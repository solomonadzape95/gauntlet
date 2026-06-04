## Tier badge GIFs

Drop a small looping GIF (or WebP) per tier here. The PlayerCard's floating tier badge (top-right) will pick them up automatically.

```
/public/tiers/elite.gif      ← star tier
/public/tiers/standard.gif   ← regular tier
/public/tiers/engine.gif     ← workhorse tier
/public/tiers/wall.gif       ← defender tier
/public/tiers/gloves.gif     ← GK tier
```

### Specs
- ~64×64 px, looping, dark-friendly (transparent or near-black background)
- 200–600KB max per file
- Square aspect; the badge crops to a circle in rest state and expands to a pill on hover

### Fallback
If a tier's GIF is missing, the badge shows the existing tier icon as a static placeholder — no layout break.
