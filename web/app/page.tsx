"use client";

import { ConnectButton } from "@mysten/dapp-kit";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Proof-of-Receipt</h1>
        <ConnectButton />
      </header>

      <section className="mt-16">
        <h2 className="text-3xl font-bold tracking-tight">
          Snapshot the web. Prove it later.
        </h2>
        <p className="mt-3 text-zinc-400">
          Paste a URL. We pin the bytes to Walrus and anchor a verifiable receipt on Sui.
        </p>

        <form
          className="mt-8 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            // TODO Day 3: POST to /api/snapshot, then sign mint() tx via dApp Kit.
          }}
        >
          <input
            type="url"
            required
            placeholder="https://example.com/article"
            className="flex-1 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-100 text-zinc-900 px-4 py-2 font-medium hover:bg-white"
          >
            Capture
          </button>
        </form>
      </section>
    </main>
  );
}
