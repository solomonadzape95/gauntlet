import Link from "next/link";

import { cn } from "@/lib/cn";
import type { Tournament, MatchdaySlot } from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  /** Slug of the pool currently being viewed — highlighted in the strip. */
  currentPoolSlug?: string;
}

/**
 * Horizontal schedule strip for a tournament. Renders one tile per matchday
 * slot. The current pool gets a hazard ring; live future MDs link to their
 * pool; "soon" tiles render disabled with their opening date.
 *
 * The Tournament.schedule's `pool` field is the slug we navigate to when set;
 * we don't look up PoolMeta here because the slug is sufficient for the href.
 */
export function MatchdayStrip({ tournament, currentPoolSlug }: Props) {
  return (
    <section className="border-b border-zinc-900">
      <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-6 md:py-7">
        <div className="flex items-center justify-between mb-4">
          <div className="text-utility text-zinc-500">
            {tournament.name} · schedule
          </div>
          <div className="text-utility text-zinc-600 hidden md:block">
            Tap a live matchday to enter its pool
          </div>
        </div>

        <div className="flex gap-2 md:gap-3 overflow-x-auto -mx-2 px-2 pb-1 snap-x snap-mandatory">
          {tournament.schedule.map((slot) => {
            const isCurrent =
              currentPoolSlug !== undefined &&
              slot.pool !== null &&
              slot.pool === currentPoolSlug;
            const href =
              slot.pool && (slot.status === "live" || slot.status === "done")
                ? `/pools/${slot.pool}`
                : undefined;
            return (
              <MatchdayTile
                key={slot.matchday}
                slot={slot}
                href={href}
                current={isCurrent}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MatchdayTile({
  slot,
  href,
  current,
}: {
  slot: MatchdaySlot;
  href?: string;
  current?: boolean;
}) {
  const content = (
    <div
      className={cn(
        "block min-w-[10rem] md:min-w-[12rem] snap-start",
        "border bg-ink-surface px-4 py-3.5 transition-colors",
        current
          ? "border-hazard ring-1 ring-hazard"
          : "border-zinc-900",
        href && !current && "hover:border-zinc-700",
        !href && "opacity-60 cursor-not-allowed",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-mono text-xs tracking-wider text-zinc-100">
          {slot.matchday}
        </div>
        <StatusBadge status={slot.status} current={current} />
      </div>
      <div className="text-utility text-zinc-500">
        {formatDate(slot.date)}
      </div>
      {slot.fixture && (
        <div className="mt-1.5 text-sm text-zinc-300 line-clamp-2 leading-snug">
          {slot.fixture}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-current={current ? "page" : undefined}>
        {content}
      </Link>
    );
  }
  return content;
}

function StatusBadge({
  status,
  current,
}: {
  status: MatchdaySlot["status"];
  current?: boolean;
}) {
  if (current) {
    return (
      <span className="text-utility text-hazard inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block size-1.5 rounded-full bg-hazard animate-pulse-dot"
        />
        Now
      </span>
    );
  }
  switch (status) {
    case "live":
      return (
        <span className="text-utility text-emerald-400 inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-emerald-400" />
          Live
        </span>
      );
    case "done":
      return (
        <span className="text-utility text-zinc-500 inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-zinc-500" />
          Done
        </span>
      );
    case "soon":
    default:
      return (
        <span className="text-utility text-zinc-600 inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-zinc-700" />
          Soon
        </span>
      );
  }
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
