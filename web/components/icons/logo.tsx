import { cn } from "@/lib/cn";

/**
 * Gauntlet wordmark / helmet logo. Rendered as a CSS `mask-image` so the
 * artwork's color comes from the element's `color` (via
 * `background-color: currentColor`). That makes it composable with Tailwind
 * color utilities and hover variants — e.g. `text-white group-hover:text-hazard
 * transition-colors` paints the logo yellow when the parent is hovered, with
 * a smooth tween.
 *
 * The SVG ships with a 1400×980 viewBox; we preserve that aspect ratio so
 * callers can just pass a `height` and get a proportional width back.
 */
export function Logo({
  height = 24,
  className,
  title,
}: {
  height?: number;
  /** Tailwind classes — use `text-*` to color the logo. */
  className?: string;
  title?: string;
}) {
  const ratio = 1400 / 980;
  const width = Math.round(height * ratio);
  return (
    <span
      role="img"
      aria-label={title ?? "Gauntlet"}
      title={title}
      className={cn("inline-block shrink-0 select-none", className)}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: "currentColor",
        WebkitMaskImage: 'url("/logo.svg")',
        maskImage: 'url("/logo.svg")',
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
