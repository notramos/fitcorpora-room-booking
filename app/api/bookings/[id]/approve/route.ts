import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { approveBooking } from "@/lib/sheetsDb";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // TEMP: auth check disabled for testing. Uncomment to re-enable, and add
  // an approver check once real accounts are wired up.
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  const { id } = await params;

  try {
    const approved = await approveBooking(id);
    if (!approved) {
      return NextResponse.json(
        { error: "Booking tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Gagal menyetujui booking." },
      { status: 500 }
    );
  }
}
