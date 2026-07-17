"use client";

import { useState } from "react";
import Link from "next/link";
import BookingModal from "./BookingModal";
import StatusBadge from "./StatusBadge";
import { computeStatus } from "@/lib/roomStatus";
import { getHourSlots, toMinutes } from "@/lib/timeSlots";
import type { Booking, Room } from "@/lib/types";

export default function RoomCard({
  room,
  bookings,
  now,
  onBooked,
}: {
  room: Room;
  bookings: Booking[];
  now: Date;
  onBooked: (booking: Booking) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ start: string; end: string } | null>(
    null
  );

  const { status, currentBooking, nextBooking } = computeStatus(bookings, now);
  const isInUse = status === "Sedang Dipakai";
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots = getHourSlots(bookings);

  function openBooking(slotStart?: string, slotEnd?: string) {
    setPrefill(slotStart && slotEnd ? { start: slotStart, end: slotEnd } : null);
    setIsModalOpen(true);
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      {/* header */}
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0">
          <Link
            href={`/rooms/${room.id}`}
            className="block truncate text-base font-semibold tracking-tight transition-colors hover:text-muted-foreground hover:underline"
          >
            {room.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {room.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {room.capacity} orang
            </span>
          </div>
        </div>

        <StatusBadge inUse={isInUse} />
      </div>

      {/* status summary */}
      <div className="border-t border-dashed px-5 py-3 text-sm">
        {currentBooking ? (
          <p className="text-foreground">
            Sedang dipakai <span className="text-muted-foreground">oleh</span>{" "}
            <span className="font-medium">{currentBooking.bookerName}</span>{" "}
            <span className="text-muted-foreground">
              s/d {currentBooking.endTime}
            </span>
          </p>
        ) : nextBooking ? (
          <p className="text-foreground">
            <span className="text-muted-foreground">Berikutnya</span>{" "}
            <span className="font-mono font-medium tabular-nums">
              {nextBooking.startTime}
            </span>{" "}
            <span className="text-muted-foreground">oleh</span>{" "}
            <span className="font-medium">{nextBooking.bookerName}</span>
          </p>
        ) : bookings.length > 0 ? (
          <p className="text-muted-foreground">
            Tidak ada booking lagi untuk hari ini.
          </p>
        ) : (
          <p className="text-muted-foreground">Belum ada booking hari ini.</p>
        )}
      </div>

      {/* hourly slot grid */}
      <div className="px-5 py-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Jam Booking Hari Ini
        </p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {slots.map((slot) => {
            const isBooked = !!slot.booking;
            const isCurrent =
              isBooked && slot.booking!.id === currentBooking?.id;
            const isPast = toMinutes(slot.end) <= nowMinutes && !isCurrent;
            const isDisabled = isBooked || isPast;

            return (
              <button
                key={slot.start}
                type="button"
                disabled={isDisabled}
                onClick={() => openBooking(slot.start, slot.end)}
                title={
                  isBooked
                    ? `Dibooking oleh ${slot.booking!.bookerName}`
                    : isPast
                      ? "Jam ini sudah lewat"
                      : `Booking jam ${slot.start}`
                }
                className={`rounded-md border px-1 py-1.5 text-center font-mono text-xs tabular-nums transition-colors ${
                  isBooked
                    ? `cursor-not-allowed border-transparent bg-primary text-primary-foreground line-through ${
                        isPast ? "opacity-40" : "opacity-70"
                      }`
                    : isPast
                      ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/60"
                      : "bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {slot.start}
              </button>
            );
          })}
        </div>
      </div>

      {/* action */}
      <div className="mt-auto grid grid-cols-[auto_1fr] gap-2 border-t p-4">
        <Link
          href={`/rooms/${room.id}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Detail
        </Link>
        <button
          onClick={() => openBooking()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            <path d="M8 2v4M16 2v4M3 10h18" />
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M12 14v4M10 16h4" />
          </svg>
          Booking
        </button>
      </div>

      {isModalOpen && (
        <BookingModal
          room={room}
          initialStartTime={prefill?.start}
          initialEndTime={prefill?.end}
          onClose={() => setIsModalOpen(false)}
          onBooked={onBooked}
        />
      )}
    </div>
  );
}
