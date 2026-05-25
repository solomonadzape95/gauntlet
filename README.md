# Proof-of-Receipt

A tamper-proof "wayback machine" for the web. Paste a URL → get a verifiable receipt backed by Sui + Walrus that anyone can audit, forever.

Built for the **Tatum × Walrus hackathon** (May 23 – June 6, 2026).

## How it works

1. You paste a URL or upload a file.
2. We render/capture it and store the bytes on Walrus (decentralized storage).
3. We mint a Sui object containing the Walrus blob ID, a SHA-256 hash, the timestamp, and your wallet address.
4. You get a shareable link. Anyone visiting it can independently verify the snapshot is exactly what you saved, and when.

## Who it's for

Journalists citing deleted tweets, lawyers preserving evidence, fact-checkers, scam victims, anyone who needs to prove "this is what the internet said on this date."

## Stack

Sui · Walrus · Tatum (RPC + Data API + Notifications) · Next.js · Playwright

## Repo layout

```
proof-of-receipt/
├── contracts/       # Sui Move package — Receipt object + mint entry
├── snapshotter/     # Node service: render URL + upload to Walrus
└── web/             # Next.js frontend (paste UI + verifier page)
```

## Status

Pre-alpha. See [PLAN.md](./PLAN.md) for the day-by-day build plan.
