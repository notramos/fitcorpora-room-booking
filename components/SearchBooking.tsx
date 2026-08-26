"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BookingModal from "./BookingModal";
import RoomDetailModal from "./RoomDetailModal";
import ThemeToggle from "./ThemeToggle";
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
  capacityOk: boolean;
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
  result: { room, available, capacityOk, conflict },
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
      className={`relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-5 pl-6 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        isBest ? "ring-1 ring-primary/40" : ""
      } ${available ? "" : "opacity-75"}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${
          available ? "bg-emerald-500" : "bg-red-400"
        }`}
        aria-hidden="true"
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onDetail(room)}
            className="font-semibold tracking-tight hover:underline"
          >
            {room.name}
          </button>
          {isBest && (
            <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              Rekomendasi
            </span>
          )}
          {isOvertime && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Overtime
            </span>
          )}
          {!isOvertime && room.requiresApproval && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Perlu Persetujuan
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {room.location} · Kapasitas {room.capacity} orang
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {available
            ? isOvertime
              ? "Di luar jam operasional — perlu diajukan sebagai surat overtime"
              : room.requiresApproval
                ? "Ruangan terbatas — booking Anda perlu disetujui office management dulu"
                : capacityOk
                  ? "Sesuai kebutuhan Anda"
                  : "Tersedia, tapi kapasitas di bawah yang diminta"
            : `Dipakai atau sedang menunggu persetujuan · ${conflict?.bookerName} (${conflict?.startTime}–${conflict?.endTime})`}
        </p>
        <button
          onClick={() => onDetail(room)}
          className="mt-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Lihat detail & fasilitas
        </button>
      </div>

      <button
        onClick={() => onBook(room)}
        disabled={!available}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isOvertime
          ? "Ajukan Overtime"
          : room.requiresApproval
            ? "Ajukan Booking"
            : "Booking"}
      </button>
    </div>
  );
}

export default function SearchBooking({
  initialRooms,
}: {
  initialRooms: Room[];
}) {
  const [rooms] = useState(initialRooms);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState(() => nextRoundedTime(new Date()));
  const [endTime, setEndTime] = useState(() =>
    addOneHour(nextRoundedTime(new Date()))
  );
  const [capacity, setCapacity] = useState(1);
  const [searched, setSearched] = useState(false);

  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [lastBooked, setLastBooked] = useState<Booking | null>(null);

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

  const invalidRange = startTime >= endTime;
  const isOvertime =
    !invalidRange &&
    (toMinutes(startTime) < toMinutes(BUSINESS_START) ||
      toMinutes(endTime) > toMinutes(BUSINESS_END));

  const results = useMemo<RoomResult[]>(() => {
    if (!searched || invalidRange) return [];

    const scored = rooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId === room.id);
      const conflict =
        roomBookings.find((b) =>
          overlaps(startTime, endTime, b.startTime, b.endTime)
        ) ?? null;
      const available = !conflict;
      const capacityOk = room.capacity >= capacity;
      return {
        room,
        available,
        capacityOk,
        match: available && capacityOk,
        conflict,
      };
    });

    // Prioritize rooms that fully match the search (available + enough
    // capacity), then rooms with just enough capacity, keeping the rest
    // visible but lower in the list.
    return scored.sort((a, b) => {
      if (a.match !== b.match) return a.match ? -1 : 1;
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.capacityOk !== b.capacityOk) return a.capacityOk ? -1 : 1;
      return a.room.capacity - b.room.capacity;
    });
  }, [searched, invalidRange, rooms, bookings, startTime, endTime, capacity]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-3">
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

      {/* Small-screen nav row — Jadwal collapses out of the header above sm */}
      <div className="flex items-center gap-1 border-b px-6 py-2 sm:hidden">
        <Link
          href="/jadwal"
          className="inline-flex h-8 flex-1 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Jadwal
        </Link>
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Cari &amp; Booking Ruangan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Masukkan tanggal, jam, dan kapasitas yang dibutuhkan untuk melihat
            rekomendasi ruangan.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 gap-4 rounded-xl border bg-card p-6 shadow-sm sm:grid-cols-4"
        >
          <div className="space-y-1.5">
            <label className={labelClass}>Tanggal</label>
            <input
              type="date"
              required
              min={todayStr()}
              max={maxDateStr()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSearched(false);
              }}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <label className={labelClass}>Kapasitas</label>
            <input
              type="number"
              min={1}
              required
              value={capacity}
              onChange={(e) => {
                setCapacity(Math.max(1, Number(e.target.value) || 1));
                setSearched(false);
              }}
              className={inputClass}
            />
          </div>

          {invalidRange && (
            <p className="sm:col-span-4 text-sm text-destructive">
              Jam mulai harus lebih awal dari jam selesai.
            </p>
          )}
          {isOvertime && (
            <p className="sm:col-span-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Jam operasional gedung {BUSINESS_HOURS_LABEL} (lampu mati pukul
              18.00). Booking di luar jam ini akan diajukan sebagai surat
              overtime ke office management.
            </p>
          )}

          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={invalidRange || loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
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

        {searched && !invalidRange && (
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
    </div>
  );
}
