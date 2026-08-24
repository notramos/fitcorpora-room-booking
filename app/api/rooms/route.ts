import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createRoom, getRooms } from "@/lib/sheetsDb";
import type { CreateRoomInput } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rooms = await getRooms();
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca data ruangan." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: Partial<CreateRoomInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  if (!body.name || !body.location || !body.capacity) {
    return NextResponse.json(
      { error: "Nama, lokasi, dan kapasitas wajib diisi." },
      { status: 400 }
    );
  }

  const input: CreateRoomInput = {
    name: body.name,
    location: body.location,
    capacity: Number(body.capacity) || 0,
    requiresApproval: !!body.requiresApproval,
    facilities: body.facilities ?? [],
    images: body.images ?? [],
  };

  try {
    const room = await createRoom(input);
    return NextResponse.json(room, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Gagal membuat ruangan." },
      { status: 500 }
    );
  }
}
