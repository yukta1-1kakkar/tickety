import { useEffect, useState } from 'react';
import { API_BASE } from '../../apiConfig';

export type RouteInfo = { route_id: string; origin: string; destination: string };
export type Catalog = { total: number; routes: RouteInfo[] };
export type Fare = {
  id: number; route_id: string; fare: number | null; currency: string; price_level: string | null;
  lowest_price: number | null; typical_price_low: number | null; typical_price_high: number | null;
  airline: string; flight_number: string | null; departure_time: string | null; arrival_time: string | null;
  duration_minutes: number | null; stops: number | null; cabin: string | null; travel_date: string;
  observation_date: string; collected_at: string | null; advance_purchase_days: number;
};
export type LeadPoint = { days: number; fare: number | null; count: number };
export type NetworkTrendPoint = {
  days: number; fare: number | null; routes: number; observations: number;
  index: number | null; changePercent: number | null;
  firstObservation: string | null; lastObservation: string | null;
};
export type NetworkTrend = {
  points: NetworkTrendPoint[]; method: string; routeId: string | null; baselineWindow: number | null;
};
export type HeatmapCell = { days: number; fare: number | null; observations: number; changePercent: number | null };
export type HeatmapRoute = { routeId: string; displayId: string; weight: number; cells: HeatmapCell[] };
export type FareHeatmap = { windows: number[]; routes: HeatmapRoute[]; baselineWindow: number };
export type HistoryPoint = { date: string; fare: number; count: number };
export type Intelligence = {
  routeId: string; departureDate: string; current: Fare | null; flights: Fare[];
  history: HistoryPoint[]; leadTime: LeadPoint[];
};
export type Coverage = {
  registeredRoutes: number; observedRoutes: number; observations: number;
  observedWindows: number[];
  ticketWindowRuns: { observationDate: string; windows: { days: number; travelDate: string }[] }[];
  updatedAt: string | null;
};
export type Resource<T> = { data?: T; loading: boolean; error: boolean; retry: () => void };

async function readApi<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Unable to retrieve airfare intelligence.');
  return response.json() as Promise<T>;
}

async function readCatalog(_path: string, signal: AbortSignal): Promise<Catalog> {
  const first = await readApi<Catalog>('/routes?limit=500&offset=0', signal);
  const routes = [...first.routes];
  // The route basket can exceed a single page. Never silently omit its tail.
  while (routes.length < first.total) {
    const next = await readApi<Catalog>(`/routes?limit=500&offset=${routes.length}`, signal);
    if (!next.routes.length) throw new Error('Incomplete route catalogue.');
    routes.push(...next.routes);
  }
  return { total: first.total, routes };
}

export function useApi<T>(path: string | null, loader: (path: string, signal: AbortSignal) => Promise<T> = readApi): Resource<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: boolean }>();
  const key = `${path}:${attempt}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    loader(path, controller.signal)
      .then(data => { if (active) setResult({ key, data }); })
      .catch(() => { if (active) setResult({ key, error: true }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [path, key, loader]);
  return {
    data: result?.key === key ? result.data : undefined,
    loading: !!path && result?.key !== key,
    error: result?.key === key && !!result.error,
    retry: () => setAttempt(value => value + 1),
  };
}

export const useRouteCatalog = () => useApi<Catalog>('/routes', readCatalog);
export const money = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? 'Unavailable' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
export const cityLabel = (value: string) => value.length === 3 ? value.toUpperCase()
  : value.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
export const routeParts = (value: string) => value.split(/[_-]/).map(cityLabel);
export const routeLabel = (value: string) => routeParts(value).join(' → ');
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const dateLabel = (value: string) => validDate(value)
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date unavailable';
export const timeLabel = (value: string | null) => !value || Number.isNaN(Date.parse(value)) ? 'Unavailable'
  : new Date(value).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
export const collectedLabel = (fare: Fare) => fare.collected_at
  ? timestampLabel(fare.collected_at) : `${dateLabel(fare.observation_date)} · time unavailable`;
export const timestampLabel = (value: string | null) => !value || Number.isNaN(Date.parse(value)) ? 'Unavailable'
  : new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';
export const levelName = (value: string | null) => ['low', 'typical', 'high'].includes(value?.toLowerCase() ?? '') ? value!.toLowerCase() : 'unavailable';
export const durationLabel = (minutes: number | null) => minutes == null ? 'Duration unavailable' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
export const stopsLabel = (stops: number | null) => stops == null ? 'Stops unavailable' : stops === 0 ? 'Non-stop' : `${stops} stop${stops === 1 ? '' : 's'}`;
export function todayIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
export function defaultDate() {
  return new Date(Date.parse(todayIndia()) + 7 * 86_400_000).toISOString().slice(0, 10);
}
export const daysUntil = (departure: string) => Math.round((Date.parse(departure) - Date.parse(todayIndia())) / 86_400_000);
export const fareUrl = (route: string, date: string) => `/fare?${new URLSearchParams({ route, date })}`;

export function priceEvidence(fare: Fare): string {
  const { fare: current, typical_price_low: low, typical_price_high: high } = fare;
  if (current == null || low == null || high == null || low > high) return 'Price insights unavailable for this route.';
  if (current < low) return `Your fare is ${money(low - current)} below the typical range.`;
  if (current > high) return `Your fare is ${money(current - high)} above the typical range.`;
  return 'Your current fare is within the observed typical range.';
}
