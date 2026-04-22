/**
 * C1: Seasonal / weather context via Open-Meteo Historical Archive API.
 *
 * Strategy: use the same calendar month from ONE YEAR PRIOR as a climate
 * proxy (e.g. trip in October 2026 → fetch October 2025 actuals). This gives
 * real measured values for free, with no API key required.
 *
 * The result is injected into the prompt so OpenAI can recommend appropriate
 * clothing, flag weather risks, and schedule indoor/outdoor activities
 * accordingly — instead of guessing or defaulting to perfect weather.
 *
 * Best-effort: any fetch failure, timeout, or missing data silently returns
 * undefined so itinerary generation always proceeds.
 */

/** How long to wait for the Open-Meteo request before giving up. */
const FETCH_TIMEOUT_MS = 3000;

export interface WeatherContext {
  /** Short location label (first segment of the Mapbox place string). */
  location: string;
  /** Month name, e.g. "October". */
  monthName: string;
  /** Mean daily maximum temperature in °C for the reference month. */
  avgHighC: number;
  /** Mean daily minimum temperature in °C for the reference month. */
  avgLowC: number;
  /** Number of days with precipitation > 1 mm. */
  rainyDays: number;
  /** Total precipitation for the month in mm. */
  totalRainMm: number;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Fetch climate data for a single coordinate from the Open-Meteo
 * Historical Archive and return a WeatherContext object.
 *
 * @param location  Human-readable location name (used in the rendered block).
 * @param lat       Latitude of the location.
 * @param lng       Longitude of the location.
 * @param arrivalDate  Trip arrival date in YYYY-MM-DD format.
 */
export async function fetchWeatherContext(
  location: string,
  lat: number,
  lng: number,
  arrivalDate: string
): Promise<WeatherContext | undefined> {
  try {
    // Calculate the reference period: same month, one year prior.
    const parts = arrivalDate.split('-').map(Number);
    if (parts.length < 2) return undefined;
    const [year, month] = parts as [number, number];
    const refYear = year - 1;
    const lastDay = new Date(refYear, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    const startDate = `${refYear}-${mm}-01`;
    const endDate = `${refYear}-${mm}-${String(lastDay).padStart(2, '0')}`;

    const url =
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      console.warn(`⚠️ [WEATHER] Open-Meteo returned ${res.status}`);
      return undefined;
    }

    const json = (await res.json()) as {
      daily?: {
        temperature_2m_max?: (number | null)[];
        temperature_2m_min?: (number | null)[];
        precipitation_sum?: (number | null)[];
      };
    };

    const highs = (json.daily?.temperature_2m_max ?? []).filter((v): v is number => v !== null);
    const lows  = (json.daily?.temperature_2m_min  ?? []).filter((v): v is number => v !== null);
    const precip = (json.daily?.precipitation_sum  ?? []).filter((v): v is number => v !== null);

    if (!highs.length || !lows.length) return undefined;

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const avgHighC  = Math.round(avg(highs));
    const avgLowC   = Math.round(avg(lows));
    const rainyDays = precip.filter((v) => v > 1).length;
    const totalRainMm = Math.round(precip.reduce((s, v) => s + v, 0));

    const monthName = new Date(refYear, month - 1, 1).toLocaleString('en-US', { month: 'long' });

    console.log(`🌤️ [WEATHER] ${location} ${monthName}: high ${avgHighC}°C / low ${avgLowC}°C / ${rainyDays} rainy days`);

    return {
      location: location.split(',')[0].trim(),
      monthName,
      avgHighC,
      avgLowC,
      rainyDays,
      totalRainMm,
    };
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn('⚠️ [WEATHER] fetch threw:', err.message);
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/** Format the weather context as a prompt-ready block. */
export function renderWeatherContext(ctx: WeatherContext): string {
  const lines: string[] = [
    `**🌤️ CLIMATE — ${ctx.location}, ${ctx.monthName} (last year actuals):**`,
    `- Avg high: ${ctx.avgHighC}°C, avg low: ${ctx.avgLowC}°C`,
    `- Rainy days: ~${ctx.rainyDays} out of ~${new Date(2024, new Date(`2024-${ctx.monthName}-01`).getMonth() + 1, 0).getDate()} days (${ctx.totalRainMm}mm total)`,
    `- Use this to suggest appropriate clothing layers, flag rain risks, and balance outdoor vs indoor scheduling.`,
  ];
  return lines.join('\n') + '\n';
}
