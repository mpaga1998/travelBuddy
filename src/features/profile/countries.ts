export type CountryOption = { code: string; name: string; flag: string };

// Minimal list to start (extend later) - with hardcoded flags
const BASE: Array<[string, string, string]> = [
  ["IT", "Italy", "🇮🇹"],
  ["FR", "France", "🇫🇷"],
  ["ES", "Spain", "🇪🇸"],
  ["PT", "Portugal", "🇵🇹"],
  ["DE", "Germany", "🇩🇪"],
  ["GB", "United Kingdom", "🇬🇧"],
  ["US", "United States", "🇺🇸"],
  ["BR", "Brazil", "🇧🇷"],
  ["AR", "Argentina", "🇦🇷"],
  ["MX", "Mexico", "🇲🇽"],
  ["CA", "Canada", "🇨🇦"],
  ["AU", "Australia", "🇦🇺"],
  ["JP", "Japan", "🇯🇵"],
  ["KR", "South Korea", "🇰🇷"],
  ["IN", "India", "🇮🇳"],
];

export const COUNTRIES: CountryOption[] = BASE.map(([code, name, flag]) => ({
  code,
  name,
  flag,
}));