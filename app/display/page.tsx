import Link from "next/link";
import { getRooms } from "@/lib/sheetsDb";
import CopyLinkButton from "@/components/CopyLinkButton";

// Public index of tablet/kiosk display links, one per room — lets an admin
// grab each room's /display/[id] URL without needing the raw room ID.
// Excluded from the auth middleware (see middleware.ts matcher).
export default async function DisplayIndexPage() {
  const rooms = await getRooms();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tampilan Tablet per Ruangan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buka atau salin link tampilan tablet untuk dipasang di depan tiap
          ruangan.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {rooms.map((room) => {
          const path = `/display/${room.id}`;
          return (
            <div
              key={room.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight">
                  {room.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {room.location} · Kapasitas {room.capacity} orang
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <CopyLinkButton path={path} />
                <Link
                  href={path}
                  target="_blank"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Buka Tampilan
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
