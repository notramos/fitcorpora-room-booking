"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import RealtimeClock from "./RealtimeClock";
import RoomCard from "./RoomCard";
import type { Booking, Room } from "@/lib/types";

const REFRESH_INTERVAL_MS = 30000;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function todayLabel() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Dashboard({
  initialRooms,
  initialBookings,
}: {
  initialRooms: Room[];
  initialBookings: Booking[];
}) {
  const { data: session } = useSession();
  const [rooms, setRooms] = useState(initialRooms);
  const [bookings, setBookings] = useState(initialBookings);
  const [now, setNow] = useState(() => new Date());

  async function refetch() {
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch("/api/rooms"),
        fetch(`/api/bookings?date=${todayStr()}`),
      ]);
      if (roomsRes.ok) setRooms(await roomsRes.json());
      if (bookingsRes.ok) setBookings(await bookingsRes.json());
    } catch {
      // keep showing last known data on transient network errors
    }
  }

  useEffect(() => {
    const interval = setInterval(refetch, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight">
                Booking Ruangan Kantor
              </h1>
              <p className="text-xs text-muted-foreground">
                {session
                  ? `Halo, ${session.user?.name ?? session.user?.email}`
                  : "Mode testing — autentikasi dinonaktifkan"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RealtimeClock
              onTick={setNow}
              className="hidden font-mono text-sm font-medium tabular-nums text-muted-foreground sm:block"
            />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Daftar Ruangan</h2>
          <p className="text-sm text-muted-foreground">
            {todayLabel()} · {rooms.length} ruangan tersedia
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              bookings={bookings.filter(
                (b) => b.roomId === room.id && b.date === todayStr()
              )}
              now={now}
              onBooked={() => refetch()}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
