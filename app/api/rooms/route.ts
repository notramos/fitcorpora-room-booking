import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRooms } from "@/lib/excelDb";

export async function GET() {
  // TEMP: auth check disabled for testing. Uncomment to re-enable.
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  try {
    const rooms = getRooms();
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca data ruangan." },
      { status: 500 }
    );
  }
}
