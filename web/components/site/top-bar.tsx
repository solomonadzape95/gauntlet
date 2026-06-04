"use client";

import Link from "next/link";
import { WalletButton } from "./wallet-button";
import { MenuDropdown } from "./menu-dropdown";
import { Logo } from "@/components/icons/logo";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 bg-transparent backdrop-blur-[2px]">
      <div className="mx-auto max-w-[90rem] px-6 lg:px-12 h-20 md:h-24 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-0.5 group text-white hover:text-hazard transition-colors"
          aria-label="Gauntlet"
        >
          <Logo height={36} className="md:hidden" />
          <Logo height={42} className="hidden md:inline-block" />
          <span className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
            Gauntlet
          </span>
        </Link>
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <MenuDropdown />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
