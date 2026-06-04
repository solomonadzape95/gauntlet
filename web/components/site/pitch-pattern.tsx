/**
 * Subtle football pitch markings tiled behind every page.
 * Pure SVG, no JS. Renders fixed at ~2.5% opacity so it never competes with content.
 */
export function PitchPattern() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none opacity-[0.025]"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1200 1800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="#ffffff" strokeWidth="2" fill="none">
          {/* Outer pitch boundary */}
          <rect x="100" y="100" width="1000" height="1600" />

          {/* Halfway line */}
          <line x1="100" y1="900" x2="1100" y2="900" />

          {/* Center circle + spot */}
          <circle cx="600" cy="900" r="140" />
          <circle cx="600" cy="900" r="5" fill="#ffffff" />

          {/* Top penalty area */}
          <rect x="350" y="100" width="500" height="220" />
          {/* Top 6-yard box */}
          <rect x="475" y="100" width="250" height="90" />
          {/* Top penalty spot + arc */}
          <circle cx="600" cy="260" r="5" fill="#ffffff" />
          <path d="M 470 320 A 140 140 0 0 0 730 320" />

          {/* Bottom penalty area */}
          <rect x="350" y="1480" width="500" height="220" />
          {/* Bottom 6-yard box */}
          <rect x="475" y="1610" width="250" height="90" />
          {/* Bottom penalty spot + arc */}
          <circle cx="600" cy="1540" r="5" fill="#ffffff" />
          <path d="M 470 1480 A 140 140 0 0 1 730 1480" />

          {/* Corner arcs */}
          <path d="M 100 110 A 10 10 0 0 1 110 100" />
          <path d="M 1100 110 A 10 10 0 0 0 1090 100" />
          <path d="M 100 1690 A 10 10 0 0 0 110 1700" />
          <path d="M 1100 1690 A 10 10 0 0 1 1090 1700" />
        </g>
      </svg>
    </div>
  );
}
