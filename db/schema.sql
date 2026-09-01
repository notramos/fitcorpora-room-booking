-- Reference schema for the room-booking database.
--
-- You normally don't need to run this by hand: lib/db.ts applies the same
-- DDL automatically on first connect (CREATE TABLE IF NOT EXISTS) and seeds
-- 3 example rooms when the rooms table is empty. This file exists for
-- documentation and for setting up a database outside the app (e.g. a
-- read replica or a manual restore).

CREATE TABLE IF NOT EXISTS rooms (
  -- text, not uuid: ids migrated from the old Google Sheets store are
  -- plain strings ("1", "2", …); new ids are crypto.randomUUID() strings.
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
  date           text NOT NULL,             -- "YYYY-MM-DD" (office timezone)
  start_time     text NOT NULL,             -- "HH:mm"
  end_time       text NOT NULL,             -- "HH:mm"
  purpose        text NOT NULL DEFAULT '',
  booker_name    text NOT NULL DEFAULT '',
  booker_email   text NOT NULL DEFAULT '',
  created_at     text NOT NULL,             -- ISO 8601 timestamp
  status         text NOT NULL DEFAULT 'approved',  -- 'approved' | 'pending'
  reminder_sent  boolean NOT NULL DEFAULT false,
  is_overtime    boolean NOT NULL DEFAULT false,
  overtime_note  text NOT NULL DEFAULT '',
  graph_event_id text                       -- Microsoft Graph calendar event id
);

CREATE INDEX IF NOT EXISTS bookings_room_date_idx ON bookings (room_id, date);
