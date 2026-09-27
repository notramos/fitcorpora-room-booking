"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BookingModal from "./BookingModal";
import RoomDetailModal from "./RoomDetailModal";
import ThemeToggle from "./ThemeToggle";
import MobileBottomNav from "./MobileBottomNav";
import TimeRangePicker from "./TimeRangePicker";
import {
  BUSINESS_END,
  BUSINESS_HOURS_LABEL,
  BUSINESS_START,
  nowMinutesInAppTimezone,
  overlaps,
  todayStr,
  toMinutes,
} from "@/lib/timeSlots";
import type { Booking, Room } from "@/lib/types";

const MAX_ADVANCE_DAYS = 30;

function maxDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + MAX_ADVANCE_DAYS);
  return todayStr(d);
}

function dateFromToday(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return todayStr(date);
}

const TIME_STEP_MINUTES = 30;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Rounds "now" up to the next half-hour mark, e.g. 09:12 -> 09:30,
// 09:45 -> 10:00, then clamps into 08:00–18:00 — so the search form opens
// on a normal bookable slot by default. Overtime (outside that window) is
// still reachable by typing a time manually; it just isn't the default.
function nextRoundedTime(from: Date): string {
  const minutes = nowMinutesInAppTimezone(from);
  const rounded = Math.ceil(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  const clamped = Math.min(
    Math.max(rounded, toMinutes(BUSINESS_START)),
    toMinutes(BUSINESS_END) - 60
  );
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${pad(h)}:${pad(m)}`;
}

function addOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${pad((h + 1) % 24)}:${pad(m)}`;
}

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
const labelClass = "text-sm font-medium leading-none";

interface RoomResult {
  room: Room;
  available: boolean;
  match: boolean;
  conflict: Booking | null;
}

function ResultGroup({
  title,
  subtitle,
  items,
  bestId,
  isOvertime,
  onBook,
  onDetail,
}: {
  title: string;
  subtitle: string;
  items: RoomResult[];
  bestId: string | undefined;
  isOvertime: boolean;
  onBook: (room: Room) => void;
  onDetail: (room: Room) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">
          {title} <span className="text-muted-foreground">· {items.length}</span>
        </h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((result) => (
          <RoomResultCard
            key={result.room.id}
            result={result}
            isBest={result.room.id === bestId}
            isOvertime={isOvertime}
            onBook={onBook}
            onDetail={onDetail}
          />
        ))}
      </div>
    </div>
  );
}

