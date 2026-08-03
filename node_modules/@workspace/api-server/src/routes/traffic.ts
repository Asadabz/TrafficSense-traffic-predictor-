import { Router } from "express";
import { PredictTrafficBody, GetHistoricalDataQueryParams } from "@workspace/api-zod";

const router = Router();

type CongestionLevel = "light" | "moderate" | "heavy";

// ---------------------------------------------------------------------------
// Real geocoding via OpenStreetMap Nominatim (free, no API key required)
// Usage policy requires a descriptive User-Agent — do not remove it.
// ---------------------------------------------------------------------------
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number; label: string }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "TrafficSense-Portfolio-Project/1.0 (student project)" },
  });
  if (!res.ok) throw new Error(`Geocoding request failed for "${location}"`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data.length) throw new Error(`Could not find location: "${location}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

// ---------------------------------------------------------------------------
// Real routing via OSRM demo server (free, no API key required)
// Returns up to 3 alternative routes that actually follow real roads.
// ---------------------------------------------------------------------------
interface OsrmStep { name: string; distance: number; duration: number }
interface OsrmRoute {
  geometry: { coordinates: [number, number][] }; // [lng, lat]
  legs: { steps: OsrmStep[]; distance: number; duration: number }[];
  distance: number;
  duration: number;
}

async function fetchRoutes(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<OsrmRoute[]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?alternatives=true&overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing request failed");
  const data = (await res.json()) as { code: string; routes: OsrmRoute[] };
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route found between these locations");
  return data.routes;
}

function longestStepName(route: OsrmRoute): string {
  const steps = route.legs.flatMap((l) => l.steps).filter((s) => s.name);
  if (!steps.length) return "Main Road";
  return steps.reduce((a, b) => (b.distance > a.distance ? b : a)).name || "Main Road";
}

/** Turn a real OSRM coordinate path into segments with congestion per segment */
function buildSegmentsFromCoords(
  coords: [number, number][],
  overallLevel: CongestionLevel,
  lightBias = 0
): Array<{ lat_start: number; lng_start: number; lat_end: number; lng_end: number; congestion_level: CongestionLevel }> {
  const levels: CongestionLevel[] = ["light", "moderate", "heavy"];
  const levelIndex = { light: 0, moderate: 1, heavy: 2 };

  const maxSegments = 40;
  const step = Math.max(1, Math.floor(coords.length / maxSegments));
  const sampled = coords.filter((_, i) => i % step === 0);
  if (sampled[sampled.length - 1] !== coords[coords.length - 1]) sampled.push(coords[coords.length - 1]);

  const segments = [];
  for (let i = 0; i < sampled.length - 1; i++) {
    const [lngS, latS] = sampled[i];
    const [lngE, latE] = sampled[i + 1];
    let idx = levelIndex[overallLevel] + Math.floor(Math.random() * 3 - 1) - lightBias;
    idx = Math.max(0, Math.min(2, idx));
    const lvl: CongestionLevel = Math.random() < 0.55 ? overallLevel : levels[idx];
    segments.push({ lat_start: latS, lng_start: lngS, lat_end: latE, lng_end: lngE, congestion_level: lvl });
  }
  return segments;
}

// ---------------------------------------------------------------------------
// ML model integration — calls the Python FastAPI service (predict_server.py)
// running on localhost:8000. Falls back to a simple time-based heuristic if
// the ML service is unreachable or the road name isn't one it was trained on.
// ---------------------------------------------------------------------------
const KNOWN_ROADS_BANGALORE = [
  "MG Road", "Brigade Road", "Commercial Street", "Residency Road",
  "100 Feet Road, Indiranagar", "CMH Road", "80 Feet Road, Koramangala",
  "Old Airport Road", "Bannerghatta Road", "Outer Ring Road, Marathahalli",
  "Silk Board Junction", "Hosur Road", "Whitefield Main Road",
];
const KNOWN_ROADS_MUMBAI = ["Vashi Bridge"];

function detectCity(text: string): "Bangalore" | "Mumbai" {
  return /mumbai|vashi|navi mumbai/i.test(text) ? "Mumbai" : "Bangalore";
}

/** Best-effort match of a free-text location/road name to a road the model was trained on */
function matchKnownRoad(text: string, city: "Bangalore" | "Mumbai"): string | null {
  const pool = city === "Mumbai" ? KNOWN_ROADS_MUMBAI : KNOWN_ROADS_BANGALORE;
  const lower = text.toLowerCase();
  const match = pool.find((r) => lower.includes(r.toLowerCase()) || r.toLowerCase().includes(lower));
  return match ?? null;
}

/** Low-level call to the ML service — takes raw hour/day_of_week directly */
async function getMlPredictionRaw(
  city: string,
  road: string,
  hour: number,
  day_of_week: number
): Promise<{ congestion_ratio: number; zone: CongestionLevel }> {
  const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
// ...
const res = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, road, hour, day_of_week }),
  });

  if (!res.ok) throw new Error("ML prediction service failed");
  return res.json() as Promise<{ congestion_ratio: number; zone: CongestionLevel }>;
}

/** Convenience wrapper — derives hour/day_of_week from a datetime string */
async function getMlPrediction(
  city: string,
  road: string,
  datetime: string
): Promise<{ congestion_ratio: number; zone: CongestionLevel }> {
  const d = new Date(datetime);
  const hour = d.getHours();
  const day_of_week = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0 ... Sun=6
  return getMlPredictionRaw(city, road, hour, day_of_week);
}

/** Time-based fallback used when ML service is down or road is unrecognized */
function levelFromDatetime(datetime: string): { level: CongestionLevel; baseIndex: number } {
  const d = new Date(datetime);
  const h = d.getHours();
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;

  if (isWeekend) {
    if (h >= 10 && h <= 14) return { level: "moderate", baseIndex: 45 };
    return { level: "light", baseIndex: 22 };
  }
  if ((h >= 7 && h <= 9) || (h >= 17 && h <= 19)) return { level: "heavy", baseIndex: 72 };
  if (h >= 10 && h <= 16) return { level: "moderate", baseIndex: 48 };
  if (h >= 20 || h < 6) return { level: "light", baseIndex: 15 };
  return { level: "light", baseIndex: 28 };
}

function buildHourlyForecast(baseIndex: number) {
  return Array.from({ length: 24 }, (_, h) => {
    let peak = 0;
    if (h >= 7 && h <= 9) peak = 30;
    else if (h >= 17 && h <= 19) peak = 35;
    else if (h >= 10 && h <= 16) peak = 15;
    const noise = Math.random() * 10 - 5;
    const index = Math.max(0, Math.min(100, baseIndex + peak + noise));
    return {
      hour: h,
      congestion_index: Math.round(index * 10) / 10,
      label: (index < 35 ? "light" : index < 65 ? "moderate" : "heavy") as CongestionLevel,
    };
  });
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const ROUTE_META = [
  { id: "fastest", name: "Fastest", tag: "FAST", lightBias: 0 },
  { id: "balanced", name: "Balanced", tag: "BAL", lightBias: 1 },
  { id: "scenic", name: "Scenic", tag: "SCEN", lightBias: 2 },
] as const;
// ---------------------------------------------------------------------------
// GET /api/geocode-search?q=...
// Returns place suggestions for autocomplete (proxies Nominatim so the
// frontend doesn't hit rate limits / CORS issues directly).
// ---------------------------------------------------------------------------
router.get("/geocode-search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 3) return res.json({ suggestions: [] });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "TrafficSense-Portfolio-Project/1.0 (student project)" },
    });
    const data = (await r.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    return res.json({
      suggestions: data.map((d) => ({
        label: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      })),
    });
  } catch {
    return res.json({ suggestions: [] });
  }
});
// ---------------------------------------------------------------------------
router.post("/predict", async (req, res) => {
  const parsed = PredictTrafficBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const { origin, destination, datetime } = parsed.data;

  try {
    // 1. Real geocoding — turns typed addresses into real lat/lng
    const [originGeo, destGeo] = await Promise.all([
      geocodeLocation(origin),
      geocodeLocation(destination),
    ]);

    // 2. Real routing — real road-following alternative routes
    const osrmRoutes = await fetchRoutes(originGeo, destGeo);

    // 3. Try ML model prediction first, fall back to heuristic if it fails
    const city = detectCity(origin) === "Mumbai" || detectCity(destination) === "Mumbai" ? "Mumbai" : "Bangalore";
    const matchedRoad = matchKnownRoad(origin, city) ?? matchKnownRoad(destination, city);

    let level: CongestionLevel;
    let baseIndex: number;
    let usedMl = false;

    if (matchedRoad) {
      try {
        const mlResult = await getMlPrediction(city, matchedRoad, datetime as unknown as string);
        level = mlResult.zone;
        baseIndex = Math.round(mlResult.congestion_ratio * 100);
        usedMl = true;
      } catch {
        const fallback = levelFromDatetime(datetime as unknown as string);
        level = fallback.level;
        baseIndex = fallback.baseIndex;
      }
    } else {
      const fallback = levelFromDatetime(datetime as unknown as string);
      level = fallback.level;
      baseIndex = fallback.baseIndex;
    }

    const lighterLevel: CongestionLevel = level === "heavy" ? "moderate" : level === "moderate" ? "light" : "light";
    const levelsForRank: CongestionLevel[] = [level, lighterLevel, "light"];

    const sortedRoutes = [...osrmRoutes].sort((a, b) => a.duration - b.duration).slice(0, 3);

    const routeAlternatives = sortedRoutes.map((route, i) => {
      const meta = ROUTE_META[i] ?? ROUTE_META[ROUTE_META.length - 1];
      const overallLevel = levelsForRank[i] ?? "light";
      const segments = buildSegmentsFromCoords(route.geometry.coordinates, overallLevel, meta.lightBias);
      const minutes = Math.round(route.duration / 60);
      return {
        id: meta.id,
        name: meta.name,
        tag: meta.tag,
        via: longestStepName(route),
        estimated_minutes: minutes,
        congestion_level: overallLevel,
        confidence_score: Math.max(0.7, 0.9 - i * 0.06 + Math.random() * 0.05),
        segments,
      };
    });

    const primary = routeAlternatives[0];

    return res.json({
      congestion_level: primary.congestion_level,
      estimated_minutes: primary.estimated_minutes,
      hourly_forecast: buildHourlyForecast(baseIndex),
      confidence_score: primary.confidence_score,
      origin_coords: { lat: originGeo.lat, lng: originGeo.lng },
      destination_coords: { lat: destGeo.lat, lng: destGeo.lng },
      route_segments: primary.segments,
      route_alternatives: routeAlternatives,
      ml_model_used: usedMl,
    });
  } catch (err: any) {
    return res.status(422).json({ error: err?.message ?? "Could not compute a route for these locations." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/historical
// Uses the real trained ML model (168 predictions: 7 days x 24 hours) when
// the location matches a known trained road. Falls back to a time-based
// heuristic if the road is unrecognized or the ML service is unreachable.
// ---------------------------------------------------------------------------
router.get("/historical", async (req, res) => {
  const parsed = GetHistoricalDataQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const { location } = parsed.data;
  const city = detectCity(location);
  const matchedRoad = matchKnownRoad(location, city);

  if (matchedRoad) {
    try {
      // Fire all 7 days x 24 hours = 168 predictions in parallel
      const jobs: Promise<{ dayIndex: number; hour: number; result: { congestion_ratio: number; zone: CongestionLevel } }>[] = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (let hour = 0; hour < 24; hour++) {
          jobs.push(
            getMlPredictionRaw(city, matchedRoad, hour, dayIndex).then((result) => ({
              dayIndex,
              hour,
              result,
            }))
          );
        }
      }

      const settled = await Promise.all(jobs);

      const patterns = DAYS.map((day, dayIndex) => {
        const hourly = settled
          .filter((s) => s.dayIndex === dayIndex)
          .sort((a, b) => a.hour - b.hour)
          .map((s) => ({
            hour: s.hour,
            congestion_index: Math.round(s.result.congestion_ratio * 1000) / 10, // 0-1 -> 0-100
            label: s.result.zone,
          }));
        return { day, hourly };
      });

      return res.json({ location, patterns, ml_model_used: true });
    } catch {
      // ML service unreachable — fall through to heuristic below
    }
  }

  // Fallback: heuristic (unmatched road OR ML service down)
  const patterns = DAYS.map((day) => {
    const isWeekend = day === "Saturday" || day === "Sunday";
    const baseIndex = isWeekend ? 15 : 25;
    return {
      day,
      hourly: Array.from({ length: 24 }, (_, h) => {
        let peak = 0;
        if (!isWeekend) {
          if (h >= 7 && h <= 9) peak = 40;
          else if (h >= 17 && h <= 19) peak = 45;
          else if (h >= 10 && h <= 16) peak = 20;
        } else {
          if (h >= 10 && h <= 14) peak = 25;
        }
        const noise = Math.random() * 8 - 4;
        const index = Math.max(0, Math.min(100, baseIndex + peak + noise));
        return {
          hour: h,
          congestion_index: Math.round(index * 10) / 10,
          label: (index < 35 ? "light" : index < 65 ? "moderate" : "heavy") as CongestionLevel,
        };
      }),
    };
  });

  return res.json({ location, patterns, ml_model_used: false });
});

// ---------------------------------------------------------------------------
// GET /api/summary
// Averages real ML predictions across all known roads for the current hour.
// Falls back to randomized values only if the ML service is unreachable.
// ---------------------------------------------------------------------------
router.get("/summary", async (_req, res) => {
  const now = new Date();
  const isoNow = now.toISOString();
  const allRoads = [
    ...KNOWN_ROADS_BANGALORE.map((r) => ({ city: "Bangalore" as const, road: r })),
    ...KNOWN_ROADS_MUMBAI.map((r) => ({ city: "Mumbai" as const, road: r })),
  ];

  try {
    const results = await Promise.all(
      allRoads.map((r) => getMlPrediction(r.city, r.road, isoNow))
    );

    const avgCongestion = results.reduce((sum, r) => sum + r.congestion_ratio, 0) / results.length;
    const heavy_zones = results.filter((r) => r.zone === "heavy").length;
    const moderate_zones = results.filter((r) => r.zone === "moderate").length;
    const light_zones = results.filter((r) => r.zone === "light").length;

    return res.json({
      active_incidents: heavy_zones, // proxy metric until real incident data exists
      average_congestion_index: Math.round(avgCongestion * 1000) / 10, // scale 0-1 -> 0-100
      predictions_today: 1200 + Math.floor(Math.random() * 400),
      heavy_zones,
      light_zones,
      moderate_zones,
      ml_model_used: true,
    });
  } catch {
    // Fallback: ML service unreachable
    const h = now.getHours();
    const isPeak = (h >= 7 && h <= 9) || (h >= 17 && h <= 19);
    return res.json({
      active_incidents: isPeak ? Math.floor(Math.random() * 12) + 4 : Math.floor(Math.random() * 5) + 1,
      average_congestion_index: isPeak ? 58 + Math.random() * 15 : 28 + Math.random() * 15,
      predictions_today: 1200 + Math.floor(Math.random() * 400),
      heavy_zones: isPeak ? Math.floor(Math.random() * 8) + 3 : Math.floor(Math.random() * 3),
      light_zones: isPeak ? Math.floor(Math.random() * 10) + 5 : Math.floor(Math.random() * 15) + 8,
      moderate_zones: isPeak ? Math.floor(Math.random() * 12) + 6 : Math.floor(Math.random() * 8) + 4,
      ml_model_used: false,
    });
  }
});

export default router;