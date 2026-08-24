import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteRoom, updateRoom } from "@/lib/sheetsDb";
import type { CreateRoomInput } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

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
    const room = await updateRoom(id, input);
    if (!room) {
      return NextResponse.json(
        { error: "Ruangan tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json(room);
  } catch {
    return NextResponse.json(
      { error: "Gagal menyimpan perubahan ruangan." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const deleted = await deleteRoom(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Ruangan tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Gagal menghapus ruangan." },
      { status: 500 }
    );
  }
}
