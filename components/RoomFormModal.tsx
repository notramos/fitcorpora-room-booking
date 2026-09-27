"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CreateRoomInput, Room } from "@/lib/types";

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
const labelClass = "text-sm font-medium leading-none";
const MAX_IMAGES = 5;

async function compressImage(file: File): Promise<File> {
  if (file.size <= 1_500_000) return file;

  const bitmap = await createImageBitmap(file);
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82)
  );
  return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }) : file;
}

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
  // Kept as a string so the field can be cleared while typing; parsed and
  // validated on submit.
  const [capacity, setCapacity] = useState(room ? String(room.capacity) : "");
  const [requiresApproval, setRequiresApproval] = useState(
    room?.requiresApproval ?? false
  );
  const [facilities, setFacilities] = useState(
    room?.facilities.join(", ") ?? ""
  );
  const [images, setImages] = useState(room?.images.join(", ") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploadedUrls = useRef<string[]>([]);

  async function cleanupUploadedFiles() {
    const files = [...uploadedUrls.current];
    uploadedUrls.current = [];
    await Promise.all(
      files.map((url) =>
        fetch(`/api/uploads/rooms/${encodeURIComponent(url.split("/").pop() ?? "")}`, {
          method: "DELETE",
        }).catch(() => undefined)
      )
    );
  }

  function closeModal() {
    void cleanupUploadedFiles().finally(onClose);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const capacityNum = parseInt(capacity, 10);
    if (!Number.isFinite(capacityNum) || capacityNum < 1) {
      setError("Kapasitas minimal 1 orang.");
      return;
    }

    setSubmitting(true);

    const input: CreateRoomInput = {
      name: name.trim(),
      location: location.trim(),
      capacity: capacityNum,
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
      uploadedUrls.current = [];
      onSaved(data as Room);
      onClose();
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) {
      setError(`Maksimal ${MAX_IMAGES} gambar per ruangan.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, remaining)) {
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append("file", compressed);
        const res = await fetch("/api/uploads/rooms", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Gagal mengupload gambar.");
          break;
        }
        uploaded.push(data.url as string);
        uploadedUrls.current.push(data.url as string);
      }
      if (files.length > remaining) {
        setError(`Maksimal ${MAX_IMAGES} gambar per ruangan. Sebagian file tidak diupload.`);
      }
      if (uploaded.length > 0) {
        setImages((current) => [...current.split(",").map((s) => s.trim()).filter(Boolean), ...uploaded].join(", "));
      }
    } catch {
      setError("Terjadi kesalahan saat mengupload gambar.");
    } finally {
      setUploading(false);
    }
  }

  const imageUrls = images.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={closeModal}
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
                type="text"
                inputMode="numeric"
                required
                placeholder="20"
                value={capacity}
                onChange={(e) =>
                  setCapacity(e.target.value.replace(/\D/g, ""))
                }
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
              Foto Ruangan{" "}
              <span className="font-normal text-muted-foreground">
                (maks. 5 MB per file)
              </span>
            </label>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleImageUpload(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${dragging ? "border-primary bg-muted" : "bg-background hover:bg-muted/50"}`}
            >
              <span className="text-sm font-medium">
                {uploading ? "Mengoptimalkan dan mengupload…" : "Pilih atau tarik foto ke sini"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WebP · Maksimal {MAX_IMAGES} gambar · 5 MB per file
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  void handleImageUpload(e.target.files);
                  e.currentTarget.value = "";
                }}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {imageUrls.length}/{MAX_IMAGES} gambar dipilih
            </p>
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1 sm:grid-cols-4">
                {imageUrls.map((url) => (
                  <div key={url} className="group relative aspect-video overflow-hidden rounded-md border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- uploaded room images are served from the app. */}
                    <img src={url} alt="Preview ruangan" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Hapus gambar"
                      onClick={() => {
                        setImages(imageUrls.filter((item) => item !== url).join(", "));
                        if (uploadedUrls.current.includes(url)) {
                          uploadedUrls.current = uploadedUrls.current.filter((item) => item !== url);
                          void fetch(`/api/uploads/rooms/${encodeURIComponent(url.split("/").pop() ?? "")}`, { method: "DELETE" });
                        }
                      }}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="hidden"
              value={images}
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
            onClick={closeModal}
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
