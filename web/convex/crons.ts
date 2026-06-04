import { cronJobs } from "convex/server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { api } from "./_generated/api";

const crons = cronJobs();

/**
 * Poll Sui RPC for new pool events every 30 seconds. The `events.append`
 * mutation dedups by txDigest+eventSeq so re-runs are harmless. The action
 * also projects PassMinted / PassCashedOut / PassEliminated into the
 * passes + cashouts + users tables.
 *
 * Note: the `api.sui_actions` reference is typed after `pnpm dlx convex dev`
 * picks up the new file and regenerates `_generated/api.d.ts`. Cast here so
 * the app typechecks even when the generation is one step behind.
 */
crons.interval(
  "Poll Sui events",
  { seconds: 30 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (api as any).sui_actions.pollEvents,
  {},
);

export default crons;
