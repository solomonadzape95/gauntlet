import { cn } from "@/lib/cn";
import { teamColors } from "@/lib/team-colors";

interface Props {
  country: string;
  width?: number;
  className?: string;
}

/**
 * SVG-rendered flags for the WC 2026 field. Hand-drawn at viewBox 16x12 so
 * they live alongside text without raster fuzz. Anything not explicitly
 * mapped here falls back to a 3-band stripe built from team-colors so we
 * never silently render nothing.
 */
export function Flag({ country, width = 20, className }: Props) {
  const height = (width * 12) / 16;
  const inner = renderInner(country);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 12"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("rounded-[1px] ring-1 ring-zinc-800/40 shrink-0", className)}
      aria-label={`${country} flag`}
    >
      {inner}
    </svg>
  );
}

function renderInner(country: string): React.ReactNode {
  switch (country) {
    // === CONCACAF hosts ===
    case "Mexico":
      return (
        <>
          <rect width="5.33" height="12" fill="#006847" />
          <rect x="5.33" width="5.34" height="12" fill="#fff" />
          <rect x="10.67" width="5.33" height="12" fill="#CE1126" />
          <circle cx="8" cy="6" r="1.05" fill="#7c2d12" opacity="0.55" />
        </>
      );
    case "USA":
      return (
        <>
          <rect width="16" height="12" fill="#fff" />
          {[0, 2, 4, 6, 8, 10].map((y) => (
            <rect key={y} y={y} width="16" height="0.92" fill="#B31942" />
          ))}
          <rect width="7" height="6.46" fill="#0A3161" />
        </>
      );
    case "Canada":
      return (
        <>
          <rect width="4" height="12" fill="#D52B1E" />
          <rect x="4" width="8" height="12" fill="#fff" />
          <rect x="12" width="4" height="12" fill="#D52B1E" />
          <path d="M8 3.5 L7.4 5.1 L6 4.8 L6.7 6.2 L5.5 6.7 L6.7 7.4 L6.6 8.5 L8 7.8 L9.4 8.5 L9.3 7.4 L10.5 6.7 L9.3 6.2 L10 4.8 L8.6 5.1 Z" fill="#D52B1E" />
        </>
      );

    // === CONMEBOL ===
    case "Argentina":
      return (
        <>
          <rect width="16" height="4" fill="#75AADB" />
          <rect y="4" width="16" height="4" fill="#fff" />
          <rect y="8" width="16" height="4" fill="#75AADB" />
          <circle cx="8" cy="6" r="1.2" fill="#F6B40E" />
        </>
      );
    case "Brazil":
      return (
        <>
          <rect width="16" height="12" fill="#009C3B" />
          <polygon points="8,1.5 14.5,6 8,10.5 1.5,6" fill="#FFDF00" />
          <circle cx="8" cy="6" r="2.4" fill="#002776" />
        </>
      );
    case "Uruguay":
      return (
        <>
          <rect width="16" height="12" fill="#fff" />
          {[1, 3, 5, 7].map((y) => (
            <rect key={y} y={y} width="16" height="1.3" fill="#0038A8" />
          ))}
          <rect width="6.5" height="6.5" fill="#fff" />
          <circle cx="3.25" cy="3.25" r="1.7" fill="#FCD116" />
        </>
      );
    case "Colombia":
      return (
        <>
          <rect width="16" height="6" fill="#FCD116" />
          <rect y="6" width="16" height="3" fill="#003893" />
          <rect y="9" width="16" height="3" fill="#CE1126" />
        </>
      );
    case "Ecuador":
      return (
        <>
          <rect width="16" height="6" fill="#FFD100" />
          <rect y="6" width="16" height="3" fill="#003893" />
          <rect y="9" width="16" height="3" fill="#CE1126" />
        </>
      );
    case "Paraguay":
      return (
        <>
          <rect width="16" height="4" fill="#D52B1E" />
          <rect y="4" width="16" height="4" fill="#fff" />
          <rect y="8" width="16" height="4" fill="#0038A8" />
        </>
      );

    // === UEFA ===
    case "France":
      return (
        <>
          <rect width="5.33" height="12" fill="#002395" />
          <rect x="5.33" width="5.34" height="12" fill="#fff" />
          <rect x="10.67" width="5.33" height="12" fill="#ED2939" />
        </>
      );
    case "England":
      return (
        <>
          <rect width="16" height="12" fill="#fff" />
          <rect x="6.5" width="3" height="12" fill="#CE1124" />
          <rect y="4.5" width="16" height="3" fill="#CE1124" />
        </>
      );
    case "Germany":
      return (
        <>
          <rect width="16" height="4" fill="#000" />
          <rect y="4" width="16" height="4" fill="#DD0000" />
          <rect y="8" width="16" height="4" fill="#FFCE00" />
        </>
      );
    case "Spain":
      return (
        <>
          <rect width="16" height="3" fill="#AA151B" />
          <rect y="3" width="16" height="6" fill="#F1BF00" />
          <rect y="9" width="16" height="3" fill="#AA151B" />
        </>
      );
    case "Italy":
      return (
        <>
          <rect width="5.33" height="12" fill="#009246" />
          <rect x="5.33" width="5.34" height="12" fill="#fff" />
          <rect x="10.67" width="5.33" height="12" fill="#CE2B37" />
        </>
      );
    case "Portugal":
      return (
        <>
          <rect width="6.4" height="12" fill="#046A38" />
          <rect x="6.4" width="9.6" height="12" fill="#DA291C" />
          <circle cx="6.4" cy="6" r="1.6" fill="#FFE900" />
        </>
      );
    case "Netherlands":
      return (
        <>
          <rect width="16" height="4" fill="#AE1C28" />
          <rect y="4" width="16" height="4" fill="#fff" />
          <rect y="8" width="16" height="4" fill="#21468B" />
        </>
      );
    case "Belgium":
      return (
        <>
          <rect width="5.33" height="12" fill="#000" />
          <rect x="5.33" width="5.34" height="12" fill="#FAE042" />
          <rect x="10.67" width="5.33" height="12" fill="#ED2939" />
        </>
      );
    case "Croatia":
      return (
        <>
          <rect width="16" height="4" fill="#FF0000" />
          <rect y="4" width="16" height="4" fill="#fff" />
          <rect y="8" width="16" height="4" fill="#171796" />
          {/* Checkerboard tilt accent */}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={5.5 + (i % 2) * 1} y={4 + Math.floor(i / 2) * 1.5} width="1" height="1.5" fill="#FF0000" />
          ))}
        </>
      );
    case "Switzerland":
      return (
        <>
          <rect width="16" height="12" fill="#D52B1E" />
          <rect x="7" y="3.5" width="2" height="5" fill="#fff" />
          <rect x="5.5" y="5" width="5" height="2" fill="#fff" />
        </>
      );
    case "Poland":
      return (
        <>
          <rect width="16" height="6" fill="#fff" />
          <rect y="6" width="16" height="6" fill="#DC143C" />
        </>
      );
    case "Denmark":
      return (
        <>
          <rect width="16" height="12" fill="#C60C30" />
          <rect x="5" width="2" height="12" fill="#fff" />
          <rect y="5" width="16" height="2" fill="#fff" />
        </>
      );
    case "Austria":
      return (
        <>
          <rect width="16" height="4" fill="#ED2939" />
          <rect y="4" width="16" height="4" fill="#fff" />
          <rect y="8" width="16" height="4" fill="#ED2939" />
        </>
      );
    case "Scotland":
      return (
        <>
          <rect width="16" height="12" fill="#0065BD" />
          <path d="M0 0 L16 12 M16 0 L0 12" stroke="#fff" strokeWidth="2" />
        </>
      );
    case "Serbia":
      return (
        <>
          <rect width="16" height="4" fill="#C6363C" />
          <rect y="4" width="16" height="4" fill="#0C4076" />
          <rect y="8" width="16" height="4" fill="#fff" />
        </>
      );
    case "Turkey":
      return (
        <>
          <rect width="16" height="12" fill="#E30A17" />
          <circle cx="6" cy="6" r="2.4" fill="#fff" />
          <circle cx="6.7" cy="6" r="1.9" fill="#E30A17" />
        </>
      );

    // === CAF ===
    case "Morocco":
      return (
        <>
          <rect width="16" height="12" fill="#C1272D" />
          <path
            d="M8,3 L8.9,5.4 L11.3,5.4 L9.3,7 L10.1,9.4 L8,7.9 L5.9,9.4 L6.7,7 L4.7,5.4 L7.1,5.4 Z"
            fill="none"
            stroke="#006233"
            strokeWidth="0.45"
          />
        </>
      );
    case "South Africa":
      return (
        <>
          <rect width="16" height="12" fill="#fff" />
          <polygon points="0,0 6,6 0,12" fill="#000" />
          <polygon points="0,0 6,6 16,0" fill="#E03C31" />
          <polygon points="0,12 6,6 16,12" fill="#001489" />
          <path d="M0 1 L7 6 L0 11 Z" fill="#FFB81C" />
          <path d="M0 2 L5 6 L0 10 Z" fill="#007A4D" />
        </>
      );
    case "Senegal":
      return (
        <>
          <rect width="5.33" height="12" fill="#00853F" />
          <rect x="5.33" width="5.34" height="12" fill="#FDEF42" />
          <rect x="10.67" width="5.33" height="12" fill="#E31B23" />
          <path d="M8 4.5 L8.5 5.7 L9.7 5.7 L8.7 6.5 L9.1 7.7 L8 7 L6.9 7.7 L7.3 6.5 L6.3 5.7 L7.5 5.7 Z" fill="#00853F" />
        </>
      );
    case "Nigeria":
      return (
        <>
          <rect width="5.33" height="12" fill="#008751" />
          <rect x="5.33" width="5.34" height="12" fill="#fff" />
          <rect x="10.67" width="5.33" height="12" fill="#008751" />
        </>
      );
    case "Egypt":
      return (
        <>
          <rect width="16" height="4" fill="#CE1126" />
          <rect y="4" width="16" height="4" fill="#fff" />
          <rect y="8" width="16" height="4" fill="#000" />
          <circle cx="8" cy="6" r="0.9" fill="#C09300" />
        </>
      );
    case "Ghana":
      return (
        <>
          <rect width="16" height="4" fill="#CE1126" />
          <rect y="4" width="16" height="4" fill="#FCD116" />
          <rect y="8" width="16" height="4" fill="#006B3F" />
          <path d="M8 4.5 L8.45 5.7 L9.7 5.7 L8.7 6.5 L9.05 7.7 L8 7 L6.95 7.7 L7.3 6.5 L6.3 5.7 L7.55 5.7 Z" fill="#000" />
        </>
      );
    case "Algeria":
      return (
        <>
          <rect width="8" height="12" fill="#006633" />
          <rect x="8" width="8" height="12" fill="#fff" />
          <circle cx="8" cy="6" r="1.8" fill="#D21034" />
          <circle cx="8.5" cy="6" r="1.5" fill={"#fff"} />
        </>
      );
    case "Tunisia":
      return (
        <>
          <rect width="16" height="12" fill="#E70013" />
          <circle cx="8" cy="6" r="2.4" fill="#fff" />
          <circle cx="8" cy="6" r="1.8" fill="#E70013" />
        </>
      );
    case "Cote d'Ivoire":
    case "Côte d'Ivoire":
      return (
        <>
          <rect width="5.33" height="12" fill="#FF8200" />
          <rect x="5.33" width="5.34" height="12" fill="#fff" />
          <rect x="10.67" width="5.33" height="12" fill="#009E60" />
        </>
      );
    case "Cameroon":
      return (
        <>
          <rect width="5.33" height="12" fill="#007A5E" />
          <rect x="5.33" width="5.34" height="12" fill="#CE1126" />
          <rect x="10.67" width="5.33" height="12" fill="#FCD116" />
          <path d="M8 4.7 L8.4 5.8 L9.5 5.8 L8.6 6.5 L8.9 7.6 L8 7 L7.1 7.6 L7.4 6.5 L6.5 5.8 L7.6 5.8 Z" fill="#FCD116" />
        </>
      );

    // === AFC ===
    case "Japan":
      return (
        <>
          <rect width="16" height="12" fill="#fff" />
          <circle cx="8" cy="6" r="2.6" fill="#BC002D" />
        </>
      );
    case "South Korea":
      return (
        <>
          <rect width="16" height="12" fill="#fff" />
          <circle cx="8" cy="6" r="2.4" fill="#003478" />
          <path d="M8 3.6 A 2.4 2.4 0 0 1 8 8.4 A 1.2 1.2 0 0 0 8 6 A 1.2 1.2 0 0 1 8 3.6 Z" fill="#C53030" />
        </>
      );
    case "Iran":
      return (
        <>
          <rect width="16" height="4" fill="#239F40" />
          <rect y="4" width="16" height="4" fill="#fff" />
          <rect y="8" width="16" height="4" fill="#DA0000" />
        </>
      );
    case "Saudi Arabia":
      return (
        <>
          <rect width="16" height="12" fill="#006C35" />
          <rect x="3" y="8" width="10" height="1" fill="#fff" />
        </>
      );
    case "Australia":
      return (
        <>
          <rect width="16" height="12" fill="#012169" />
          <rect width="7.5" height="6.5" fill="#012169" />
          <path d="M0 0 L7.5 6.5 M7.5 0 L0 6.5" stroke="#fff" strokeWidth="0.7" />
          <path d="M3.75 0 L3.75 6.5 M0 3.25 L7.5 3.25" stroke="#fff" strokeWidth="1.1" />
          <path d="M3.75 0 L3.75 6.5 M0 3.25 L7.5 3.25" stroke="#E4002B" strokeWidth="0.5" />
        </>
      );

    // === OFC ===
    case "New Zealand":
      return (
        <>
          <rect width="16" height="12" fill="#012169" />
          <rect width="7.5" height="6.5" fill="#012169" />
          <path d="M0 0 L7.5 6.5 M7.5 0 L0 6.5" stroke="#fff" strokeWidth="0.7" />
          <path d="M3.75 0 L3.75 6.5 M0 3.25 L7.5 3.25" stroke="#fff" strokeWidth="1.1" />
          <path d="M3.75 0 L3.75 6.5 M0 3.25 L7.5 3.25" stroke="#C8102E" strokeWidth="0.5" />
        </>
      );

    default:
      return <FallbackBands country={country} />;
  }
}

/**
 * Last-resort flag: a 3-band rendering using the country's primary/secondary/
 * accent from team-colors.ts. Guarantees we never render an empty SVG.
 */
function FallbackBands({ country }: { country: string }) {
  const colors = teamColors(country);
  const c1 = colors.primary;
  const c2 = colors.secondary;
  const c3 = colors.accent ?? colors.primary;
  return (
    <>
      <rect width="16" height="4" fill={c1} />
      <rect y="4" width="16" height="4" fill={c2} />
      <rect y="8" width="16" height="4" fill={c3} />
    </>
  );
}
