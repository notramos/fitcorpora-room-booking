import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as XLSX from "xlsx";
import type { Booking, CreateBookingInput, Room } from "./types";

const DB_PATH = process.env.EXCEL_DB_PATH
  ? path.resolve(process.cwd(), process.env.EXCEL_DB_PATH)
  : path.join(process.cwd(), "data", "database.xlsx");

const ROOMS_SHEET = "Rooms";
const BOOKINGS_SHEET = "Bookings";
const BOOKING_HEADERS: (keyof Booking)[] = [
  "id",
  "roomId",
  "date",
  "startTime",
  "endTime",
  "purpose",
  "bookerName",
  "bookerEmail",
  "createdAt",
];

export class BookingConflictError extends Error {
  conflict: Booking;
  constructor(message: string, conflict: Booking) {
    super(message);
    this.name = "BookingConflictError";
    this.conflict = conflict;
  }
}

const SEED_ROOMS: Room[] = [
  {
    id: crypto.randomUUID(),
    name: "Ruang Rapat A",
    location: "Lantai 1",
    capacity: 10,
  },
  {
    id: crypto.randomUUID(),
    name: "Ruang Rapat B",
    location: "Lantai 2",
    capacity: 6,
  },
  {
    id: crypto.randomUUID(),
    name: "Aula Serbaguna",
    location: "Lantai 3",
    capacity: 50,
  },
];

// Serializes all mutating operations within this Node process so two
// near-simultaneous bookings can't both read stale state before either
// writes. This does NOT protect against multiple server instances/processes
// sharing the same file — only against races within a single process.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const result = queue.then(fn, fn) as Promise<T>;
  // Swallow rejection on the shared chain so one failed op doesn't
  // permanently poison the queue for subsequent operations.
  queue = result.catch(() => undefined);
  return result;
}

function ensureDbInitialized(): void {
  if (fs.existsSync(DB_PATH)) return;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const wb = XLSX.utils.book_new();
  const roomsSheet = XLSX.utils.json_to_sheet(SEED_ROOMS);
  XLSX.utils.book_append_sheet(wb, roomsSheet, ROOMS_SHEET);

  const bookingsSheet = XLSX.utils.aoa_to_sheet([BOOKING_HEADERS]);
  XLSX.utils.book_append_sheet(wb, bookingsSheet, BOOKINGS_SHEET);

  writeWorkbook(wb);
}

// Windows can transiently hold a file lock right after a write (e.g. AV/
// indexer scanning the new file), causing the very next read/write to fail
// with EBUSY/EPERM. Retry a few times with a short synchronous backoff
// before giving up.
function withRetry<T>(fn: () => T): T {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      return fn();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= MAX_ATTEMPTS || (code !== "EBUSY" && code !== "EPERM")) {
        throw err;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
    }
  }
}

// Read/write via explicit fs + buffers rather than XLSX.readFile/writeFile —
// those rely on the library's own runtime fs-detection, which does not
// resolve reliably once bundled by Next.js/Turbopack.
function readWorkbook(): XLSX.WorkBook {
  ensureDbInitialized();
  const buffer = withRetry(() => fs.readFileSync(DB_PATH));
  return XLSX.read(buffer, { type: "buffer" });
}

function writeWorkbook(wb: XLSX.WorkBook): void {
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  withRetry(() => fs.writeFileSync(DB_PATH, buffer));
}

// SheetJS can return cell values as non-plain types (e.g. a date-typed cell
// becomes a JS `Date`, which has methods). Those can't be passed from a Server
// Component to a Client Component, so every row is normalized to a plain object
// with explicitly-typed primitive fields on read.
function asString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toRoom(r: Record<string, unknown>): Room {
  return {
    id: asString(r.id),
    name: asString(r.name),
    location: asString(r.location),
    capacity: Number(r.capacity) || 0,
  };
}

function toBooking(r: Record<string, unknown>): Booking {
  return {
    id: asString(r.id),
    roomId: asString(r.roomId),
    date: asString(r.date),
    startTime: asString(r.startTime),
    endTime: asString(r.endTime),
    purpose: asString(r.purpose),
    bookerName: asString(r.bookerName),
    bookerEmail: asString(r.bookerEmail),
    createdAt: asString(r.createdAt),
  };
}

export function getRooms(): Room[] {
  const wb = readWorkbook();
  const sheet = wb.Sheets[ROOMS_SHEET];
  if (!sheet) return [];
  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(sheet)
    .map(toRoom);
}

export function getRoomById(id: string): Room | undefined {
  return getRooms().find((r) => r.id === id);
}

export function getBookings(filter?: {
  roomId?: string;
  date?: string;
}): Booking[] {
  const wb = readWorkbook();
  const sheet = wb.Sheets[BOOKINGS_SHEET];
  if (!sheet) return [];
  let bookings = XLSX.utils
    .sheet_to_json<Record<string, unknown>>(sheet)
    .map(toBooking);
  if (filter?.roomId) {
    bookings = bookings.filter((b) => b.roomId === filter.roomId);
  }
  if (filter?.date) {
    bookings = bookings.filter((b) => b.date === filter.date);
  }
  return bookings;
}

export function getBookingsForRoom(roomId: string, date: string): Booking[] {
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

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return withLock(() => {
    if (toMinutes(input.startTime) >= toMinutes(input.endTime)) {
      throw new Error("Jam mulai harus lebih awal dari jam selesai.");
    }

    const wb = readWorkbook();
    const sheet = wb.Sheets[BOOKINGS_SHEET];
    const existing = sheet
      ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).map(toBooking)
      : [];

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

    const updated = [...existing, booking];
    const newSheet = XLSX.utils.json_to_sheet(updated, {
      header: BOOKING_HEADERS as string[],
    });
    wb.Sheets[BOOKINGS_SHEET] = newSheet;
    writeWorkbook(wb);

    return booking;
  });
}

export function deleteBooking(id: string): Promise<boolean> {
  return withLock(() => {
    const wb = readWorkbook();
    const sheet = wb.Sheets[BOOKINGS_SHEET];
    const existing = sheet
      ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).map(toBooking)
      : [];

    const remaining = existing.filter((b) => b.id !== id);
    if (remaining.length === existing.length) {
      return false;
    }

    const newSheet = XLSX.utils.json_to_sheet(remaining, {
      header: BOOKING_HEADERS as string[],
    });
    wb.Sheets[BOOKINGS_SHEET] = newSheet;
    writeWorkbook(wb);

    return true;
  });
}
