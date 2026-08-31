import { getRooms } from "@/lib/db";
import ScheduleOverview from "@/components/ScheduleOverview";

// Reads rooms from Postgres per request — never prerendered, since the
// build host has no database connection.
export const dynamic = "force-dynamic";

export default async function JadwalPage() {
  const rooms = await getRooms();
  return <ScheduleOverview initialRooms={rooms} />;
}
