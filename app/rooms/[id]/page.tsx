import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBookings, getRoomById } from "@/lib/excelDb";
import RoomDetail from "@/components/RoomDetail";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getServerSession(authOptions);

  const { id } = await params;
  const room = getRoomById(id);
  if (!room) {
    notFound();
  }

  const bookings = getBookings({ roomId: id });

  return <RoomDetail room={room} initialBookings={bookings} />;
}
