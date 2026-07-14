import type { Booking } from "./types";

export interface RoomStatus {
  status: "Tersedia" | "Sedang Dipakai";
  currentBooking: Booking | null;
  nextBooking: Booking | null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function computeStatus(bookings: Booking[], now: Date): RoomStatus {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = [...bookings].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );

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
