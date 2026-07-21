import { google, sheets_v4 } from "googleapis";
import crypto from "crypto";
import type { Booking, CreateBookingInput, Room } from "./types";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const ROOMS_RANGE = "Rooms!A:D";
const BOOKINGS_RANGE = "Bookings!A:I";
const BOOKINGS_SHEET_NAME = "Bookings";

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export class BookingConflictError extends Error {
  conflict: Booking;
  constructor(message: string, conflict: Booking) {
    super(message);
    this.name = "BookingConflictError";
    this.conflict = conflict;
  }
}

const SEED_ROOMS: Room[] = [
  { id: crypto.randomUUID(), name: "Ruang Rapat A", location: "Lantai 1", capacity: 10 },
  { id: crypto.randomUUID(), name: "Ruang Rapat B", location: "Lantai 2", capacity: 6 },
  { id: crypto.randomUUID(), name: "Aula Serbaguna", location: "Lantai 3", capacity: 50 },
];

// Serializes all mutating operations within this Node process so two
// near-simultaneous bookings can't both read stale state before either
// writes. This does NOT protect against multiple concurrent serverless
// instances (e.g. on Vercel) — only against races within a single warm
// instance/process. Google Sheets itself has no row-level locking either,
// so this is a best-effort mitigation, not a hard guarantee at scale.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const result = queue.then(fn, fn) as Promise<T>;
  queue = result.catch(() => undefined);
  return result;
}

function toRoom(row: string[]): Room {
  return {
    id: row[0] ?? "",
    name: row[1] ?? "",
    location: row[2] ?? "",
    capacity: Number(row[3]) || 0,
  };
}

function toBooking(row: string[]): Booking {
  return {
    id: row[0] ?? "",
    roomId: row[1] ?? "",
    date: row[2] ?? "",
    startTime: row[3] ?? "",
    endTime: row[4] ?? "",
    purpose: row[5] ?? "",
    bookerName: row[6] ?? "",
    bookerEmail: row[7] ?? "",
    createdAt: row[8] ?? "",
  };
}

function bookingToRow(b: Booking): string[] {
  return [
    b.id,
    b.roomId,
    b.date,
    b.startTime,
    b.endTime,
    b.purpose,
    b.bookerName,
    b.bookerEmail,
    b.createdAt,
  ];
}

async function ensureRoomsSeeded(): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Rooms!A2:D",
  });
  if (res.data.values && res.data.values.length > 0) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: ROOMS_RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: SEED_ROOMS.map((r) => [r.id, r.name, r.location, String(r.capacity)]),
    },
  });
}

// The numeric tab ("sheetId") for the Bookings tab, distinct from
// GOOGLE_SHEET_ID (the spreadsheet ID). Needed for row-deletion via
// batchUpdate. Cached after first lookup since it never changes.
let bookingsTabId: number | null = null;

async function getBookingsTabId(): Promise<number> {
  if (bookingsTabId !== null) return bookingsTabId;

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });

  const tab = res.data.sheets?.find(
    (s) => s.properties?.title === BOOKINGS_SHEET_NAME
  );
  if (!tab?.properties?.sheetId && tab?.properties?.sheetId !== 0) {
    throw new Error(`Tab "${BOOKINGS_SHEET_NAME}" tidak ditemukan di spreadsheet.`);
  }

  bookingsTabId = tab.properties.sheetId;
  return bookingsTabId;
}

export async function getRooms(): Promise<Room[]> {
  await ensureRoomsSeeded();
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: ROOMS_RANGE,
  });
  const rows = res.data.values ?? [];
  return rows.slice(1).map((row) => toRoom(row as string[]));
}

export async function getRoomById(id: string): Promise<Room | undefined> {
  const rooms = await getRooms();
  return rooms.find((r) => r.id === id);
}

export async function getBookings(filter?: {
  roomId?: string;
  date?: string;
}): Promise<Booking[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: BOOKINGS_RANGE,
  });
  const rows = res.data.values ?? [];
  let bookings = rows.slice(1).map((row) => toBooking(row as string[]));

  if (filter?.roomId) {
    bookings = bookings.filter((b) => b.roomId === filter.roomId);
  }
  if (filter?.date) {
    bookings = bookings.filter((b) => b.date === filter.date);
  }
  return bookings;
}

export async function getBookingsForRoom(
  roomId: string,
  date: string
): Promise<Booking[]> {
  return getBookings({ roomId, date });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return withLock(async () => {
    if (input.date < todayStr()) {
      throw new Error("Tidak bisa booking untuk tanggal yang sudah lewat.");
    }

    if (input.date === todayStr()) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (toMinutes(input.endTime) <= nowMinutes) {
        throw new Error("Jam ini sudah lewat untuk hari ini.");
      }
    }

    if (toMinutes(input.startTime) >= toMinutes(input.endTime)) {
      throw new Error("Jam mulai harus lebih awal dari jam selesai.");
    }

    const sheets = getSheetsClient();
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: BOOKINGS_RANGE,
    });
    const existing = (existingRes.data.values ?? [])
      .slice(1)
      .map((row) => toBooking(row as string[]));

    const conflict = existing.find(
      (b) =>
        b.roomId === input.roomId &&
        b.date === input.date &&
        overlaps(input.startTime, input.endTime, b.startTime, b.endTime)
    );
    if (conflict) {
      throw new BookingConflictError(
        `Ruangan sudah dipakai oleh ${conflict.bookerName} pukul ${conflict.startTime}-${conflict.endTime}.`,
        conflict
      );
    }

    const booking: Booking = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: BOOKINGS_RANGE,
      valueInputOption: "RAW",
      requestBody: { values: [bookingToRow(booking)] },
    });

    return booking;
  });
}

export function deleteBooking(id: string): Promise<boolean> {
  return withLock(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: BOOKINGS_RANGE,
    });
    const rows = res.data.values ?? [];
    // rows[0] is the header; data rows start at rows[1].
    const rowIndex = rows.slice(1).findIndex((row) => row[0] === id);
    if (rowIndex === -1) return false;

    const sheetRowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexing
    const tabId = await getBookingsTabId();

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: tabId,
                dimension: "ROWS",
                startIndex: sheetRowNumber - 1,
                endIndex: sheetRowNumber,
              },
            },
          },
        ],
      },
    });

    return true;
  });
}
