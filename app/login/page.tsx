"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/30 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.07),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.05),transparent_30%)]" />
      <div className="relative w-full max-w-md rounded-2xl border bg-card text-card-foreground shadow-xl">
        <div className="border-b p-7 text-center sm:p-8">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
              <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
            </svg>
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Fitcorpora Office Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Fitcorpora Room Booking
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
            Kelola jadwal ruang meeting kantor dengan akun Microsoft Anda.
          </p>
        </div>
        <div className="space-y-4 p-7 sm:p-8">
          <button
            onClick={() => signIn("azure-ad", { callbackUrl: "/" })}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Login dengan Microsoft
          </button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Akses ini hanya tersedia untuk akun internal yang terdaftar di Microsoft Entra ID.
          </p>
        </div>
      </div>
    </main>
  );
}
