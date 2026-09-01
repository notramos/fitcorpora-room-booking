import { Pool, type PoolClient } from "pg";
import crypto from "crypto";
import { notifyPendingApproval } from "./teamsNotify";
import { createCalendarEvent, deleteCalendarEvent } from "./graphCalendar";
import {
  BUSINESS_END,
  BUSINESS_HOURS_LABEL,
  BUSINESS_START,
  nowMinutesInAppTimezone,
  overlaps,
  todayStr,
  toMinutes,
} from "./timeSlots";
import type { Booking, CreateBookingInput, CreateRoomInput, Room } from "./types";

// PostgreSQL replaces the old Google Sheets store. One pooled connection per
// process; in dev the pool is stashed on globalThis so Next's hot reload
// doesn't leak a new pool on every edit.
const globalForPool = globalThis as unknown as { __roomBookingPool?: Pool };

function getPool(): Pool {
  if (globalForPool.__roomBookingPool) return globalForPool.__roomBookingPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL tidak diset — lihat README bagian Setup PostgreSQL.");
  }

  const pool = new Pool({
    connectionString,
    // Managed Postgres (Neon, Supabase, RDS, …) usually needs TLS but with a
    // cert chain node doesn't ship. Set DATABASE_SSL=true to opt in without
    // pinning a CA. Leave unset for a local/docker Postgres on a trusted net.
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  globalForPool.__roomBookingPool = pool;
  return pool;
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

// Runs the schema DDL once per process. CREATE ... IF NOT EXISTS is
// idempotent, and the advisory lock keeps two concurrent instances from
// racing on the initial seed. Memoized so it's a no-op await after the
// first call.
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS rooms (
          -- text, not uuid: ids carried over from the old Google Sheets
          -- store are plain strings ("1", "2", …), and new ids are
          -- crypto.randomUUID() strings — both are valid text.
          id                text PRIMARY KEY,
          name              text    NOT NULL,
          location          text    NOT NULL DEFAULT '',
          capacity          integer NOT NULL DEFAULT 0,
          requires_approval boolean NOT NULL DEFAULT false,
          facilities        text[]  NOT NULL DEFAULT '{}',
          images            text[]  NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS bookings (
          id             text PRIMARY KEY,
          room_id        text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          date           text NOT NULL,
          start_time     text NOT NULL,
          end_time       text NOT NULL,
          purpose        text NOT NULL DEFAULT '',
          booker_name    text NOT NULL DEFAULT '',
          booker_email   text NOT NULL DEFAULT '',
          created_at     text NOT NULL,
          status         text NOT NULL DEFAULT 'approved',
          reminder_sent  boolean NOT NULL DEFAULT false,
          is_overtime    boolean NOT NULL DEFAULT false,
          overtime_note  text NOT NULL DEFAULT '',
          graph_event_id text
        );

        CREATE INDEX IF NOT EXISTS bookings_room_date_idx
          ON bookings (room_id, date);
      `);

      await client.query("BEGIN");
      // 4242 is an arbitrary constant key — any concurrent instance calling
      // ensureSchema() blocks here until the first one finishes seeding.
      await client.query("SELECT pg_advisory_xact_lock(4242)");
      const { rows } = await client.query<{ count: string }>(
        "SELECT count(*)::int AS count FROM rooms"
      );
      if (Number(rows[0].count) === 0) {
        for (const r of SEED_ROOMS) {
          await client.query(
            `INSERT INTO rooms (id, name, location, capacity, requires_approval, facilities, images)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [r.id, r.name, r.location, r.capacity, r.requiresApproval, r.facilities, r.images]
          );
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      // Let the next call retry rather than caching a failed bootstrap.
      schemaReady = null;
      throw err;
    } finally {
      client.release();
    }
  })();
  return schemaReady;
}

// Serializes mutating operations within this Node process, same intent as
// the old Sheets store. Unlike Sheets, Postgres also gives us real
// cross-instance safety: createBooking / updateBooking take a per-room
// advisory lock inside their transaction, so two serverless instances
// can't both slip a conflicting booking past the overlap check.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const result = queue.then(fn, fn) as Promise<T>;
  queue = result.catch(() => undefined);
  return result;
}

async function query<R>(text: string, params: unknown[] = []): Promise<R[]> {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return res.rows as R[];
}

type RoomRow = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  requires_approval: boolean;
  facilities: string[];
  images: string[];
};

