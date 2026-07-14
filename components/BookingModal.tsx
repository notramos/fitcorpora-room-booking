"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Booking, Room } from "@/lib/types";

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground read-only:bg-muted read-only:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "text-sm font-medium leading-none";

// Business hours for the slot picker (07:00 – 21:00, hourly).
const START_HOUR = 7;
const END_HOUR = 21;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function hh(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return (
    toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
  );
}

export default function BookingModal({
  room,
  onClose,
  onBooked,
}: {
  room: Room;
  onClose: () => void;
  onBooked: (booking: Booking) => void;
}) {
  const { data: session } = useSession();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // TEMP: while auth is disabled there's no session, so let the tester type these in.
  const [bookerName, setBookerName] = useState(session?.user?.name ?? "");
  const [bookerEmail, setBookerEmail] = useState(session?.user?.email ?? "");

  const [existing, setExisting] = useState<Booking[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // All setState calls run after `await`, so this is safe to invoke from an
  // effect without triggering cascading synchronous renders. The loading flag
  // is switched on via the date-change handler / initial state instead.
  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/bookings?roomId=${encodeURIComponent(room.id)}&date=${date}`
      );
      setExisting(res.ok ? ((await res.json()) as Booking[]) : []);
    } catch {
      setExisting([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [room.id, date]);

  useEffect(() => {
    // Legitimate data-fetch on open / date change; state updates happen after
    // the awaited fetch resolves, not synchronously during this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Hourly slots with their booked state + who booked them.
  const slots = useMemo(() => {
    const result: {
      start: string;
      end: string;
      booking: Booking | null;
    }[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      const start = hh(h);
      const end = hh(h + 1);
      const booking =
        existing.find((b) => overlaps(start, end, b.startTime, b.endTime)) ??
        null;
      result.push({ start, end, booking });
    }
    return result;
  }, [existing]);

  const sortedBookings = useMemo(
    () =>
      [...existing].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
    [existing]
  );

  // Live conflict detection against the currently-chosen range.
  const conflict = useMemo(() => {
    if (!startTime || !endTime || startTime >= endTime) return null;
    return (
      existing.find((b) =>
        overlaps(startTime, endTime, b.startTime, b.endTime)
      ) ?? null
    );
  }, [startTime, endTime, existing]);

  const invalidRange = startTime >= endTime;
  const canSubmit =
    !submitting && !invalidRange && !conflict && purpose.trim().length > 0;

  function selectSlot(start: string, end: string) {
    setStartTime(start);
    setEndTime(end);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (invalidRange) {
      setError("Jam mulai harus lebih awal dari jam selesai.");
      return;
    }
    if (conflict) {
      setError(
        `Jam ini sudah dibooking oleh ${conflict.bookerName} (${conflict.startTime}–${conflict.endTime}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          date,
          startTime,
          endTime,
          purpose,
          bookerName: session?.user?.name ?? bookerName,
          bookerEmail: session?.user?.email ?? bookerEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal membuat booking.");
        // Someone may have booked in the meantime — refresh slot availability.
        loadBookings();
        return;
      }

      onBooked(data as Booking);
      onClose();
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-xl border bg-card text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col space-y-1.5 border-b p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Booking {room.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {room.location} · Kapasitas {room.capacity} orang
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Nama Pemesan</label>
              <input
                type="text"
                required={!session}
                readOnly={!!session}
                placeholder="Nama"
                value={session?.user?.name ?? bookerName}
                onChange={(e) => setBookerName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Email Pemesan</label>
              <input
                type="email"
                required={!session}
                readOnly={!!session}
                placeholder="email@kantor.com"
                value={session?.user?.email ?? bookerEmail}
                onChange={(e) => setBookerEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Tanggal</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setLoadingSlots(true);
                setError(null);
              }}
              className={inputClass}
            />
          </div>

          {/* Time-slot picker: booked slots are disabled */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Pilih Jam</label>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm border bg-background" />
                  Kosong
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  Dipilih
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-muted line-through" />
                  Terisi
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {slots.map((slot) => {
                const isBooked = !!slot.booking;
                const isSelected =
                  !isBooked &&
                  toMinutes(slot.start) >= toMinutes(startTime) &&
                  toMinutes(slot.end) <= toMinutes(endTime);
                return (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={isBooked}
                    onClick={() => selectSlot(slot.start, slot.end)}
                    title={
                      isBooked
                        ? `Dibooking oleh ${slot.booking!.bookerName}`
                        : `Pilih ${slot.start}`
                    }
                    className={`rounded-md border px-1 py-1.5 text-center font-mono text-xs tabular-nums transition-colors ${
                      isBooked
                        ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/60 line-through"
                        : isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {slot.start}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Klik slot untuk memilih, atau atur manual di bawah. Slot terisi
              tidak bisa dipilih.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Jam Mulai</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setError(null);
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
                  setError(null);
                }}
                className={inputClass}
              />
            </div>
          </div>

          {/* Info: already-booked slots for this room & date */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sudah Dibooking {date ? `· ${date}` : ""}
            </p>
            {loadingSlots ? (
              <p className="text-sm text-muted-foreground">Memuat…</p>
            ) : sortedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada booking pada tanggal ini.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {sortedBookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-mono text-xs font-medium tabular-nums">
                      {b.startTime}–{b.endTime}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
                      {b.bookerName}
                      {b.purpose ? ` · ${b.purpose}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Keperluan</label>
            <textarea
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="Rapat tim, presentasi, dll."
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
          </div>

          {(error || conflict || invalidRange) && (
            <div className="flex items-start gap-2 rounded-md border border-foreground/20 bg-muted px-3 py-2 text-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>
                {error ??
                  (invalidRange
                    ? "Jam mulai harus lebih awal dari jam selesai."
                    : `Jam ${startTime}–${endTime} bentrok dengan booking ${conflict?.bookerName} (${conflict?.startTime}–${conflict?.endTime}).`)}
              </span>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Batal
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Menyimpan…" : "Simpan Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
