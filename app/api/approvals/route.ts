import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPendingBookings, getRooms } from "@/lib/sheetsDb";

export async function GET() {
  // TEMP: auth check disabled for testing. Uncomment to re-enable, and add
  // an approver check once real accounts are wired up.
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  try {
    const [pending, rooms] = await Promise.all([
      getPendingBookings(),
      getRooms(),
    ]);
    const roomsById = new Map(rooms.map((r) => [r.id, r]));

    const items = pending
      .map((booking) => ({ booking, room: roomsById.get(booking.roomId) }))
      .filter((item): item is { booking: typeof pending[number]; room: NonNullable<typeof item.room> } => !!item.room)
      .sort(
        (a, b) =>
          a.booking.date.localeCompare(b.booking.date) ||
          a.booking.startTime.localeCompare(b.booking.startTime)
      );

    return NextResponse.json(items);
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca daftar persetujuan." },
      { status: 500 }
    );
  }
}
