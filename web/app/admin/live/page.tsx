"use client";

import { CornerFrame } from "@/components/ui/corner-frame";
import { LiveOverview } from "@/components/live/live-overview";

export default function AdminLivePage() {
  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">
            Live · all active broadcasts
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Every live pool
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Across all live tournaments. Pick a matchday pool to drop into its
            broadcast view.
          </p>
        </section>
      </CornerFrame>

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <LiveOverview audience="admin" />
        </div>
      </section>
    </div>
  );
}