type BookingRow = {
  id: string;
  room_id: string;
  date: string;
  start_time: string;
  end_time: string;
  purpose: string;
  booker_name: string;
  booker_email: string;
  created_at: string;
  status: string;
  reminder_sent: boolean;
  is_overtime: boolean;
  overtime_note: string;
  graph_event_id: string | null;
};

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    capacity: Number(row.capacity) || 0,
    requiresApproval: row.requires_approval,
    facilities: row.facilities ?? [],
    images: row.images ?? [],
  };
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    purpose: row.purpose,
    bookerName: row.booker_name,
    bookerEmail: row.booker_email,
    createdAt: row.created_at,
    status: row.status === "pending" ? "pending" : "approved",
    reminderSent: row.reminder_sent,
    isOvertime: row.is_overtime,
    overtimeNote: row.overtime_note,
    graphEventId: row.graph_event_id || undefined,
  };
}

const ROOM_COLS =
  "id, name, location, capacity, requires_approval, facilities, images";
const BOOKING_COLS =
  "id, room_id, date, start_time, end_time, purpose, booker_name, booker_email, created_at, status, reminder_sent, is_overtime, overtime_note, graph_event_id";

export async function getRooms(): Promise<Room[]> {
  const rows = await query<RoomRow>(
    `SELECT ${ROOM_COLS} FROM rooms ORDER BY name`
  );
  return rows.map(toRoom);
}

export async function getRoomById(id: string): Promise<Room | undefined> {
  const rows = await query<RoomRow>(
    `SELECT ${ROOM_COLS} FROM rooms WHERE id = $1`,
    [id]
  );
  return rows[0] ? toRoom(rows[0]) : undefined;
}

export async function getBookings(filter?: {
  roomId?: string;
  date?: string;
  // Inclusive "YYYY-MM-DD" range. The date column is text in ISO order, so
  // lexical >=/<= is chronological. Combine with `date` at your own risk —
  // they'd just AND together.
  dateFrom?: string;
  dateTo?: string;
  status?: Booking["status"];
}): Promise<Booking[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.roomId) {
    params.push(filter.roomId);
    clauses.push(`room_id = $${params.length}`);
  }
  if (filter?.date) {
    params.push(filter.date);
    clauses.push(`date = $${params.length}`);
  }
  if (filter?.dateFrom) {
    params.push(filter.dateFrom);
    clauses.push(`date >= $${params.length}`);
  }
  if (filter?.dateTo) {
    params.push(filter.dateTo);
    clauses.push(`date <= $${params.length}`);
  }
  if (filter?.status) {
    params.push(filter.status);
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query<BookingRow>(
    `SELECT ${BOOKING_COLS} FROM bookings ${where}
     ORDER BY date, start_time`,
    params
  );
  return rows.map(toBooking);
}

