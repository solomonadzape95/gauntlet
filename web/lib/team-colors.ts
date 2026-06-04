/**
 * Country → jersey colors map. Hand-curated for the WC 2026 field.
 *
 * Hex codes lifted from each FA's primary kit identity (not exact PMS values
 * since we're rendering on dark ink, but tuned for readability).
 *
 * Missing countries fall back to `FALLBACK` (Gauntlet ink + hazard). Add new
 * nations as fixtures pull them in.
 */

export type JerseyPattern =
  | "solid"
  | "stripes-vertical"
  | "checks"
  | "stars-stripes"
  | "cross-accent";

/**
 * Surface texture overlay drawn on top of the team's primary color on player
 * cards / modals. Each maps to a different repeating CSS background pattern:
 *   - "mesh"    → dotted halftone (modern polyester)
 *   - "stripes" → repeating vertical bands (classic kits)
 *   - "diagonal"→ slanted pinstripes
 *   - "none"    → flat color, vignette + sheen only
 */
export type CardTexture = "mesh" | "stripes" | "diagonal" | "none";

export interface TeamColors {
  primary: string;
  secondary: string;
  accent?: string;
  pattern?: JerseyPattern;
  texture?: CardTexture;
}

export const FALLBACK: TeamColors = {
  primary: "#1A1A1A",
  secondary: "#F5FF00",
  pattern: "solid",
};

export const TEAM_COLORS: Record<string, TeamColors> = {
  // CONCACAF hosts
  Mexico:      { primary: "#006847", secondary: "#FFFFFF", accent: "#CE1126", pattern: "solid" },
  USA:         { primary: "#FFFFFF", secondary: "#0A3161", accent: "#B31942", pattern: "stars-stripes" },
  Canada:      { primary: "#D52B1E", secondary: "#FFFFFF", pattern: "solid" },

  // CONMEBOL
  Argentina:   { primary: "#75AADB", secondary: "#FFFFFF", pattern: "stripes-vertical" },
  Brazil:      { primary: "#FFCC29", secondary: "#009C3B", accent: "#002776", pattern: "solid" },
  Uruguay:     { primary: "#5CBCEB", secondary: "#FFFFFF", pattern: "solid" },
  Colombia:    { primary: "#FCD116", secondary: "#003893", accent: "#CE1126", pattern: "solid" },
  Ecuador:     { primary: "#FFD100", secondary: "#003893", pattern: "solid" },
  Paraguay:    { primary: "#FFFFFF", secondary: "#D52B1E", accent: "#0038A8", pattern: "stripes-vertical" },

  // UEFA
  France:      { primary: "#0055A4", secondary: "#FFFFFF", accent: "#EF4135", pattern: "solid" },
  England:     { primary: "#FFFFFF", secondary: "#001489", accent: "#CE1124", pattern: "cross-accent" },
  Germany:     { primary: "#FFFFFF", secondary: "#000000", accent: "#FFCE00", pattern: "solid" },
  Spain:       { primary: "#AA151B", secondary: "#F1BF00", pattern: "solid" },
  Italy:       { primary: "#1C3F94", secondary: "#FFFFFF", pattern: "solid" },
  Portugal:    { primary: "#7A0017", secondary: "#046A38", pattern: "solid" },
  Netherlands: { primary: "#FF6C00", secondary: "#FFFFFF", pattern: "solid" },
  Belgium:     { primary: "#ED2939", secondary: "#FAE042", accent: "#000000", pattern: "solid" },
  Croatia:     { primary: "#FF0000", secondary: "#FFFFFF", pattern: "checks" },
  Switzerland: { primary: "#D52B1E", secondary: "#FFFFFF", pattern: "cross-accent" },
  Poland:      { primary: "#FFFFFF", secondary: "#DC143C", pattern: "solid" },
  Denmark:     { primary: "#C60C30", secondary: "#FFFFFF", pattern: "cross-accent" },
  Austria:     { primary: "#FFFFFF", secondary: "#ED2939", pattern: "solid" },
  Scotland:    { primary: "#0065BD", secondary: "#FFFFFF", pattern: "solid" },
  Serbia:      { primary: "#C6363C", secondary: "#FFFFFF", accent: "#0C4076", pattern: "solid" },
  Turkey:      { primary: "#E30A17", secondary: "#FFFFFF", pattern: "solid" },

  // CAF
  Morocco:     { primary: "#C1272D", secondary: "#006233", pattern: "solid" },
  Senegal:     { primary: "#00853F", secondary: "#FDEF42", accent: "#E31B23", pattern: "solid" },
  Nigeria:     { primary: "#008751", secondary: "#FFFFFF", pattern: "solid" },
  Egypt:       { primary: "#CE1126", secondary: "#FFFFFF", accent: "#000000", pattern: "solid" },
  Ghana:       { primary: "#FFFFFF", secondary: "#FCD116", accent: "#CE1126", pattern: "solid" },
  Algeria:     { primary: "#FFFFFF", secondary: "#006633", pattern: "solid" },
  Tunisia:     { primary: "#E70013", secondary: "#FFFFFF", pattern: "solid" },
  "Cote d'Ivoire": { primary: "#FF8200", secondary: "#FFFFFF", accent: "#009E60", pattern: "solid" },
  "Côte d'Ivoire": { primary: "#FF8200", secondary: "#FFFFFF", accent: "#009E60", pattern: "solid" },
  Cameroon:    { primary: "#007A5E", secondary: "#FFFFFF", accent: "#CE1126", pattern: "solid" },
  "South Africa": { primary: "#FFB81C", secondary: "#007A4D", accent: "#000000", pattern: "solid" },

  // AFC
  Japan:       { primary: "#000A47", secondary: "#FFFFFF", pattern: "solid" },
  "South Korea": { primary: "#C53030", secondary: "#FFFFFF", accent: "#003478", pattern: "solid" },
  Iran:        { primary: "#FFFFFF", secondary: "#239F40", accent: "#DA0000", pattern: "solid" },
  "Saudi Arabia": { primary: "#FFFFFF", secondary: "#006C35", pattern: "solid" },
  Australia:   { primary: "#FFCD00", secondary: "#00843D", pattern: "solid" },

  // OFC
  "New Zealand": { primary: "#FFFFFF", secondary: "#000000", pattern: "solid" },

  // Last Eleven (fictional demo teams — sharp brand split, used as the
  // jersey-color source for every player on that squad).
  "Phoenix XI": { primary: "#E5462A", secondary: "#FFE08A", accent: "#FFFFFF", pattern: "solid", texture: "mesh" },
  "Eclipse XI": { primary: "#1F2937", secondary: "#C0C0C0", accent: "#7FD0E5", pattern: "solid", texture: "stripes" },
};

