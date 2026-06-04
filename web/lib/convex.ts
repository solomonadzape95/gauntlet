import { ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Lazy-initialized Convex client. We instantiate it once at module scope
 * (NOT inside React state) so that server components and client components
 * share the same client instance.
 *
 * If NEXT_PUBLIC_CONVEX_URL isn't set we still construct a client pointed at
 * a placeholder URL — Convex hooks become inert in that case and we surface
 * a helpful error in the dev console rather than crashing the whole tree.
 */
export const convex = new ConvexReactClient(
  url ?? "https://placeholder-convex-not-configured.invalid",
  {
    // Keep verbose noise off in production; turn back on if debugging.
    verbose: false,
  },
);

export const convexConfigured = Boolean(url);