export async function getBookingById(id: string): Promise<Booking | undefined> {
  const rows = await query<BookingRow>(
    `SELECT ${BOOKING_COLS} FROM bookings WHERE id = $1`,
    [id]
  );
  return rows[0] ? toBooking(rows[0]) : undefined;
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
    const rows = await query<{ id: string }>(
      `UPDATE bookings SET reminder_sent = true WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows.length > 0;
  });
}

// Admin escape hatch: clear the "reminder already sent" flag so the next
// cron run will DM the booker again. Previously this needed opening the
// spreadsheet and blanking column K by hand — now it's a button on the
// /admin/bookings dashboard.
export function resetReminderSent(id: string): Promise<boolean> {
  return withLock(async () => {
    const rows = await query<{ id: string }>(
      `UPDATE bookings SET reminder_sent = false WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows.length > 0;
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

// A stable bigint key for pg_advisory_xact_lock, derived from the room id.
async function lockRoom(client: PoolClient, roomId: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    roomId,
  ]);
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

    const isOutsideBusinessHours =
      toMinutes(input.startTime) < toMinutes(BUSINESS_START) ||
      toMinutes(input.endTime) > toMinutes(BUSINESS_END);

    if (isOutsideBusinessHours && !input.isOvertime) {
      throw new Error(
        `Booking hanya bisa dilakukan pukul ${BUSINESS_HOURS_LABEL}. Untuk jam di luar itu, ajukan sebagai overtime.`
      );
    }
    if (input.isOvertime && !input.purpose.trim()) {
      throw new Error("Keperluan wajib diisi untuk pengajuan overtime.");
    }

    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await lockRoom(client, input.roomId);

      const roomRows = await client.query<RoomRow>(
        `SELECT ${ROOM_COLS} FROM rooms WHERE id = $1`,
        [input.roomId]
      );
      const room = roomRows.rows[0] ? toRoom(roomRows.rows[0]) : undefined;
      if (!room) {
        throw new Error("Ruangan tidak ditemukan.");
      }

      const sameDay = (
        await client.query<BookingRow>(
          `SELECT ${BOOKING_COLS} FROM bookings WHERE room_id = $1 AND date = $2`,
          [input.roomId, input.date]
        )
      ).rows.map(toBooking);

      // Both approved and pending bookings hold the slot — a pending request
      // still blocks double-booking while it waits on the approver.
      const conflict = sameDay.find((b) =>
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
        // Overtime always needs sign-off, regardless of the room's own
        // requiresApproval setting — after-hours access is a building-wide
        // concern (lights shut off at 18:00), not a per-room one.
        status:
          room.requiresApproval || input.isOvertime ? "pending" : "approved",
        reminderSent: false,
      };

      // Rooms that don't require approval are confirmed immediately, so send
      // the Teams/Outlook calendar invite right away. A failed Graph call
      // shouldn't block the booking itself — it just means no invite went
      // out, same tradeoff as the Teams notification below.
      if (booking.status === "approved") {
        booking.graphEventId = await createCalendarEvent(booking, room).catch(
          () => undefined
        );
      }

      await client.query(
        `INSERT INTO bookings (${BOOKING_COLS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          booking.id,
          booking.roomId,
          booking.date,
          booking.startTime,
          booking.endTime,
          booking.purpose,
          booking.bookerName,
          booking.bookerEmail,
          booking.createdAt,
          booking.status,
          booking.reminderSent,
          booking.isOvertime,
          booking.overtimeNote,
          booking.graphEventId ?? null,
        ]
      );

      await client.query("COMMIT");

      if (booking.status === "pending") {
        // Fire-and-forget: an undelivered Teams notification shouldn't fail
        // the booking itself — the approval queue page is the source of truth.
        notifyPendingApproval(booking, room).catch(() => undefined);
      }

      return booking;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });
}

// Lets the booker (or an admin) change date/time/purpose on an existing
// booking. Ownership is enforced by the caller (the API route) — this
// function just does the write. Re-validates against the same rules as
// createBooking (past date, start<end, business hours/overtime, conflicts),
// excluding the booking's own row from the conflict check so it doesn't
// collide with itself.
export function updateBooking(
  id: string,
  input: { date: string; startTime: string; endTime: string; purpose: string }
): Promise<Booking> {
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

    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      const existingRows = await client.query<BookingRow>(
        `SELECT ${BOOKING_COLS} FROM bookings WHERE id = $1`,
        [id]
      );
      if (!existingRows.rows[0]) {
        throw new Error("Booking tidak ditemukan.");
      }
      const existingBooking = toBooking(existingRows.rows[0]);

      await lockRoom(client, existingBooking.roomId);

      const isOutsideBusinessHours =
        toMinutes(input.startTime) < toMinutes(BUSINESS_START) ||
        toMinutes(input.endTime) > toMinutes(BUSINESS_END);
      if (isOutsideBusinessHours && !existingBooking.isOvertime) {
        throw new Error(
          `Booking hanya bisa dilakukan pukul ${BUSINESS_HOURS_LABEL}. Untuk jam di luar itu, ajukan sebagai overtime.`
        );
      }

      const sameDay = (
        await client.query<BookingRow>(
          `SELECT ${BOOKING_COLS} FROM bookings WHERE room_id = $1 AND date = $2 AND id <> $3`,
          [existingBooking.roomId, input.date, id]
        )
      ).rows.map(toBooking);
      const conflict = sameDay.find((b) =>
        overlaps(input.startTime, input.endTime, b.startTime, b.endTime)
      );
      if (conflict) {
        throw new BookingConflictError(
          `Ruangan sudah dipakai oleh ${conflict.bookerName} pukul ${conflict.startTime}-${conflict.endTime}.`,
          conflict
        );
      }

      const updated: Booking = {
        ...existingBooking,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        purpose: input.purpose,
      };

      // Keep an existing calendar invite in sync: drop the stale one and
      // create a fresh one at the new time. Best-effort, same tradeoff as
      // elsewhere — a failed Graph call shouldn't block saving the edit.
      if (updated.status === "approved" && updated.graphEventId) {
        await deleteCalendarEvent(
          updated.bookerEmail,
          updated.graphEventId
        ).catch(() => undefined);
        const roomRows = await client.query<RoomRow>(
          `SELECT ${ROOM_COLS} FROM rooms WHERE id = $1`,
          [updated.roomId]
        );
        const room = roomRows.rows[0] ? toRoom(roomRows.rows[0]) : undefined;
        updated.graphEventId = room
          ? await createCalendarEvent(updated, room).catch(() => undefined)
          : undefined;
      }

      await client.query(
        `UPDATE bookings
         SET date = $2, start_time = $3, end_time = $4, purpose = $5, graph_event_id = $6
         WHERE id = $1`,
        [
          id,
          updated.date,
          updated.startTime,
          updated.endTime,
          updated.purpose,
          updated.graphEventId ?? null,
        ]
      );

      await client.query("COMMIT");
      return updated;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });
}

// Approving/rejecting only apply to bookings still "pending". Rejecting
// simply removes the row — there's no separate "rejected" status to track,
// since a rejected slot should just become free again.
export function approveBooking(id: string): Promise<boolean> {
  return withLock(async () => {
    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const rows = await client.query<BookingRow>(
        `SELECT ${BOOKING_COLS} FROM bookings WHERE id = $1`,
        [id]
      );
      if (!rows.rows[0]) {
        await client.query("ROLLBACK");
        return false;
      }
      const booking = toBooking(rows.rows[0]);
      const roomRows = await client.query<RoomRow>(
        `SELECT ${ROOM_COLS} FROM rooms WHERE id = $1`,
        [booking.roomId]
      );
      const room = roomRows.rows[0] ? toRoom(roomRows.rows[0]) : undefined;

      // Same fire-and-forget tradeoff as createBooking: a failed Graph call
      // shouldn't block the approval itself.
      const graphEventId = room
        ? await createCalendarEvent(booking, room).catch(() => undefined)
        : undefined;

      await client.query(
        `UPDATE bookings SET status = 'approved', graph_event_id = $2 WHERE id = $1`,
        [id, graphEventId ?? booking.graphEventId ?? null]
      );
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });
}

export function createRoom(input: CreateRoomInput): Promise<Room> {
  return withLock(async () => {
    const room: Room = { ...input, id: crypto.randomUUID() };
    await query(
      `INSERT INTO rooms (id, name, location, capacity, requires_approval, facilities, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        room.id,
        room.name,
        room.location,
        room.capacity,
        room.requiresApproval,
        room.facilities,
        room.images,
      ]
    );
    return room;
  });
}

