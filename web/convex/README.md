# Convex backend (Gauntlet)

Mutable application state lives here. Money + ownership stay on Sui; roster JSONs live on Walrus; everything else (tournaments, matchday schedule, event cache, users, cashouts, admin roles) is in Convex.

## One-time setup

```bash
cd web
pnpm dlx convex dev
```

The first run:

1. Prompts you to log in to Convex in the browser.
2. Asks which project to use → create a new one named `gauntlet`.
3. Generates `convex/_generated/` (do not commit — it regenerates on schema change).
4. Prints your deployment URL.

Copy the URL into `web/.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL="https://<your-deployment>.convex.cloud"
```

Then leave `pnpm dlx convex dev` running in a background terminal; it auto-pushes schema + function changes on save.

## Seed the registry

The seed mutation mirrors the prior hardcoded `lib/pools.ts` + `lib/tournaments.ts` so the public app keeps showing the same Genesis pool after the cutover. Run it once with your admin wallet + the existing on-chain ids:

```bash
pnpm dlx convex run seed:default \
  '{
    "adminAddress": "0xYOUR_ADMIN_ADDRESS",
    "poolObjectId": "0xYOUR_POOL_OBJECT_ID",
    "rosterBlobId": "YOUR_ROSTER_WALRUS_BLOB",
    "matchdayBlobId": "YOUR_MATCHDAY_WALRUS_BLOB"
  }'
```

The mutation is idempotent — safe to re-run if you tweak values.

## Tables

| Table         | Purpose                                                              |
|---------------|----------------------------------------------------------------------|
| `tournaments` | League / cup container (WC 2026, EPL Weekly). Cover image + tagline. |
| `matchdays`   | Per-MD slot under a tournament. `poolObjectId` set once on-chain.   |
| `rosters`     | Audit index of Walrus blob uploads (player pool / MD roster / results). |
| `events`      | Cached Sui events polled every 30s. Powers the activity feed.       |
| `passes`      | Materialized view of Pass NFTs derived from the event log.          |
| `cashouts`    | Cashout receipts for the admin dashboard.                           |
| `adminRoles`  | `address → role` table. Seeded with `NEXT_PUBLIC_ADMIN_ADDRESS`.    |
| `users`       | Lightweight directory derived from event sender addresses.          |

## Conventions

- All slugs are kebab-case (`world-cup-2026`, not `WorldCup2026`).
- Object IDs and blob IDs are stored as strings (not bigints).
- `*Mist` fields are stringified u64 (Sui MIST). Convert with `BigInt(s)`.
- `timestampMs` is always epoch milliseconds.
- Mutations that bridge to Sui (e.g. `matchdays.setPoolId`) trust the client — admin gating happens at the page layer via `admin.isAdmin`. Do not call privileged mutations from public pages.
