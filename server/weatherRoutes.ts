import type { Express } from "express";
import { pool } from "./db";

interface WeatherDay {
  date: string;
  high: number | null;
  low: number | null;
  forecast: string;
}

const weatherCache = new Map<string, { expires: number; data: WeatherDay[] }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const NWS_UA = "CompanyHQ-LandscapeScheduler/1.0 (admin@chapinlandscapes.com)";

async function fetchNwsForecast(lat: number, lng: number): Promise<WeatherDay[]> {
  const pointsRes = await fetch(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
    { headers: { "User-Agent": NWS_UA, Accept: "application/geo+json" } }
  );
  if (!pointsRes.ok) throw new Error(`NWS points returned ${pointsRes.status}`);
  const pts = await pointsRes.json();
  const forecastUrl: string | undefined = pts?.properties?.forecast;
  if (!forecastUrl) throw new Error("NWS did not return a forecast URL");

  const fRes = await fetch(forecastUrl, {
    headers: { "User-Agent": NWS_UA, Accept: "application/geo+json" },
  });
  if (!fRes.ok) throw new Error(`NWS forecast returned ${fRes.status}`);
  const fData = await fRes.json();
  const periods: any[] = fData?.properties?.periods ?? [];

  const dayMap = new Map<string, { high?: number; low?: number; forecast: string }>();
  for (const p of periods) {
    const date: string = (p.startTime ?? "").slice(0, 10);
    if (!date) continue;
    if (!dayMap.has(date)) dayMap.set(date, { forecast: "" });
    const d = dayMap.get(date)!;
    if (p.isDaytime) {
      d.high = p.temperature;
      d.forecast = p.shortForecast ?? "";
    } else {
      d.low = p.temperature;
      if (!d.forecast) d.forecast = p.shortForecast ?? "";
    }
  }

  return Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    high: v.high ?? null,
    low: v.low ?? null,
    forecast: v.forecast,
  }));
}

export function registerWeatherRoutes(app: Express, requireAuth: any) {
  app.get("/api/weather/forecast", requireAuth, async (_req: any, res: any) => {
    try {
      const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'weather_location'`
      );
      const rawVal = rows[0]?.value;
      if (!rawVal) return res.json({ days: [], message: "No weather location configured" });

      let loc: { lat?: number; lng?: number; city?: string };
      try { loc = JSON.parse(rawVal); } catch {
        return res.json({ days: [], message: "Invalid weather location format" });
      }

      const lat = Number(loc.lat);
      const lng = Number(loc.lng);
      if (!lat || !lng || !isFinite(lat) || !isFinite(lng)) {
        return res.json({ days: [], message: "Weather location has no valid coordinates" });
      }

      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      const cached = weatherCache.get(key);
      if (cached && cached.expires > Date.now()) return res.json({ days: cached.data });

      const days = await fetchNwsForecast(lat, lng);
      weatherCache.set(key, { expires: Date.now() + CACHE_TTL_MS, data: days });
      return res.json({ days });
    } catch (err: any) {
      console.error("[weather/forecast]", err.message);
      return res.json({ days: [], error: err.message });
    }
  });
}