export function updateRoom(
  id: string,
  input: CreateRoomInput
): Promise<Room | null> {
  return withLock(async () => {
    const rows = await query<{ id: string }>(
      `UPDATE rooms
       SET name = $2, location = $3, capacity = $4, requires_approval = $5, facilities = $6, images = $7
       WHERE id = $1
       RETURNING id`,
      [
        id,
        input.name,
        input.location,
        input.capacity,
        input.requiresApproval,
        input.facilities,
        input.images,
      ]
    );
    if (rows.length === 0) return null;
    return { ...input, id };
  });
}

export function deleteRoom(id: string): Promise<boolean> {
  return withLock(async () => {
    // ON DELETE CASCADE clears this room's bookings along with it — the old
    // Sheets store left them orphaned instead, but a foreign key can't.
    const rows = await query<{ id: string }>(
      `DELETE FROM rooms WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows.length > 0;
  });
}

export function rejectBooking(id: string): Promise<boolean> {
  return deleteBooking(id);
}

export function deleteBooking(id: string): Promise<boolean> {
  return withLock(async () => {
    const rows = await query<BookingRow>(
      `SELECT ${BOOKING_COLS} FROM bookings WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return false;

    const booking = toBooking(rows[0]);
    if (booking.graphEventId) {
      // Same fire-and-forget tradeoff as elsewhere: a failed cancellation
      // shouldn't block freeing up the slot.
      await deleteCalendarEvent(booking.bookerEmail, booking.graphEventId).catch(
        () => undefined
      );
    }

    const deleted = await query<{ id: string }>(
      `DELETE FROM bookings WHERE id = $1 RETURNING id`,
      [id]
    );
    return deleted.length > 0;
  });
}
