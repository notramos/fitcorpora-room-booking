import { NextRequest, NextResponse } from "next/server";
import { getBookings } from "@/lib/sheetsDb";
import { todayStr } from "@/lib/timeSlots";

// Public, unauthenticated read for the kiosk/tablet display — deliberately
// separate from /api/bookings (which requires a session and returns full
// booker email + purpose). This only returns what's already shown on the
// public display: room id, time range, booker name, status — never email or
// purpose. Excluded from the auth middleware alongside /display itself (see
// middleware.ts matcher), since the kiosk never has a session to send.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const date = request.nextUrl.searchParams.get("date") ?? todayStr();

  try {
    const bookings = await getBookings({ roomId, date, status: "approved" });
    const safe = bookings.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      bookerName: b.bookerName,
      status: b.status,
    }));
    return NextResponse.json(safe, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca data booking." },
      { status: 500 }
    );
  }
}
