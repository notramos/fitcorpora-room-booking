"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  BUSINESS_END,
  BUSINESS_HOURS_LABEL,
  BUSINESS_START,
  todayStr,
  toMinutes,
} from "@/lib/timeSlots";
import type { Booking, Room } from "@/lib/types";
import AttendeePicker from "./AttendeePicker";

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
const labelClass = "text-sm font-medium leading-none";

// Admin-only: log a booking someone requested by walk-in / phone / chat.
// The name typed here is what the room tablet shows, and the booking is
// confirmed immediately (forceApproved) so it appears without a separate
// approval step.
export default function AdminBookingModal({
  rooms,
  onClose,
  onCreated,
}: {
  rooms: Room[];
  onClose: () => void;
  onCreated: (booking: Booking) => void;
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([]);
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const invalidRange = startTime >= endTime;
  const isOvertime = useMemo(
    () =>
      !invalidRange &&
      (toMinutes(startTime) < toMinutes(BUSINESS_START) ||
        toMinutes(endTime) > toMinutes(BUSINESS_END)),
    [invalidRange, startTime, endTime]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!roomId) return setError("Pilih ruangan.");
    if (!bookerName.trim()) return setError("Nama pemesan wajib diisi.");
    if (invalidRange)
      return setError("Jam mulai harus lebih awal dari jam selesai.");
    if (isOvertime && !purpose.trim())
      return setError("Keperluan wajib diisi untuk jam di luar operasional.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          date,
          startTime,
          endTime,
          purpose,
          bookerName: bookerName.trim(),
          bookerEmail: bookerEmail.trim(),
          attendeeEmails,
          isOvertime,
          overtimeNote: "",
          forceApproved: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat booking.");
        return;
      }
      onCreated(data as Booking);
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
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-xl border bg-card text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Tambah Booking (atas nama pemesan)
          </h2>
          <p className="text-sm text-muted-foreground">
            Booking langsung terkonfirmasi dan tampil di tablet ruangan.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          <div className="space-y-1.5">
            <label className={labelClass}>Ruangan</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={inputClass}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.location}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Nama Pemesan</label>
            <input
              type="text"
              required
              value={bookerName}
              onChange={(e) => setBookerName(e.target.value)}
              placeholder="Nama orang yang meminta ruangan"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Email Pemesan (opsional)</label>
            <input
              type="email"
              value={bookerEmail}
              onChange={(e) => setBookerEmail(e.target.value)}
              placeholder="email@kantor.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Tanggal</label>
            <input
              type="date"
              required
              min={todayStr()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Jam Mulai</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Jam Selesai</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {isOvertime && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Di luar jam operasional ({BUSINESS_HOURS_LABEL}) — isi keperluan
              dengan jelas.
            </p>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>
              Keperluan {isOvertime ? "" : "(opsional)"}
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="Rapat tim, presentasi, dll."
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Peserta Meeting (opsional)</label>
            <AttendeePicker value={attendeeEmails} onChange={setAttendeeEmails} disabled={submitting} />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
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
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Menyimpan…" : "Simpan Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
