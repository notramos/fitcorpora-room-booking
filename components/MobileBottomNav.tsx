"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "calendar" | "mine" | "approval" | "admin" | "logout";

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    calendar: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /></>,
    mine: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="m9 16 2 2 4-4" /></>,
    approval: <><path d="M12 22c5-2 8-6 8-11V5l-8-3-8 3v6c0 5 3 9 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    admin: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function MobileBottomNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAdmin = session?.user?.isAdmin ?? false;

  const items: Array<{ href: string; label: string; icon: IconName }> = isAdmin
    ? [
        { href: "/", label: "Beranda", icon: "home" },
        { href: "/jadwal", label: "Jadwal", icon: "calendar" },
        { href: "/approval", label: "Approval", icon: "approval" },
        { href: "/admin/bookings", label: "Admin", icon: "admin" },
      ]
    : [
        { href: "/", label: "Beranda", icon: "home" },
        { href: "/jadwal", label: "Jadwal", icon: "calendar" },
        { href: "/jadwal/saya", label: "Booking Saya", icon: "mine" },
      ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/jadwal") return pathname === "/jadwal";
    if (href.startsWith("/admin/")) return pathname.startsWith("/admin/");
    return pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="Navigasi utama mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-6px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <NavIcon name={item.icon} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        {!isAdmin && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <NavIcon name="logout" />
            <span>Keluar</span>
          </button>
        )}
      </div>
    </nav>
  );
}
