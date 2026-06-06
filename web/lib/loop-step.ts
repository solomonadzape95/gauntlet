/**
 * Shared helper for rendering the autonomous loop's current step + countdown,
 * derived from the `automation` row. Used by the admin panel and the public
 * live banner so both show the same thing.
 */

export interface LoopRow {
  enabled: boolean;
  status: string;
  lockDelayMs: number;
  simDelayMs: number;
  settleDelayMs: number;
  lastMintAtMs?: number;
  lockedAtMs?: number;
  simStartedAtMs?: number;
}

export interface LoopStep {
  /** Short human label for the step in progress. */
  label: string;
  /** Absolute epoch-ms the current step fires at, or null if not counting. */
  etaMs: number | null;
}

/** Current step + countdown target, or null when the loop is off / done. */
export function loopStepInfo(row: LoopRow | null | undefined): LoopStep | null {
  if (!row || !row.enabled) return null;
  switch (row.status) {
    case "open":
      return row.lastMintAtMs
        ? { label: "Pool locks", etaMs: row.lastMintAtMs + row.lockDelayMs }
        : { label: "Locks after the first entry", etaMs: null };
    case "locked":
      // Once the sim has started we're counting to settle; before that, kickoff.
      return row.simStartedAtMs
        ? { label: "Match settles", etaMs: row.simStartedAtMs + row.settleDelayMs }
        : { label: "Kickoff", etaMs: (row.lockedAtMs ?? Date.now()) + row.simDelayMs };
    case "simming":
      return { label: "Match settles", etaMs: (row.simStartedAtMs ?? Date.now()) + row.settleDelayMs };
    case "settled":
    case "spawned":
      return { label: "Settled — withdraw open", etaMs: null };
    default:
      return { label: row.status, etaMs: null };
  }
}

/** mm:ss for a remaining-millisecond count (clamped at 0). */
export function formatCountdown(remainingMs: number): string {
  const s = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
