"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminBookingModal from "./AdminBookingModal";
import EditBookingModal from "./EditBookingModal";
import Pagination from "./Pagination";
import ThemeToggle from "./ThemeToggle";
import MobileBottomNav from "./MobileBottomNav";
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
  "inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:rounded-md";
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
  const [showFilters, setShowFilters] = useState(false);

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
    <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 sm:px-6 sm:py-10 sm:pb-10">
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
          <span className="hidden min-[390px]:inline">Cari &amp; Booking Ruangan</span>
          <span className="min-[390px]:hidden">Beranda</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/rooms"
            className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent sm:text-sm"
          >
            Ruangan
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Administration
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Kelola Semua Booking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cari, ubah, hapus, setujui, atau atur ulang pengingat untuk booking
            apa pun — pengganti mengedit spreadsheet secara manual.
          </p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className={`${btnPrimary} h-11 shrink-0 sm:h-9`}
        >
          + Tambah Booking
        </button>
      </div>

      <div className="mb-5 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 sm:mb-3">
        <div>
          <h2 className="text-sm font-semibold">Filter booking</h2>
          <p className="text-xs text-muted-foreground">Persempit daftar berdasarkan pemesan, ruangan, status, atau tanggal.</p>
        </div>
        <div className="flex items-center gap-2">
          {filtersActive && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Filter aktif</span>}
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-3 text-xs font-semibold sm:hidden"
            aria-expanded={showFilters}
          >
            {showFilters ? "Tutup" : "Buka filter"}
          </button>
        </div>
      </div>
      <div className={`${showFilters ? "grid" : "hidden"} mt-4 grid-cols-1 gap-3 sm:mt-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2`}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, email, keperluan, ruangan…"
          className={`${fieldClass} w-full min-w-0 flex-1 sm:min-w-[14rem]`}
        />
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className={`${fieldClass} w-full sm:w-auto`}
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
          className={`${fieldClass} w-full sm:w-auto`}
        >
          <option value="all">Semua status</option>
          <option value="approved">Disetujui</option>
          <option value="pending">Menunggu</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${fieldClass} w-full sm:w-auto`}
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
        <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center">
          <p className="font-medium">Tidak ada booking ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">Ubah atau reset filter untuk melihat data lain.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((b) => {
            const room = roomsById.get(b.roomId);
            return (
              <div
                key={b.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5"
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatDateLong(b.date)}</span>
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold tabular-nums text-foreground">{b.startTime}–{b.endTime}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{b.bookerName}</span>
                    {b.bookerEmail ? (
                      <span className="block truncate text-xs text-muted-foreground sm:inline sm:text-sm">
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

                <div className="grid shrink-0 grid-cols-2 gap-2 border-t pt-3 sm:flex sm:flex-wrap sm:justify-end sm:border-t-0 sm:pt-0">
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
      <MobileBottomNav />
    </div>
  );
}
