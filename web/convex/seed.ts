import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed mutation — populates tournaments + matchday slots for the demo.
 *
 * Idempotent AND authoritative: every run **overwrites** the canonical
 * fields (image, name, tagline, status, dates) on existing tournament +
 * matchday rows to match what's defined here, then **prunes** any stray
 * matchdays that aren't in the canonical schedule. Matchdays that already
 * carry an on-chain `poolObjectId` are protected — they're patched but
 * never deleted (so a live pool can't be silently orphaned).
 *
 *   npx convex run seed:default '{"adminAddress":"0x..."}'
 *
 * For PRODUCTION, target the prod deployment with --prod (env vars + data are
 * per-deployment, so prod must be seeded separately from dev):
 *
 *   npx convex run --prod seed:default '{"adminAddress":"0x..."}'
 *
 * Re-run with the on-chain Pool id + Walrus roster id to flip Last Eleven's
 * MD1 from "soon" to "live":
 *
 *   npx convex run --prod seed:default '{
 *     "adminAddress":"0x...",
 *     "lastElevenPoolId":"0xPOOL",
 *     "lastElevenRosterBlobId":"BLOBID"
 *   }'
 */
const defaultSeed = mutation({
  args: {
    adminAddress: v.string(),
    lastElevenPoolId: v.optional(v.string()),
    lastElevenRosterBlobId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { adminAddress, lastElevenPoolId, lastElevenRosterBlobId },
  ) => {
    // Bootstrap super admin (only inserts; never overwrites role).
    const existingAdmin = await ctx.db
      .query("adminRoles")
      .withIndex("by_address", (q) => q.eq("address", adminAddress))
      .unique();
    if (!existingAdmin) {
      await ctx.db.insert("adminRoles", {
        address: adminAddress,
        role: "super",
        addedAt: Date.now(),
      });
    }

    // ── Tournaments ──────────────────────────────────────────────────────
    const tournaments: Array<{
      slug: string;
      name: string;
      season: string;
      tagline: string;
      image: string;
      imageOriginal: string;
      status: "live" | "soon" | "done";
      playerPoolBlobId?: string;
    }> = [
      {
        slug: "last-eleven",
        name: "Last Eleven · Genesis",
        season: "Demo · 2026",
        tagline:
          "Two squads of 11 generational talents. Phoenix XI vs Eclipse XI. The Gauntlet demo pool — pick a superstar, hit their target, survive.",
        image: "/pools/last-eleven-edited.jpg",
        imageOriginal: "/pools/last-eleven-original.jpg",
        status: "live",
        playerPoolBlobId: lastElevenRosterBlobId,
      },
      {
        slug: "world-cup-2026",
        name: "FIFA World Cup 2026",
        season: "Season 1 · 2026",
        tagline:
          "USA · Mexico · Canada. June 11 – July 19. 48 nations, one survival ladder. Opens with the tournament.",
        image: "/pools/genesis-wc-edited.jpg",
        imageOriginal: "/pools/genesis-wc-original.jpg",
        status: "soon",
      },
      {
        slug: "epl-weekly",
        name: "Premier League · Weekly",
        season: "Season 1 · Coming Soon",
        tagline:
          "Every Saturday matchday. Twenty teams, hundreds of players, a fresh AI roster per fixture window.",
        image: "/pools/epl-weekly-edited.jpg",
        imageOriginal: "/pools/epl-weekly-original.jpg",
        status: "soon",
      },
      {
        slug: "laliga-weekly",
        name: "La Liga · Weekly",
        season: "Season 1 · Coming Soon",
        tagline:
          "Same survival mechanic, Spanish rotation. Hand-built derbies, no FOMO across Sundays.",
        image: "/pools/laliga-weekly-edited.jpg",
        imageOriginal: "/pools/laliga-weekly-original.jpg",
        status: "soon",
      },
      {
        slug: "ucl-nights",
        name: "Champions League · Nights",
        season: "Season 1 · Coming Soon",
        tagline:
          "Tuesday and Wednesday under the lights. Shorter, sharper pools that resolve before the second leg.",
        image: "/pools/ucl-nights-edited.jpg",
        imageOriginal: "/pools/ucl-nights-original.jpg",
        status: "soon",
      },
    ];

    for (const t of tournaments) {
      const existing = await ctx.db
        .query("tournaments")
        .withIndex("by_slug", (q) => q.eq("slug", t.slug))
        .unique();
      const fields = {
        name: t.name,
        season: t.season,
        tagline: t.tagline,
        image: t.image,
        imageOriginal: t.imageOriginal,
        status: t.status,
        ...(t.playerPoolBlobId
          ? { playerPoolBlobId: t.playerPoolBlobId }
          : {}),
      };
      if (!existing) {
        await ctx.db.insert("tournaments", {
          slug: t.slug,
          ownerAddress: adminAddress,
          createdAt: Date.now(),
          ...fields,
        });
      } else {
        await ctx.db.patch(existing._id, fields);
      }
    }

    // ── Matchday schedules ───────────────────────────────────────────────
    type ScheduleRow = {
      mdSlug: string;
      label: string;
      date: string;
      fixture?: string;
      status: "live" | "soon" | "done";
      rosterBlobId?: string;
      poolObjectId?: string;
      entryFeeMist?: string;
    };

    const schedules: Record<string, ScheduleRow[]> = {
      "last-eleven": [
        {
          mdSlug: "MD1",
          label: "MD1",
          date: "2026-06-07",
          fixture: "Phoenix XI vs Eclipse XI · The Coliseum",
          status: lastElevenPoolId ? "live" : "soon",
          rosterBlobId: lastElevenRosterBlobId,
          poolObjectId: lastElevenPoolId,
          entryFeeMist: "100000000",
        },
      ],
      "world-cup-2026": [
        { mdSlug: "MD1", label: "MD1", date: "2026-06-11", fixture: "Mexico vs South Africa · Estadio Azteca", status: "soon" },
        { mdSlug: "MD2", label: "MD2", date: "2026-06-12", status: "soon" },
        { mdSlug: "MD3", label: "MD3", date: "2026-06-13", status: "soon" },
        { mdSlug: "MD4", label: "MD4", date: "2026-06-14", status: "soon" },
        { mdSlug: "R16", label: "R16", date: "2026-06-29", status: "soon" },
        { mdSlug: "QF",  label: "QF",  date: "2026-07-09", status: "soon" },
        { mdSlug: "SF",  label: "SF",  date: "2026-07-14", status: "soon" },
        { mdSlug: "F",   label: "F",   date: "2026-07-19", status: "soon" },
      ],
      "epl-weekly": [
        { mdSlug: "MW1", label: "MW1", date: "2026-08-15", fixture: "Opening Saturday", status: "soon" },
        { mdSlug: "MW2", label: "MW2", date: "2026-08-22", status: "soon" },
        { mdSlug: "MW3", label: "MW3", date: "2026-08-29", status: "soon" },
        { mdSlug: "MW4", label: "MW4", date: "2026-09-12", status: "soon" },
      ],
      "laliga-weekly": [
        { mdSlug: "J1", label: "J1", date: "2026-08-16", fixture: "Jornada 1", status: "soon" },
        { mdSlug: "J2", label: "J2", date: "2026-08-23", status: "soon" },
        { mdSlug: "J3", label: "J3", date: "2026-08-30", status: "soon" },
        { mdSlug: "J4", label: "J4", date: "2026-09-13", status: "soon" },
      ],
      "ucl-nights": [
        { mdSlug: "GW1", label: "GW1", date: "2026-09-15", fixture: "Group Stage · Night 1", status: "soon" },
        { mdSlug: "GW2", label: "GW2", date: "2026-09-30", status: "soon" },
        { mdSlug: "GW3", label: "GW3", date: "2026-10-21", status: "soon" },
        { mdSlug: "GW4", label: "GW4", date: "2026-11-04", status: "soon" },
      ],
    };

    for (const [tournamentSlug, rows] of Object.entries(schedules)) {
      await upsertSchedule(ctx, tournamentSlug, rows);
      const keep = rows.map((r) => r.mdSlug);
      await pruneSchedule(ctx, tournamentSlug, keep);
    }

    return { ok: true };
  },
});

