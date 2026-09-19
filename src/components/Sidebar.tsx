"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { initials } from "@/lib/format";

type Item = { href: string; label: string; icon: React.ReactNode };

const icon = {
  overview: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="8.5" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="2.6" strokeWidth="1.2" />
    </svg>
  ),
  modes: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <circle cx="8" cy="8" r="4.2" strokeWidth="1.2" />
      <circle cx="16.5" cy="15.5" r="5" strokeWidth="1.2" />
    </svg>
  ),
  live: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth="1.2" />
      <path d="M10 8.5 16 12l-6 3.5z" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  detection: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <circle cx="12" cy="13" r="3" strokeWidth="1.2" />
      <path d="M12 3.5 21 20H3z" strokeWidth="1.1" strokeLinejoin="round" opacity="0.55" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="8.5" strokeWidth="1.2" />
      <path d="M12 7.5V12l3 2" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="3.2" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="8.5" strokeWidth="1.2" strokeDasharray="3 3" />
    </svg>
  ),
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Overview", icon: icon.overview },
  { href: "/dashboard/modes", label: "Modes", icon: icon.modes },
  { href: "/dashboard/live", label: "Live", icon: icon.live },
  { href: "/dashboard/detection", label: "Detection", icon: icon.detection },
  { href: "/dashboard/sessions", label: "Sessions", icon: icon.sessions },
  { href: "/dashboard/settings", label: "Settings", icon: icon.settings },
];

export function Sidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* desktop rail */}
      <aside data-tour="nav" className="fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
        <div className="capsule flex flex-col items-center gap-1 rounded-full px-2.5 py-4">
          <Link
            href="/"
            className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/15"
            title="Duplex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          </Link>
          {ITEMS.map((item) => {
            const active = isActive(item.href);
            const tourKey =
              item.href === "/dashboard"
                ? "nav-overview"
                : item.href === "/dashboard/modes"
                  ? "nav-modes"
                  : item.href === "/dashboard/live"
                    ? "nav-live"
                    : item.href === "/dashboard/detection"
                      ? "nav-detection"
                      : item.href === "/dashboard/sessions"
                        ? "nav-sessions"
                        : "nav-settings";
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                data-tour={tourKey}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-full transition ${
                  active
                    ? "bg-white text-black"
                    : "text-muted hover:bg-white/[0.07] hover:text-fg"
                }`}
              >
                {item.icon}
                <span className="pill pointer-events-none absolute left-14 whitespace-nowrap px-3 py-1 text-[0.7rem] opacity-0 backdrop-blur-xl transition group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
          <div className="my-2 h-px w-6 bg-white/10" />
          <button
            onClick={logout}
            disabled={busy}
            title="Sign out"
            data-tour="user"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-[0.65rem] text-muted transition hover:text-fg"
          >
            {initials(name)}
          </button>
        </div>
      </aside>

      {/* mobile bar */}
      <nav className="fixed bottom-4 left-1/2 z-30 w-[min(94vw,26rem)] -translate-x-1/2 lg:hidden">
        <div className="capsule flex items-center justify-between rounded-full px-2 py-2 backdrop-blur-xl">
          {ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  active ? "bg-white text-black" : "text-muted"
                }`}
              >
                {item.icon}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
