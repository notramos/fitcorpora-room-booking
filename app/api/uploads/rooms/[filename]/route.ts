import path from "node:path";
import { unlink } from "node:fs/promises";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { filename } = await params;
  if (path.basename(filename) !== filename) {
    return NextResponse.json({ error: "Nama file tidak valid." }, { status: 400 });
  }

  try {
    await unlink(path.join(process.cwd(), "public", "uploads", "rooms", filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return NextResponse.json({ error: "Gagal menghapus gambar." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
