// Open-Meteo is free and requires no API key — good fit for a project with
// no monetization and no budget for paid weather APIs.
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherInfo {
  tempC: number;
  weatherCode: number;
  description: string;
  isRainy: boolean;
  seasonProfile: 'light' | 'heavy' | 'all';
}

// WMO weather codes -> plain-language description.
// https://open-meteo.com/en/docs
function describeWeatherCode(code: number): { description: string; isRainy: boolean } {
  if (code === 0) return { description: 'clear sky', isRainy: false };
  if (code <= 3) return { description: 'partly cloudy', isRainy: false };
  if (code <= 48) return { description: 'foggy', isRainy: false };
  if (code <= 57) return { description: 'drizzling', isRainy: true };
  if (code <= 67) return { description: 'rainy', isRainy: true };
  if (code <= 77) return { description: 'snowy', isRainy: true };
  if (code <= 82) return { description: 'showery', isRainy: true };
  if (code <= 99) return { description: 'stormy', isRainy: true };
  return { description: 'unsettled', isRainy: false };
}

function seasonProfileFor(tempC: number): 'light' | 'heavy' | 'all' {
  if (tempC >= 24) return 'light';
  if (tempC <= 14) return 'heavy';
  return 'all';
}

export async function getWeatherForCoords(lat: number, lon: number): Promise<WeatherInfo | null> {
  try {
    const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;

    const data = await res.json();
    const tempC = data?.current?.temperature_2m;
    const weatherCode = data?.current?.weather_code;
    if (typeof tempC !== 'number' || typeof weatherCode !== 'number') return null;

    const { description, isRainy } = describeWeatherCode(weatherCode);
    return { tempC, weatherCode, description, isRainy, seasonProfile: seasonProfileFor(tempC) };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}
