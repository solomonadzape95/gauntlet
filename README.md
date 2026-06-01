# Gauntlet

A "last man standing" survival pool for the FIFA World Cup 2026, on Sui + Walrus.

Built for the **Tatum × Walrus hackathon** (May 23 – June 6, 2026).
**Launching 5 days before kickoff.**

## How it works

1. **Pick a player.** Deposit 1 SUI. Mint a Survival Pass NFT tied to a real-world footballer.
2. **Get your target.** The AI Game Master assigns your player a stat target — score a goal, complete 4 tackles, keep a clean sheet, whatever fits their role. Superstars get brutal targets. Workhorses get reachable ones.
3. **The match happens.** Real-world stats land on Walrus. If your player hit their target, your pass survives. If not, it burns and your stake locks into the pot for the survivors.
4. **Cash out or ride.** Survivors choose: take a guaranteed proportional share of the pot now, or let it ride into the next matchday for a fatter multiplier.

The more passes die, the more each survivor's share grows.

## Stack

- **Sui Move** — `gauntlet::pool` module (pool + survival pass logic)
- **Walrus** — player roster, matchday results, card media
- **Tatum** — Sui RPC, Data API, Notifications webhooks
- **Next.js 15 + Tailwind + Mysten dApp Kit** — frontend + wallet
- **Claude API + MCP-style Walrus tool** *(stretch)* — AI Broker chat

## Repo layout

```
.
├── contracts/      Sui Move package (gauntlet::pool)
├── data/           Walrus seed data (roster + matchday + cards)
├── scripts/        helper scripts (Walrus upload, pool creation)
└── web/            Next.js frontend
```

## Status

Day 1 of 5 (pivot day). See [PLAN.md](./PLAN.md).

## Pivot history

This repo was originally **Proof-of-Receipt** (a tamper-proof web snapshot service). Pivoted to Gauntlet on June 1 with 5 days remaining. The original scaffold (Next.js + dApp Kit + Tailwind) carried over; the snapshotter and receipt module were deleted. See `gemini-chat.txt` for the brainstorm that led here.
