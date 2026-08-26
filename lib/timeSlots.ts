import type { Booking } from "./types";

// Business/operating hours — the building's lights shut off at 18:00, so
// normal bookings are confined to 08:00–18:00. A request outside this
// window isn't rejected outright; it's routed through the overtime flow
// instead (see BUSINESS_START/BUSINESS_END below and lib/sheetsDb.ts's
// createBooking).
export const START_HOUR = 8;
export const END_HOUR = 18;
export const BUSINESS_START = hh(START_HOUR);
export const BUSINESS_END = hh(END_HOUR);
export const BUSINESS_HOURS_LABEL = `${BUSINESS_START}–${BUSINESS_END}`;

// The office's real timezone. "Today" and "now" for booking validation are
// always pinned to this, rather than the ambient timezone of whatever
// machine happens to run the code — the Next.js server may run in UTC (e.g.
// on Vercel) while the office/browsers are WIB (UTC+7), and without pinning
// this, a booking made for "today" between 00:00–06:59 WIB could be
// computed as "yesterday" server-side and get wrongly rejected as past.
export const APP_TIMEZONE = "Asia/Jakarta";

// "YYYY-MM-DD" for the given instant, in the office's timezone — use this
// instead of `new Date().toISOString().slice(0, 10)` (which is UTC) or
// `date.toLocaleDateString()` (which is the ambient/browser timezone)
// anywhere a booking's `date` field is compared or generated.
export function todayStr(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the sheet's date format.
  return date.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}

// Minutes since midnight, in the office's timezone — pair with `toMinutes`
// for "is this slot past" checks so it agrees with `todayStr` above.
export function nowMinutesInAppTimezone(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hh(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return (
    toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
  );
}

export interface HourSlot {
  start: string;
  end: string;
  booking: Booking | null;
}

// Hourly slots for the business-hours window, each annotated with the
// booking that occupies it (if any).
export function getHourSlots(bookings: Booking[]): HourSlot[] {
  const result: HourSlot[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const start = hh(h);
    const end = hh(h + 1);
    const booking =
      bookings.find((b) => overlaps(start, end, b.startTime, b.endTime)) ??
      null;
    result.push({ start, end, booking });
  }
  return result;
}
