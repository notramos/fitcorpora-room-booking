"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RealtimeClock from "./RealtimeClock";
import BookingModal from "./BookingModal";
import StatusBadge from "./StatusBadge";
import { computeStatus } from "@/lib/roomStatus";
import type { Booking, Room } from "@/lib/types";

const REFRESH_INTERVAL_MS = 30000;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatDateLong(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function RoomDetail({
  room,
  initialBookings,
}: {
  room: Room;
  initialBookings: Booking[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [now, setNow] = useState(() => new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function refetch() {
    try {
      const res = await fetch(
        `/api/bookings?roomId=${encodeURIComponent(room.id)}`
      );
      if (res.ok) setBookings((await res.json()) as Booking[]);
    } catch {
      // keep last known data on transient errors
    }
  }

  useEffect(() => {
    const interval = setInterval(refetch, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayStr();

  const todaysSchedule = useMemo(
    () =>
      bookings
        .filter((b) => b.date === today)
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
    [bookings, today]
  );

  const { status, currentBooking, nextBooking } = computeStatus(
    todaysSchedule,
    now
  );
  const isInUse = status === "Sedang Dipakai";
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Upcoming bookings (future dates) grouped by date.
  const upcomingByDate = useMemo(() => {
    const groups = new Map<string, Booking[]>();
    bookings
      .filter((b) => b.date > today)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          toMinutes(a.startTime) - toMinutes(b.startTime)
      )
      .forEach((b) => {
        const list = groups.get(b.date) ?? [];
        list.push(b);
        groups.set(b.date, list);
      });
    return Array.from(groups.entries());
  }, [bookings, today]);

  const totalBookings = bookings.length;

  return (
    <div className="flex flex-1 flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
            Kembali
          </Link>
          <RealtimeClock
            onTick={setNow}
            className="font-mono text-sm font-medium tabular-nums text-muted-foreground"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-8">
        {/* hero */}
        <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2">
                <StatusBadge inUse={isInUse} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {room.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
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
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {room.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
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
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Kapasitas {room.capacity} orang
                </span>
                <span className="inline-flex items-center gap-1.5">
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
                    <path d="M8 2v4M16 2v4M3 10h18" />
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                  </svg>
                  {totalBookings} total booking
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/display/${room.id}`}
                target="_blank"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                Tampilan Tablet
              </Link>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  <path d="M8 2v4M16 2v4M3 10h18" />
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M12 14v4M10 16h4" />
                </svg>
                Booking Ruangan
              </button>
            </div>
          </div>

          {/* current / next summary */}
          <div className="mt-5 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            {currentBooking ? (
              <p>
                <span className="text-muted-foreground">Sedang dipakai oleh</span>{" "}
                <span className="font-medium">{currentBooking.bookerName}</span>{" "}
                <span className="text-muted-foreground">
                  hingga {currentBooking.endTime} · {currentBooking.purpose}
                </span>
              </p>
            ) : nextBooking ? (
              <p>
                <span className="text-muted-foreground">Booking berikutnya</span>{" "}
                <span className="font-mono font-medium tabular-nums">
                  {nextBooking.startTime}–{nextBooking.endTime}
                </span>{" "}
                <span className="text-muted-foreground">oleh</span>{" "}
                <span className="font-medium">{nextBooking.bookerName}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Tidak ada booking lagi untuk hari ini.
              </p>
            )}
          </div>
        </section>

        {/* today's schedule */}
        <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Jadwal Hari Ini
            </h2>
            <p className="text-sm text-muted-foreground">{formatDateLong(today)}</p>
          </div>
          <div className="p-6">
            {todaysSchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada booking hari ini.
              </p>
            ) : (
              <ul className="space-y-2">
                {todaysSchedule.map((b) => {
                  const isCurrent = b.id === currentBooking?.id;
                  const isPast =
                    toMinutes(b.endTime) <= nowMinutes && !isCurrent;
                  return (
                    <li
                      key={b.id}
                      className={`flex items-start gap-4 rounded-lg border px-4 py-3 ${
                        isCurrent
                          ? "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
                          : "bg-muted/40"
                      } ${isPast ? "opacity-55" : ""}`}
                    >
                      <span
                        className={`w-28 shrink-0 font-mono text-sm font-medium tabular-nums ${
                          isCurrent ? "text-red-700 dark:text-red-400" : ""
                        }`}
                      >
                        {b.startTime}–{b.endTime}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {b.bookerName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {b.purpose}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Berlangsung
                        </span>
                      )}
                      {isPast && (
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Selesai
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* upcoming bookings */}
        <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              Booking Mendatang
            </h2>
            <p className="text-sm text-muted-foreground">
              Jadwal untuk hari-hari berikutnya
            </p>
          </div>
          <div className="p-6">
            {upcomingByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada booking mendatang.
              </p>
            ) : (
              <div className="space-y-5">
                {upcomingByDate.map(([date, list]) => (
                  <div key={date}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {formatDateLong(date)}
                    </p>
                    <ul className="space-y-2">
                      {list.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-start gap-4 rounded-lg border bg-muted/40 px-4 py-3"
                        >
                          <span className="w-28 shrink-0 font-mono text-sm font-medium tabular-nums">
                            {b.startTime}–{b.endTime}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {b.bookerName}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {b.purpose}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {isModalOpen && (
        <BookingModal
          room={room}
          onClose={() => setIsModalOpen(false)}
          onBooked={() => refetch()}
        />
      )}
    </div>
  );
}
