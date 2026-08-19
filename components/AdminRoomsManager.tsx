"use client";

import Link from "next/link";
import { useState } from "react";
import RoomFormModal from "./RoomFormModal";
import ThemeToggle from "./ThemeToggle";
import type { Room } from "@/lib/types";

export default function AdminRoomsManager({
  initialRooms,
}: {
  initialRooms: Room[];
}) {
  const [rooms, setRooms] = useState(initialRooms);
  const [formRoom, setFormRoom] = useState<Room | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upsert(room: Room) {
    setRooms((prev) => {
      const exists = prev.some((r) => r.id === room.id);
      return exists
        ? prev.map((r) => (r.id === room.id ? room : r))
        : [...prev, room];
    });
  }

  async function handleDelete(room: Room) {
    if (
      !confirm(
        `Hapus "${room.name}"? Booking yang sudah ada untuk ruangan ini tidak akan ikut terhapus, tapi jadi tidak terhubung ke ruangan manapun.`
      )
    ) {
      return;
    }
    setDeleting(room.id);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Gagal menghapus ruangan.");
        return;
      }
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Cari &amp; Booking Ruangan
        </Link>
        <ThemeToggle />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kelola Ruangan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tambah, ubah, atau hapus ruangan — termasuk fasilitas, foto, dan
            status persetujuan.
          </p>
        </div>
        <button
          onClick={() => setFormRoom("new")}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tambah Ruangan
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold tracking-tight">{room.name}</p>
                {room.requiresApproval && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Perlu Persetujuan
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {room.location} · Kapasitas {room.capacity} orang
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {room.facilities.length > 0
                  ? room.facilities.join(", ")
                  : "Belum ada data fasilitas"}
                {" · "}
                {room.images.length} foto
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setFormRoom(room)}
                className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(room)}
                disabled={deleting === room.id}
                className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-background px-4 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                {deleting === room.id ? "Menghapus…" : "Hapus"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {formRoom && (
        <RoomFormModal
          room={formRoom === "new" ? undefined : formRoom}
          onClose={() => setFormRoom(null)}
          onSaved={upsert}
        />
      )}
    </div>
  );
}
