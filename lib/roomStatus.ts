import { nowMinutesInAppTimezone, toMinutes } from "./timeSlots";
import type { Booking } from "./types";

export interface RoomStatus {
  status: "Tersedia" | "Sedang Dipakai";
  currentBooking: Booking | null;
  nextBooking: Booking | null;
}

export function computeStatus(bookings: Booking[], now: Date): RoomStatus {
  const nowMinutes = nowMinutesInAppTimezone(now);

  // A booking still awaiting approval doesn't actually occupy the room —
  // only approved bookings count toward "Sedang Dipakai" / next-up status.
  const sorted = bookings
    .filter((b) => b.status === "approved")
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const currentBooking =
    sorted.find(
      (b) => toMinutes(b.startTime) <= nowMinutes && nowMinutes < toMinutes(b.endTime)
    ) ?? null;

  if (currentBooking) {
    return { status: "Sedang Dipakai", currentBooking, nextBooking: null };
  }

  const nextBooking =
    sorted.find((b) => toMinutes(b.startTime) > nowMinutes) ?? null;

  return { status: "Tersedia", currentBooking: null, nextBooking };
}
