"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EditBookingModal from "./EditBookingModal";
import ThemeToggle from "./ThemeToggle";
import MobileBottomNav from "./MobileBottomNav";
import { todayStr, toMinutes } from "@/lib/timeSlots";
import type { Booking, Room } from "@/lib/types";

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function ScheduleOverview({
  initialRooms,
  initialScope = "all",
}: {
  initialRooms: Room[];
  initialScope?: "all" | "mine";
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const myEmail = session?.user?.email ?? null;

  function canManage(b: Booking): boolean {
    return isAdmin || (!!myEmail && b.bookerEmail === myEmail);
  }

  const [rooms] = useState(initialRooms);
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Tolerate the two inputs being set out of order.
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  const multiDay = lo !== hi;

  function rangeQuery(): string {
    return lo === hi ? `date=${lo}` : `dateFrom=${lo}&dateTo=${hi}`;
  }

  function loadBookings() {
    setLoading(true);
    fetch(`/api/bookings?${rangeQuery()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Booking[]) => setBookings(data))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = lo === hi ? `date=${lo}` : `dateFrom=${lo}&dateTo=${hi}`;
    fetch(`/api/bookings?${query}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Booking[]) => {
        if (!cancelled) setBookings(data);
      })
      .catch(() => {
        if (!cancelled) setBookings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lo, hi]);

  async function handleDelete(id: string) {
    if (!confirm("Hapus booking ini?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadBookings();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Gagal menghapus booking.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  const visibleBookings = useMemo(
    () =>
      initialScope === "mine" && myEmail
        ? bookings.filter(
            (booking) => booking.bookerEmail.toLowerCase() === myEmail.toLowerCase()
          )
        : bookings,
    [bookings, initialScope, myEmail]
  );

  const byRoom = useMemo(() => {
    return rooms
      .map((room) => {
        const roomBookings = visibleBookings
          .filter((b) => b.roomId === room.id)
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) ||
              toMinutes(a.startTime) - toMinutes(b.startTime)
          );
        return { room, bookings: roomBookings };
      })
      .filter(({ bookings: roomBookings }) =>
        initialScope === "mine" ? roomBookings.length > 0 : true
      );
  }, [rooms, visibleBookings, initialScope]);

  const dateInputClass =
    "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:w-auto";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 sm:px-6 sm:py-10 sm:pb-10">
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
        <ThemeToggle />
      </div>

      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Office workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {initialScope === "mine" ? "Booking saya" : "Jadwal ruangan"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {multiDay
              ? `${formatDateShort(lo)} – ${formatDateShort(hi)}`
              : formatDateLabel(lo)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 shadow-sm sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Dari</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className={dateInputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Sampai</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className={dateInputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const date = todayStr();
              setFrom(date);
              setTo(date);
            }}
            className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 1);
              const tomorrow = todayStr(date);
              setFrom(tomorrow);
              setTo(tomorrow);
            }}
            className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            Besok
          </button>
        </div>
      </div>

      {!loading && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
            <p className="text-xs text-muted-foreground">Total booking</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{visibleBookings.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
            <p className="text-xs text-muted-foreground">Ruangan terpakai</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {new Set(visibleBookings.map((b) => b.roomId)).size}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border bg-primary p-3 text-primary-foreground shadow-sm sm:col-span-1 sm:p-4">
            <p className="text-xs text-primary-foreground/70">Rentang aktif</p>
            <p className="mt-1 truncate text-sm font-semibold">
              {multiDay ? `${formatDateShort(lo)} – ${formatDateShort(hi)}` : "Hari ini"}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {byRoom.map(({ room, bookings: roomBookings }) => (
            <div
              key={room.id}
              className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold tracking-tight">
                    {room.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {room.location} · Kapasitas {room.capacity} orang
                  </p>
                </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {roomBookings.length} booking
                </span>
              </div>

              {roomBookings.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-5 text-center">
                  <p className="text-sm font-medium">Belum ada booking</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ruangan tersedia pada rentang ini.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {roomBookings.map((b) => (
                    <li
                      key={b.id}
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        b.status === "pending"
                          ? "border-dashed border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                          : "bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-medium">
                            {b.bookerName}
                          </span>
                          {b.status === "pending" && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Menunggu
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 rounded-md bg-background px-2 py-1 font-mono text-xs font-semibold tabular-nums text-foreground shadow-sm">
                          {b.startTime}–{b.endTime}
                        </span>
                      </div>
                      {multiDay && (
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                          {formatDateShort(b.date)}
                        </p>
                      )}
                      {b.purpose && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.purpose}
                        </p>
                      )}
                      {canManage(b) && (
                        <div className="mt-2 flex justify-end gap-2 border-t pt-2">
                          <button
                            type="button"
                            onClick={() => setEditing(b)}
                            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === b.id}
                            onClick={() => handleDelete(b.id)}
                            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            {deletingId === b.id ? "Menghapus…" : "Hapus"}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {byRoom.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center sm:col-span-2 xl:col-span-3">
              <p className="font-medium">Belum ada booking pada tanggal ini</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Booking yang Anda buat akan tampil di sini.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Cari ruangan
              </Link>
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditBookingModal
          booking={editing}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={loadBookings}
        />
      )}
      <MobileBottomNav />
    </div>
  );
}
