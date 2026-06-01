# Walrus seed data

Pre-uploaded blobs the `gauntlet::pool` contract references.

## `roster.json`

16-player roster for the demo matchday. The AI Game Master (precomputed) assigns each player a stat target and a 1–2 sentence rationale. Difficulty tiers: `star`, `regular`, `workhorse`, `defender`, `GK`.

Upload to Walrus testnet:

```bash
curl -X PUT "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5" \
  --data-binary @data/roster.json
```

Save the returned `blobId` from the response. Pass it to `create_pool(entry_fee_mist, roster_blob_id)`.

## `matchday-1.json`

Per-player stat outcomes for the demo matchday. The `eliminated_player_ids` array is what we submit to `settle_pool` along with the matchday blob ID for verifier transparency.

Upload after creating the pool, before settling:

```bash
curl -X PUT "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5" \
  --data-binary @data/matchday-1.json
```

## Demo math

With 16 entries at 1 SUI each:
- Pot = 16 SUI
- Eliminated player_ids: `[0, 3, 4, 5, 6, 7, 11, 13, 14]` (9 player slots)
- If each player_id has exactly one pass minted → 7 survivors
- Cashout per survivor = 16 / 7 ≈ 2.28 SUI (2.28× multiplier)

For the demo recording we'll vary the mint distribution to land on cleaner numbers.

## The oracle hand-wave

In production, matchday results come from a sports oracle (Pyth, Chainlink). For the hackathon, the admin pushes results manually via the `/admin` page → an "Advance Matchday" button reads `matchday-1.json` and calls `settle_pool` with the `eliminated_player_ids` from this file. The demo video calls this out explicitly.
