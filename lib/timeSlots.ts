import type { Booking } from "./types";

// Business hours for hourly slot pickers (07:00 – 21:00).
export const START_HOUR = 7;
export const END_HOUR = 21;

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
