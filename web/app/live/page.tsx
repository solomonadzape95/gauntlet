"use client";

import { TopBar } from "@/components/site/top-bar";
import { CornerFrame } from "@/components/ui/corner-frame";
import { LiveOverview } from "@/components/live/live-overview";

export default function LivePage() {
  return (
    <main className="min-h-screen">
      <TopBar />
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12 md:py-16">
          <div className="text-utility text-hazard mb-3 inline-flex items-center gap-2">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-hazard animate-pulse-dot"
            />
            On now
          </div>
          <h1 className="font-serif text-display-lg max-w-3xl">
            Live broadcasts.
          </h1>
          <p className="mt-5 text-lg md:text-xl text-zinc-300 leading-relaxed max-w-2xl">
            Every survival pool that&apos;s currently active. Real-time pot,
            picks, and survivor heat. Tap a matchday to drop into the
            broadcast.
          </p>
        </section>
      </CornerFrame>

      <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-14">
        <LiveOverview audience="public" />
      </section>
    </main>
  );
}
