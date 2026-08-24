import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPendingBookings, getRooms } from "@/lib/sheetsDb";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
