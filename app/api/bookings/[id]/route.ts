import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  BookingConflictError,
  deleteBooking,
  getBookingById,
  updateBooking,
} from "@/lib/sheetsDb";

// Admins can edit/delete any booking; everyone else only their own — matched
// by email since that's the one immutable identifier stamped on a booking at
// creation time (see app/api/bookings/route.ts, which derives it from the
// session rather than trusting client input).
function canManage(
  session: { user?: { email?: string | null; isAdmin?: boolean } } | null,
  bookerEmail: string
): boolean {
  if (!session?.user) return false;
  if (session.user.isAdmin) return true;
  return !!session.user.email && session.user.email === bookerEmail;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getBookingById(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Booking tidak ditemukan." },
      { status: 404 }
    );
  }
  if (!canManage(session, existing.bookerEmail)) {
    return NextResponse.json(
      { error: "Anda hanya bisa mengubah booking milik sendiri." },
      { status: 403 }
    );
  }

  let body: { date?: string; startTime?: string; endTime?: string; purpose?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  if (!body.date || !body.startTime || !body.endTime) {
    return NextResponse.json(
      { error: "Tanggal, jam mulai, dan jam selesai wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const updated = await updateBooking(id, {
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      purpose: body.purpose ?? "",
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return NextResponse.json(
        { error: err.message, conflict: err.conflict },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Gagal mengubah booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getBookingById(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Booking tidak ditemukan." },
      { status: 404 }
    );
  }
  if (!canManage(session, existing.bookerEmail)) {
    return NextResponse.json(
      { error: "Anda hanya bisa menghapus booking milik sendiri." },
      { status: 403 }
    );
  }

  try {
    const deleted = await deleteBooking(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Booking tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Gagal menghapus booking." },
      { status: 500 }
    );
  }
}
