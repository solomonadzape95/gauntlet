import type { JerseyPattern, TeamColors } from "@/lib/team-colors";
import { cn } from "@/lib/cn";

interface Props extends Partial<TeamColors> {
  /** Squad number stamped on the back. */
  number?: number;
  /** Pixel width; height auto-scales to ~1.1 ratio. */
  size?: number;
  /** Tailwind classes on the wrapper. */
  className?: string;
}

/**
 * Code-rendered jersey back. One SVG, programmatically tinted to the player's
 * national colors. Pattern variants cover the big nations:
 *   - solid:            most countries
 *   - stripes-vertical: Argentina, Paraguay
 *   - checks:           Croatia
 *   - cross-accent:     England, Switzerland, Denmark
 *   - stars-stripes:    USA
 *
 * Design intent (mock-jersey screenshots): photorealistic-ish jersey back,
 * rounded shoulders + crew neck, sleeves visible at sides, large stenciled
 * number centered on the back with a hollow / outlined look — the team color
 * shows through the number.
 *
 * Renders server-side, no JS dependency, no image network requests.
 */
export function Jersey({
  primary = "#1A1A1A",
  secondary = "#F5FF00",
  accent,
  pattern = "solid",
  number,
  size = 220,
  className,
}: Props) {
  const a = accent ?? secondary;
  const trim = secondary;
  // Hollow-stencil number: white outline so it pops against any tint.
  const numberStroke = "#FFFFFF";
  // Subtle inner fill = lighter team primary so the digit reads from a distance.
  const numberFill = "rgba(255,255,255,0.04)";

  return (
    <svg
      viewBox="0 0 200 240"
      width={size}
      height={Math.round((size * 240) / 200)}
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`j-shade-${pattern}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="48%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
        </linearGradient>
        <linearGradient id={`j-edge-${pattern}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
          <stop offset="15%" stopColor="rgba(0,0,0,0)" />
          <stop offset="85%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
        <pattern
          id="j-checks"
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <rect x="0" y="0" width="11" height="11" fill={primary} />
          <rect x="11" y="0" width="11" height="11" fill={a} />
          <rect x="0" y="11" width="11" height="11" fill={a} />
          <rect x="11" y="11" width="11" height="11" fill={primary} />
        </pattern>
        <clipPath id={`j-clip-${pattern}`}>
          <path d={SHIRT_PATH} />
        </clipPath>
      </defs>

      {/* Base shape — silhouette + neck shadow */}
      <g clipPath={`url(#j-clip-${pattern})`}>
        <PatternFill pattern={pattern} primary={primary} secondary={trim} accent={a} />

        {/* Fabric folds — subtle dark/light streaks that read as cloth. */}
        <FabricFolds />

        {/* Side body shading (darker edges) */}
        <rect x="0" y="0" width="200" height="240" fill={`url(#j-edge-${pattern})`} />

        {/* Overall light-from-above shading */}
        <rect x="0" y="0" width="200" height="240" fill={`url(#j-shade-${pattern})`} />

        {/* Stencil number — hollow with white outline, team color shows through */}
        {number !== undefined && (
          <text
            x="100"
            y="155"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-anton), Impact, sans-serif"
            fontWeight={400}
            fontSize="130"
            letterSpacing="-2"
            fill={numberFill}
            stroke={numberStroke}
            strokeWidth="3.5"
            strokeLinejoin="round"
            style={{ paintOrder: "stroke fill" }}
          >
            {number}
          </text>
        )}
      </g>

      {/* Outline (silhouette stroke) */}
      <path
        d={SHIRT_PATH}
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Crew neck + sleeve cuff trim sits on top of the clipped fill */}
      <Trim trim={trim} />
    </svg>
  );
}

/**
 * Rounded-shoulder T-shirt back silhouette. Wider than the previous version,
 * with sleeves that sit clearly outside the torso line and a proper crew neck
 * dip at the top. ViewBox: 0 0 200 240.
 */
