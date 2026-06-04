# Pool cover images

Drop pool cover assets here. **Two files per pool**, matching the hero collage pattern — a stylized version visible at rest, and the original photo revealed by the slow warp transition on hover.

```
/public/pools/<slug>-edited.jpg     ← stylized cover (default visible)
/public/pools/<slug>-original.jpg   ← real photo (revealed on hover)
```

Both paths are referenced from `web/lib/pools.ts` (`image` + `imageOriginal`).

## Current slugs

| Slug | Files |
|------|-------|
| `genesis-wc` | `genesis-wc-edited.jpg` · `genesis-wc-original.jpg` |
| `epl-weekly` | `epl-weekly-edited.jpg` · `epl-weekly-original.jpg` |
| `laliga-weekly` | `laliga-weekly-edited.jpg` · `laliga-weekly-original.jpg` |
| `ucl-nights` | `ucl-nights-edited.jpg` · `ucl-nights-original.jpg` |
| `create-pools` (Create Your Pool card) | `create-pools-edited.jpg` · `create-pools-original.jpg` |

## Specs

- **Aspect**: 16:9 (matches the card + detail-page hero crop)
- **Resolution**: ~1600 × 900, JPG or WebP, dark-friendly
- **Tone**: lean dark — these sit on `bg-ink` (`#0A0A0A`). Cards apply a bottom fade mask, so anything in the bottom ~25% dissolves into the card body — keep faces and key subjects in the top two thirds.
- **`-edited.jpg`**: stylized treatment — illustration, posterize, monochrome, halftone, whatever matches the editorial vibe of the `/public/hero/` photos.
- **`-original.jpg`**: unedited reference. Same framing as `-edited.jpg` so the warp reads as the same scene "resolving" into reality.

## Fallback

If a file is missing the dark gradient placeholder shows through, and the broken `<img>` hides itself via the `onError` handler — pool cards stay usable while you finalize art.
