"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TEAMS_APP_ID_URI = process.env.NEXT_PUBLIC_TEAMS_APP_ID_URI!;

export default function TeamsSsoBootstrap() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const teamsJs = await import("@microsoft/teams-js");
        await teamsJs.app.initialize();

        const token = await teamsJs.authentication.getAuthToken({
          resources: [TEAMS_APP_ID_URI],
        });

        const res = await fetch("/api/auth/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          throw new Error("Verifikasi sesi gagal di server.");
        }

        if (cancelled) return;
        teamsJs.app.notifySuccess();
        router.replace("/");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Gagal masuk otomatis via Teams."
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium text-foreground">
          Tidak bisa masuk otomatis
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
        <a
          href="/login"
          className="text-sm font-medium text-foreground underline underline-offset-2"
        >
          Masuk manual
        </a>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">Menghubungkan sesi Teams…</p>
  );
}
