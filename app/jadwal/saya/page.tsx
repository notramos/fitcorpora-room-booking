import { getRooms } from "@/lib/db";
import ScheduleOverview from "@/components/ScheduleOverview";

export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
  const rooms = await getRooms();
  return <ScheduleOverview initialRooms={rooms} initialScope="mine" />;
}
