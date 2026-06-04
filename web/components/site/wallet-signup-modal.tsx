"use client";

import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { shortAddress } from "@/lib/sui";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "gauntlet-signup-dismissed";

interface UserRow {
  _id: string;
  address: string;
  displayName?: string;
  passCount: number;
}

/**
 * One-shot welcome modal that pops the first time a wallet connects without
 * a Convex user record. Optional — user can skip and set a name later from
 * /profile. Dismissals are persisted per-address in localStorage so we don't
 * pester between sessions.
 */
export function WalletSignupModal() {
  const account = useCurrentAccount();
  const address = account?.address ?? "";

  const user = useQuery(
    api.users.get,
    convexConfigured && address ? { address } : "skip",
  ) as UserRow | null | undefined;
  const seen = useMutation(api.users.seen);
  const setDisplayName = useMutation(api.users.setDisplayName);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open the modal once per address — only if Convex says no user yet AND
  // the user hasn't dismissed previously.
  useEffect(() => {
    if (!convexConfigured || !address) return;
    if (user === undefined) return; // still loading
    if (user && user.displayName) return; // already onboarded
    const dismissed =
      typeof window !== "undefined" &&
      localStorage.getItem(`${DISMISS_KEY}:${address}`) === "1";
    if (dismissed) return;
    setOpen(true);
  }, [address, user]);

  // Best-effort "seen" tick on every new connection so the users table tracks
  // addresses even when the modal is dismissed before the mutation fires.
  useEffect(() => {
    if (!convexConfigured || !address) return;
    seen({ address }).catch(() => {});
  }, [address, seen]);

  const close = (persistDismiss: boolean) => {
    if (persistDismiss && typeof window !== "undefined" && address) {
      localStorage.setItem(`${DISMISS_KEY}:${address}`, "1");
    }
    setOpen(false);
    setName("");
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a display name (or hit Skip).");
      return;
    }
    if (trimmed.length > 30) {
      setError("Keep it under 30 characters.");
      return;
    }
    try {
      setBusy(true);
      await seen({ address });
      await setDisplayName({ address, displayName: trimmed });
      close(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] bg-ink/85 backdrop-blur flex items-end md:items-center justify-center p-4 overflow-y-auto"
          onClick={() => close(true)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-ink-surface border border-zinc-800 my-8 p-7"
          >
            <button
              onClick={() => close(true)}
              aria-label="Skip"
              className="absolute top-4 right-4 inline-flex items-center justify-center size-9 rounded-full text-zinc-400 hover:text-hazard transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="text-utility text-hazard mb-2 inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-hazard" />
              Welcome to Gauntlet
            </div>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">
              Pick a name?
            </h2>
            <p className="mt-3 text-base text-zinc-300 leading-relaxed">
              Shows up on the leaderboard and your profile page. Totally
              optional — you can skip and set it later from{" "}
              <code className="font-mono text-zinc-100">/profile</code>.
            </p>
            <p className="mt-2 text-utility text-zinc-500 font-mono">
              Wallet · {shortAddress(address)}
            </p>

            <div className="mt-5">
              <label className="text-utility text-zinc-500 block mb-2">
                Display name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. messi-stan-43"
                maxLength={30}
                className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-base focus:outline-none focus:border-hazard"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) handleSave();
                }}
              />
            </div>

            {error && (
              <div className="mt-3 border border-red-900/50 bg-red-950/20 p-3">
                <p className="text-base text-red-300 break-words">{error}</p>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <Button
                variant="hazard"
                onClick={handleSave}
                disabled={busy}
                bullet
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save name"
                )}
              </Button>
              <button
                type="button"
                onClick={() => close(true)}
                className="text-utility text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
