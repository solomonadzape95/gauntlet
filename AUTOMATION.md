# Autonomous game loop

A server-signed engine (in Convex) that runs matchdays end-to-end with no
browser open. Per pool, it walks the on-chain lifecycle on a timer and spawns
the next matchday when one settles.

```
OPEN    ── lockDelay after the LAST mint (default 90s, editable) ──►  lock_pool
LOCKED  ── + simDelay (30s) ──►  Sim:start   (live page animates the match)
SIM     ── + settleDelay (30s) ──►  Gemini results → Walrus → settle_pool
SETTLED ──►  spawn next matchday (same teams, fresh AI targets) → repeat
```

- It **signs as the pool admin** (`lock_pool` / `settle_pool` / `create_pool`).
- It **never calls `close_pool`** — settled pools stay open so winners withdraw.
- Tick-driven every 30s and guarded by the live on-chain phase, so a double
  fire just aborts on-chain. The 30s cadence produces the ~30s step spacing.
- Outcomes come from Gemini, with a deterministic fallback if the AI is down.
- **Disabled by default per pool** — nothing signs until an admin enrolls and
  enables a pool.

## Files

| Piece | Where |
| --- | --- |
| State table + admin/internal mutations + queries | `web/convex/automation.ts` |
| Engine (signing, Gemini, Walrus, steps, tick, manual step) | `web/convex/gameLoop.ts` |
| 30s cron tick | `web/convex/crons.ts` ("Advance game loop") |
| Lock-countdown reset on each mint | `web/convex/sui_actions.ts` (PassMinted projection) |
| Admin control panel | `web/components/admin/automation-panel.tsx` (on `/admin/pools/[poolId]`) |
| Public auto-lock countdown | `web/app/pools/[slug]/live/live-client.tsx` (`AutoLockBanner`) |

## Required Convex env

Set on **both** deployments you use (dev and prod are separate). The engine
reads these inside the Node action:

```bash
cd web
# the wallet that signs lock/settle/create — MUST be the pool admin, Ed25519,
# server-side only. Export with: sui keytool export --key-identity <addr>
npx convex env set ADMIN_PRIVATE_KEY "suiprivkey1..."
npx convex env set GAUNTLET_PACKAGE_ID 0x<mainnet-package>
npx convex env set SUI_RPC_URL https://sui-mainnet.gateway.tatum.io
npx convex env set TATUM_API_KEY t-...        # sent as x-api-key to the gateway
npx convex env set GEMINI_API_KEY ...          # AI outcomes (falls back if unset)
# Walrus (roster/result JSON storage)
npx convex env set NEXT_PUBLIC_WALRUS_AGGREGATOR https://aggregator.walrus-testnet.walrus.space
npx convex env set NEXT_PUBLIC_WALRUS_PUBLISHER  https://publisher.walrus-testnet.walrus.space
# repeat each with --prod for the production deployment
```

The admin wallet needs **real SUI for gas** — every lock/settle/create costs
gas. If it runs dry the loop errors (shown as "Last error" in the panel).

## Deploy (don't skip — this is the #1 gotcha)

Changing anything under `web/convex/` requires a **deploy**. `npx convex codegen`
only regenerates local TypeScript types — it does **not** push functions, so the
app will call functions that don't exist and you'll see
`Server Error … Q(automation:forPool)` / `Q(events:platformStats)`.

```bash
cd web
npx convex dev --once     # deploy to the dev deployment
npx convex deploy         # deploy to the production deployment
```

## Enroll → test → enable

1. Open `/admin/pools/<poolId>` → **Autonomous loop** panel → **Enroll this
   pool**. (Needs a Convex matchday row for the pool and a connected admin
   wallet.)
2. (Optional) edit the **lock delay** (seconds after the last mint).
3. Click **Run one step** repeatedly and watch it walk the chain:
   `open · locks in Ns` → `locked` → `sim started` → `settled · N survivors`
   → `spawned MD2 (0x…)`. This signs real txs — validate on a cheap pool first.
4. When happy, **Start loop**. The 30s cron now advances it automatically; the
   spawned child pool is auto-enrolled and enabled, so the loop continues.
5. **Pause loop** stops the cron from touching it (no on-chain effect).

## Timing knobs

Per pool, stored on the `automation` row:

- `lockDelayMs` — after the last mint → lock. Default 90s. Editable in the panel.
- `simDelayMs` — after lock → sim start. Default 30s.
- `settleDelayMs` — after sim start → settle. Default 30s.

Steps are evaluated each 30s tick, so effective timing is ±30s.

## What users see (live page)

- **Open:** `AUTO · Locks in M:SS — each new entry resets the clock`.
- **Sim:** the existing live match banner/scoreboard (driven by `Sim:start`).
- **Settled:** survivors + the single **Withdraw** button.

## Security notes

- The admin controls (`register` / `setEnabled` / `setTimings`) and the manual
  `step` action are **admin-address-gated** (caller must be in `adminRoles`).
  That's a gate matching the app's wallet-identity model — not cryptographic
  proof. The `tick` cron is internal and not callable from clients.
- The contract still enforces fund safety regardless of the loop: the only
  outflows from the pot are the weighted `cashout` and the 10% fee at settle.
  The worst a forged `step` could do is resolve an already-enrolled matchday
  early — it can't move funds.
- Keep `ADMIN_PRIVATE_KEY` in Convex env only. Never expose it client-side.

## Troubleshooting

- **`Server Error … Q(automation:forPool|events:platformStats)`** → functions
  not deployed. Run `npx convex dev --once` (dev) / `npx convex deploy` (prod).
- **Panel "Last error: ADMIN_PRIVATE_KEY not set"** → set the env (above).
- **"Last error: tx … failed: InsufficientGas"** → fund the admin wallet.
- **Walrus upload fails** → the publisher must be reachable; see the Walrus note
  (testnet publisher is the working default).
- **Inspect the loop live:** Convex dashboard → Logs (watch the "Advance game
  loop" cron) and Data → `automation` table (`status`, `lastError`).
