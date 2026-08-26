"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BUSINESS_END,
  BUSINESS_HOURS_LABEL,
  BUSINESS_START,
  getHourSlots,
  nowMinutesInAppTimezone,
  overlaps,
  todayStr,
  toMinutes,
} from "@/lib/timeSlots";
import type { Booking, Room } from "@/lib/types";

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground read-only:bg-muted read-only:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "text-sm font-medium leading-none";

function formatDateLong(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BookingModal({
  room,
  initialDate,
  initialStartTime,
  initialEndTime,
  fixedSlot = false,
  onClose,
  onBooked,
}: {
  room: Room;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  // When true, the date/time were already chosen on the search page —
  // show them as read-only info instead of editable inputs/slot picker,
  // and skip the email field for a quicker one-field booking flow.
  fixedSlot?: boolean;
  onClose: () => void;
  onBooked: (booking: Booking) => void;
}) {
  const { data: session } = useSession();
  const [date, setDate] = useState(initialDate ?? todayStr());
  const [startTime, setStartTime] = useState(initialStartTime ?? "09:00");
  const [endTime, setEndTime] = useState(initialEndTime ?? "10:00");
  const [purpose, setPurpose] = useState("");
  const [overtimeNote, setOvertimeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Fallback state for when there's no session (shouldn't normally happen
  // once the auth middleware is active, but keeps the form usable if it
  // somehow renders without one).
  const [bookerName, setBookerName] = useState(session?.user?.name ?? "");
  const [bookerEmail, setBookerEmail] = useState(session?.user?.email ?? "");

  // Used to disable already-passed hourly slots when the selected date is
  // today. Refreshed periodically in case the modal stays open across an
  // hour boundary.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

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
  const slots = useMemo(() => getHourSlots(existing), [existing]);

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
  const isPastDate = date < todayStr();
  const isToday = date === todayStr();
  const nowMinutes = nowMinutesInAppTimezone(now);
  const isPastTime =
    isToday && !invalidRange && toMinutes(endTime) <= nowMinutes;
  // Outside 08:00–18:00 (building lights shut off at 18:00) — routed
  // through the overtime flow instead of being blocked outright.
  const isOvertime =
    !invalidRange &&
    (toMinutes(startTime) < toMinutes(BUSINESS_START) ||
      toMinutes(endTime) > toMinutes(BUSINESS_END));
  const canSubmit =
    !submitting &&
    !invalidRange &&
    !isPastDate &&
    !isPastTime &&
    !conflict &&
    (!!session || bookerName.trim().length > 0) &&
    (!isOvertime || purpose.trim().length > 0);

  function selectSlot(start: string, end: string) {
    setStartTime(start);
    setEndTime(end);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isPastDate) {
      setError("Tidak bisa booking untuk tanggal yang sudah lewat.");
      return;
    }
    if (invalidRange) {
      setError("Jam mulai harus lebih awal dari jam selesai.");
      return;
    }
    if (isPastTime) {
      setError("Jam ini sudah lewat untuk hari ini.");
      return;
    }
    if (conflict) {
      setError(
        `Jam ini sudah dibooking oleh ${conflict.bookerName} (${conflict.startTime}–${conflict.endTime}).`
      );
      return;
    }
    if (isOvertime && !purpose.trim()) {
      setError("Keperluan wajib diisi untuk pengajuan overtime.");
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
          isOvertime,
          overtimeNote,
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
          {room.requiresApproval && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Ruangan ini terbatas. Booking akan berstatus{" "}
              <span className="font-medium">menunggu persetujuan</span> office
              management sebelum terkonfirmasi.
            </div>
          )}

          {isOvertime && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Jam ini di luar jam operasional ({BUSINESS_HOURS_LABEL}) —
              gedung mematikan lampu pukul 18.00. Booking ini akan diajukan
              sebagai <span className="font-medium">surat overtime</span> dan
              perlu persetujuan office management. Isi keperluan dengan
              jelas.
            </div>
          )}

          <div className={fixedSlot ? "" : "grid grid-cols-2 gap-4"}>
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
            {!fixedSlot && (
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
            )}
          </div>

          {fixedSlot ? (
            /* Date/time were already chosen on the search page — just confirm them. */
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <p className="font-medium">{formatDateLong(date)}</p>
              <p className="font-mono tabular-nums text-muted-foreground">
                {startTime}–{endTime}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className={labelClass}>Tanggal</label>
                <input
                  type="date"
                  required
                  min={todayStr()}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setLoadingSlots(true);
                    setError(null);
                  }}
                  className={inputClass}
                />
                {isPastDate && (
                  <p className="text-xs text-muted-foreground">
                    Tidak bisa booking untuk tanggal yang sudah lewat.
                  </p>
                )}
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
                    const isPastSlot =
                      isToday && toMinutes(slot.end) <= nowMinutes;
                    const isDisabled = isBooked || isPastDate || isPastSlot;
                    const isSelected =
                      !isDisabled &&
                      toMinutes(slot.start) >= toMinutes(startTime) &&
                      toMinutes(slot.end) <= toMinutes(endTime);
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => selectSlot(slot.start, slot.end)}
                        title={
                          isBooked
                            ? `Dibooking oleh ${slot.booking!.bookerName}`
                            : isPastDate
                              ? "Tanggal sudah lewat"
                              : isPastSlot
                                ? "Jam ini sudah lewat"
                                : `Pilih ${slot.start}`
                        }
                        className={`rounded-md border px-1 py-1.5 text-center font-mono text-xs tabular-nums transition-colors ${
                          isDisabled
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
                  Klik slot untuk memilih, atau atur manual di bawah. Slot
                  terisi tidak bisa dipilih.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Jam Mulai</label>
                  <input
                    type="time"
                    required
                    disabled={isPastDate}
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
                    disabled={isPastDate}
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setError(null);
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

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
            <label className={labelClass}>
              Keperluan {isOvertime ? "" : "(opsional)"}
            </label>
            <textarea
              required={isOvertime}
              disabled={isPastDate}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="Rapat tim, presentasi, dll."
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {isOvertime && (
            <div className="space-y-1.5">
              <label className={labelClass}>
                Dokumen/Keterangan Pendukung (opsional)
              </label>
              <textarea
                disabled={isPastDate}
                value={overtimeNote}
                onChange={(e) => setOvertimeNote(e.target.value)}
                rows={2}
                placeholder="Link approval atasan, dokumen pendukung, atau keterangan tambahan lain"
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          {(error || conflict || invalidRange || isPastTime) && (
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
                    : isPastTime
                      ? "Jam ini sudah lewat untuk hari ini."
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
            {submitting
              ? "Menyimpan…"
              : isOvertime
                ? "Ajukan Surat Overtime"
                : room.requiresApproval
                  ? "Ajukan Persetujuan"
                  : "Simpan Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
