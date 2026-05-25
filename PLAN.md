# Proof-of-Receipt — Build Plan

**Hackathon:** Tatum × Walrus (May 23 – June 6, 2026)
**Today:** May 25 — ~12 days until submission (deadline June 6, 17:00 UTC)

## Pitch (one paragraph)

A tamper-proof snapshot service for the web. Users paste a URL or upload a file; we render/capture the bytes, pin them to Walrus, and mint a Sui object containing the Walrus blob ID, a SHA-256 of the bytes, a timestamp, and the signer's wallet. Anyone, forever, can visit the receipt link and independently confirm: (a) the snapshot was made at this time, (b) the bytes have not been altered, (c) this specific wallet attested to it. Walrus is structurally necessary (it stores the actual evidence); Sui is structurally necessary (it stores the rights + timestamp + signature anchor); Tatum is the only path to both via RPC, Data API, and Notifications.

## Why this wins on the judging rubric

| Bucket | Weight | Our play |
|---|---|---|
| Walrus & Tatum integration | 30% | Walrus *is* the product. Tatum RPC + Data API + Notifications all used. |
| Technical quality | 30% | Clean Move contract, real cryptographic verification client-side. |
| Creativity | 20% | Walrus's own pitch is "verifiable ID + tracked history" — we ship the canonical example. |
| Presentation | 20% | The 2-min demo writes itself: "delete this tweet — now watch the receipt still resolve." |

## Architecture

```
[User browser]
     │  paste URL / upload file
     ▼
[Next.js web app]
     │  POST /api/snapshot
     ▼
[Snapshotter API]
     ├─► Playwright renders URL → PNG + raw HTML + response headers
     ├─► Compute SHA-256 of bundled bytes
     ├─► Upload bundle to Walrus  ──────────►  returns blob_id
     └─► Return { blob_id, sha256, captured_at } to browser
     ▼
[Browser signs Sui tx with user's wallet]
     │  contracts::receipt::mint(blob_id, url, sha256)
     ▼
[Tatum Sui RPC] ──► chain ──► emits ReceiptMinted event
                                       │
                                       ▼
                          [Tatum Notifications webhook]
                                       │
                                       ▼
                          email/Discord: "your receipt is live"

[Anyone, later]
   GET /r/<object_id>
     ├─► Tatum Data API reads Sui object
     ├─► Walrus fetches blob by blob_id
     ├─► Client re-hashes blob, compares to on-chain sha256
     └─► Shows snapshot + ✅/❌ verification badge
```

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind | Fastest polished demo |
| Wallet | Mysten dApp Kit (`@mysten/dapp-kit`) | Official, supports Slush/Suiet/Phantom-Sui |
| Rendering | Playwright (headless Chromium) | Reliable for JS-heavy pages |
| Storage | Walrus testnet (HTTP API) | Required |
| Chain | Sui testnet | Required; cheap |
| Contract | Sui Move | Native |
| RPC | Tatum Sui RPC | Required |
| Events → push | Tatum Notifications | Hits "Best Tatum Tools" bonus |
| Object read | Tatum Data API | Hits "Best Tatum Tools" bonus |
| Snapshotter host | Railway (free tier) | Playwright on Vercel is painful |
| Web host | Vercel | Default for Next.js |

## Sui Move contract sketch

```move
module proof::receipt {
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::String;

    public struct Receipt has key, store {
        id: UID,
        walrus_blob_id: vector<u8>,
        original_url: String,
        sha256: vector<u8>,
        captured_at_ms: u64,
        signer: address,
    }

    public struct ReceiptMinted has copy, drop {
        receipt_id: ID,
        walrus_blob_id: vector<u8>,
        signer: address,
        captured_at_ms: u64,
    }

    public entry fun mint(
        walrus_blob_id: vector<u8>,
        original_url: String,
        sha256: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let r = Receipt {
            id: object::new(ctx),
            walrus_blob_id,
            original_url,
            sha256,
            captured_at_ms: clock::timestamp_ms(clock),
            signer: tx_context::sender(ctx),
        };
        let rid = object::id(&r);
        event::emit(ReceiptMinted {
            receipt_id: rid,
            walrus_blob_id,
            signer: tx_context::sender(ctx),
            captured_at_ms: clock::timestamp_ms(clock),
        });
        transfer::transfer(r, tx_context::sender(ctx));
    }
}
```

