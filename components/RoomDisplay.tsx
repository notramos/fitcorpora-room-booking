"use client";

import { useCallback, useEffect, useState } from "react";
import { computeStatus } from "@/lib/roomStatus";
import {
  nowMinutesInAppTimezone,
  todayStr,
  toMinutes,
} from "@/lib/timeSlots";
import type { Booking, Room } from "@/lib/types";

const REFRESH_INTERVAL_MS = 30000;

// Public display keeps names short (e.g. "Gregorius Sergio Guntur" ->
// "Gregorius Sergio") — full multi-word names crowd the kiosk layout and
// the first two words are enough to identify the booker at a glance.
function shortName(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).join(" ");
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
  // booking shows up on the display without a manual reload. Uses
  // /api/display/[roomId] rather than /api/bookings — the kiosk has no
  // session, and /api/bookings requires one (previously this fetch was
  // silently redirected to /login by the auth middleware, failed to parse as
  // JSON, and got swallowed by the catch below, so the display just never
  // updated until someone manually reloaded it). `no-store` avoids any
  // browser/Next caching. `today` is recomputed each call so a kiosk left on
  // overnight rolls over to the new day automatically.
  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/display/${encodeURIComponent(room.id)}?date=${todayStr()}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        return (await res.json()) as Booking[];
      }
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
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [loadBookings]);

  const reference = now ?? new Date();
  const nowMinutes = nowMinutesInAppTimezone(reference);
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
    <main className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6 sm:p-10 md:flex-row md:gap-12">
      {/* left: identity, clock, status */}
      <section
        className="flex min-w-0 flex-col justify-center gap-6 break-words text-center md:w-[40%] md:shrink-0 md:border-r md:pr-12 md:text-left"
        style={{ containerType: "inline-size" }}
      >
        {/* md:shrink-0 is load-bearing: overflow-wrap:break-word (from
            break-words above) makes the browser treat this column's
            min-content width as almost nothing, since any word can now be
            broken anywhere. Without shrink-0, a long two-word booker name
            (e.g. two long real names, not one glued-together word) makes
            the flex layout collapse this whole column down toward that
            near-zero min-content instead of holding at w-[40%] — so the
            clock/status appear to "overflow" because their container
            shrank, not because the text itself grew past it. */}
        {/* break-words (overflow-wrap) is inherited, so it also covers the
            booker name below — without it, a very long unbroken word (a
            typo'd name with no spaces, e.g. from a mistyped booking) would
            overflow past both edges of this centered/left-aligned column
            instead of wrapping, since there's no space for the browser to
            break the line at. */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {room.name}
          </h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {room.location} · Kapasitas {room.capacity} orang
          </p>
        </div>

        <div>
          {/* Font sizes scale off this section's own width (container query
              units, cqw) rather than the viewport (vw) or fixed breakpoints
              — this section is only ~40% of the viewport once split, so
              sizing off vw doesn't know how much room is actually available
              and can overflow past the section into the schedule column
              next to it. cqw is relative to this section's own content box,
              so it can never outgrow it regardless of screen size. */}
          <div className="flex items-end justify-center gap-4 md:justify-start">
            <span
              className="font-mono font-bold leading-none tabular-nums"
              style={{ fontSize: "clamp(2.5rem, 18cqw, 8rem)" }}
            >
              {timeMain}
            </span>
            <span
              className="mb-2 font-mono font-medium leading-none tabular-nums text-muted-foreground"
              style={{ fontSize: "clamp(1.25rem, 8cqw, 3.5rem)" }}
            >
              {seconds}
            </span>
          </div>
          <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
            {dateStr}
          </p>
        </div>

        <div className="flex min-w-0 w-full flex-col items-center gap-3 md:items-start">
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-base font-medium text-white sm:text-lg ${
              isInUse ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white/80" />
            {isInUse ? "Sedang Dipakai" : "Tersedia"}
          </span>
          <p className="w-full min-w-0 text-base text-muted-foreground sm:text-lg">
            {currentBooking ? (
              <>
                Dipakai oleh{" "}
                <span className="font-medium text-foreground">
                  {shortName(currentBooking.bookerName)}
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
      <section className="flex min-h-0 flex-1 flex-col">
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
                    {shortName(b.bookerName)}
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
