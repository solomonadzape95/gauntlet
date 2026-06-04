"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ADMIN_ADDRESS, shortAddress } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";

/**
 * Renders children only if the connected wallet is an admin. Sources of truth
 * (in priority order):
 *   1. Convex `adminRoles` table — populated by the seed + /admin/admins page.
 *   2. NEXT_PUBLIC_ADMIN_ADDRESS — the bootstrap admin from env.
 *
 * Until Convex returns a result, we optimistically allow the env admin so the
 * first paint isn't a flash-of-denied.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const address = account?.address ?? "";
  // Skip Convex entirely if URL isn't configured — fall back to env admin only.
  const convexAdmin = useQuery(
    api.admin.isAdmin,
    convexConfigured && address ? { address } : "skip",
  );

  if (!account) {
    return (
      <Empty
        title="Admin console"
        body="Connect a wallet to continue."
      />
    );
  }

  const isEnvAdmin =
    ADMIN_ADDRESS !== "0x0" && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  const allowed = convexAdmin === true || isEnvAdmin;

  if (convexAdmin === undefined && !isEnvAdmin) {
    return (
      <Empty
        title="Checking access…"
        body="Verifying admin role."
      />
    );
  }

  if (!allowed) {
    return (
      <Empty
        title="Access denied"
        body="The admin console is restricted to admins."
        footnote={
          <div className="text-xs font-mono text-zinc-600 mt-4 leading-relaxed">
            You: {shortAddress(address)}
            {ADMIN_ADDRESS !== "0x0" && (
              <>
                <br />
                Env admin: {shortAddress(ADMIN_ADDRESS)}
              </>
            )}
            <div className="mt-3">
              <Link href="/" className="text-zinc-400 hover:text-hazard">
                ← Back to site
              </Link>
            </div>
          </div>
        }
      />
    );
  }

  return <main className="flex-1">{children}</main>;
}

function Empty({
  title,
  body,
  footnote,
}: {
  title: string;
  body: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-20 md:py-24 text-center">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight mb-4">
          {title}
        </h1>
        <div className="text-base text-zinc-300">{body}</div>
        {footnote}
      </div>
    </main>
  );
}
