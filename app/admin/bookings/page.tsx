import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBookings, getRooms } from "@/lib/db";
import AdminBookingsManager from "@/components/AdminBookingsManager";

// Full booking register for admins. With Google Sheets, fixing or removing
// an arbitrary booking — any room, any date, approved or pending — meant
// opening the spreadsheet and editing the row directly. Postgres has no
// such "just open the sheet" fallback, so this page is that fallback:
// search, edit, delete, approve, and re-arm reminders for every booking.
export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const [bookings, rooms] = await Promise.all([getBookings(), getRooms()]);

  return <AdminBookingsManager initialBookings={bookings} rooms={rooms} />;
}
