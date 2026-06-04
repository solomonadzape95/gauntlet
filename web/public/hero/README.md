# Hero collage photos

Each marquee slot uses **two images**: the stylized illustration that's visible by default, and the original photo that's revealed on hover via the warp effect.

## Naming convention

8 slots × 2 images = **16 files total**, named:

```
/hero/01-edited.jpg      ← stylized (visible at rest)
/hero/01-original.jpg    ← real photo (revealed on hover)
/hero/02-edited.jpg
/hero/02-original.jpg
…
/hero/08-edited.jpg
/hero/08-original.jpg
```

Same convention with `.webp` or `.png` is fine — just keep the file extension consistent and update the import strings in `hero-collage.tsx` if you change away from `.jpg`.

## What the hover does

- **At rest**: the `-edited` (stylized) image is fully visible. The `-original` photo sits underneath, slightly scaled up (1.08×) and invisible.
- **On hover**: the stylized version *warps away* — it scales up to 1.1×, skews −4° on the Y-axis, blurs by 6px, and fades to opacity 0 (~600ms cubic-bezier ease). At the same time the original photo scales down to 1.0 and fades to full opacity. The effect reads as the illustration "lifting off" to reveal the photo beneath.

## Generating the stylized versions from the originals

The `edited.png` reference you sent (flat vector illustration, limited palette, posterized planes) is best produced via **AI img-to-img**. Options:

| Tool | Cost | Notes |
|---|---|---|
| **Recraft.ai** | Free tier | Web UI, upload + pick "Vector Illustration" / "Flat" preset. Manual but excellent. |
| **Replicate (SDXL img2img)** | ~$0.005–0.02/image | Programmatic. Prompt: `flat vector illustration, posterized shading, limited 6-color palette, simplified geometric planes, retro pop-art football poster`. |
| **OpenAI gpt-image-1** | ~$0.04–0.08/image | Programmatic. Better natural-language control over style. |

**Recommended for this hackathon**: generate the 8 stylized versions manually via Recraft.ai (about 10 min total), save them as `01-edited.jpg` … `08-edited.jpg`. Drop the matching photo originals as `01-original.jpg` … `08-original.jpg`.

If you'd rather batch them via API, ask and I'll write a Node script that takes a folder of originals and outputs the edited variants.

## Specs

- **Aspect**: portrait (the slot is `aspect-[3/4]`)
- **Size**: ~900×1200 px on the long edge is plenty; the browser scales down
- **Format**: JPG or WebP, sRGB
- **Background**: dark-friendly compositions look best — the slot bg is `#141414`

## Fallback behavior

- If `-edited` is missing: hover reveals nothing on top, you see the original underneath at rest
- If `-original` is missing: hover fades the edited away to the gradient placeholder
- If both are missing: slot shows the gradient placeholder with the slot number top-left
- No layout shift in any case
