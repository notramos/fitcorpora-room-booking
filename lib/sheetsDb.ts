import { google, sheets_v4 } from "googleapis";
import crypto from "crypto";
import { notifyPendingApproval } from "./teamsNotify";
import { nowMinutesInAppTimezone, overlaps, todayStr, toMinutes } from "./timeSlots";
import type { Booking, CreateBookingInput, CreateRoomInput, Room } from "./types";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const ROOMS_RANGE = "Rooms!A:G";
const ROOMS_SHEET_NAME = "Rooms";
const BOOKINGS_RANGE = "Bookings!A:K";
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
  { id: crypto.randomUUID(), name: "Ruang Rapat A", location: "Lantai 1", capacity: 10, requiresApproval: false, facilities: [], images: [] },
  { id: crypto.randomUUID(), name: "Ruang Rapat B", location: "Lantai 2", capacity: 6, requiresApproval: false, facilities: [], images: [] },
  { id: crypto.randomUUID(), name: "Aula Serbaguna", location: "Lantai 3", capacity: 50, requiresApproval: false, facilities: [], images: [] },
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

function splitList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toRoom(row: string[]): Room {
  return {
    id: row[0] ?? "",
    name: row[1] ?? "",
    location: row[2] ?? "",
    capacity: Number(row[3]) || 0,
    requiresApproval: (row[4] ?? "").trim().toUpperCase() === "TRUE",
    facilities: splitList(row[5]),
    images: splitList(row[6]),
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
    status: row[9] === "pending" ? "pending" : "approved",
    reminderSent: (row[10] ?? "").trim().toUpperCase() === "TRUE",
  };
}

function roomToRow(r: Room): string[] {
  return [
    r.id,
    r.name,
    r.location,
    String(r.capacity),
    r.requiresApproval ? "TRUE" : "FALSE",
    r.facilities.join(", "),
    r.images.join(", "),
  ];
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
    b.status,
    b.reminderSent ? "TRUE" : "FALSE",
  ];
}

async function ensureRoomsSeeded(): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Rooms!A2:G",
  });
  if (res.data.values && res.data.values.length > 0) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: ROOMS_RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: SEED_ROOMS.map(roomToRow),
    },
  });
}

// The numeric tab ("sheetId") for each tab, distinct from GOOGLE_SHEET_ID
// (the spreadsheet ID). Needed for row-deletion via batchUpdate. Cached
// after first lookup since it never changes.
const tabIdCache = new Map<string, number>();

async function getTabId(sheetName: string): Promise<number> {
  const cached = tabIdCache.get(sheetName);
  if (cached !== undefined) return cached;

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });

  const tab = res.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!tab?.properties?.sheetId && tab?.properties?.sheetId !== 0) {
    throw new Error(`Tab "${sheetName}" tidak ditemukan di spreadsheet.`);
  }

  tabIdCache.set(sheetName, tab.properties.sheetId);
  return tab.properties.sheetId;
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
  status?: Booking["status"];
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
  if (filter?.status) {
    bookings = bookings.filter((b) => b.status === filter.status);
  }
  return bookings;
}

// Approved, today's bookings starting within the next `windowMinutes` that
// haven't had their "meeting starts soon" Teams DM sent yet. Meant to be
// polled by an external scheduler (see app/api/cron/reminders) — since a
// booking only leaves this list once `markReminderSent` runs, it's safe to
// call this more often than `windowMinutes` without double-sending.
export async function getBookingsDueForReminder(
  windowMinutes: number
): Promise<Booking[]> {
  const nowMinutes = nowMinutesInAppTimezone();
  const bookings = await getBookings({ date: todayStr(), status: "approved" });
  return bookings.filter((b) => {
    if (b.reminderSent || !b.bookerEmail) return false;
    const minutesUntilStart = toMinutes(b.startTime) - nowMinutes;
    return minutesUntilStart > 0 && minutesUntilStart <= windowMinutes;
  });
}