function RoomResultCard({
  result: { room, available, conflict },
  isBest,
  isOvertime,
  onBook,
  onDetail,
}: {
  result: RoomResult;
  isBest: boolean;
  isOvertime: boolean;
  onBook: (room: Room) => void;
  onDetail: (room: Room) => void;
}) {
  return (
    <div
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md ${
        isBest ? "ring-1 ring-primary/40" : ""
      } ${available ? "" : "opacity-75"}`}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5 sm:h-7 sm:w-7"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shadow-sm ${
            available
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {available ? "Tersedia" : "Terisi"}
        </span>
      </div>

      <div className="min-w-0 flex-1 p-3 pb-2 sm:p-4 sm:pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
          <button
            onClick={() => onDetail(room)}
            className="line-clamp-2 min-w-0 max-w-full text-left text-sm font-semibold leading-snug tracking-tight hover:underline sm:text-base"
          >
            {room.name}
          </button>
          {isBest && (
            <span className="hidden items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground sm:inline-flex">
              Rekomendasi
            </span>
          )}
          {isOvertime && (
            <span className="hidden items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300 sm:inline-flex">
              Overtime
            </span>
          )}
          {!isOvertime && room.requiresApproval && (
            <span className="hidden items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300 sm:inline-flex">
              Perlu Persetujuan
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
          {room.location} · Kapasitas {room.capacity} orang
        </p>
        {(isOvertime || room.requiresApproval) && available && (
          <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 sm:hidden">
            {isOvertime ? "Perlu approval overtime" : "Perlu persetujuan"}
          </p>
        )}
        <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
          {available
            ? isOvertime
              ? "Di luar jam operasional — perlu diajukan sebagai surat overtime"
              : room.requiresApproval
                ? "Ruangan terbatas — booking Anda perlu disetujui office management dulu"
                : "Sesuai kebutuhan Anda"
            : `Dipakai atau sedang menunggu persetujuan · ${conflict?.bookerName} (${conflict?.startTime}–${conflict?.endTime})`}
        </p>
        <button
          onClick={() => onDetail(room)}
          className="mt-1 hidden text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:block"
        >
          Lihat detail & fasilitas
        </button>
      </div>

      <button
        onClick={() => onBook(room)}
        disabled={!available}
        aria-label={
          available
            ? isOvertime
              ? `Ajukan overtime untuk ${room.name}`
              : room.requiresApproval
                ? `Ajukan booking ${room.name}`
                : `Booking ${room.name}`
            : `${room.name} tidak tersedia`
        }
        className="mx-3 mb-3 inline-flex h-11 min-w-0 shrink-0 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 sm:mx-4 sm:mb-4 sm:h-10 sm:rounded-md sm:px-4"
      >
        <span className="truncate">{available ? "Pilih Ruangan" : "Tidak Tersedia"}</span>
      </button>
    </div>
  );
}

export default function SearchBooking({
  initialRooms,
}: {
  initialRooms: Room[];
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  const [rooms] = useState(initialRooms);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState(() => nextRoundedTime(new Date()));
  const [endTime, setEndTime] = useState(() =>
    addOneHour(nextRoundedTime(new Date()))
  );
  // Minimum capacity filter — kept as a string so it can be left blank
  // (blank = no capacity filter). Blank/invalid parses to 0.
  const [capacity, setCapacity] = useState("");
  const minCap = Math.max(0, parseInt(capacity, 10) || 0);
  const [searched, setSearched] = useState(false);

  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [lastBooked, setLastBooked] = useState<Booking | null>(null);

  function changeDate(nextDate: string) {
    setLoading(true);
    setDate(nextDate);
    setSearched(false);
  }

  useEffect(() => {
    let cancelled = false;
    const loadBookings = () => {
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
    };

    loadBookings();
    const refreshInterval = window.setInterval(loadBookings, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [date]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedDateIsToday = date === todayStr();
  const currentMinutes = nowMinutesInAppTimezone(new Date(clockNow));

  function getUnavailableReason(rangeStart: string, rangeEnd: string) {
    if (loading) return "Sedang memuat jadwal ruangan";
    if (selectedDateIsToday && toMinutes(rangeStart) < currentMinutes) {
      return "Waktu ini sudah terlewat";
    }

    const eligibleRooms =
      minCap > 0 ? rooms.filter((room) => room.capacity >= minCap) : rooms;
    const hasAvailableRoom = eligibleRooms.some(
      (room) =>
        !bookings.some(
          (booking) =>
            booking.roomId === room.id &&
            overlaps(rangeStart, rangeEnd, booking.startTime, booking.endTime)
        )
    );

    return hasAvailableRoom ? null : "Tidak ada ruangan yang tersedia pada jam ini";
  }

  const invalidRange = startTime >= endTime;
  const isOvertime =
    !invalidRange &&
    (toMinutes(startTime) < toMinutes(BUSINESS_START) ||
      toMinutes(endTime) > toMinutes(BUSINESS_END));

  const results = useMemo<RoomResult[]>(() => {
    if (!searched || invalidRange) return [];

    // Rooms below the requested capacity are excluded entirely — the
    // results only ever show rooms that actually fit.
    const eligible =
      minCap > 0 ? rooms.filter((r) => r.capacity >= minCap) : rooms;

    const scored = eligible.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId === room.id);
      const conflict =
        roomBookings.find((b) =>
          overlaps(startTime, endTime, b.startTime, b.endTime)
        ) ?? null;
      const available = !conflict;
      return {
        room,
        available,
        match: available,
        conflict,
      };
    });

    // Available rooms first, then smallest-fitting room first so the
    // tightest match is at the top.
    return scored.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.room.capacity - b.room.capacity;
    });
  }, [searched, invalidRange, rooms, bookings, startTime, endTime, minCap]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
              </svg>
            </div>
            <h1 className="text-sm font-semibold leading-tight tracking-tight">
              Fitcorpora Room Booking
            </h1>
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/jadwal"
              className="hidden h-8 items-center justify-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
            >
              Jadwal
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/approval"
                  className="hidden h-8 items-center justify-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                >
                  Persetujuan
                </Link>
                <Link
                  href="/admin/rooms"
                  className="hidden h-8 items-center justify-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
                >
                  Kelola Ruangan
                </Link>
              </>
            )}
            <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Logout"
              title="Logout"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 sm:px-6 sm:py-10 sm:pb-10">
        <div className="mb-5 flex flex-col gap-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-sm">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Office workspace
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
              Cari ruang meeting
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Pilih waktu dan kapasitas yang dibutuhkan. Kami akan menampilkan
              ruangan yang paling sesuai beserta status ketersediaannya.
            </p>
          </div>
          <div className="hidden grid-cols-2 gap-2 text-xs sm:grid sm:min-w-[13rem]">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-muted-foreground">Total ruangan</p>
              <p className="mt-1 text-lg font-semibold">{rooms.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-muted-foreground">Batas booking</p>
              <p className="mt-1 text-lg font-semibold">30 hari</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-3 shadow-sm sm:gap-4 sm:rounded-2xl sm:grid-cols-2 sm:p-6 lg:grid-cols-5"
        >
          <div className="sm:col-span-2 lg:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold sm:text-base">Cari ketersediaan</h3>
                <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                  Slot yang sudah terlewat atau bentrok akan otomatis dinonaktifkan.
                </p>
              </div>
              <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                WIB · {BUSINESS_HOURS_LABEL}
              </span>
            </div>
          </div>

          <section className="space-y-2 rounded-xl border bg-muted/30 p-2.5 sm:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                1
              </span>
              <p className="text-xs font-semibold">Pilih tanggal</p>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  changeDate(dateFromToday(0));
                }}
                className={`h-8 rounded-lg border text-[11px] font-semibold transition-colors ${
                  date === dateFromToday(0) ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
              >
                Hari ini
              </button>
              <button
                type="button"
                onClick={() => {
                  changeDate(dateFromToday(1));
                }}
                className={`h-8 rounded-lg border text-[11px] font-semibold transition-colors ${
                  date === dateFromToday(1) ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
              >
                Besok
              </button>
            </div>

            <input
              type="date"
              aria-label="Pilih tanggal booking"
              required
              min={todayStr()}
              max={maxDateStr()}
              value={date}
              onChange={(e) => {
                changeDate(e.target.value);
              }}
              className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </section>

          <TimeRangePicker
            startTime={startTime}
            endTime={endTime}
            getUnavailableReason={getUnavailableReason}
            onChange={(nextStart, nextEnd) => {
              setStartTime(nextStart);
              setEndTime(nextEnd);
              setSearched(false);
            }}
          />

          <div className="flex items-center gap-3 rounded-xl border px-2.5 py-2 sm:hidden">
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-medium" htmlFor="capacity-mobile">
                Kapasitas
              </label>
              <p className="truncate text-[10px] text-muted-foreground">
                Opsional · minimum peserta
              </p>
            </div>
            <input
              id="capacity-mobile"
              type="text"
              inputMode="numeric"
              aria-label="Kapasitas minimal"
              placeholder="6"
              value={capacity}
              onChange={(e) => {
                setCapacity(e.target.value.replace(/\D/g, ""));
                setSearched(false);
              }}
              className="h-9 w-20 shrink-0 rounded-lg border bg-background px-2 text-center text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="hidden space-y-1.5 sm:block">
            <label className={labelClass}>Tanggal</label>
            <input
              type="date"
              required
              min={todayStr()}
              max={maxDateStr()}
              value={date}
              onChange={(e) => {
                changeDate(e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div className="hidden space-y-1.5 sm:block">
            <label className={labelClass}>Jam Mulai</label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setSearched(false);
              }}
              className={inputClass}
            />
          </div>
          <div className="hidden space-y-1.5 sm:block">
            <label className={labelClass}>Jam Selesai</label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setSearched(false);
              }}
              className={inputClass}
            />
          </div>
          <div className="hidden space-y-1.5 sm:block">
            <label className={labelClass}>
              Kapasitas{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="input number"
              value={capacity}
              onChange={(e) => {
                setCapacity(e.target.value.replace(/\D/g, ""));
                setSearched(false);
              }}
              className={inputClass}
            />
          </div>

          {invalidRange && (
            <p className="text-xs text-destructive sm:col-span-2 sm:text-sm lg:col-span-5">
              Jam mulai harus lebih awal dari jam selesai.
            </p>
          )}
          {isOvertime && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900 sm:col-span-2 sm:px-3 sm:text-sm dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 lg:col-span-5">
              Di luar jam operasional {BUSINESS_HOURS_LABEL}; booking akan diajukan sebagai overtime.
            </p>
          )}

          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={invalidRange || loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 sm:h-11 sm:w-auto sm:min-w-40 sm:rounded-md"
            >
              {loading ? "Memuat…" : "Cari Ruangan"}
            </button>
          </div>
        </form>

        {lastBooked && (
          <div
            className={`mt-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
              lastBooked.status === "pending"
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            <p>
              {lastBooked.isOvertime
                ? "Surat overtime terkirim dan menunggu persetujuan office management. Slot sudah diamankan untuk Anda."
                : lastBooked.status === "pending"
                  ? "Booking terkirim dan menunggu persetujuan office management. Slot sudah diamankan untuk Anda."
                  : "Booking berhasil dikonfirmasi."}
            </p>
            <button
              onClick={() => setLastBooked(null)}
              className="shrink-0 text-xs font-medium underline"
            >
              Tutup
            </button>
          </div>
        )}

        {searched && !invalidRange && results.length === 0 && (
          <p className="mt-8 rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            {minCap > 0
              ? `Tidak ada ruangan dengan kapasitas minimal ${minCap} orang.`
              : "Tidak ada ruangan."}
          </p>
        )}

        {searched && !invalidRange && results.length > 0 && (
          <div className="mt-8 space-y-8">
            <ResultGroup
              title="Tersedia"
              subtitle={`${results.filter((r) => r.available).length} ruangan bisa dipesan di jam ini`}
              items={results.filter((r) => r.available)}
              bestId={results.find((r) => r.match)?.room.id}
              isOvertime={isOvertime}
              onBook={setBookingRoom}
              onDetail={setDetailRoom}
            />
            <ResultGroup
              title="Tidak Tersedia"
              subtitle="Sudah dipakai orang lain di jam yang Anda pilih"
              items={results.filter((r) => !r.available)}
              bestId={undefined}
              isOvertime={isOvertime}
              onBook={setBookingRoom}
              onDetail={setDetailRoom}
            />
          </div>
        )}
      </main>

      {bookingRoom && (
        <BookingModal
          room={bookingRoom}
          initialDate={date}
          initialStartTime={startTime}
          initialEndTime={endTime}
          fixedSlot
          onClose={() => setBookingRoom(null)}
          onBooked={(booking) => {
            setBookingRoom(null);
            setLastBooked(booking);
            fetch(`/api/bookings?date=${date}`)
              .then((res) => (res.ok ? res.json() : []))
              .then((data: Booking[]) => setBookings(data))
              .catch(() => undefined);
          }}
        />
      )}

      {detailRoom && (
        <RoomDetailModal room={detailRoom} onClose={() => setDetailRoom(null)} />
      )}

      <MobileBottomNav />
    </div>
  );
}
