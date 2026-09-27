"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Pagination from "./Pagination";
import RoomFormModal from "./RoomFormModal";
import ThemeToggle from "./ThemeToggle";
import MobileBottomNav from "./MobileBottomNav";
import type { Room } from "@/lib/types";

const PAGE_SIZE = 10;

export default function AdminRoomsManager({
  initialRooms,
}: {
  initialRooms: Room[];
}) {
  const [rooms, setRooms] = useState(initialRooms);
  const [formRoom, setFormRoom] = useState<Room | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rooms.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRooms = rooms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        `Hapus "${room.name}"? Semua booking untuk ruangan ini akan ikut terhapus.`
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
    <div className="mx-auto w-full max-w-5xl px-4 py-5 pb-32 sm:px-6 sm:py-10 sm:pb-10">
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
          <span className="hidden min-[390px]:inline">Cari &amp; Booking Ruangan</span>
          <span className="min-[390px]:hidden">Beranda</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings"
            className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent sm:text-sm"
          >
            Booking
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Administration
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Kelola Ruangan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tambah, ubah, atau hapus ruangan — termasuk fasilitas, foto, dan
            status persetujuan.
          </p>
          </div>
        </div>
        <button
          onClick={() => setFormRoom("new")}
          className="hidden h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:inline-flex"
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {pageRooms.map((room) => (
          <div
            key={room.id}
            className="flex min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:min-h-40 sm:gap-4 sm:p-5"
          >
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border bg-muted sm:h-20 sm:w-24 sm:rounded-lg">
                {room.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- room image URLs are managed by admins.
                  <img
                    src={room.images[0]}
                    alt={`Foto ${room.name}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/room-placeholder.svg";
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <span className="text-[10px] font-medium">Tanpa foto</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight sm:text-base">{room.name}</p>
                  {room.requiresApproval && (
                    <span className="hidden items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300 sm:inline-flex">
                      Perlu Persetujuan
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {room.location} · Kapasitas {room.capacity} orang
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
                  {room.facilities.length > 0
                    ? room.facilities.join(", ")
                    : "Belum ada data fasilitas"}
                  {" · "}
                  {room.images.length} foto
                </p>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t pt-3">
              <button
                onClick={() => setFormRoom(room)}
                className="inline-flex h-11 min-w-0 items-center justify-center rounded-xl border bg-background px-2 text-xs font-semibold shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:h-9 sm:rounded-md sm:px-4 sm:text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(room)}
                disabled={deleting === room.id}
                className="inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-red-200 bg-background px-2 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 sm:h-9 sm:rounded-md sm:px-4 sm:text-sm"
              >
                {deleting === room.id ? "Menghapus…" : "Hapus"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <button
        type="button"
        onClick={() => setFormRoom("new")}
        aria-label="Tambah ruangan"
        className="fixed bottom-24 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg sm:hidden"
      >
        <span aria-hidden="true">+</span>
      </button>

      {formRoom && (
        <RoomFormModal
          room={formRoom === "new" ? undefined : formRoom}
          onClose={() => setFormRoom(null)}
          onSaved={upsert}
        />
      )}
      <MobileBottomNav />
    </div>
  );
}
