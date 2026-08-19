export interface Room {
  id: string;
  name: string;
  location: string;
  capacity: number;
  // Rooms not open to everyone — bookings need approval before they're
  // confirmed. Set per-room in the Rooms sheet (column E).
  requiresApproval: boolean;
  // Comma-separated in the sheet (column F), e.g. "Proyektor, AC, Whiteboard".
  facilities: string[];
  // Comma-separated image URLs (column G) shown as a gallery in the room
  // detail modal.
  images: string[];
}

export type CreateRoomInput = Omit<Room, "id">;

export type BookingStatus = "approved" | "pending";

export interface Booking {
  id: string;
  roomId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  purpose: string;
  bookerName: string;
  bookerEmail: string;
  createdAt: string; // ISO timestamp
  // "approved" for open rooms (default) or once an approver signs off;
  // "pending" holds the slot but isn't confirmed yet. Rejecting a pending
  // booking just deletes it — there's no separate "rejected" state to track.
  status: BookingStatus;
  // Whether the "meeting starts soon" Teams DM has already gone out —
  // prevents the reminder cron from sending it twice. Only meaningful for
  // "approved" bookings with a non-empty bookerEmail.
  reminderSent: boolean;
}

export type CreateBookingInput = Omit<
  Booking,
  "id" | "createdAt" | "status" | "reminderSent"
>;
