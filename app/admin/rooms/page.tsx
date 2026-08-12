import { getRooms } from "@/lib/sheetsDb";
import AdminRoomsManager from "@/components/AdminRoomsManager";

// TEMP: admin-only, auth disabled for testing. Uncomment once Azure AD App
// Roles are wired up (see lib/auth.ts session.user.isAdmin), and redirect
// non-admins away instead of rendering this page.
// import { redirect } from "next/navigation";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

export default async function AdminRoomsPage() {
  // const session = await getServerSession(authOptions);
  // if (!session?.user?.isAdmin) {
  //   redirect("/");
  // }

  const rooms = await getRooms();

  return <AdminRoomsManager initialRooms={rooms} />;
}