## Day-by-day plan

**Day 1–2 (May 25–26) — scaffolding**
- Next.js app boots, Tailwind wired, wallet connect button works on testnet
- Tatum account, free Sui RPC key in `.env`
- Walrus testnet aggregator + publisher endpoints confirmed
- Hello-world Sui Move package compiles + `sui client publish` succeeds
- Playwright spike: render `https://example.com` to PNG locally

**Day 3–4 (May 27–28) — core storage path**
- `receipt.move` final + published to testnet, package ID committed
- `/api/snapshot` route: URL → Playwright → bundle → Walrus → returns `{ blob_id, sha256 }`
- Manual stitched flow: paste URL → see `blob_id` printed

**Day 5–6 (May 29–30) — wallet + minting**
- Browser invokes `receipt::mint` via dApp Kit
- Confirm tx on Suiscan
- Receipt page `/r/[id]` reads object via Tatum Data API and displays fields

**Day 7–8 (May 31 – Jun 1) — verifier UX**
- Render snapshot inline; "verify hash" button re-hashes Walrus bytes client-side and shows ✅/❌
- Polished copy: original URL, captured timestamp, signer address (truncated), Suiscan + Walrus links
- Share buttons (X, copy link)

**Day 9 (Jun 2) — Tatum notifications**
- Subscribe webhook to `ReceiptMinted` event
- Simple Discord/email push: "your receipt 0xabc is live: <link>"
- Bonus surface for "Best Tatum Tools"

**Day 10 (Jun 3) — polish**
- File-upload path (PDF/image direct, no rendering)
- Failure states (URL unreachable, Walrus 5xx, wallet rejected)
- Mobile layout pass
- README quickstart + screenshots

**Day 11 (Jun 4) — demo prep**
- Record 2:30 video: create receipt of a tweet → delete tweet → receipt still resolves
- Deploy production: snapshotter on Railway, web on Vercel
- Test from a fresh machine + fresh wallet

**Day 12 (Jun 5) — buffer / stretch**

**Jun 6 17:00 UTC — submit**
- GitHub repo, demo video, X/LinkedIn post tagging @Tatum_io @WalrusProtocol @SuiNetwork (bonus)

## Risks + mitigations

- **Playwright on serverless is painful.** → Host snapshotter on Railway as a long-running container, not on Vercel.
- **Walrus testnet flakiness.** → Retry with backoff. Surface failures clearly. Cache nothing client-side until upload confirms.
- **X.com blocks headless browsers.** → Support raw-HTML/file upload as fallback path.
- **Sui wallet UX eats a day.** → Use Mysten dApp Kit, do not roll our own.
- **Move language gotchas.** → Keep the contract tiny — one struct, one entry function, one event. No upgrades, no admin caps for MVP.
- **Time.** → MVP locked by Jun 1. Days 7–12 are polish. If we slip, the demo still works.

## Stretch (only after MVP ships)

- **"Watch this URL"** — periodic re-snapshot; diff detected → mint a linked follow-up receipt. Tatum webhooks drive the pipeline.
- **Multi-signer receipts** — two wallets co-sign a snapshot (escrow-style agreements).
- **Human-readable proof IDs** — short slugs that resolve to object IDs.
- **API mode** — programmatic snapshot for developers; rate-limited free tier.

## Open questions (resolve in Day 1)

- Sui testnet vs mainnet for submission — hackathon prefers mainnet but testnet is fine. Decide after smoke test.
- Walrus storage costs at scale — irrelevant for demo, note for pitch.
- Do we need wallet sponsorship (gasless mint) so non-crypto users can demo? Maybe Day 8 stretch.
