import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resetReminderSent } from "@/lib/db";

// Admin-only: clears a booking's "reminder already sent" flag so the next
// reminder cron run DMs the booker again. This is the in-app replacement
// for opening the old Google Sheet and blanking column K by hand.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const ok = await resetReminderSent(id);
    if (!ok) {
      return NextResponse.json(
        { error: "Booking tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Gagal mengatur ulang pengingat." },
      { status: 500 }
    );
  }
}
