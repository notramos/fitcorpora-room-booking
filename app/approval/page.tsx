import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPendingBookings, getRooms } from "@/lib/sheetsDb";
import ApprovalQueue from "@/components/ApprovalQueue";

export default async function ApprovalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const [pending, rooms] = await Promise.all([getPendingBookings(), getRooms()]);
  const roomsById = new Map(rooms.map((r) => [r.id, r]));

  const items = pending
    .map((booking) => ({ booking, room: roomsById.get(booking.roomId) }))
    .filter(
      (item): item is { booking: typeof pending[number]; room: NonNullable<typeof item.room> } =>
        !!item.room
    )
    .sort(
      (a, b) =>
        a.booking.date.localeCompare(b.booking.date) ||
        a.booking.startTime.localeCompare(b.booking.startTime)
    );

  return <ApprovalQueue initialItems={items} />;
}
