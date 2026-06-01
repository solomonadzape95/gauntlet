"use client";

import Link from "next/link";
import { ConnectButton } from "@mysten/dapp-kit";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold tracking-tight">Gauntlet</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
            Season 0 · World Cup 2026
          </span>
        </div>
        <ConnectButton />
      </header>

      <section className="mt-24">
        <h1 className="text-5xl font-bold tracking-tight leading-[1.05]">
          Pick a player.<br />
          Hit their target.<br />
          <span className="text-zinc-500">Survive.</span>
        </h1>
        <p className="mt-6 max-w-xl text-zinc-400 text-lg leading-relaxed">
          The AI Game Master assigns every footballer a stat target. They hit it, you survive. They flop, you're out — and your stake locks into the pot for the survivors.
        </p>

        <div className="mt-10 flex gap-3">
          <Link
            href="/pick"
            className="rounded-md bg-zinc-100 text-zinc-900 px-5 py-3 font-medium hover:bg-white"
          >
            Enter the Gauntlet →
          </Link>
          <a
            href="#how"
            className="rounded-md border border-zinc-800 px-5 py-3 font-medium text-zinc-300 hover:border-zinc-600"
          >
            How it works
          </a>
        </div>
      </section>

      <section className="mt-24 grid grid-cols-3 gap-4">
        <Stat label="Prize Pool" value="— SUI" />
        <Stat label="Survivors" value="—" />
        <Stat label="Status" value="OPEN" />
      </section>

      <section id="how" className="mt-24 space-y-6 text-zinc-400 leading-relaxed">
        <h2 className="text-2xl font-semibold text-zinc-100">How it works</h2>
        <ol className="list-decimal pl-5 space-y-3">
          <li>Deposit 1 SUI. Pick a player from the 16-card roster. You get a Survival Pass NFT.</li>
          <li>An AI Game Master has pre-assigned every player a stat target — score a goal, win 3 tackles, keep a clean sheet, whatever fits their role. Superstars get brutal targets, workhorses get reachable ones.</li>
          <li>The matchday happens. Real-world results land on Walrus. If your player hit their target, your pass survives. If not, it burns.</li>
          <li>Survivors split the pot. The more passes die, the bigger your slice.</li>
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
