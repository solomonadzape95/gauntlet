/**
 * Country → continent lookup. Conservative — covers WC 2026 + major football
 * nations. Falls back to "Other" so the criteria filter never breaks.
 */

const MAP: Record<string, Continent> = {
  // Africa
  "Algeria": "Africa", "Cameroon": "Africa", "Egypt": "Africa",
  "Ghana": "Africa", "Ivory Coast": "Africa", "Côte d'Ivoire": "Africa",
  "Morocco": "Africa", "Nigeria": "Africa", "Senegal": "Africa",
  "South Africa": "Africa", "Tunisia": "Africa",

  // Asia
  "Australia": "Asia", "China": "Asia", "Iran": "Asia", "Iraq": "Asia",
  "Japan": "Asia", "Jordan": "Asia", "Saudi Arabia": "Asia",
  "South Korea": "Asia", "Korea Republic": "Asia", "Qatar": "Asia",
  "UAE": "Asia", "Uzbekistan": "Asia",

  // Europe
  "Austria": "Europe", "Belgium": "Europe", "Croatia": "Europe",
  "Czechia": "Europe", "Czech Republic": "Europe", "Denmark": "Europe",
  "England": "Europe", "France": "Europe", "Germany": "Europe",
  "Greece": "Europe", "Hungary": "Europe", "Iceland": "Europe",
  "Italy": "Europe", "Netherlands": "Europe", "Norway": "Europe",
  "Poland": "Europe", "Portugal": "Europe", "Republic of Ireland": "Europe",
  "Romania": "Europe", "Russia": "Europe", "Scotland": "Europe",
  "Serbia": "Europe", "Slovakia": "Europe", "Slovenia": "Europe",
  "Spain": "Europe", "Sweden": "Europe", "Switzerland": "Europe",
  "Turkey": "Europe", "Türkiye": "Europe", "Ukraine": "Europe",
  "Wales": "Europe",

  // North & Central America
  "Canada": "North America", "Costa Rica": "North America",
  "Honduras": "North America", "Jamaica": "North America",
  "Mexico": "North America", "Panama": "North America",
  "United States": "North America", "USA": "North America",

  // South America
  "Argentina": "South America", "Bolivia": "South America",
  "Brazil": "South America", "Chile": "South America",
  "Colombia": "South America", "Ecuador": "South America",
  "Paraguay": "South America", "Peru": "South America",
  "Uruguay": "South America", "Venezuela": "South America",

  // Oceania
  "New Zealand": "Oceania",
};

export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "South America"
  | "Oceania"
  | "Other";

export const CONTINENTS: Continent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
];

export function continentFor(country: string): Continent {
  return MAP[country] ?? MAP[country?.trim() ?? ""] ?? "Other";
}
