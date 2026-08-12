"use client";

import { useEffect, useState } from "react";
import type { Room } from "@/lib/types";

export default function RoomDetailModal({
  room,
  onClose,
}: {
  room: Room;
  onClose: () => void;
}) {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const images = room.images;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-xl border bg-card text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b p-6 pb-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {room.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {room.location} · Kapasitas {room.capacity} orang
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {images.length > 0 ? (
            <div className="space-y-2">
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- external URLs pasted straight into the sheet, not part of the Next.js image pipeline */}
                <img
                  src={images[activeImage]}
                  alt={`${room.name} — foto ${activeImage + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((src, i) => (
                    <button
                      key={src + i}
                      onClick={() => setActiveImage(i)}
                      className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border transition-opacity ${
                        i === activeImage
                          ? "border-primary opacity-100"
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail of the same external URL */}
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Belum ada foto ruangan
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fasilitas
            </p>
            {room.facilities.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {room.facilities.map((f) => (
                  <li
                    key={f}
                    className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-foreground"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada data fasilitas.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t p-4">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
