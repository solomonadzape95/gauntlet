"use client";

import { useQuery } from "convex/react";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { formatSui, shortAddress, suiscanTx } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";

export default function AdminCashoutsPage() {
  const rows = useQuery(
    api.cashouts.recent,
    convexConfigured ? { limit: 200 } : "skip",
  );

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">Cashouts</div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Cashout receipts
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Survivor cashouts derived from the on-chain event cache. Each row
            links to its Sui transaction.
          </p>
        </section>
      </CornerFrame>

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          {rows === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {rows && rows.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No cashouts yet.
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="border border-zinc-900 divide-y divide-zinc-900">
              <div className="px-5 py-3 grid grid-cols-12 gap-3 text-utility text-zinc-500">
                <div className="col-span-4">Pass</div>
                <div className="col-span-3">Owner</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">When</div>
                <div className="col-span-1 text-right">Tx</div>
              </div>
              {(rows as Array<{
                _id: string;
                passId: string;
                ownerAddress: string;
                amountMist: string;
                txDigest: string;
                timestampMs: number;
              }>).map((c) => (
                <a
                  key={c._id}
                  href={suiscanTx(c.txDigest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 grid grid-cols-12 gap-3 items-center hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="col-span-4 font-mono text-xs text-zinc-300 truncate">
                    {c.passId}
                  </div>
                  <div className="col-span-3 font-mono text-xs text-zinc-400 truncate">
                    {shortAddress(c.ownerAddress)}
                  </div>
                  <div className="col-span-2 text-base text-hazard">
                    {formatSui(BigInt(c.amountMist))} SUI
                  </div>
                  <div className="col-span-2 text-utility text-zinc-500">
                    {formatTime(c.timestampMs)}
                  </div>
                  <div className="col-span-1 text-right">
                    <ArrowUpRight className="size-4 text-zinc-600 inline" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatTime(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
