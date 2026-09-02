import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BookingConflictError, createBooking, getBookings } from "@/lib/db";
import type { CreateBookingInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const roomId = request.nextUrl.searchParams.get("roomId") ?? undefined;
    const date = request.nextUrl.searchParams.get("date") ?? undefined;
    const dateFrom = request.nextUrl.searchParams.get("dateFrom") ?? undefined;
    const dateTo = request.nextUrl.searchParams.get("dateTo") ?? undefined;
    const bookings = await getBookings({ roomId, date, dateFrom, dateTo });
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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<CreateBookingInput> & { forceApproved?: boolean };
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

  const isAdmin = !!session.user?.isAdmin;

  // Normal users always book as themselves — the name/email come from the
  // session, not the request, so they can't be spoofed. Admins may book on
  // someone else's behalf (walk-in / phone request): the name they type is
  // what shows on the tablet display.
  const onBehalf = isAdmin && !!body.bookerName?.trim();
  const bookerName = onBehalf
    ? body.bookerName!.trim()
    : (session.user?.name ?? "Unknown");
  const bookerEmail = onBehalf
    ? (body.bookerEmail?.trim() ?? "")
    : (session.user?.email ?? "");

  const input: CreateBookingInput & { forceApproved?: boolean } = {
    roomId: body.roomId!,
    date: body.date!,
    startTime: body.startTime!,
    endTime: body.endTime!,
    purpose: body.purpose ?? "",
    bookerName,
    bookerEmail,
    isOvertime: !!body.isOvertime,
    overtimeNote: body.overtimeNote ?? "",
    // Only an admin can confirm on creation; ignored for everyone else.
    forceApproved: isAdmin && body.forceApproved === true,
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
