// One-time migration: copy the existing Google Sheets data into PostgreSQL,
// preserving every row id so kiosk /display/[id] links and pending
// approvals survive the switch.
//
// Run it once, from a checkout that has BOTH sets of env vars available
// (the old Sheets credentials + the new DATABASE_URL):
//
//   npm ci   # needs `googleapis` (devDependency) and `pg`
//   GOOGLE_SERVICE_ACCOUNT_EMAIL=... \
//   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   GOOGLE_SHEET_ID=... \
//   DATABASE_URL=postgres://user:pass@host:5432/db \
//   DATABASE_SSL=true \
//   node scripts/migrate-sheets-to-postgres.mjs
//
// Safe to re-run: rows are inserted with ON CONFLICT (id) DO NOTHING, so a
// second pass only fills in what's missing and never overwrites data the
// live app has already written.

import { google } from "googleapis";
import { Pool } from "pg";

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEET_ID,
  DATABASE_URL,
  DATABASE_SSL,
} = process.env;

for (const [k, v] of Object.entries({
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEET_ID,
  DATABASE_URL,
})) {
  if (!v) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const splitList = (raw) =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const isTrue = (v) => (v ?? "").trim().toUpperCase() === "TRUE";

function toRoom(row) {
  return {
    id: row[0] ?? "",
    name: row[1] ?? "",
    location: row[2] ?? "",
    capacity: Number(row[3]) || 0,
    requiresApproval: isTrue(row[4]),
    facilities: splitList(row[5]),
    images: splitList(row[6]),
  };
}

function toBooking(row) {
  return {
    id: row[0] ?? "",
    roomId: row[1] ?? "",
    date: row[2] ?? "",
    startTime: row[3] ?? "",
    endTime: row[4] ?? "",
    purpose: row[5] ?? "",
    bookerName: row[6] ?? "",
    bookerEmail: row[7] ?? "",
    createdAt: row[8] ?? new Date().toISOString(),
    status: row[9] === "pending" ? "pending" : "approved",
    reminderSent: isTrue(row[10]),
    isOvertime: isTrue(row[11]),
    overtimeNote: row[12] ?? "",
    graphEventId: row[13] || null,
  };
}

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS rooms (
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
  CREATE INDEX IF NOT EXISTS bookings_room_date_idx ON bookings (room_id, date);
`;

async function readSheet() {
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [roomsRes, bookingsRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "Rooms!A:G",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "Bookings!A:N",
    }),
  ]);

  const rooms = (roomsRes.data.values ?? []).slice(1).map(toRoom).filter((r) => r.id);
  const bookings = (bookingsRes.data.values ?? [])
    .slice(1)
    .map(toBooking)
    .filter((b) => b.id);
  return { rooms, bookings };
}

async function main() {
  const { rooms, bookings } = await readSheet();
  console.log(`Read from sheet: ${rooms.length} rooms, ${bookings.length} bookings`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_DDL);
    await client.query("BEGIN");

    let roomsInserted = 0;
    for (const r of rooms) {
      const res = await client.query(
        `INSERT INTO rooms (id, name, location, capacity, requires_approval, facilities, images)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.name, r.location, r.capacity, r.requiresApproval, r.facilities, r.images]
      );
      roomsInserted += res.rowCount ?? 0;
    }

    const roomIds = new Set(rooms.map((r) => r.id));
    const orphans = bookings.filter((b) => !roomIds.has(b.roomId));
    if (orphans.length) {
      console.warn(
        `Skipping ${orphans.length} booking(s) whose roomId has no matching room:`,
        orphans.map((b) => b.id)
      );
    }

    let bookingsInserted = 0;
    for (const b of bookings.filter((b) => roomIds.has(b.roomId))) {
      const res = await client.query(
        `INSERT INTO bookings
           (id, room_id, date, start_time, end_time, purpose, booker_name, booker_email,
            created_at, status, reminder_sent, is_overtime, overtime_note, graph_event_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO NOTHING`,
        [
          b.id, b.roomId, b.date, b.startTime, b.endTime, b.purpose, b.bookerName,
          b.bookerEmail, b.createdAt, b.status, b.reminderSent, b.isOvertime,
          b.overtimeNote, b.graphEventId,
        ]
      );
      bookingsInserted += res.rowCount ?? 0;
    }

    await client.query("COMMIT");
    console.log(
      `Inserted ${roomsInserted} new room(s), ${bookingsInserted} new booking(s). ` +
        `Existing rows with the same id were left untouched.`
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