const SHIRT_PATH = `
  M 56 22
  Q 80 14 100 14
  Q 120 14 144 22
  L 170 32
  Q 184 38 192 52
  L 198 76
  Q 198 84 190 88
  L 168 96
  L 168 220
  Q 168 230 158 230
  L 42 230
  Q 32 230 32 220
  L 32 96
  L 10 88
  Q 2 84 2 76
  L 8 52
  Q 16 38 30 32
  Z
`;

function PatternFill({
  pattern,
  primary,
  secondary,
  accent,
}: {
  pattern: JerseyPattern;
  primary: string;
  secondary: string;
  accent: string;
}) {
  switch (pattern) {
    case "stripes-vertical": {
      const stripes = 7;
      const stripeWidth = 200 / stripes;
      return (
        <g>
          <rect x="0" y="0" width="200" height="240" fill={primary} />
          {Array.from({ length: stripes }).map((_, i) =>
            i % 2 === 1 ? (
              <rect
                key={i}
                x={i * stripeWidth}
                y={0}
                width={stripeWidth}
                height={240}
                fill={accent}
              />
            ) : null,
          )}
        </g>
      );
    }
    case "checks":
      return <rect x="0" y="0" width="200" height="240" fill="url(#j-checks)" />;
    case "cross-accent":
      return (
        <g>
          <rect x="0" y="0" width="200" height="240" fill={primary} />
          <rect x="92" y="0" width="16" height="240" fill={accent} />
          <rect x="0" y="118" width="200" height="16" fill={accent} />
        </g>
      );
    case "stars-stripes":
      return (
        <g>
          <rect x="0" y="0" width="200" height="240" fill={primary} />
          {Array.from({ length: 5 }).map((_, i) => (
            <rect
              key={i}
              x={0}
              y={120 + i * 13}
              width={200}
              height={6}
              fill={accent}
            />
          ))}
          <rect x="42" y="36" width="50" height="36" fill={secondary} />
          <polygon
            points="67,42 71,54 84,54 73,62 77,74 67,66 57,74 61,62 50,54 63,54"
            fill={primary}
          />
        </g>
      );
    case "solid":
    default:
      return <rect x="0" y="0" width="200" height="240" fill={primary} />;
  }
}

/**
 * Crew neck + sleeve cuffs in trim color. Sits ABOVE the pattern fill so the
 * trim color always reads no matter what's underneath.
 */
function Trim({ trim }: { trim: string }) {
  return (
    <g>
      {/* Crew neck collar */}
      <path
        d="M 76 16 Q 80 12 100 12 Q 120 12 124 16 L 118 30 Q 100 22 82 30 Z"
        fill={trim}
      />
      <path
        d="M 82 30 Q 100 22 118 30 L 116 34 Q 100 26 84 34 Z"
        fill="rgba(0,0,0,0.25)"
      />
      {/* Left sleeve cuff (band at bottom of sleeve) */}
      <path
        d="M 2 76 L 32 96 L 32 102 L 6 86 Z"
        fill={trim}
      />
      {/* Right sleeve cuff */}
      <path
        d="M 198 76 L 168 96 L 168 102 L 194 86 Z"
        fill={trim}
      />
    </g>
  );
}

/**
 * Subtle fabric fold streaks — three vertical hint-lines on each side of the
 * torso, low opacity so they read as cloth without competing with the number.
 */
function FabricFolds() {
  return (
    <g opacity="0.22">
      {/* Center crease */}
      <path
        d="M 100 36 Q 100 130 100 218"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.2"
        fill="none"
      />
      {/* Left side folds */}
      <path
        d="M 60 50 Q 62 130 64 220"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M 44 90 Q 48 150 50 220"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1"
        fill="none"
      />
      {/* Right side folds */}
      <path
        d="M 140 50 Q 138 130 136 220"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M 156 90 Q 152 150 150 220"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1"
        fill="none"
      />
      {/* Shoulder light */}
      <path
        d="M 70 26 Q 100 22 130 26"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
        fill="none"
      />
    </g>
  );
}
