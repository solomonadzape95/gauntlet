"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Menu as MenuIcon, X, ArrowRight } from "lucide-react";

interface MenuItem {
  href: string;
  label: string;
  description?: string;
}

export const ADMIN_NAV: MenuItem[] = [
  { href: "/admin", label: "Dashboard", description: "Overview, counters, recent activity." },
  { href: "/admin/tournaments", label: "Tournaments", description: "Top-level containers and cover art." },
  { href: "/admin/pools", label: "Live", description: "Watch + run every pool: lock, settle, close, cash out." },
  { href: "/admin/rosters", label: "Rosters", description: "Walrus uploads and roster index." },
  { href: "/admin/users", label: "Users", description: "Wallet directory with pass counts." },
  { href: "/admin/cashouts", label: "Cashouts", description: "Cashout receipts ledger." },
  { href: "/admin/admins", label: "Admins", description: "Add / remove admin addresses." },
];

export function AdminMenuDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <motion.button
        onClick={() => setOpen((x) => !x)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-2 px-4 py-3.5 rounded-full bg-zinc-100 text-ink text-utility hover:bg-white transition-colors"
      >
        {open ? (
          <X className="size-3.5" strokeWidth={2.4} />
        ) : (
          <MenuIcon className="size-3.5" strokeWidth={2.4} />
        )}
        Menu
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-3 w-[360px] space-y-2 z-50"
          >
            {ADMIN_NAV.map((item, idx) => (
              <MenuLink
                key={item.href}
                {...item}
                onNavigate={() => setOpen(false)}
                delay={idx * 0.03}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({
  href,
  label,
  description,
  onNavigate,
  delay,
}: MenuItem & { onNavigate: () => void; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={href}
        onClick={onNavigate}
        className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-800 bg-ink-surface px-5 py-4 hover:border-hazard hover:bg-ink-raised transition-colors"
      >
        <div className="min-w-0">
          <div className="font-serif text-xl md:text-2xl font-semibold tracking-tight text-zinc-100 group-hover:text-hazard transition-colors">
            {label}
          </div>
          {description && (
            <div className="mt-1.5 text-utility text-zinc-500 group-hover:text-zinc-200 transition-colors">
              {description}
            </div>
          )}
        </div>
        <ArrowRight className="size-4 text-zinc-600 group-hover:text-hazard group-hover:translate-x-1 transition-all mt-2 shrink-0" />
      </Link>
    </motion.div>
  );
}