export function markReminderSent(id: string): Promise<boolean> {
  return withLock(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: BOOKINGS_RANGE,
    });
    const rows = res.data.values ?? [];
    const rowIndex = rows.slice(1).findIndex((row) => row[0] === id);
    if (rowIndex === -1) return false;

    const sheetRowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexing
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!K${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [["TRUE"]] },
    });

    return true;
  });
}

// Pending bookings across every room, for the approval queue page.
export async function getPendingBookings(): Promise<Booking[]> {
  return getBookings({ status: "pending" });
}

export async function getBookingsForRoom(
  roomId: string,
  date: string
): Promise<Booking[]> {
  return getBookings({ roomId, date });
}

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return withLock(async () => {
    if (input.date < todayStr()) {
      throw new Error("Tidak bisa booking untuk tanggal yang sudah lewat.");
    }

    if (input.date === todayStr()) {
      const nowMinutes = nowMinutesInAppTimezone();
      if (toMinutes(input.endTime) <= nowMinutes) {
        throw new Error("Jam ini sudah lewat untuk hari ini.");
      }
    }

    if (toMinutes(input.startTime) >= toMinutes(input.endTime)) {
      throw new Error("Jam mulai harus lebih awal dari jam selesai.");
    }

    const room = await getRoomById(input.roomId);
    if (!room) {
      throw new Error("Ruangan tidak ditemukan.");
    }

    const sheets = getSheetsClient();
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: BOOKINGS_RANGE,
    });
    const existing = (existingRes.data.values ?? [])
      .slice(1)
      .map((row) => toBooking(row as string[]));

    // Both approved and pending bookings hold the slot — a pending request
    // still blocks double-booking while it waits on the approver.
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
      status: room.requiresApproval ? "pending" : "approved",
      reminderSent: false,
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: BOOKINGS_RANGE,
      valueInputOption: "RAW",
      requestBody: { values: [bookingToRow(booking)] },
    });

    if (booking.status === "pending") {
      // Fire-and-forget: an undelivered Teams notification shouldn't fail
      // the booking itself — the approval queue page is the source of truth.
      notifyPendingApproval(booking, room).catch(() => undefined);
    }

    return booking;
  });
}

// Approving/rejecting only apply to bookings still "pending". Rejecting
// simply removes the row — there's no separate "rejected" status to track,
// since a rejected slot should just become free again.
export function approveBooking(id: string): Promise<boolean> {
  return withLock(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: BOOKINGS_RANGE,
    });
    const rows = res.data.values ?? [];
    const rowIndex = rows.slice(1).findIndex((row) => row[0] === id);
    if (rowIndex === -1) return false;

    const sheetRowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexing
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!J${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [["approved"]] },
    });

    return true;
  });
}

export function createRoom(input: CreateRoomInput): Promise<Room> {
  return withLock(async () => {
    const room: Room = { ...input, id: crypto.randomUUID() };
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: ROOMS_RANGE,
      valueInputOption: "RAW",
      requestBody: { values: [roomToRow(room)] },
    });
    return room;
  });
}

export function updateRoom(
  id: string,
  input: CreateRoomInput
): Promise<Room | null> {
  return withLock(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: ROOMS_RANGE,
    });
    const rows = res.data.values ?? [];
    const rowIndex = rows.slice(1).findIndex((row) => row[0] === id);
    if (rowIndex === -1) return null;

    const sheetRowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexing
    const room: Room = { ...input, id };
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Rooms!A${sheetRowNumber}:G${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [roomToRow(room)] },
    });
    return room;
  });
}

export function deleteRoom(id: string): Promise<boolean> {
  return withLock(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: ROOMS_RANGE,
    });
    const rows = res.data.values ?? [];
    const rowIndex = rows.slice(1).findIndex((row) => row[0] === id);
    if (rowIndex === -1) return false;

    const sheetRowNumber = rowIndex + 2; // +1 for header, +1 for 1-indexing
    const tabId = await getTabId(ROOMS_SHEET_NAME);

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

export function rejectBooking(id: string): Promise<boolean> {
  return deleteBooking(id);
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
    const tabId = await getTabId(BOOKINGS_SHEET_NAME);

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