async function upsertSchedule(
  ctx: { db: { query: any; insert: any; patch: any } }, // eslint-disable-line @typescript-eslint/no-explicit-any
  tournamentSlug: string,
  rows: Array<{
    mdSlug: string;
    label: string;
    date: string;
    fixture?: string;
    status: "live" | "soon" | "done";
    rosterBlobId?: string;
    poolObjectId?: string;
    entryFeeMist?: string;
  }>,
) {
  for (const md of rows) {
    const existing = await ctx.db
      .query("matchdays")
      .withIndex("by_tournament_md", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
        q.eq("tournamentSlug", tournamentSlug).eq("mdSlug", md.mdSlug),
      )
      .unique();
    // Authoritative patch — every canonical field gets overwritten from the
    // seed. Optional fields (poolObjectId, rosterBlobId, entryFeeMist,
    // fixture) only get written when the seed actually has a value, so a
    // re-run without ids doesn't clobber a previously-attached pool.
    const fields: Record<string, unknown> = {
      label: md.label,
      date: md.date,
      status: md.status,
    };
    if (md.fixture !== undefined) fields.fixture = md.fixture;
    if (md.poolObjectId) fields.poolObjectId = md.poolObjectId;
    if (md.rosterBlobId) fields.rosterBlobId = md.rosterBlobId;
    if (md.entryFeeMist) fields.entryFeeMist = md.entryFeeMist;

    if (!existing) {
      await ctx.db.insert("matchdays", {
        tournamentSlug,
        mdSlug: md.mdSlug,
        createdAt: Date.now(),
        ...fields,
      });
    } else {
      await ctx.db.patch(existing._id, fields);
    }
  }
}

async function pruneSchedule(
  ctx: { db: { query: any; delete: any } }, // eslint-disable-line @typescript-eslint/no-explicit-any
  tournamentSlug: string,
  keepMdSlugs: string[],
) {
  const keep = new Set(keepMdSlugs);
  const existing = await ctx.db
    .query("matchdays")
    .withIndex("by_tournament", (q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      q.eq("tournamentSlug", tournamentSlug),
    )
    .collect();
  for (const md of existing) {
    if (keep.has(md.mdSlug)) continue;
    // Protect any matchday with a real on-chain pool — patching is fine,
    // deleting would silently orphan it. Caller should remove the pool
    // first if they really want it gone.
    if (md.poolObjectId) continue;
    await ctx.db.delete(md._id);
  }
}

export default defaultSeed;
