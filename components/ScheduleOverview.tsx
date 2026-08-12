"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "./ThemeToggle";
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

export default function ScheduleOverview({
  initialRooms,
}: {
  initialRooms: Room[];
}) {
  const [rooms] = useState(initialRooms);
  const [date, setDate] = useState(todayStr);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/bookings?date=${date}`)
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
  }, [date]);

  const byRoom = useMemo(() => {
    return rooms.map((room) => {
      const roomBookings = bookings
        .filter((b) => b.roomId === room.id)
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      return { room, bookings: roomBookings };
    });
  }, [rooms, bookings]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
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
            Kondisi Ruangan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateLabel(date)}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Tanggal</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:w-auto"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {byRoom.map(({ room, bookings: roomBookings }) => (
            <div
              key={room.id}
              className="flex flex-col rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-tight">
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
                <p className="text-sm text-muted-foreground">Kosong.</p>
              ) : (
                <ul className="space-y-2">
                  {roomBookings.map((b) => (
                    <li
                      key={b.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        b.status === "pending"
                          ? "border-dashed border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                          : "bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
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
                        <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                          {b.startTime}–{b.endTime}
                        </span>
                      </div>
                      {b.purpose && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.purpose}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
