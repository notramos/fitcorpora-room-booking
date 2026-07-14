import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBookings, getRooms } from "@/lib/excelDb";
import Dashboard from "@/components/Dashboard";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function Home() {
  await getServerSession(authOptions);

  const rooms = getRooms();
  const bookings = getBookings({ date: todayStr() });

  return <Dashboard initialRooms={rooms} initialBookings={bookings} />;
}
