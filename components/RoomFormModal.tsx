"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { CreateRoomInput, Room } from "@/lib/types";

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
const labelClass = "text-sm font-medium leading-none";

export default function RoomFormModal({
  room,
  onClose,
  onSaved,
}: {
  // Omit to create a new room; pass an existing room to edit it.
  room?: Room;
  onClose: () => void;
  onSaved: (room: Room) => void;
}) {
  const [name, setName] = useState(room?.name ?? "");
  const [location, setLocation] = useState(room?.location ?? "");
  const [capacity, setCapacity] = useState(room?.capacity ?? 1);
  const [requiresApproval, setRequiresApproval] = useState(
    room?.requiresApproval ?? false
  );
  const [facilities, setFacilities] = useState(
    room?.facilities.join(", ") ?? ""
  );
  const [images, setImages] = useState(room?.images.join(", ") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const input: CreateRoomInput = {
      name: name.trim(),
      location: location.trim(),
      capacity: Math.max(1, Number(capacity) || 1),
      requiresApproval,
      facilities: facilities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      images: images
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const res = await fetch(
        room ? `/api/rooms/${room.id}` : "/api/rooms",
        {
          method: room ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan ruangan.");
        return;
      }
      onSaved(data as Room);
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
        <div className="border-b p-6 pb-5">
          <h2 className="text-lg font-semibold tracking-tight">
            {room ? `Edit ${room.name}` : "Tambah Ruangan"}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          <div className="space-y-1.5">
            <label className={labelClass}>Nama Ruangan</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ruang Rapat C"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Lokasi</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Lantai 4"
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
                onChange={(e) => setCapacity(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>
              Fasilitas{" "}
              <span className="font-normal text-muted-foreground">
                (pisahkan dengan koma)
              </span>
            </label>
            <input
              type="text"
              value={facilities}
              onChange={(e) => setFacilities(e.target.value)}
              placeholder="Proyektor, AC, Whiteboard"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>
              Link Foto{" "}
              <span className="font-normal text-muted-foreground">
                (pisahkan dengan koma)
              </span>
            </label>
            <input
              type="text"
              value={images}
              onChange={(e) => setImages(e.target.value)}
              placeholder="https://.../foto1.jpg, https://.../foto2.jpg"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            Ruangan terbatas — booking perlu persetujuan office management
          </label>

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
            {submitting ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
