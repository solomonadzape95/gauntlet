# Gauntlet — Build Plan

**Hackathon:** Tatum × Walrus (May 23 – June 6, 2026)
**Today:** June 1 — **5 days until submission** (deadline June 6, 17:00 UTC)
**Working title:** Gauntlet (alt: Last Eleven, Survivor.fc — trivially renameable)

## Pivot context

Originally scoped as **Proof-of-Receipt** (a tamper-proof web snapshot service). On June 1, with 5 days remaining, we pivoted to **Gauntlet** — a World Cup survival pool. The Next.js + dApp Kit + Tailwind scaffold remains; the snapshotter service and `receipt` Move module have been removed and replaced with the survival pool module and Walrus seed data.

## Pitch

A "last man standing" survival game on Sui, launching 5 days before the FIFA World Cup 2026 kickoff (June 11). Players deposit SUI to mint a **Survival Pass** tied to a specific real-world footballer. An AI Game Master assigns each player a stat target — superstars get brutal targets ("score 2 goals"), workhorses get reachable ones ("3 tackles + 85% pass accuracy"). If your player hits their target in the real-world match, your pass survives and your share of the pot grows. If they flop, your pass burns and your stake locks into the pool for survivors to claim. Between rounds, survivors cash out for a guaranteed proportional share — or let it ride for a fatter multiplier next matchday.

The MVP ships ONE matchday (no let-it-ride round 2) and uses an admin "Advance Matchday" button as the oracle stand-in. Roadmap is continuous-mode post-tournament (Premier League weekly survival, La Liga, Champions League nights).

## Why this wins the rubric

| Bucket | Weight | Our play |
|---|---|---|
| Walrus & Tatum integration | 30% | **Three** distinct Walrus blob types (roster, matchday results, player cards). **Three** Tatum surfaces (RPC, Data API, Notifications). |
| Technical quality | 30% | Move state machine, real proportional payout math, owned-pass + shared-pool ownership model. |
| Creativity | 20% | Survival pools don't exist on-chain. Niche moat vs football.fun (shares) and LeagueDAO (fantasy). |
| Presentation | 20% | World Cup ships June 11, we launch June 6. Demo arc has stakes: pick → matchday → reveal → cashout. |

## Architecture

```
[User browser]
     │  pick player + 1 SUI
     ▼
[Sui Move contract — gauntlet::pool] (shared object)
     ├─ create_pool   (admin only, once)
     ├─ mint_pass     (any user, OPEN phase)
     ├─ lock_pool     (admin, OPEN → LOCKED)
     ├─ settle_pool   (admin, LOCKED → SETTLED; pushes eliminated_player_ids)
     ├─ cashout       (pass owner, SETTLED phase, within cashout window)
     └─ close_pool    (admin, SETTLED → CLOSED after window)

[Walrus]
     ├─ roster.json         (16 players, AI-assigned targets + rationales)
     ├─ matchday-1.json     (per-player real-world stats + hit/missed verdicts)
     └─ player_cards/       (card images, Day 4 stretch)

[Tatum]
     ├─ RPC      → all on-chain writes (mint, settle, cashout)
     ├─ Data API → query Pool state, owned passes, leaderboard
     └─ Webhooks → "your pass survived", "you cashed out N SUI"
```

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 + Tailwind (existing scaffold) |
| Wallet | Mysten dApp Kit |
| Chain | Sui testnet |
| Contract | Sui Move (2024 edition) |
| Storage | Walrus testnet (HTTP publisher + aggregator) |
| RPC | Tatum Sui RPC |
| Reads | Tatum Sui Data API |
| Push | Tatum Notifications → Discord webhook |
| AI (stretch) | Anthropic Claude API + MCP-style Walrus tool |
| Hosting | Vercel |

## Move contract

See `contracts/sources/pool.move`. Single module `gauntlet::pool`. ~180 LoC.

- **Objects**: `Pool` (shared), `Pass` (owned, key+store).
- **Entries**: `create_pool`, `mint_pass`, `lock_pool`, `settle_pool`, `cashout`, `close_pool`.
- **Phases**: OPEN → LOCKED → SETTLED → CLOSED.
- **Events**: `PoolCreated`, `PassMinted`, `PoolLocked`, `PoolSettled`, `PassCashedOut`, `PoolClosed`.
- **Payout math**: `payout = pot_value / alive_count`; both decrement on each cashout.

## 5-day plan

