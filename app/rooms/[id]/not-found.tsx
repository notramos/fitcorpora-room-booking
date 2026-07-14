import Link from "next/link";

export default function RoomNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">
          Ruangan tidak ditemukan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ruangan yang Anda cari tidak ada atau sudah dihapus.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </main>
  );
}
