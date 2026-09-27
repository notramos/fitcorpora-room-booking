"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import MobileBottomNav from "./MobileBottomNav";
import type { Booking, Room } from "@/lib/types";

interface ApprovalItem {
  booking: Booking;
  room: Room;
}

function formatDateLong(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ApprovalQueue({
  initialItems,
}: {
  initialItems: ApprovalItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals");
      if (res.ok) setItems(await res.json());
    } catch {
      // keep showing last known data on transient network errors
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Gagal memproses booking.");
        return;
      }
      setItems((prev) => prev.filter((item) => item.booking.id !== id));
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 pb-28 sm:px-6 sm:py-10 sm:pb-10">
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
            className="hidden h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
          >
            Kelola Semua Booking
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Office management
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Persetujuan Booking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tinjau permintaan booking ruangan terbatas dan overtime.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 sm:block sm:min-w-40">
          <p className="text-xs font-medium uppercase tracking-wide">Menunggu tindakan</p>
          <p className="text-2xl font-semibold tabular-nums sm:mt-1">{items.length}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="text-xl" aria-hidden="true">✓</span>
          </div>
          <p className="mt-4 font-semibold">Semua pengajuan sudah diproses</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pengajuan baru akan otomatis muncul di halaman ini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ booking, room }) => (
            <div
              key={booking.id}
              className="flex flex-col gap-4 rounded-2xl border border-t-4 border-t-amber-400 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:border-l-4 sm:border-t sm:border-l-amber-400 sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tracking-tight">{room.name}</p>
                  {booking.isOvertime && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-300">
                      Overtime
                    </span>
                  )}
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Menunggu
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDateLong(booking.date)} · {booking.startTime}–
                  {booking.endTime}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">{booking.bookerName}</span>
                  {booking.purpose ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {booking.purpose}
                    </span>
                  ) : null}
                </p>
                {booking.overtimeNote && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pendukung: {booking.overtimeNote}
                  </p>
                )}
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-col md:flex-row">
                <button
                  onClick={() => act(booking.id, "reject")}
                  disabled={busyId === booking.id}
                  className="inline-flex h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:rounded-md"
                >
                  Tolak
                </button>
                <button
                  onClick={() => act(booking.id, "approve")}
                  disabled={busyId === booking.id}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:rounded-md"
                >
                  Setujui
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <MobileBottomNav />
    </div>
  );
}
