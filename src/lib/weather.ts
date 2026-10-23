// Open-Meteo is free and requires no API key — good fit for a project with
// no monetization and no budget for paid weather APIs.
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherInfo {
  tempC: number;
  weatherCode: number;
  description: string;
  isRainy: boolean;
  // Season slug matching the `seasons` table (spring/summer/monsoon/autumn/winter).
  seasonSlug: string;
}

// WMO weather codes -> plain-language description.
// https://open-meteo.com/en/docs
function describeWeatherCode(code: number): { description: string; isRainy: boolean } {
  // Snow counts as wet weather: it rules out suede and canvas the same way rain does.
  if (code === 0) return { description: 'clear sky', isRainy: false };
  if (code === 1) return { description: 'mainly clear', isRainy: false };
  if (code === 2) return { description: 'partly cloudy', isRainy: false };
  if (code === 3) return { description: 'overcast', isRainy: false };
  if (code === 45 || code === 48) return { description: 'foggy', isRainy: false };
  if (code >= 51 && code <= 57) return { description: 'drizzling', isRainy: true };
  if (code >= 61 && code <= 67) return { description: 'rainy', isRainy: true };
  if (code >= 71 && code <= 77) return { description: 'snowy', isRainy: true };
  if (code >= 80 && code <= 82) return { description: 'showery', isRainy: true };
  if (code === 85 || code === 86) return { description: 'snow showers', isRainy: true };
  if (code >= 95 && code <= 99) return { description: 'stormy', isRainy: true };
  return { description: 'unsettled', isRainy: false };
}

/**
 * Season for a place and day. Uses the calendar season for the hemisphere
 * (so mild days map to spring/autumn instead of "no season"), lets clearly
 * hot or cold temperatures override it, and uses temperature + rain in the
 * tropics where calendar seasons don't apply.
 */
export function seasonFor(lat: number, tempC: number, isRainy: boolean, date = new Date()): string {
  if (Math.abs(lat) < 23.5) {
    if (isRainy && tempC >= 22) return 'monsoon';
    if (tempC >= 26) return 'summer';
    if (tempC <= 15) return 'winter';
    return 'spring';
  }

  if (tempC >= 28) return 'summer';
  if (tempC <= 5) return 'winter';

  // Meteorological seasons, shifted six months for the southern hemisphere.
  const month = (date.getUTCMonth() + (lat < 0 ? 6 : 0)) % 12; // 0 = Jan
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

/**
 * `localDate` is the user's own calendar day (YYYY-MM-DD) — the server's
 * clock can be on a different day or even month near a boundary.
 */
export async function getWeatherForCoords(lat: number, lon: number, localDate?: string): Promise<WeatherInfo | null> {
  try {
    const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`;
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const data = await res.json();
    const tempC = data?.current?.temperature_2m;
    const weatherCode = data?.current?.weather_code;
    if (typeof tempC !== 'number' || typeof weatherCode !== 'number') return null;

    const { description, isRainy } = describeWeatherCode(weatherCode);
    // Noon UTC keeps the calendar day (and so the month) stable.
    const date = localDate ? new Date(`${localDate}T12:00:00Z`) : new Date();
    const season = seasonFor(lat, tempC, isRainy, Number.isNaN(date.getTime()) ? new Date() : date);
    return { tempC, weatherCode, description, isRainy, seasonSlug: season };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}
