import { getRooms } from "@/lib/sheetsDb";
import ScheduleOverview from "@/components/ScheduleOverview";

export default async function JadwalPage() {
  const rooms = await getRooms();
  return <ScheduleOverview initialRooms={rooms} />;
}