**Day 1 — June 1 (today)** — PIVOT + chain + seed data
- [x] Delete snapshotter/, remove receipt.move, rewrite PLAN/README
- [x] Write `gauntlet::pool` Move module
- [x] Hand-write `data/roster.json` (16 players)
- [x] Hand-write `data/matchday-1.json` (8 elim / 8 survive)
- [ ] `sui move build` clean; `sui client publish` to testnet; commit package ID
- [ ] Upload roster + matchday to Walrus via `curl PUT`; record blob IDs
- [ ] CLI smoke test: `create_pool(entry_fee, roster_blob_id)` → capture Pool object ID

**Day 2 — June 2** — frontend mint flow
- [ ] Reskin `web/app/page.tsx` as landing (pool stats live from chain)
- [ ] Build `/pick` page — fetches roster from Walrus, renders 16-card grid
- [ ] Click player → confirm + `mint_pass` tx via dApp Kit → Suiscan link
- [ ] "My Passes" sidebar — Tatum Data API query for owned `Pass` objects

**Day 3 — June 3** — settlement + cashout
- [ ] `/admin` page, gated to `pool.admin` address
- [ ] "Lock Pool" button → `lock_pool` tx
- [ ] "Advance Matchday" button → calls `settle_pool` with eliminated IDs from matchday-1.json
- [ ] Settlement reveal animation on user pages (framer-motion)
- [ ] `cashout` button on alive passes → tx → SUI in wallet → Suiscan link
- [ ] `/pass/[id]` detail page with pass state + cashout CTA

**Day 4 — June 4** — Tatum Notifications + AI Broker stretch
- [ ] Subscribe Tatum Notifications webhook to `PoolSettled` + `PassCashedOut` events
- [ ] Discord webhook endpoint → push on settle/cashout
- [ ] STRETCH: Claude API-powered AI Broker chat panel reading roster.json from Walrus
- [ ] Polish: loading states, error toasts, motion graphics, empty states

**Day 5 — June 5** — deploy + demo
- [ ] Deploy `web/` to Vercel (production)
- [ ] Record 2:30 demo video (the 10-step demo loop below)
- [ ] Polish README with screenshots + Suiscan/Walrus links
- [ ] Test demo flow from fresh wallet + fresh machine
- [ ] Draft X/LinkedIn submission post tagging @Tatum_io @WalrusProtocol @SuiNetwork

**June 6, 17:00 UTC — SUBMIT** (GitHub + video + tagged post)

## The 60-second demo (the recording target)

1. Open `/` → pool card visible: "MD1 · ~N SUI pot · ~M survivors · status: OPEN"
2. Connect Slush wallet → testnet SUI balance shown
3. Click **Enter the Gauntlet** → `/pick` → 16-player grid, each card shows target + AI rationale
4. Pick Messi → confirm 1-SUI deposit → tx → Pass minted → Suiscan link
5. Pass visible in sidebar with status ALIVE, target shown
6. (Cut) Admin opens `/admin` in second tab → clicks Lock → clicks Advance Matchday
7. (Cut back) User page shows matchday reveal animation. Pass: SURVIVED. Multiplier: 2x.
8. Click **Cash Out** → tx → 2 SUI lands in wallet → Suiscan link
9. (Background) Discord webhook ping: "💰 Pass #N cashed out 2.00 SUI"
10. (Stretch) Open AI Broker drawer, ask "should I have let it ride?" → broker quips with Walrus-fed data

## Risks + mitigations

- **Move learning curve** → Contract is small (~180 LoC). Reference Sui Move examples. Ship dirtiest passing version Day 1, polish later.
- **Walrus testnet flakiness** → Pre-upload all seed data Day 1; recording doesn't need live Walrus writes.
- **Oracle hand-wave optics** → Be upfront in demo: "in production this is a Pyth/Chainlink feed; the button simulates it." Show side-by-side fake-JSON-vs-real-ESPN.
- **Time** → Days 4–5 are explicitly polish + demo. If anything slips Days 1–3, drop AI Broker; ship without it.
- **One-matchday demo feels small** → Frame as Season 0 Genesis; roadmap slide shows multi-round + continuous-mode.

## Stretch (only after MVP ships)

- Live AI Broker chat (Claude API) reading Walrus blobs MCP-style (Day 4)
- Auto-generated shareable PNG match cards (Day 5)
- Motion graphics on pass survival/upgrade
- Let-it-ride into a second matchday
- Multi-pool selection / private friend codes
- Continuous-mode roadmap slide for the pitch

## Open questions (resolved Day 1)

- Sui testnet — yes, already wired
- Walrus endpoints — confirmed (`publisher.walrus-testnet.walrus.space`, `aggregator.walrus-testnet.walrus.space`)
- Folder name `proof-of-receipt` stays for now; rename via `git mv` only if we deploy publicly

---

**Today's first concrete action:** `cd contracts && sui move build`
