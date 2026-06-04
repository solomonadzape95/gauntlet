/**
 * Country name → ISO 3166-1 alpha-2 (or subdivision) code, used by the
 * `<CountryFlag>` component to fetch official flag SVGs from flagcdn.com.
 *
 * Keep keys exactly as they appear in the roster `team` / `country` fields,
 * including common alternate spellings.
 */
const CODES: Record<string, string> = {
  // CONCACAF
  Mexico: "mx",
  USA: "us",
  "United States": "us",
  Canada: "ca",

  // CONMEBOL
  Argentina: "ar",
  Brazil: "br",
  Uruguay: "uy",
  Colombia: "co",
  Ecuador: "ec",
  Paraguay: "py",
  Peru: "pe",
  Chile: "cl",

  // UEFA
  France: "fr",
  England: "gb-eng",
  Germany: "de",
  Spain: "es",
  Italy: "it",
  Portugal: "pt",
  Netherlands: "nl",
  Belgium: "be",
  Croatia: "hr",
  Switzerland: "ch",
  Poland: "pl",
  Denmark: "dk",
  Austria: "at",
  Scotland: "gb-sct",
  Wales: "gb-wls",
  "Northern Ireland": "gb-nir",
  Serbia: "rs",
  Turkey: "tr",
  Türkiye: "tr",
  Norway: "no",
  Sweden: "se",
  Finland: "fi",
  Iceland: "is",
  Ukraine: "ua",
  "Republic of Ireland": "ie",
  Ireland: "ie",
  "Czech Republic": "cz",
  Czechia: "cz",
  Greece: "gr",
  Hungary: "hu",
  Romania: "ro",
  Slovakia: "sk",
  Slovenia: "si",
  Albania: "al",

  // CAF
  Morocco: "ma",
  Senegal: "sn",
  Nigeria: "ng",
  Egypt: "eg",
  Ghana: "gh",
  Algeria: "dz",
  Tunisia: "tn",
  "Cote d'Ivoire": "ci",
  "Côte d'Ivoire": "ci",
  "Ivory Coast": "ci",
  Cameroon: "cm",
  "South Africa": "za",

  // AFC
  Japan: "jp",
  "South Korea": "kr",
  "Korea Republic": "kr",
  Iran: "ir",
  "Saudi Arabia": "sa",
  Australia: "au",
  Qatar: "qa",
  UAE: "ae",
  Uzbekistan: "uz",
  Iraq: "iq",
  China: "cn",

  // OFC
  "New Zealand": "nz",
};

export function countryCode(name: string | undefined): string | null {
  if (!name) return null;
  return CODES[name] ?? CODES[name.trim()] ?? null;
}
