"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  useCurrentAccount,
  useDisconnectWallet,
  ConnectModal,
} from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Copy, LogOut, ArrowUpRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { shortAddress, POOL_OBJECT_ID } from "@/lib/sui";
import { useMyPasses, type MyPass } from "@/lib/hooks/use-my-passes";
import { useRoster } from "@/lib/hooks/use-roster";
import { usePoolState, type PoolState } from "@/lib/hooks/use-pool-state";
import { cn } from "@/lib/cn";

export function WalletButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  if (!account) {
    return (
      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
        <ConnectModal
          trigger={
            <Button variant="ink" size="sm" bullet>
              Connect Wallet
            </Button>
          }
        />
      </motion.div>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative" ref={rootRef}>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((x) => !x)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-100 text-ink font-mono text-xs hover:bg-white transition-colors"
      >
        {shortAddress(account.address)}
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-3 w-[340px] space-y-2 z-50"
          >
            {/* Address panel */}
            <Panel>
              <PanelLabel>Connected</PanelLabel>
              <div className="mt-2 font-mono text-sm text-zinc-100 break-all leading-tight">
                {account.address}
              </div>
            </Panel>

            {/* Passes panel */}
            <PassesPanel onNavigate={() => setOpen(false)} />

            <ActionRow onClick={copy}>
              {copied ? (
                <>
                  <Check className="size-4 text-hazard" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy address
                </>
              )}
            </ActionRow>

            <ActionRow
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              tone="warn"
            >
              <LogOut className="size-4" />
              Disconnect
            </ActionRow>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800 bg-ink-surface px-5 py-4 shadow-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-utility text-zinc-500">{children}</div>;
}

function PassesPanel({ onNavigate }: { onNavigate: () => void }) {
  const { data: passes, isLoading } = useMyPasses();
  const { data: roster } = useRoster();
  const { data: pool } = usePoolState();

  if (isLoading) {
    return (
      <Panel>
        <PanelLabel>My Passes</PanelLabel>
        <p className="mt-2 text-xs text-zinc-600">Loading…</p>
      </Panel>
    );
  }

  if (!passes || passes.length === 0) {
    return (
      <Panel>
        <PanelLabel>My Passes</PanelLabel>
        <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
          Nothing in the gauntlet yet.{" "}
          <Link
            href="/pools"
            onClick={onNavigate}
            className="text-hazard hover:underline"
          >
            Browse pools →
          </Link>
        </p>
      </Panel>
    );
  }

  const playerMap = roster
    ? new Map(roster.players.map((p) => [p.id, p]))
    : new Map<number, { name: string }>();

  return (
    <Panel className="px-0 py-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <PanelLabel>My Passes</PanelLabel>
        <div className="font-mono text-utility text-zinc-600 tabular">
          {passes.length}
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {passes.map((p, i) => (
          <PassRow
            key={p.id}
            pass={p}
            playerName={playerMap.get(p.player_id)?.name}
            pool={pool ?? null}
            onNavigate={onNavigate}
            isLast={i === passes.length - 1}
          />
        ))}
      </div>
      <div className="px-5 pt-3 pb-4 border-t border-zinc-900">
        <Link
          href="/me"
          onClick={onNavigate}
          className="text-utility text-zinc-500 hover:text-hazard transition-colors inline-flex items-center gap-1.5"
        >
          View all on the My Passes page <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </Panel>
  );
}

function PassRow({
  pass,
  playerName,
  pool,
  onNavigate,
  isLast,
}: {
  pass: MyPass;
  playerName: string | undefined;
  pool: PoolState | null;
  onNavigate: () => void;
  isLast: boolean;
}) {
  const { label, tone } = passStatus(pass, pool);
  return (
    <Link
      href={`/pass/${pass.id}`}
      onClick={onNavigate}
      className={cn(
        "group flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors border-t border-zinc-900/60",
        isLast && "border-b-0",
      )}
    >
      <div className="min-w-0">
        <div className="font-semibold text-zinc-100 truncate text-sm">
          {playerName ?? `Player #${pass.player_id}`}
        </div>
        <div className={cn("text-utility mt-0.5", tone)}>{label}</div>
      </div>
      <ArrowUpRight className="size-3.5 text-zinc-600 group-hover:text-zinc-300 shrink-0 transition-colors" />
    </Link>
  );
}

function ActionRow({
  children,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "warn";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border bg-ink-surface px-5 py-3.5",
        "flex items-center gap-3 text-sm transition-colors",
        tone === "default" &&
          "border-zinc-800 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900/50",
        tone === "warn" &&
          "border-zinc-800 text-zinc-400 hover:border-red-900/60 hover:text-red-300 hover:bg-red-950/10",
      )}
    >
      {children}
    </button>
  );
}

function passStatus(
  pass: MyPass,
  pool: PoolState | null,
): { label: string; tone: string } {
  if (pass.pool_id !== POOL_OBJECT_ID) {
    return { label: "Other pool", tone: "text-zinc-500" };
  }
  if (!pool) return { label: "Loading", tone: "text-zinc-500" };
  if (pool.phase === 0) {
    return { label: "Kickoff pending", tone: "text-zinc-400" };
  }
  if (pool.phase === 1) {
    return { label: "Locked · settling", tone: "text-amber-400" };
  }
  if (pool.phase === 2) {
    if (pool.eliminated_players.includes(pass.player_id)) {
      return { label: "Out", tone: "text-zinc-500" };
    }
    return { label: "Through — cash out", tone: "text-hazard" };
  }
  return { label: "Final whistle", tone: "text-zinc-600" };
}
