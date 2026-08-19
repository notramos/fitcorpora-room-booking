import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRooms } from "@/lib/sheetsDb";
import SearchBooking from "@/components/SearchBooking";

export default async function Home() {
  await getServerSession(authOptions);

  const rooms = await getRooms();

  return <SearchBooking initialRooms={rooms} />;
}
