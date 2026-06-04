"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WalletButton } from "./wallet-button";
import { AdminMenuDropdown, ADMIN_NAV } from "./admin-menu-dropdown";
import { Logo } from "@/components/icons/logo";

/**
 * Admin shell header.
 *
 * Layout:
 *   Left  — Gauntlet logo · ADMIN pill · · Active page label
 *   Right — Admin menu dropdown + wallet button
 */
export function AdminTopBar() {
  const pathname = usePathname() ?? "/admin";
  const active = activeLabel(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-900 bg-ink/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[110rem] px-4 md:px-6 lg:px-10 h-14 md:h-16 flex items-center justify-between gap-4">
        {/* LEFT — brand · admin pill · active page */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <Link
            href="/"
            className="shrink-0 inline-flex items-center gap-2 text-white hover:text-hazard transition-colors"
            aria-label="Gauntlet"
          >
            <Logo height={36} className="md:hidden" />
            <Logo height={42} className="hidden md:inline-block" />
            <span className="font-serif text-lg md:text-xl font-semibold tracking-tight">
              Gauntlet
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 border border-hazard text-hazard px-1.5 py-0.5 text-[10px] tracking-[0.18em] font-mono uppercase shrink-0">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-hazard animate-pulse-dot"
            />
            Admin
          </span>
          {active && (
            <>
              <span aria-hidden className="text-zinc-700 shrink-0">
                ·
              </span>
              <span className="text-base md:text-lg font-serif text-zinc-100 truncate">
                {active}
              </span>
            </>
          )}
        </div>

        {/* RIGHT — menu + wallet */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <AdminMenuDropdown />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

function activeLabel(pathname: string): string | null {
  // Longest-prefix match against ADMIN_NAV. Each nav href is unique, and
  // /admin matches only when the path is exactly /admin (else /admin/foo
  // would always pick "Dashboard").
  let best: { label: string; len: number } | null = null;
  for (const item of ADMIN_NAV) {
    if (item.href === "/admin") {
      if (pathname === "/admin") {
        best = { label: item.label, len: item.href.length };
      }
      continue;
    }
    if (
      pathname === item.href ||
      pathname.startsWith(item.href + "/")
    ) {
      if (!best || item.href.length > best.len) {
        best = { label: item.label, len: item.href.length };
      }
    }
  }
  return best?.label ?? null;
}
