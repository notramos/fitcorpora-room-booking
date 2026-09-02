"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminBookingModal from "./AdminBookingModal";
import EditBookingModal from "./EditBookingModal";
import Pagination from "./Pagination";
import ThemeToggle from "./ThemeToggle";
import type { Booking, Room } from "@/lib/types";

const PAGE_SIZE = 10;

function formatDateLong(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const btnBase =
  "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50";
const btnOutline = `${btnBase} border bg-background hover:bg-accent hover:text-accent-foreground`;
const btnPrimary = `${btnBase} bg-primary px-4 text-primary-foreground hover:bg-primary/90`;
const btnDanger = `${btnBase} border border-red-200 bg-background px-4 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`;
const fieldClass =
  "h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

type StatusFilter = "all" | "approved" | "pending";

export default function AdminBookingsManager({
  initialBookings,
  rooms,
}: {
  initialBookings: Booking[];
  rooms: Room[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState(false);

  const [q, setQ] = useState("");
  const [roomId, setRoomId] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [date, setDate] = useState<string>("");
  const [page, setPage] = useState(1);

  // Any filter change jumps back to the first page.
  useEffect(() => setPage(1), [q, roomId, status, date]);

  const roomsById = useMemo(
    () => new Map(rooms.map((r) => [r.id, r])),
    [rooms]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bookings
      .filter((b) => {
        if (roomId !== "all" && b.roomId !== roomId) return false;
        if (status !== "all" && b.status !== status) return false;
        if (date && b.date !== date) return false;
        if (needle) {
          const room = roomsById.get(b.roomId);
          const hay = [
            b.bookerName,
            b.bookerEmail,
            b.purpose,
            b.overtimeNote,
            room?.name ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.startTime.localeCompare(a.startTime)
      );
  }, [bookings, q, roomId, status, date, roomsById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filtersActive =
    q.trim() !== "" || roomId !== "all" || status !== "all" || date !== "";

  function upsert(updated: Booking) {
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  }

  async function call(
    id: string,
    url: string,
    method: "POST" | "DELETE",
    onOk: () => void
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(url, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Gagal memproses permintaan.");
        return;
      }
      onOk();
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setBusyId(null);
    }
  }

  function approve(b: Booking) {
    void call(b.id, `/api/bookings/${b.id}/approve`, "POST", () =>
      upsert({ ...b, status: "approved" })
    );
  }

  function resetReminder(b: Booking) {
    void call(b.id, `/api/bookings/${b.id}/reset-reminder`, "POST", () =>
      upsert({ ...b, reminderSent: false })
    );
  }

  function remove(b: Booking) {
    const room = roomsById.get(b.roomId);
    if (
      !confirm(
        `Hapus booking ${b.bookerName} — ${room?.name ?? "ruangan"} ${b.date} ${b.startTime}–${b.endTime}? Tindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }
    void call(b.id, `/api/bookings/${b.id}`, "DELETE", () =>
      setBookings((prev) => prev.filter((x) => x.id !== b.id))
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className={`${btnOutline} gap-1.5`}>
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

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kelola Semua Booking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cari, ubah, hapus, setujui, atau atur ulang pengingat untuk booking
            apa pun — pengganti mengedit spreadsheet secara manual.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className={`${btnPrimary} shrink-0`}
        >
          + Tambah Booking
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, email, keperluan, ruangan…"
          className={`${fieldClass} min-w-[14rem] flex-1`}
        />
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className={fieldClass}
        >
          <option value="all">Semua ruangan</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={fieldClass}
        >
          <option value="all">Semua status</option>
          <option value="approved">Disetujui</option>
          <option value="pending">Menunggu</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={fieldClass}
        />
        {filtersActive && (
          <button
            onClick={() => {
              setQ("");
              setRoomId("all");
              setStatus("all");
              setDate("");
            }}
            className={btnOutline}
          >
            Reset
          </button>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {filtered.length} dari {bookings.length} booking
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada booking yang cocok dengan filter.
        </p>
      ) : (
        <div className="space-y-3">
          {pageItems.map((b) => {
            const room = roomsById.get(b.roomId);
            return (
              <div
                key={b.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight">
                      {room?.name ?? "(ruangan terhapus)"}
                    </p>
                    {b.status === "pending" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Menunggu
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Disetujui
                      </span>
                    )}
                    {b.isOvertime && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-300">
                        Overtime
                      </span>
                    )}
                    {b.reminderSent && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Pengingat terkirim
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateLong(b.date)} · {b.startTime}–{b.endTime}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{b.bookerName}</span>
                    {b.bookerEmail ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {b.bookerEmail}
                      </span>
                    ) : null}
                  </p>
                  {b.purpose && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {b.purpose}
                    </p>
                  )}
                  {b.overtimeNote && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pendukung: {b.overtimeNote}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <button
                    onClick={() => setEditing(b)}
                    disabled={busyId === b.id}
                    className={btnOutline}
                  >
                    Edit
                  </button>
                  {b.status === "pending" && (
                    <button
                      onClick={() => approve(b)}
                      disabled={busyId === b.id}
                      className={btnPrimary}
                    >
                      Setujui
                    </button>
                  )}
                  {b.status === "approved" && b.reminderSent && (
                    <button
                      onClick={() => resetReminder(b)}
                      disabled={busyId === b.id}
                      className={btnOutline}
                    >
                      Atur ulang pengingat
                    </button>
                  )}
                  <button
                    onClick={() => remove(b)}
                    disabled={busyId === b.id}
                    className={btnDanger}
                  >
                    {busyId === b.id ? "…" : "Hapus"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

      {editing && (
        <EditBookingModal
          booking={editing}
          isAdmin
          onClose={() => setEditing(null)}
          onSaved={(updated) => upsert(updated)}
        />
      )}

      {creating && (
        <AdminBookingModal
          rooms={rooms}
          onClose={() => setCreating(false)}
          onCreated={(b) => setBookings((prev) => [b, ...prev])}
        />
      )}
    </div>
  );
}
