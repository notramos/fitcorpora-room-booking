"use client";

import { useEffect, useState } from "react";

type DirectoryUser = {
  id: string;
  displayName: string;
  email: string;
};

export default function AttendeePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setDirectoryError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setDirectoryError(null);
      try {
        const response = await fetch(`/api/directory/users?q=${encodeURIComponent(trimmed)}`);
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          setDirectoryError(data.error ?? "User tidak dapat dicari.");
          setResults([]);
          return;
        }
        setResults(data as DirectoryUser[]);
      } catch {
        setDirectoryError("Gagal mencari user.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function add(email: string) {
    if (!value.includes(email)) onChange([...value, email]);
    setQuery("");
    setResults([]);
  }

  function remove(email: string) {
    onChange(value.filter((item) => item !== email));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((email) => (
            <span key={email} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              <span className="max-w-[15rem] truncate">{email}</span>
              <button type="button" onClick={() => remove(email)} disabled={disabled} aria-label={`Hapus ${email}`} className="text-muted-foreground hover:text-foreground">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="email"
          value={query}
          disabled={disabled || value.length >= 20}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama atau email peserta…"
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
        />
        {(loading || results.length > 0 || directoryError) && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-card p-1 shadow-lg">
            {loading && <p className="px-3 py-2 text-xs text-muted-foreground">Mencari user…</p>}
            {directoryError && <p className="px-3 py-2 text-xs text-red-700">{directoryError}</p>}
            {results.map((user) => (
              <button key={user.id} type="button" onClick={() => add(user.email)} className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-muted">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{user.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              </button>
            ))}
            {!loading && !directoryError && results.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">User tidak ditemukan.</p>}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Ketik minimal 2 karakter. Maksimal 20 peserta.</p>
    </div>
  );
}
