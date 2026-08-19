import { notFound } from "next/navigation";
import { getBookings, getRoomById } from "@/lib/sheetsDb";
import { todayStr } from "@/lib/timeSlots";
import RoomDisplay from "@/components/RoomDisplay";

// Public kiosk/tablet view — meant to be mounted at the room entrance.
// Excluded from the auth middleware so a wall display works without login.
export default async function RoomDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = await getRoomById(id);
  if (!room) {
    notFound();
  }

  const bookings = await getBookings({
    roomId: id,
    date: todayStr(),
    status: "approved",
  });

  return <RoomDisplay room={room} bookings={bookings} />;
}
