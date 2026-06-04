"use client";

import { useState } from "react";
import { countryCode } from "@/lib/country-codes";
import { cn } from "@/lib/cn";

/**
 * Real country-flag icon via flagcdn.com — replaces the previous
 * country-name-keyed stripes fallback. Renders nothing when the country
 * name doesn't map to a known ISO code (so we don't show a broken image).
 */
export function CountryFlag({
  country,
  width = 22,
  className,
  title,
}: {
  country: string | undefined;
  width?: number;
  className?: string;
  title?: string;
}) {
  const code = countryCode(country);
  const [failed, setFailed] = useState(false);
  if (!code || failed) return null;

  // flagcdn supports a small set of pixel widths — pick the nearest above
  // the requested width so we don't waste bandwidth or lose sharpness.
  const cdnWidth = [20, 40, 80, 160, 320, 640, 1280, 2560].find((w) => w >= width) ?? 40;
  // Aspect 4:3 for country flags (flagcdn convention).
  const height = Math.round((width * 3) / 4);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w${cdnWidth}/${code}.png`}
      srcSet={`https://flagcdn.com/w${cdnWidth * 2}/${code}.png 2x`}
      width={width}
      height={height}
      alt={title ?? country ?? ""}
      title={title ?? country}
      className={cn(
        "inline-block object-cover rounded-[3px] ring-1 ring-black/15 shrink-0",
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}