export function teamColors(team: string): TeamColors {
  return TEAM_COLORS[team] ?? FALLBACK;
}

/**
 * Club kit colors — used when a player's `team` isn't a country (e.g. for
 * "Phoenix XI" / "Eclipse XI" in Last Eleven), so each all-star renders in
 * their actual club's primary kit instead of every card looking identical.
 *
 * Covers the clubs in the Last Eleven roster; expand as new rosters land.
 */
export const CLUB_COLORS: Record<string, TeamColors> = {
  // English
  "Manchester City":  { primary: "#6CABDD", secondary: "#FFFFFF", accent: "#1C2C5B", pattern: "solid" },
  "Manchester United":{ primary: "#DA291C", secondary: "#FFE500", accent: "#000000", pattern: "solid" },
  "Liverpool":        { primary: "#C8102E", secondary: "#FFFFFF", accent: "#00B2A9", pattern: "solid" },
  "Arsenal":          { primary: "#EF0107", secondary: "#FFFFFF", accent: "#063672", pattern: "solid" },
  "Chelsea":          { primary: "#034694", secondary: "#FFFFFF", accent: "#DBA111", pattern: "solid" },
  "Tottenham":        { primary: "#FFFFFF", secondary: "#132257", pattern: "solid" },

  // Spanish
  "Real Madrid":      { primary: "#FFFFFF", secondary: "#FEBE10", accent: "#00529F", pattern: "solid" },
  "Barcelona":        { primary: "#A50044", secondary: "#004D98", accent: "#EDBB00", pattern: "stripes-vertical" },
  "Atletico Madrid":  { primary: "#CB3524", secondary: "#FFFFFF", accent: "#272E61", pattern: "stripes-vertical" },
  "Athletic Bilbao":  { primary: "#EE2523", secondary: "#FFFFFF", accent: "#000000", pattern: "stripes-vertical" },

  // German
  "Bayern Munich":    { primary: "#DC052D", secondary: "#FFFFFF", accent: "#0066B2", pattern: "solid" },
  "Borussia Dortmund":{ primary: "#FDE100", secondary: "#000000", pattern: "solid" },
  "Bayer Leverkusen": { primary: "#E32221", secondary: "#000000", pattern: "solid" },

  // Italian
  "Inter Milan":      { primary: "#0050A0", secondary: "#000000", accent: "#FFFFFF", pattern: "stripes-vertical" },
  "AC Milan":         { primary: "#FB090B", secondary: "#000000", pattern: "stripes-vertical" },
  "Juventus":         { primary: "#FFFFFF", secondary: "#000000", pattern: "stripes-vertical" },
  "Napoli":           { primary: "#12A0D7", secondary: "#FFFFFF", accent: "#003C82", pattern: "solid" },

  // French
  "PSG":              { primary: "#004170", secondary: "#DA291C", accent: "#FFFFFF", pattern: "solid" },
  "Paris Saint-Germain": { primary: "#004170", secondary: "#DA291C", accent: "#FFFFFF", pattern: "solid" },
  "Marseille":        { primary: "#FFFFFF", secondary: "#2FAEE0", pattern: "solid" },

  // Rest of world (Last Eleven coverage)
  "Inter Miami":      { primary: "#F7B5CD", secondary: "#231F20", accent: "#000000", pattern: "solid" },
  "Al-Nassr":         { primary: "#FFEB3B", secondary: "#0033A0", pattern: "solid" },
};

export function clubColors(club: string): TeamColors | null {
  return CLUB_COLORS[club] ?? null;
}

/**
 * Resolve jersey colors for a player. Country lookup wins (so WC players keep
 * national colors), then club lookup, then fallback. Use this everywhere
 * instead of calling `teamColors(player.team)` directly.
 */
export function playerColors(player: {
  team: string;
  club: string;
}): TeamColors {
  return TEAM_COLORS[player.team] ?? CLUB_COLORS[player.club] ?? FALLBACK;
}
