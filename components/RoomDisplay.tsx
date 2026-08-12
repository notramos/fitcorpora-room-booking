"use client";

import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import { computeStatus } from "@/lib/roomStatus";
import type { Booking, Room } from "@/lib/types";

const REFRESH_INTERVAL_MS = 30000;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RoomDisplay({
  room,
  bookings: initialBookings,
}: {
  room: Room;
  bookings: Booking[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [bookings, setBookings] = useState(initialBookings);

  // Live clock — ticks every second.
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll fresh bookings straight from the API every 30s so a new/cancelled
  // booking shows up on the display without a manual reload. `no-store` avoids
  // any browser/Next caching. `today` is recomputed each call so a kiosk left
  // on overnight rolls over to the new day automatically.
  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/bookings?roomId=${encodeURIComponent(room.id)}&date=${todayStr()}`,
        { cache: "no-store" }
      );
      if (res.ok) return (await res.json()) as Booking[];
    } catch {
      // keep last known data on transient errors
    }
    return null;
  }, [room.id]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const fresh = await loadBookings();
      if (!cancelled && fresh) setBookings(fresh);
    };
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadBookings]);

  const reference = now ?? new Date();
  const nowMinutes = reference.getHours() * 60 + reference.getMinutes();
  const { status, currentBooking, nextBooking } = computeStatus(
    bookings,
    reference
  );
  const isInUse = status === "Sedang Dipakai";

  // Only show bookings that are currently ongoing or still upcoming today —
  // finished bookings are dropped entirely from the public tablet agenda.
  const schedule = [...bookings]
    .filter((b) => toMinutes(b.endTime) > nowMinutes)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const timeMain = now
    ? now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const seconds = now ? String(now.getSeconds()).padStart(2, "0") : "--";
  const dateStr = now
    ? now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:gap-12">
      {/* left: identity, clock, status */}
      <section className="flex flex-col justify-center gap-6 text-center lg:w-[40%] lg:border-r lg:pr-12 lg:text-left">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {room.name}
          </h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {room.location} · Kapasitas {room.capacity} orang
          </p>
        </div>

        <div>
          <div className="flex items-end justify-center gap-4 lg:justify-start">
            <span className="font-mono text-8xl font-bold leading-none tabular-nums sm:text-9xl lg:text-[10rem]">
              {timeMain}
            </span>
            <span className="mb-2 font-mono text-4xl font-medium leading-none tabular-nums text-muted-foreground sm:mb-3 sm:text-5xl lg:text-6xl">
              {seconds}
            </span>
          </div>
          <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
            {dateStr}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 lg:items-start">
          <StatusBadge inUse={isInUse} size="lg" />
          <p className="text-base text-muted-foreground sm:text-lg">
            {currentBooking ? (
              <>
                Dipakai oleh{" "}
                <span className="font-medium text-foreground">
                  {currentBooking.bookerName}
                </span>{" "}
                hingga {currentBooking.endTime}
              </>
            ) : nextBooking ? (
              <>
                Kosong hingga{" "}
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {nextBooking.startTime}
                </span>
              </>
            ) : bookings.length > 0 ? (
              "Tidak ada booking lagi hari ini"
            ) : (
              "Bebas sepanjang hari ini"
            )}
          </p>
        </div>
      </section>

      {/* right: today's agenda */}
      <section className="flex flex-1 flex-col">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Jadwal Hari Ini
          </h2>
          <span className="text-sm text-muted-foreground">
            {schedule.length} booking
          </span>
        </div>

        {schedule.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed">
            <p className="text-lg text-muted-foreground">
              Belum ada booking hari ini
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5 overflow-y-auto">
            {schedule.map((b) => {
              const isCurrent = b.id === currentBooking?.id;
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-4 rounded-xl bg-foreground px-5 py-4 text-background"
                >
                  <span className="w-36 shrink-0 font-mono text-lg font-semibold tabular-nums sm:text-xl">
                    {b.startTime}–{b.endTime}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-lg font-medium">
                    {b.bookerName}
                  </p>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                      Berlangsung
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
