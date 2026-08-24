import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRooms } from "@/lib/sheetsDb";
import AdminRoomsManager from "@/components/AdminRoomsManager";

export default async function AdminRoomsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const rooms = await getRooms();

  return <AdminRoomsManager initialRooms={rooms} />;
}
