/**
 * Live dashboard store. The legacy filename avoids a noisy import migration,
 * but this module contains no sample observations. LiveDataGate fills every
 * export from GET /api/dashboard/live before the protected portal mounts.
 */
import type {
  Airport, CPIDataPoint, FlightRoute, IndexPoint, KpaMetric, LeadTimeDataPoint,
  LiveTelemetryEvent, PriceTrendPoint, RouteWeight, SectorHeatmapItem,
} from '../types';
import { applyLiveMapData } from '../components/india-map/mapData';
import routeConfig from '../../../config/routes.json';

export interface DataQuality {
  overallConfidence: number;
  coverage: number;
  completeness: number;
  freshness: number;
  consistency: number;
  totalDailyScrapes: number;
  verifiedCarriers: number;
  activeMonitoringNodes: number;
  lastSyncTimestamp: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: string;
  throughput: string;
  status: string;
  latency: string;
  description: string;
  recordsPerDay: number;
}

export interface LiveDashboardPayload {
  hasData: boolean;
  generatedAt: string;
  kpaiMetrics: KpaMetric[];
  routeWeights: RouteWeight[];
  airports: Record<string, Airport>;
  flightRoutes: FlightRoute[];
  indexTimeline: IndexPoint[];
  cpiDataSeries: CPIDataPoint[];
  cpiComparisonMeta?: CPIComparisonMeta;
  sectorHeatmapData: SectorHeatmapItem[];
  leadTimeByRoute: Record<string, LeadTimeDataPoint[]>;
  priceTrendSeries: PriceTrendPoint[];
  liveTelemetryFeed: LiveTelemetryEvent[];
  dataQuality: DataQuality;
  dataSources: DataSource[];
}

export interface CPIComparisonMeta {
  source: string;
  officialSeries: string;
  comparisonBaseMonth: string | null;
  transportSeriesAvailable: boolean;
  note: string;
}

const DEFAULT_CPI_COMPARISON_META: CPIComparisonMeta = {
  source: 'MoSPI CPI Dashboard Data - July 2026 release',
  officialSeries: 'All-India General CPI (Combined)',
  comparisonBaseMonth: null,
  transportSeriesAvailable: false,
  note: 'APIx comparison is shown when an overlapping airfare month is available.',
};

export let KPAI_METRICS: KpaMetric[] = [];
export let ROUTE_WEIGHTS_DATA: RouteWeight[] = [];
export let AIRPORTS: Record<string, Airport> = {};
export let FLIGHT_ROUTES: FlightRoute[] = [];
export let INDEX_TIMELINE: IndexPoint[] = [];
export let CPI_DATA_SERIES: CPIDataPoint[] = [];
export let CPI_COMPARISON_META: CPIComparisonMeta = DEFAULT_CPI_COMPARISON_META;
export let SECTOR_HEATMAP_DATA: SectorHeatmapItem[] = [];
export let LEAD_TIME_ELASTICITY_DATA: LeadTimeDataPoint[] = [];
export let PRICE_TREND_SERIES: PriceTrendPoint[] = [];
export let LIVE_TELEMETRY_FEED: LiveTelemetryEvent[] = [];
export let DATA_QUALITY: DataQuality = {
  overallConfidence: 0, coverage: 0, completeness: 0, freshness: 0,
  consistency: 0, totalDailyScrapes: 0, verifiedCarriers: 0,
  activeMonitoringNodes: 0, lastSyncTimestamp: 'No observations',
};
export let DATA_SOURCES: DataSource[] = [];

let leadTimeByRoute: Record<string, LeadTimeDataPoint[]> = {};
const configuredRouteIds = new Set(routeConfig.routes.flatMap(route => [route.routeId, route.displayId]));
const configuredDisplayIds = new Set(routeConfig.routes.flatMap(route =>
  route.originAirport.split(',').flatMap(origin =>
    route.destinationAirport.split(',').map(destination => `${origin}-${destination}`),
  ),
));

export const getLeadTimeCurveForRoute = (routeId: string): LeadTimeDataPoint[] =>
  leadTimeByRoute[routeId] ?? leadTimeByRoute.ALL ?? [];

export function applyLiveDashboard(payload: LiveDashboardPayload): void {
  const flightRoutes = payload.flightRoutes.filter(route => configuredRouteIds.has(route.id));
  const routeWeights = payload.routeWeights.filter(route => configuredRouteIds.has(route.routeId));
  const usedAirports = new Set(flightRoutes.flatMap(route => [route.origin, route.destination]));
  const airports = Object.fromEntries(
    Object.entries(payload.airports).filter(([code]) => usedAirports.has(code)),
  );
  KPAI_METRICS = payload.kpaiMetrics;
  ROUTE_WEIGHTS_DATA = routeWeights;
  AIRPORTS = airports;
  FLIGHT_ROUTES = flightRoutes;
  INDEX_TIMELINE = payload.indexTimeline;
  CPI_DATA_SERIES = Array.isArray(payload.cpiDataSeries) ? payload.cpiDataSeries : [];
  CPI_COMPARISON_META = payload.cpiComparisonMeta ?? DEFAULT_CPI_COMPARISON_META;
  SECTOR_HEATMAP_DATA = payload.sectorHeatmapData.map(sector => ({
    ...sector,
    keyRoutes: sector.keyRoutes.filter(route => configuredRouteIds.has(route)),
  })).filter(sector => sector.keyRoutes.length > 0);
  leadTimeByRoute = Object.fromEntries(Object.entries(payload.leadTimeByRoute).filter(
    ([route]) => route === 'ALL' || configuredRouteIds.has(route),
  ));
  LEAD_TIME_ELASTICITY_DATA = payload.leadTimeByRoute.ALL ?? [];
  PRICE_TREND_SERIES = payload.priceTrendSeries;
  LIVE_TELEMETRY_FEED = payload.liveTelemetryFeed.filter(
    event => configuredDisplayIds.has(`${event.origin}-${event.dest}`),
  );
  DATA_QUALITY = payload.dataQuality;
  DATA_SOURCES = payload.dataSources;
  applyLiveMapData(airports, flightRoutes, routeWeights, payload.indexTimeline.at(-1)?.indexValue ?? 0);
}
