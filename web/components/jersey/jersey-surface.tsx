"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { CardTexture, TeamColors } from "@/lib/team-colors";

/**
 * Layered "fabric" surface used as the hero background on player cards,
 * pick modals, and pass detail. Stacks (back to front):
 *
 *   1. solid team primary color
 *   2. texture pattern (mesh dots / stripes / diagonal pinstripes)
 *   3. /wrinkle-template.jpg overlay with `mix-blend-mode: multiply`
 *      (silently hidden if the file is missing — drop one at
 *      `web/public/wrinkle-template.jpg` to activate the fabric folds)
 *   4. diagonal stadium-light sheen
 *   5. soft top-left light + bottom-right shade for depth
 *   6. children (number, name, etc.)
 *
 * Renders nothing extra when `texture` is "none" — caller still gets the
 * flat color + sheen + vignette.
 */
export function JerseySurface({
  colors,
  className,
  style,
  children,
  showWrinkle = true,
}: {
  colors: TeamColors;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Set false to skip the wrinkle overlay (e.g. on tiny preview tiles). */
  showWrinkle?: boolean;
}) {
  const texture = colors.texture ?? "none";
  const [wrinkleFailed, setWrinkleFailed] = useState(false);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundColor: colors.primary, ...style }}
    >
      {/* 2. texture pattern */}
      {texture !== "none" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={textureStyle(texture)}
        />
      )}

      {/* 3. wrinkle template — multiply blend so highlights pop and folds
              darken the base color. Hide imperatively on 404 so the browser
              doesn't render its broken-image placeholder icon before React
              has a chance to re-render. */}
      {showWrinkle && !wrinkleFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/wrinkle-template.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-55"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            setWrinkleFailed(true);
          }}
        />
      )}

      {/* 4. diagonal stadium-light sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 18%, rgba(255,255,255,0.20) 24%, transparent 32%)",
        }}
      />

      {/* 5. radial vignette / light source */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 25% 0%, rgba(255,255,255,0.18) 0%, transparent 45%), radial-gradient(circle at 100% 100%, rgba(0,0,0,0.35) 0%, transparent 60%)",
        }}
      />

      {/* 6. children (number, name, etc.) */}
      {children}
    </div>
  );
}

function textureStyle(t: CardTexture): CSSProperties {
  switch (t) {
    case "mesh":
      return {
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.20) 1.5px, transparent 1.7px)",
        backgroundSize: "14px 14px",
      };
    case "stripes":
      return {
        backgroundImage:
          "repeating-linear-gradient(to right, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 24px, transparent 24px, transparent 48px)",
      };
    case "diagonal":
      return {
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 3px, transparent 3px, transparent 14px)",
      };
    case "none":
    default:
      return {};
  }
}

/**
 * Ironed-on text-shadow for the squad number — combines a tight dark drop
 * for edge thickness with a thin top-edge white glow to simulate raised
 * printed numbering on a real shirt. Use as the `style` on the number text
 * element together with `fontFamily: var(--font-xirod)`.
 */
export const JERSEY_NUMBER_SHADOW: CSSProperties = {
  textShadow:
    "2px 4px 0px rgba(0, 0, 0, 0.35), 0px -1px 1px rgba(255, 255, 255, 0.45), 0px 8px 24px rgba(0, 0, 0, 0.35)",
};
