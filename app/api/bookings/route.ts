import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BookingConflictError, createBooking, getBookings } from "@/lib/sheetsDb";
import type { CreateBookingInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  // TEMP: auth check disabled for testing. Uncomment to re-enable.
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  try {
    const roomId = request.nextUrl.searchParams.get("roomId") ?? undefined;
    const date = request.nextUrl.searchParams.get("date") ?? undefined;
    const bookings = await getBookings({ roomId, date });
    return NextResponse.json(bookings);
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca data booking." },
      { status: 500 }
    );
  }
}

const REQUIRED_FIELDS: (keyof CreateBookingInput)[] = [
  "roomId",
  "date",
  "startTime",
  "endTime",
];

export async function POST(request: NextRequest) {
  // TEMP: auth check disabled for testing. Uncomment to re-enable.
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  let body: Partial<CreateBookingInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Field '${field}' wajib diisi.` },
        { status: 400 }
      );
    }
  }

  const input: CreateBookingInput = {
    roomId: body.roomId!,
    date: body.date!,
    startTime: body.startTime!,
    endTime: body.endTime!,
    purpose: body.purpose ?? "",
    // TEMP: derived from session when auth is enabled; falls back to body while auth is disabled.
    bookerName: body.bookerName ?? "Unknown",
    bookerEmail: body.bookerEmail ?? "",
  };

  try {
    const booking = await createBooking(input);
    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return NextResponse.json(
        { error: err.message, conflict: err.conflict },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Gagal membuat booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
