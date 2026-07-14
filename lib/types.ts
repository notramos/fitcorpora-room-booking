export interface Room {
  id: string;
  name: string;
  location: string;
  capacity: number;
}

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
}

export type CreateBookingInput = Omit<Booking, "id" | "createdAt">;
