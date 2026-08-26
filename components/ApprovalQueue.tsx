"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
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

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Persetujuan Booking
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Booking untuk ruangan terbatas yang menunggu persetujuan Anda.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada booking yang menunggu persetujuan.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map(({ booking, room }) => (
            <div
              key={booking.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
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

              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => act(booking.id, "reject")}
                  disabled={busyId === booking.id}
                  className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  Tolak
                </button>
                <button
                  onClick={() => act(booking.id, "approve")}
                  disabled={busyId === booking.id}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  Setujui
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
