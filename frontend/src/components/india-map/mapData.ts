import type { Airport, FlightRoute, RouteWeight } from '../../types';
import routeConfig from '../../../../config/routes.json';

const configuredDisplayRouteIds = new Set(routeConfig.routes.map(route => route.displayId));

// One Shared Source of Truth for India Geographic Geometry & Coordinates
export interface IndiaStatePath {
  name: string;
  stateCode: string;
  path: string;
  centroid: { lng: number; lat: number; x: number; y: number };
}

export interface AviationHub {
  id: string;
  name: string;
  city: string;
  code: string;
  state: string;
  region: 'North' | 'South' | 'West' | 'East' | 'Central' | 'North-East';
  lat: number;
  lng: number;
  avgFare: number;
  apix: number;
  activeRoutes: number;
  dailyTraffic: number;
  volatility: string;
  anomalyStatus: 'Normal' | 'Elevated' | 'Critical Anomaly';
  isTop6: boolean;
  notes: string;
}

export interface MapRouteArc {
  id: string;
  originCode: string;
  destCode: string;
  originCity: string;
  destCity: string;
  currentFare: number;
  historicalAvg: number;
  fareChange: number;
  status: 'normal' | 'elevated' | 'anomaly';
  distanceKm: number;
  weeklyFlights: number;
  weight: number;
  volatility: number;
  observations: number;
  dominantCarrier: string;
  anomalyReason?: string;
  historicalData?: { date: string; fare: number; upperBand: number; lowerBand: number; volume: number }[];
}

export const INDIA_SVG_WIDTH = 800;
export const INDIA_SVG_HEIGHT = 900;

// Mathematical D3-aligned Mercator projection for exact geographic alignment
export function projectLngLatToMap(lng: number, lat: number): { x: number; y: number } {
  const k = 1220;
  const lambda0 = (82.8 * Math.PI) / 180;
  const phi0 = (22.8 * Math.PI) / 180;

  const lambda = (lng * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;

  const x = 400 + k * (lambda - lambda0);
  const y = 450 - k * (Math.log(Math.tan(Math.PI / 4 + phi / 2)) - Math.log(Math.tan(Math.PI / 4 + phi0 / 2)));

  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// 9 Required Aviation Hubs with Verified Geographic Coordinates
export const AVIATION_HUBS: AviationHub[] = [
  // Top 6 Hubs (Active Route Arcs Displayed)
  {
    id: 'hub-del',
    name: 'Indira Gandhi International Airport',
    city: 'Delhi',
    code: 'DEL',
    state: 'Delhi NCR',
    region: 'North',
    lat: 28.5562,
    lng: 77.1000,
    avgFare: 5680,
    apix: 108.4,
    activeRoutes: 14,
    dailyTraffic: 1420,
    volatility: '18.4%',
    anomalyStatus: 'Critical Anomaly',
    isTop6: true,
    notes: 'Primary national gateway; high business frequency with DEL-BOM yield spike (+38.7%).'
  },
  {
    id: 'hub-bom',
    name: 'Chhatrapati Shivaji Maharaj International',
    city: 'Mumbai',
    code: 'BOM',
    state: 'Maharashtra',
    region: 'West',
    lat: 19.0896,
    lng: 72.8656,
    avgFare: 6120,
    apix: 116.2,
    activeRoutes: 12,
    dailyTraffic: 1050,
    volatility: '22.1%',
    anomalyStatus: 'Critical Anomaly',
    isTop6: true,
    notes: 'Commercial capital trunk; runway slot saturation and peak holiday surge.'
  },
  {
    id: 'hub-blr',
    name: 'Kempegowda International Airport',
    city: 'Bangalore',
    code: 'BLR',
    state: 'Karnataka',
    region: 'South',
    lat: 13.1986,
    lng: 77.7066,
    avgFare: 5240,
    apix: 106.8,
    activeRoutes: 11,
    dailyTraffic: 780,
    volatility: '12.4%',
    anomalyStatus: 'Normal',
    isTop6: true,
    notes: 'Technology corridor anchor; high stable corporate commuter volume.'
  },
  {
    id: 'hub-ccu',
    name: 'Netaji Subhash Chandra Bose International',
    city: 'Kolkata',
    code: 'CCU',
    state: 'West Bengal',
    region: 'East',
    lat: 22.6547,
    lng: 88.4467,
    avgFare: 5350,
    apix: 114.2,
    activeRoutes: 9,
    dailyTraffic: 410,
    volatility: '24.5%',
    anomalyStatus: 'Critical Anomaly',
    isTop6: true,
    notes: 'Eastern hub; pre-Durga festival forward bookings surging (+24.2%).'
  },
  {
    id: 'hub-hyd',
    name: 'Rajiv Gandhi International Airport',
    city: 'Hyderabad',
    code: 'HYD',
    state: 'Telangana',
    region: 'South',
    lat: 17.2403,
    lng: 78.4294,
    avgFare: 4890,
    apix: 104.5,
    activeRoutes: 10,
    dailyTraffic: 540,
    volatility: '9.8%',
    anomalyStatus: 'Normal',
    isTop6: true,
    notes: 'Central-south transfer hub; competitive multi-carrier yields.'
  },
  {
    id: 'hub-amd',
    name: 'Sardar Vallabhbhai Patel International',
    city: 'Ahmedabad',
    code: 'AMD',
    state: 'Gujarat',
    region: 'West',
    lat: 23.0772,
    lng: 72.6347,
    avgFare: 4720,
    apix: 98.8,
    activeRoutes: 7,
    dailyTraffic: 260,
    volatility: '11.2%',
    anomalyStatus: 'Normal',
    isTop6: true,
    notes: 'Western industrial hub; balanced supply and steady pricing.'
  },

  // Additional 3 Locations (Markers only, NO route lines to keep map clean)
  {
    id: 'hub-maa',
    name: 'Chennai International Airport',
    city: 'Chennai',
    code: 'MAA',
    state: 'Tamil Nadu',
    region: 'South',
    lat: 12.9941,
    lng: 80.1709,
    avgFare: 4950,
    apix: 105.1,
    activeRoutes: 8,
    dailyTraffic: 490,
    volatility: '10.5%',
    anomalyStatus: 'Normal',
    isTop6: false,
    notes: 'Southern automotive & IT hub; steady coastal network availability.'
  },
  {
    id: 'hub-goi',
    name: 'Dabolim / Manohar International Airport',
    city: 'Goa',
    code: 'GOA',
    state: 'Goa',
    region: 'West',
    lat: 15.3808,
    lng: 73.8313,
    avgFare: 5890,
    apix: 111.4,
    activeRoutes: 6,
    dailyTraffic: 240,
    volatility: '21.0%',
    anomalyStatus: 'Elevated',
    isTop6: false,
    notes: 'High leisure weekend demand profile with seasonal fare premiums.'
  },
  {
    id: 'hub-lko',
    name: 'Chaudhary Charan Singh International Airport',
    city: 'Lucknow',
    code: 'LUCKNOW',
    state: 'Uttar Pradesh',
    region: 'North',
    lat: 26.7606,
    lng: 80.8893,
    avgFare: 4840,
    apix: 104.1,
    activeRoutes: 6,
    dailyTraffic: 280,
    volatility: '13.2%',
    anomalyStatus: 'Normal',
    isTop6: false,
    notes: 'Northern arterial connection; strong traffic connectivity to Delhi and Mumbai.'
  }
];

// Active routes strictly between the TOP 6 LOCATIONS only
export const TOP_6_ROUTES: MapRouteArc[] = ([
  {
    id: 'DEL-BOM',
    originCode: 'DEL',
    destCode: 'BOM',
    originCity: 'Delhi',
    destCity: 'Mumbai',
    currentFare: 8950,
    historicalAvg: 5240,
    fareChange: +38.7,
    status: 'anomaly',
    distanceKm: 1148,
    weeklyFlights: 385,
    weight: 16.4,
    volatility: 88,
    observations: 3420,
    dominantCarrier: 'IndiGo / Air India',
    anomalyReason: 'Peak business slot consolidation and sudden equipment downgrade on trunk frequency.',
    historicalData: [
      { date: 'Aug 01', fare: 5200, upperBand: 6100, lowerBand: 4400, volume: 112 },
      { date: 'Aug 05', fare: 5450, upperBand: 6300, lowerBand: 4600, volume: 125 },
      { date: 'Aug 09', fare: 5800, upperBand: 6800, lowerBand: 4900, volume: 140 },
      { date: 'Aug 13', fare: 6400, upperBand: 7200, lowerBand: 5200, volume: 168 },
      { date: 'Aug 17', fare: 7300, upperBand: 8100, lowerBand: 6000, volume: 195 },
      { date: 'Aug 21', fare: 8400, upperBand: 9200, lowerBand: 6900, volume: 220 },
      { date: 'Aug 24', fare: 8950, upperBand: 9800, lowerBand: 7400, volume: 245 },
    ]
  },
  {
    id: 'DEL-BLR',
    originCode: 'DEL',
    destCode: 'BLR',
    originCity: 'Delhi',
    destCity: 'Bengaluru',
    currentFare: 6250,
    historicalAvg: 5400,
    fareChange: +7.7,
    status: 'normal',
    distanceKm: 1740,
    weeklyFlights: 290,
    weight: 13.2,
    volatility: 42,
    observations: 2840,
    dominantCarrier: 'IndiGo / Akasa Air',
    historicalData: [
      { date: 'Aug 01', fare: 5350, upperBand: 6000, lowerBand: 4600, volume: 95 },
      { date: 'Aug 05', fare: 5400, upperBand: 6100, lowerBand: 4700, volume: 98 },
      { date: 'Aug 09', fare: 5650, upperBand: 6350, lowerBand: 4900, volume: 104 },
      { date: 'Aug 13', fare: 5900, upperBand: 6600, lowerBand: 5100, volume: 112 },
      { date: 'Aug 17', fare: 6050, upperBand: 6800, lowerBand: 5250, volume: 120 },
      { date: 'Aug 21', fare: 6180, upperBand: 7000, lowerBand: 5400, volume: 128 },
      { date: 'Aug 24', fare: 6250, upperBand: 7100, lowerBand: 5500, volume: 135 },
    ]
  },
  {
    id: 'DEL-HYD',
    originCode: 'DEL',
    destCode: 'HYD',
    originCity: 'Delhi',
    destCity: 'Hyderabad',
    currentFare: 5120,
    historicalAvg: 4750,
    fareChange: +3.4,
    status: 'normal',
    distanceKm: 1260,
    weeklyFlights: 220,
    weight: 9.8,
    volatility: 31,
    observations: 2150,
    dominantCarrier: 'IndiGo / Air India',
    historicalData: [
      { date: 'Aug 01', fare: 4800, upperBand: 5400, lowerBand: 4100, volume: 80 },
      { date: 'Aug 05', fare: 4880, upperBand: 5500, lowerBand: 4200, volume: 82 },
      { date: 'Aug 09', fare: 4950, upperBand: 5600, lowerBand: 4250, volume: 85 },
      { date: 'Aug 13', fare: 5020, upperBand: 5700, lowerBand: 4300, volume: 88 },
      { date: 'Aug 17', fare: 5080, upperBand: 5750, lowerBand: 4350, volume: 92 },
      { date: 'Aug 21', fare: 5100, upperBand: 5800, lowerBand: 4400, volume: 95 },
      { date: 'Aug 24', fare: 5120, upperBand: 5850, lowerBand: 4420, volume: 98 },
    ]
  },
  {
    id: 'DEL-CCU',
    originCode: 'DEL',
    destCode: 'CCU',
    originCity: 'Delhi',
    destCity: 'Kolkata',
    currentFare: 7890,
    historicalAvg: 5120,
    fareChange: +24.2,
    status: 'anomaly',
    distanceKm: 1305,
    weeklyFlights: 210,
    weight: 8.9,
    volatility: 76,
    observations: 1980,
    dominantCarrier: 'Air India / IndiGo',
    anomalyReason: 'Pre-Durga festival forward bookings surging (+24.2%) and capacity shift.',
    historicalData: [
      { date: 'Aug 01', fare: 5200, upperBand: 5900, lowerBand: 4400, volume: 72 },
      { date: 'Aug 05', fare: 5600, upperBand: 6300, lowerBand: 4700, volume: 78 },
      { date: 'Aug 09', fare: 6200, upperBand: 7000, lowerBand: 5200, volume: 86 },
      { date: 'Aug 13', fare: 6850, upperBand: 7600, lowerBand: 5700, volume: 95 },
      { date: 'Aug 17', fare: 7300, upperBand: 8200, lowerBand: 6100, volume: 108 },
      { date: 'Aug 21', fare: 7650, upperBand: 8600, lowerBand: 6450, volume: 118 },
      { date: 'Aug 24', fare: 7890, upperBand: 8900, lowerBand: 6700, volume: 126 },
    ]
  },
  {
    id: 'DEL-AMD',
    originCode: 'DEL',
    destCode: 'AMD',
    originCity: 'Delhi',
    destCity: 'Ahmedabad',
    currentFare: 4720,
    historicalAvg: 4600,
    fareChange: -1.6,
    status: 'normal',
    distanceKm: 760,
    weeklyFlights: 175,
    weight: 6.4,
    volatility: 29,
    observations: 1620,
    dominantCarrier: 'IndiGo / Akasa Air',
  },
  {
    id: 'BOM-BLR',
    originCode: 'BOM',
    destCode: 'BLR',
    originCity: 'Mumbai',
    destCity: 'Bengaluru',
    currentFare: 4320,
    historicalAvg: 3950,
    fareChange: +5.3,
    status: 'normal',
    distanceKm: 842,
    weeklyFlights: 245,
    weight: 11.5,
    volatility: 35,
    observations: 2450,
    dominantCarrier: 'IndiGo / Vistara',
  },
  {
    id: 'BOM-HYD',
    originCode: 'BOM',
    destCode: 'HYD',
    originCity: 'Mumbai',
    destCity: 'Hyderabad',
    currentFare: 3790,
    historicalAvg: 3620,
    fareChange: +0.4,
    status: 'normal',
    distanceKm: 620,
    weeklyFlights: 160,
    weight: 4.5,
    volatility: 24,
    observations: 1540,
    dominantCarrier: 'IndiGo / Air India',
  },
  {
    id: 'BOM-CCU',
    originCode: 'BOM',
    destCode: 'CCU',
    originCity: 'Mumbai',
    destCity: 'Kolkata',
    currentFare: 6850,
    historicalAvg: 5900,
    fareChange: +12.4,
    status: 'elevated',
    distanceKm: 1650,
    weeklyFlights: 140,
    weight: 5.2,
    volatility: 54,
    observations: 1420,
    dominantCarrier: 'Air India / IndiGo',
  },
  {
    id: 'BOM-AMD',
    originCode: 'BOM',
    destCode: 'AMD',
    originCity: 'Mumbai',
    destCity: 'Ahmedabad',
    currentFare: 3150,
    historicalAvg: 3080,
    fareChange: +2.1,
    status: 'normal',
    distanceKm: 440,
    weeklyFlights: 150,
    weight: 4.1,
    volatility: 22,
    observations: 1380,
    dominantCarrier: 'IndiGo / Akasa Air',
  },
  {
    id: 'BLR-HYD',
    originCode: 'BLR',
    destCode: 'HYD',
    originCity: 'Bengaluru',
    destCity: 'Hyderabad',
    currentFare: 3100,
    historicalAvg: 3040,
    fareChange: +1.8,
    status: 'normal',
    distanceKm: 500,
    weeklyFlights: 180,
    weight: 3.8,
    volatility: 20,
    observations: 1650,
    dominantCarrier: 'IndiGo / Air India',
  },
  {
    id: 'BLR-CCU',
    originCode: 'BLR',
    destCode: 'CCU',
    originCity: 'Bengaluru',
    destCity: 'Kolkata',
    currentFare: 6420,
    historicalAvg: 5880,
    fareChange: +8.4,
    status: 'elevated',
    distanceKm: 1560,
    weeklyFlights: 130,
    weight: 4.6,
    volatility: 46,
    observations: 1290,
    dominantCarrier: 'IndiGo / Air India',
  },
  {
    id: 'HYD-CCU',
    originCode: 'HYD',
    destCode: 'CCU',
    originCity: 'Hyderabad',
    destCity: 'Kolkata',
    currentFare: 5400,
    historicalAvg: 5180,
    fareChange: +4.2,
    status: 'normal',
    distanceKm: 1180,
    weeklyFlights: 110,
    weight: 3.2,
    volatility: 28,
    observations: 1120,
    dominantCarrier: 'IndiGo / SpiceJet',
  },
  {
    id: 'AMD-BLR',
    originCode: 'AMD',
    destCode: 'BLR',
    originCity: 'Ahmedabad',
    destCity: 'Bengaluru',
    currentFare: 4950,
    historicalAvg: 4800,
    fareChange: +3.0,
    status: 'normal',
    distanceKm: 1240,
    weeklyFlights: 95,
    weight: 3.0,
    volatility: 26,
    observations: 980,
    dominantCarrier: 'Akasa Air / IndiGo',
  },
] as MapRouteArc[]).filter(route => configuredDisplayRouteIds.has(route.id));

/** Replace legacy map metrics with the current backend response before mount. */
export function applyLiveMapData(
  airports: Record<string, Airport>,
  routes: FlightRoute[],
  weights: RouteWeight[],
  apix: number,
) {
  const weightByRoute = new Map(weights.map((weight) => [weight.routeId, weight.weight]));
  AVIATION_HUBS.splice(0, AVIATION_HUBS.length, ...Object.values(airports).map((airport) => ({
    id: `hub-${airport.code.toLowerCase()}`,
    name: airport.name,
    city: airport.city,
    code: airport.code,
    state: airport.state,
    region: 'Central' as const,
    lat: airport.lat,
    lng: airport.lng,
    avgFare: airport.avgFare,
    apix,
    activeRoutes: airport.activeRoutesCount,
    dailyTraffic: airport.dailyFlights,
    volatility: `${Math.abs(airport.indexMovement).toFixed(1)}%`,
    anomalyStatus: Math.abs(airport.indexMovement) >= 20 ? 'Critical Anomaly' as const : Math.abs(airport.indexMovement) >= 10 ? 'Elevated' as const : 'Normal' as const,
    isTop6: routes.slice(0, 6).some((route) => route.origin === airport.code || route.destination === airport.code),
    notes: `Live aggregate from ${airport.activeRoutesCount} persisted route${airport.activeRoutesCount === 1 ? '' : 's'}.`,
  })));
  TOP_6_ROUTES.splice(0, TOP_6_ROUTES.length, ...routes.map((route) => ({
    id: route.id,
    originCode: route.origin,
    destCode: route.destination,
    originCity: route.originCity,
    destCity: route.destCity,
    currentFare: route.currentFare,
    historicalAvg: route.historicalAvg,
    fareChange: route.changePercent,
    status: route.isAnomaly ? 'anomaly' as const : Math.abs(route.changePercent) >= 10 ? 'elevated' as const : 'normal' as const,
    distanceKm: route.distanceKm,
    weeklyFlights: route.weeklyFrequency,
    weight: weightByRoute.get(route.id) ?? 0,
    volatility: route.volatilityIndex,
    observations: route.observationsCount,
    dominantCarrier: route.dominantCarrier,
    anomalyReason: route.anomalyReason,
    historicalData: route.historicalData,
  })));
}

export const INDIA_STATES_PATHS: IndiaStatePath[] = [
  {
    "name": "Andaman and Nicobar",
    "stateCode": "AN",
    "path": "M 635.2 794.2 L 637.4 799.4 L 634.8 804.7 L 631.1 796.7 L 635.2 794.2 Z M 632.4 789.9 L 633.3 791.7 L 631.0 794.2 L 630.7 791.4 L 632.4 789.9 Z M 625.3 777.4 L 627.0 780.7 L 623.9 779.4 L 625.3 777.4 Z M 628.8 777.3 L 629.5 779.5 L 628.8 777.3 Z M 629.5 775.2 L 629.8 777.1 L 629.5 775.2 Z M 628.4 773.0 L 627.9 778.0 L 626.9 774.2 L 628.4 773.0 Z M 619.9 770.3 L 621.4 773.8 L 619.0 772.1 L 619.9 770.3 Z M 630.3 765.6 L 630.5 768.9 L 630.3 765.6 Z M 612.7 751.1 L 613.6 753.4 L 611.5 753.7 L 612.7 751.1 Z M 606.9 715.4 L 608.4 717.8 L 608.0 722.3 L 606.8 723.7 L 604.1 723.3 L 603.9 717.9 L 606.9 715.4 Z M 610.9 706.9 L 610.5 707.9 L 610.9 706.9 Z M 609.6 702.1 L 610.6 705.1 L 608.7 705.6 L 609.6 702.1 Z M 600.6 700.3 L 601.6 701.8 L 600.6 700.3 Z M 617.6 694.8 L 618.7 695.0 L 617.6 694.8 Z M 616.5 690.7 L 618.1 694.0 L 615.6 691.5 L 616.5 690.7 Z M 617.0 689.0 L 617.0 690.5 L 617.0 689.0 Z M 617.8 688.0 L 618.2 690.4 L 616.2 688.3 L 617.8 688.0 Z M 618.6 686.8 L 618.8 689.6 L 618.6 686.8 Z M 610.8 686.3 L 612.6 690.4 L 610.4 695.4 L 612.7 693.6 L 612.0 697.9 L 610.1 698.9 L 612.0 698.7 L 611.0 702.8 L 606.8 694.7 L 607.9 692.6 L 608.9 694.2 L 610.8 686.3 Z M 611.5 686.1 L 612.2 687.5 L 611.5 686.1 Z M 615.1 685.8 L 614.6 686.9 L 615.1 685.8 Z M 618.8 685.7 L 619.3 687.0 L 618.8 685.7 Z M 611.0 685.0 L 611.0 686.4 L 611.0 685.0 Z M 615.9 685.3 L 615.5 686.4 L 615.9 685.3 Z M 612.4 684.7 L 614.8 685.6 L 612.2 690.0 L 612.4 684.7 Z M 635.1 684.4 L 635.9 686.3 L 635.1 684.4 Z M 616.2 682.4 L 615.5 683.5 L 616.2 682.4 Z M 611.0 673.3 L 611.2 675.7 L 611.0 673.3 Z M 615.0 671.4 L 616.5 680.6 L 615.4 682.6 L 612.7 681.2 L 615.0 684.4 L 611.2 684.9 L 610.5 678.2 L 612.7 676.7 L 611.5 676.7 L 611.3 673.4 L 615.0 671.4 Z M 610.7 669.8 L 610.1 674.4 L 610.7 669.8 Z M 617.3 669.7 L 616.2 670.9 L 617.3 669.7 Z M 617.8 657.1 L 619.1 662.3 L 616.1 662.1 L 618.6 663.7 L 617.9 667.8 L 616.6 669.3 L 614.9 668.4 L 615.9 670.2 L 613.8 672.3 L 612.7 669.2 L 613.8 660.8 L 617.8 657.1 Z M 617.5 654.8 L 617.8 655.9 L 617.5 654.8 Z M 625.0 644.3 L 624.9 646.4 L 625.0 644.3 Z M 630.8 627.9 L 630.2 629.3 L 630.8 627.9 Z",
    "centroid": {
      "lng": 92.97,
      "lat": 11.21,
      "x": 617,
      "y": 709
    }
  },
  {
    "name": "Telangana",
    "stateCode": "TE",
    "path": "M 287.3 605.4 L 286.9 598.1 L 289.1 596.1 L 281.5 593.2 L 286.4 590.7 L 285.4 588.9 L 287.1 581.3 L 284.6 576.5 L 287.4 571.9 L 291.1 570.5 L 285.9 568.4 L 290.4 559.8 L 288.1 557.9 L 289.3 552.9 L 287.8 549.2 L 289.2 546.8 L 292.2 546.6 L 294.3 541.0 L 296.6 540.6 L 292.6 536.0 L 294.6 534.6 L 294.8 529.8 L 296.7 528.9 L 301.4 531.3 L 301.7 527.3 L 304.4 526.3 L 303.5 521.7 L 305.6 519.0 L 304.4 516.0 L 308.3 518.7 L 315.8 519.5 L 316.1 521.8 L 318.4 522.0 L 318.1 524.2 L 322.9 526.2 L 324.3 522.8 L 329.1 525.4 L 335.8 523.2 L 339.8 527.6 L 339.2 532.8 L 337.4 534.3 L 339.0 536.1 L 338.4 541.0 L 342.7 543.9 L 346.1 543.0 L 347.7 545.9 L 350.7 545.0 L 353.9 547.5 L 357.2 553.4 L 356.0 555.2 L 358.0 553.8 L 358.7 556.1 L 361.1 555.3 L 362.4 563.8 L 365.1 562.4 L 372.0 563.5 L 378.6 562.4 L 374.0 565.2 L 371.1 572.9 L 365.7 574.1 L 365.1 576.2 L 359.7 576.9 L 358.1 580.8 L 352.3 578.3 L 349.9 581.0 L 348.3 580.0 L 348.0 582.1 L 352.8 583.0 L 352.4 586.7 L 348.3 585.6 L 344.3 580.4 L 340.6 583.5 L 341.9 585.6 L 339.5 589.4 L 335.6 587.4 L 324.8 591.2 L 323.7 598.3 L 317.5 599.1 L 317.2 601.3 L 315.6 600.1 L 314.3 603.1 L 310.9 601.4 L 306.4 601.8 L 303.3 602.9 L 300.1 607.4 L 298.6 605.8 L 287.3 605.4 Z",
    "centroid": {
      "lng": 79.06,
      "lat": 17.79,
      "x": 320,
      "y": 564
    }
  },
  {
    "name": "Andhra Pradesh",
    "stateCode": "AN",
    "path": "M 343.6 656.1 L 343.4 657.7 L 343.6 656.1 Z M 390.0 587.5 L 389.6 590.3 L 388.5 588.3 L 390.0 587.5 Z M 389.3 587.8 L 386.7 587.5 L 389.6 591.0 L 381.8 594.9 L 377.0 596.7 L 369.4 595.6 L 361.0 609.6 L 357.9 610.0 L 357.5 607.1 L 355.0 606.2 L 346.1 610.9 L 342.1 618.7 L 341.4 624.0 L 341.6 629.7 L 344.6 634.8 L 343.0 645.2 L 347.1 660.1 L 343.5 653.8 L 343.3 656.2 L 342.7 654.1 L 341.5 656.7 L 347.0 661.5 L 345.3 659.2 L 340.5 658.0 L 338.8 662.3 L 334.4 663.7 L 334.9 665.3 L 333.3 663.4 L 331.4 664.2 L 328.2 662.5 L 327.1 663.0 L 328.1 665.5 L 325.6 667.5 L 323.7 666.6 L 322.3 669.5 L 318.7 667.9 L 317.5 669.2 L 316.4 667.7 L 312.8 668.4 L 310.9 670.1 L 309.5 676.5 L 308.1 675.4 L 307.5 678.1 L 305.6 678.1 L 301.8 676.6 L 302.9 672.9 L 305.1 671.2 L 307.5 672.8 L 306.8 670.3 L 310.1 663.9 L 305.6 662.6 L 306.1 657.0 L 301.7 657.4 L 301.1 655.4 L 299.5 655.7 L 300.1 650.9 L 296.6 651.7 L 297.3 648.9 L 293.9 649.1 L 291.6 653.6 L 290.3 652.6 L 286.1 654.8 L 285.5 651.3 L 280.3 650.8 L 280.3 649.5 L 280.0 653.1 L 276.3 653.4 L 277.3 649.3 L 274.2 644.2 L 276.9 643.9 L 277.0 646.5 L 279.6 647.9 L 283.2 647.2 L 284.8 650.3 L 285.7 648.4 L 283.4 647.2 L 283.9 645.0 L 287.4 643.9 L 284.9 640.5 L 284.8 643.5 L 282.5 640.4 L 279.4 640.4 L 278.5 643.1 L 275.3 642.5 L 274.0 639.1 L 275.9 637.2 L 273.7 637.4 L 271.4 634.6 L 273.6 627.1 L 271.5 626.4 L 271.7 624.1 L 278.2 625.7 L 279.8 623.1 L 280.0 620.0 L 275.9 614.9 L 277.1 611.7 L 279.1 611.7 L 277.0 607.3 L 278.1 605.6 L 298.4 605.8 L 300.1 607.4 L 303.3 602.9 L 306.4 601.8 L 310.9 601.4 L 314.3 603.1 L 315.6 600.1 L 317.2 601.3 L 317.5 599.1 L 323.7 598.3 L 324.8 591.2 L 335.6 587.4 L 339.5 589.4 L 341.9 585.6 L 340.6 583.5 L 344.3 580.4 L 348.3 585.6 L 352.4 586.7 L 352.8 583.0 L 348.0 582.1 L 348.2 580.2 L 349.9 581.0 L 352.3 578.3 L 358.1 580.8 L 359.7 576.9 L 365.1 576.2 L 365.5 574.2 L 368.6 572.7 L 370.5 573.4 L 374.0 565.2 L 378.3 562.8 L 378.7 560.5 L 383.5 557.8 L 388.1 559.5 L 390.1 558.0 L 389.5 554.7 L 391.3 552.2 L 390.1 552.0 L 393.1 547.0 L 396.4 554.0 L 400.0 549.2 L 402.2 551.1 L 405.5 550.6 L 404.6 549.1 L 406.2 547.0 L 404.5 544.8 L 407.1 541.8 L 408.6 543.0 L 412.7 540.4 L 410.8 536.9 L 414.0 537.9 L 414.0 535.1 L 415.6 536.5 L 417.5 533.2 L 420.1 538.5 L 421.0 536.4 L 422.8 540.7 L 427.3 542.4 L 432.2 541.6 L 434.7 538.6 L 434.4 536.3 L 435.6 537.1 L 437.6 535.2 L 438.1 536.3 L 439.7 535.1 L 438.2 533.8 L 440.6 533.3 L 441.4 535.5 L 428.2 552.2 L 416.5 558.7 L 408.8 568.2 L 390.8 578.8 L 388.3 583.0 L 390.5 584.7 L 390.6 582.2 L 389.3 587.8 Z",
    "centroid": {
      "lng": 79.9,
      "lat": 15.71,
      "x": 338,
      "y": 610
    }
  },
  {
    "name": "Arunachal Pradesh",
    "stateCode": "AR",
    "path": "M 684.4 293.8 L 686.3 297.4 L 689.4 296.9 L 683.5 301.2 L 684.6 305.4 L 692.3 301.2 L 691.2 303.3 L 694.2 308.5 L 686.7 317.4 L 689.6 319.0 L 695.2 316.1 L 702.3 319.7 L 704.3 318.4 L 710.9 322.5 L 708.9 325.5 L 711.2 326.8 L 710.6 329.9 L 707.8 329.5 L 700.2 336.5 L 700.5 340.3 L 705.5 348.9 L 699.5 346.6 L 698.2 342.9 L 694.3 342.4 L 692.2 344.3 L 683.2 345.8 L 675.3 354.1 L 671.1 355.4 L 668.8 358.6 L 664.8 358.9 L 663.9 350.3 L 669.5 348.1 L 670.8 344.9 L 678.8 345.1 L 681.5 342.5 L 680.6 340.9 L 677.9 341.1 L 678.5 338.1 L 675.9 333.8 L 680.6 328.1 L 672.7 328.4 L 648.3 338.0 L 643.9 336.0 L 644.0 338.8 L 634.4 347.7 L 635.0 349.6 L 627.6 352.8 L 617.6 353.4 L 609.9 350.5 L 608.4 352.3 L 598.2 353.9 L 596.4 347.5 L 596.7 345.0 L 598.5 344.5 L 596.3 339.9 L 588.5 339.8 L 586.6 337.4 L 588.2 333.2 L 586.4 330.8 L 592.2 331.9 L 594.2 334.2 L 600.4 330.8 L 602.6 332.7 L 607.8 331.7 L 611.6 327.6 L 610.5 324.3 L 621.9 319.3 L 621.1 316.7 L 624.4 311.9 L 636.9 311.1 L 643.1 301.1 L 647.7 297.6 L 650.4 297.6 L 651.9 294.6 L 655.5 299.1 L 660.3 300.0 L 659.7 298.9 L 668.5 302.3 L 671.4 300.0 L 671.2 297.9 L 676.3 294.4 L 682.8 291.8 L 684.4 293.8 Z",
    "centroid": {
      "lng": 94.67,
      "lat": 28.04,
      "x": 653,
      "y": 326
    }
  },
  {
    "name": "Assam",
    "stateCode": "AS",
    "path": "M 550.6 386.1 L 550.3 387.6 L 550.6 386.1 Z M 680.1 328.8 L 675.9 333.9 L 678.5 338.1 L 677.9 341.1 L 680.6 340.9 L 681.5 342.6 L 678.8 345.1 L 670.7 345.0 L 669.5 348.1 L 660.2 353.2 L 657.5 352.9 L 654.6 356.8 L 648.4 359.3 L 645.2 364.2 L 644.4 361.9 L 638.6 371.1 L 638.0 377.1 L 634.1 379.6 L 633.6 376.0 L 624.3 385.9 L 627.0 388.5 L 627.3 391.5 L 622.5 398.3 L 621.4 403.2 L 619.5 403.2 L 618.0 412.6 L 613.5 413.3 L 612.2 410.0 L 605.8 419.0 L 604.9 416.3 L 600.4 416.3 L 602.2 404.9 L 601.0 401.1 L 606.4 401.7 L 604.9 398.8 L 606.2 396.2 L 613.0 393.6 L 612.6 390.9 L 608.0 387.8 L 609.8 384.8 L 608.1 385.6 L 604.1 381.0 L 599.3 382.9 L 600.7 377.4 L 599.2 376.5 L 602.2 373.3 L 594.2 375.2 L 592.0 372.4 L 588.9 377.4 L 586.9 374.4 L 585.8 378.2 L 581.7 379.0 L 579.4 381.7 L 578.8 378.5 L 574.6 379.4 L 575.2 377.8 L 573.4 376.4 L 566.6 377.6 L 565.7 376.1 L 564.2 377.6 L 563.5 374.8 L 555.8 376.1 L 551.0 381.4 L 553.7 384.6 L 550.5 385.9 L 549.4 379.5 L 551.0 376.6 L 546.8 370.7 L 547.3 367.9 L 550.3 366.0 L 550.4 357.7 L 556.0 357.4 L 557.9 354.9 L 562.0 353.7 L 568.2 356.9 L 589.2 356.0 L 592.9 353.4 L 597.1 355.0 L 608.4 352.3 L 609.9 350.5 L 617.6 353.4 L 631.1 352.2 L 644.0 338.9 L 643.9 336.0 L 648.3 338.0 L 672.7 328.4 L 680.1 328.8 Z",
    "centroid": {
      "lng": 92.82,
      "lat": 26.36,
      "x": 613,
      "y": 367
    }
  },
  {
    "name": "Bihar",
    "stateCode": "BI",
    "path": "M 428.1 339.1 L 431.9 342.2 L 438.8 343.3 L 440.3 346.2 L 439.3 350.2 L 446.1 352.3 L 447.4 354.8 L 451.1 354.6 L 451.4 357.1 L 454.0 357.5 L 460.4 354.4 L 465.0 361.7 L 468.8 359.3 L 472.8 361.2 L 475.2 360.5 L 483.8 365.1 L 491.0 361.3 L 491.4 364.5 L 496.7 366.9 L 499.4 364.7 L 502.4 366.1 L 508.4 363.6 L 511.4 366.5 L 513.0 362.4 L 515.6 362.1 L 514.5 363.5 L 516.7 367.2 L 510.0 371.6 L 506.5 377.0 L 511.8 382.5 L 512.2 387.4 L 509.1 386.1 L 506.1 388.3 L 507.2 394.1 L 501.8 390.6 L 499.7 391.8 L 499.5 394.2 L 496.3 393.5 L 495.6 396.7 L 492.6 398.2 L 490.5 408.0 L 487.9 407.1 L 487.5 409.6 L 484.7 407.7 L 482.4 409.1 L 481.0 408.0 L 477.8 413.6 L 474.1 411.4 L 475.0 408.5 L 471.0 408.1 L 469.2 403.9 L 467.1 405.0 L 462.5 402.9 L 461.0 408.6 L 452.9 409.9 L 448.7 413.3 L 448.5 411.9 L 444.7 413.5 L 442.5 409.8 L 439.6 413.0 L 436.7 413.4 L 436.1 415.5 L 431.8 411.6 L 431.8 408.9 L 427.9 410.9 L 425.4 407.2 L 422.7 409.7 L 414.9 409.8 L 415.8 407.5 L 412.5 403.8 L 411.0 398.4 L 411.7 394.1 L 422.1 388.5 L 427.6 381.8 L 431.6 383.2 L 432.6 381.2 L 436.0 382.8 L 439.0 381.6 L 436.8 378.1 L 429.1 375.4 L 426.6 372.8 L 425.7 369.6 L 428.9 369.4 L 429.2 366.3 L 423.5 364.5 L 427.3 359.9 L 434.4 360.3 L 430.5 357.6 L 430.7 354.7 L 426.7 354.0 L 423.9 343.8 L 421.9 343.6 L 423.5 342.4 L 422.8 341.1 L 426.2 341.0 L 428.1 339.1 Z",
    "centroid": {
      "lng": 85.6,
      "lat": 25.68,
      "x": 460,
      "y": 383
    }
  },
  {
    "name": "Chandigarh",
    "stateCode": "CH",
    "path": "M 272.7 261.8 L 269.9 259.9 L 272.2 259.3 L 272.7 261.8 Z",
    "centroid": {
      "lng": 76.77,
      "lat": 30.73,
      "x": 272,
      "y": 261
    }
  },
  {
    "name": "Chhattisgarh",
    "stateCode": "CH",
    "path": "M 411.2 419.8 L 415.0 421.5 L 416.2 425.4 L 419.1 426.3 L 420.8 431.5 L 424.2 432.3 L 425.7 430.7 L 424.8 436.5 L 427.0 437.7 L 426.3 442.2 L 428.7 446.2 L 429.6 444.8 L 433.4 446.0 L 433.6 448.2 L 430.2 453.0 L 425.7 455.3 L 425.6 460.0 L 417.4 463.9 L 415.6 467.6 L 416.7 472.0 L 414.2 473.4 L 413.2 475.9 L 414.6 477.0 L 412.4 477.3 L 411.4 480.0 L 412.8 483.4 L 410.0 482.7 L 408.3 488.2 L 396.5 487.9 L 392.7 495.3 L 390.3 494.0 L 389.9 501.5 L 392.1 504.4 L 391.3 512.7 L 398.0 514.3 L 398.1 517.5 L 395.4 519.2 L 395.5 517.1 L 392.3 516.2 L 390.2 517.9 L 387.9 514.1 L 383.5 513.8 L 381.7 511.7 L 380.3 513.0 L 379.8 516.1 L 384.2 519.0 L 383.4 525.3 L 386.9 527.2 L 386.4 533.8 L 388.1 538.6 L 384.6 543.1 L 380.5 544.5 L 381.8 546.5 L 377.5 551.3 L 372.9 553.3 L 369.9 563.5 L 365.1 562.4 L 362.5 563.9 L 361.1 555.3 L 358.7 556.1 L 358.0 553.8 L 356.0 555.2 L 357.2 553.5 L 355.8 549.9 L 350.8 545.0 L 347.6 545.9 L 345.5 542.2 L 347.8 540.8 L 346.1 536.9 L 348.5 531.2 L 352.5 527.6 L 353.4 529.7 L 356.3 530.2 L 358.4 528.5 L 357.2 527.0 L 359.4 526.1 L 354.4 522.8 L 351.9 518.1 L 348.8 518.7 L 351.0 517.0 L 349.0 515.6 L 351.5 515.6 L 352.0 512.6 L 348.8 510.8 L 348.5 508.6 L 353.5 506.5 L 353.6 500.3 L 350.6 500.0 L 352.7 498.5 L 351.9 492.8 L 350.2 492.9 L 349.4 491.1 L 350.1 487.5 L 354.7 484.5 L 355.7 475.0 L 357.7 474.2 L 359.7 465.8 L 361.8 466.8 L 364.0 458.3 L 368.5 456.4 L 370.1 458.3 L 374.8 456.0 L 377.9 453.1 L 378.1 448.3 L 381.7 446.4 L 381.6 443.6 L 386.2 442.1 L 386.9 437.8 L 382.5 435.8 L 381.2 433.0 L 377.3 432.2 L 374.6 433.6 L 373.8 431.7 L 376.3 428.6 L 374.7 424.3 L 378.3 426.5 L 381.2 425.1 L 394.0 427.2 L 400.0 423.0 L 403.2 425.1 L 407.0 424.7 L 411.2 419.8 Z",
    "centroid": {
      "lng": 82.02,
      "lat": 21.25,
      "x": 383,
      "y": 486
    }
  },
  {
    "name": "Dadra and Nagar Haveli",
    "stateCode": "DA",
    "path": "M 191.1 507.4 L 193.5 505.9 L 195.1 507.0 L 192.7 509.4 L 196.2 509.8 L 195.6 512.6 L 191.0 511.5 L 189.7 507.8 L 191.1 507.4 Z",
    "centroid": {
      "lng": 73.08,
      "lat": 20.19,
      "x": 193,
      "y": 510
    }
  },
  {
    "name": "Daman and Diu",
    "stateCode": "DA",
    "path": "M 188.4 503.4 L 187.5 505.6 L 188.4 503.4 Z M 147.6 497.4 L 148.7 497.8 L 146.4 498.0 L 147.6 497.4 Z M 143.8 492.2 L 146.6 493.5 L 144.8 494.7 L 146.5 495.3 L 145.3 498.4 L 141.8 496.8 L 143.8 492.2 Z",
    "centroid": {
      "lng": 70.85,
      "lat": 20.82,
      "x": 146,
      "y": 495
    }
  },
  {
    "name": "Delhi",
    "stateCode": "DE",
    "path": "M 281.1 307.1 L 283.4 310.0 L 283.7 315.1 L 280.0 317.5 L 278.0 314.8 L 273.9 315.1 L 272.9 313.3 L 275.1 311.9 L 275.3 307.5 L 278.1 305.9 L 281.1 307.1 Z",
    "centroid": {
      "lng": 77.11,
      "lat": 28.65,
      "x": 279,
      "y": 312
    }
  },
  {
    "name": "Goa",
    "stateCode": "GO",
    "path": "M 210.1 608.5 L 212.7 612.3 L 218.1 611.3 L 219.9 619.3 L 218.1 620.0 L 219.1 624.8 L 216.4 627.7 L 213.6 627.6 L 210.7 623.9 L 210.4 618.4 L 208.0 616.7 L 210.4 616.6 L 208.1 615.5 L 205.8 609.8 L 210.1 608.5 Z",
    "centroid": {
      "lng": 74.06,
      "lat": 15.36,
      "x": 214,
      "y": 618
    }
  },
  {
    "name": "Gujarat",
    "stateCode": "GU",
    "path": "M 184.4 487.8 L 184.7 489.3 L 184.4 487.8 Z M 119.5 457.9 L 119.7 459.1 L 119.5 457.9 Z M 109.1 457.4 L 108.0 458.7 L 109.1 457.4 Z M 125.7 455.7 L 124.5 456.3 L 125.7 455.7 Z M 127.6 454.8 L 126.6 455.8 L 127.6 454.8 Z M 137.0 444.2 L 136.3 445.6 L 137.0 444.2 Z M 137.7 443.9 L 137.0 444.8 L 137.7 443.9 Z M 96.7 438.1 L 97.1 439.7 L 96.7 438.1 Z M 97.4 436.7 L 98.0 437.8 L 97.4 436.7 Z M 96.3 436.0 L 96.7 437.0 L 96.3 436.0 Z M 94.9 434.2 L 95.2 436.0 L 95.0 434.7 L 93.6 435.4 L 94.9 434.2 Z M 95.1 431.5 L 94.0 433.6 L 95.1 431.5 Z M 92.5 426.7 L 93.9 426.9 L 93.2 430.2 L 89.1 431.5 L 91.5 430.3 L 89.8 430.5 L 92.5 426.7 Z M 91.4 426.3 L 90.7 429.1 L 91.4 426.3 Z M 95.4 426.1 L 95.9 427.9 L 94.2 428.2 L 95.4 426.1 Z M 93.3 425.0 L 93.9 426.6 L 91.9 427.1 L 93.3 425.0 Z M 94.4 423.6 L 92.3 425.7 L 94.4 423.6 Z M 96.3 423.4 L 97.4 424.1 L 95.9 425.5 L 96.3 423.4 Z M 95.1 422.3 L 95.9 423.9 L 94.3 425.7 L 95.1 422.3 Z M 94.0 422.3 L 89.9 429.6 L 89.4 426.0 L 94.0 422.3 Z M 172.2 407.1 L 177.6 407.7 L 175.4 408.6 L 179.5 410.4 L 179.9 412.7 L 181.6 410.3 L 184.9 411.5 L 185.6 413.7 L 189.7 414.5 L 191.6 410.9 L 193.4 410.7 L 193.1 412.9 L 196.3 413.6 L 193.1 417.8 L 196.6 421.9 L 199.3 419.2 L 200.4 423.8 L 199.1 427.1 L 202.2 429.1 L 202.3 431.1 L 205.4 430.9 L 204.8 434.9 L 209.0 435.0 L 210.4 437.6 L 211.8 436.5 L 214.9 438.6 L 215.3 441.2 L 217.9 441.0 L 220.3 446.9 L 222.8 448.6 L 220.7 453.7 L 218.3 453.6 L 215.9 456.5 L 213.6 456.0 L 215.2 458.7 L 216.7 457.4 L 218.9 459.4 L 216.7 461.0 L 214.2 460.1 L 216.5 466.4 L 214.7 468.1 L 215.8 469.3 L 208.6 472.5 L 210.5 476.1 L 208.1 477.0 L 209.7 480.0 L 219.2 478.3 L 219.6 480.0 L 214.1 480.3 L 211.6 482.1 L 211.5 484.5 L 209.0 485.2 L 208.8 487.4 L 203.9 487.5 L 210.6 491.7 L 211.5 497.2 L 205.6 501.3 L 201.0 497.9 L 199.9 499.5 L 202.0 501.8 L 199.7 505.2 L 200.5 509.4 L 198.0 509.3 L 196.9 511.2 L 195.2 509.3 L 192.9 510.3 L 195.2 507.5 L 193.6 505.9 L 189.7 507.7 L 190.7 509.3 L 185.7 510.9 L 186.6 506.5 L 188.7 505.4 L 189.0 497.0 L 185.4 488.0 L 183.4 489.6 L 183.9 486.1 L 182.5 485.0 L 185.8 478.7 L 183.4 480.1 L 182.8 478.7 L 187.8 476.0 L 181.5 476.1 L 180.7 469.5 L 182.4 463.8 L 186.2 464.4 L 189.5 462.0 L 186.0 463.1 L 181.6 462.0 L 180.4 463.9 L 177.7 459.8 L 178.9 463.2 L 177.6 462.2 L 177.3 465.6 L 176.3 463.8 L 176.0 470.0 L 176.4 465.9 L 175.0 468.0 L 173.7 467.5 L 174.7 469.4 L 173.2 468.8 L 175.4 470.8 L 175.7 474.4 L 173.9 472.5 L 176.6 476.9 L 171.7 484.4 L 172.5 486.8 L 149.8 497.4 L 146.0 497.9 L 146.5 495.3 L 144.8 494.7 L 146.3 492.6 L 143.1 491.5 L 141.6 497.0 L 129.6 488.9 L 121.3 479.2 L 121.9 476.4 L 121.0 477.8 L 119.6 476.6 L 121.2 479.0 L 111.1 469.7 L 104.8 461.3 L 107.6 457.4 L 107.6 459.3 L 110.3 458.7 L 109.5 461.2 L 111.1 462.5 L 116.6 460.7 L 116.8 458.4 L 118.4 461.1 L 121.7 457.5 L 123.1 459.2 L 123.9 456.9 L 124.7 458.2 L 126.9 455.9 L 130.9 455.7 L 138.0 443.6 L 134.9 447.0 L 130.1 446.3 L 130.7 444.7 L 130.3 447.1 L 123.2 448.8 L 121.2 451.7 L 119.7 450.1 L 116.2 450.6 L 110.2 449.0 L 98.9 441.9 L 97.3 439.9 L 101.0 437.7 L 98.7 438.3 L 95.3 433.8 L 95.4 430.2 L 101.1 425.1 L 96.0 427.8 L 95.8 426.2 L 99.0 424.1 L 96.5 423.0 L 100.8 423.0 L 101.3 415.3 L 103.8 417.6 L 105.0 415.7 L 106.2 416.9 L 118.9 415.7 L 121.6 418.1 L 127.5 418.3 L 130.0 415.4 L 139.7 412.3 L 139.7 416.3 L 144.6 417.0 L 151.5 412.8 L 148.9 411.8 L 148.7 409.5 L 151.0 406.3 L 155.1 408.0 L 160.2 406.3 L 165.8 406.5 L 167.0 408.0 L 167.4 406.4 L 168.8 407.5 L 171.2 405.7 L 172.2 407.1 Z",
    "centroid": {
      "lng": 71.6,
      "lat": 22.69,
      "x": 161,
      "y": 452
    }
  },
  {
    "name": "Haryana",
    "stateCode": "HA",
    "path": "M 273.0 257.0 L 274.4 256.5 L 276.8 260.4 L 279.8 261.7 L 278.9 264.7 L 280.8 266.8 L 285.0 268.4 L 286.1 267.2 L 285.8 268.7 L 287.4 267.6 L 289.1 269.5 L 285.3 276.0 L 282.3 277.5 L 279.0 284.3 L 279.1 300.6 L 281.2 305.5 L 275.3 307.5 L 275.1 311.9 L 272.9 313.3 L 273.9 315.1 L 278.0 314.8 L 280.0 317.5 L 283.6 315.0 L 286.6 317.4 L 287.9 328.6 L 281.5 332.5 L 277.3 331.7 L 278.2 333.7 L 276.4 333.6 L 275.9 335.6 L 274.0 334.6 L 275.7 323.9 L 273.6 321.9 L 266.7 328.1 L 266.7 326.4 L 264.9 326.2 L 265.2 323.6 L 261.4 323.0 L 262.4 326.7 L 259.0 325.9 L 258.5 327.4 L 260.0 331.2 L 254.4 330.6 L 253.6 329.0 L 256.0 325.6 L 253.8 325.1 L 257.2 323.6 L 253.6 318.5 L 250.3 317.5 L 245.7 312.5 L 243.9 304.9 L 244.8 302.9 L 241.6 299.7 L 242.3 296.8 L 235.6 297.5 L 230.5 293.3 L 225.3 295.1 L 223.9 292.2 L 225.7 290.3 L 225.5 284.7 L 222.5 283.9 L 224.4 282.0 L 223.8 279.9 L 226.4 281.0 L 229.7 278.9 L 233.7 282.2 L 235.7 280.8 L 235.8 283.4 L 237.8 282.6 L 238.8 284.8 L 237.3 287.0 L 238.7 289.8 L 243.4 283.4 L 246.0 285.0 L 250.3 283.0 L 252.6 284.9 L 256.1 284.8 L 260.4 281.9 L 258.7 280.4 L 260.6 276.1 L 259.5 274.8 L 262.1 276.0 L 263.9 273.7 L 264.8 276.2 L 268.0 276.7 L 268.8 273.6 L 266.9 272.1 L 270.4 270.5 L 271.3 267.9 L 275.0 269.0 L 271.4 256.6 L 272.5 255.7 L 273.0 257.0 Z",
    "centroid": {
      "lng": 76.33,
      "lat": 29.2,
      "x": 262,
      "y": 298
    }
  },
  {
    "name": "Himachal Pradesh",
    "stateCode": "HI",
    "path": "M 272.3 197.7 L 274.7 202.9 L 279.4 204.2 L 283.5 208.3 L 291.7 204.5 L 297.4 214.2 L 305.7 209.8 L 306.1 213.3 L 303.7 216.2 L 307.1 216.3 L 308.8 218.5 L 307.1 222.8 L 310.4 223.5 L 310.5 225.9 L 314.2 229.0 L 312.5 234.2 L 315.5 238.6 L 312.8 241.0 L 319.0 251.1 L 316.3 251.3 L 314.7 248.9 L 307.8 248.9 L 305.4 246.7 L 295.4 250.1 L 291.2 259.7 L 293.8 265.5 L 288.7 269.2 L 279.1 265.2 L 279.8 261.7 L 276.8 260.4 L 274.4 256.5 L 268.2 253.9 L 268.7 248.6 L 264.4 246.9 L 262.9 243.0 L 261.5 246.0 L 258.9 246.3 L 253.0 230.2 L 246.2 226.9 L 248.0 224.8 L 247.2 223.1 L 253.8 218.3 L 252.0 216.2 L 253.6 212.5 L 251.1 205.5 L 254.1 206.7 L 263.5 199.0 L 268.6 199.6 L 272.3 197.7 Z",
    "centroid": {
      "lng": 77.24,
      "lat": 31.93,
      "x": 282,
      "y": 231
    }
  },
  {
    "name": "Jammu and Kashmir",
    "stateCode": "JA",
    "path": "M 295.7 141.2 L 300.1 139.9 L 297.6 143.3 L 303.1 160.3 L 306.8 162.6 L 309.9 162.4 L 318.7 169.6 L 318.2 172.6 L 312.8 176.3 L 314.5 184.1 L 312.9 187.0 L 320.7 197.9 L 327.8 199.2 L 326.6 204.3 L 330.6 210.1 L 330.7 213.7 L 325.7 216.7 L 323.4 216.1 L 321.3 219.6 L 318.6 220.4 L 314.4 217.0 L 313.7 211.4 L 304.4 217.0 L 305.7 209.8 L 297.4 214.2 L 291.7 204.5 L 283.5 208.3 L 279.4 204.2 L 274.7 202.9 L 271.8 197.2 L 270.7 199.2 L 263.5 199.0 L 254.1 206.7 L 251.1 205.5 L 253.6 212.8 L 244.6 222.0 L 235.7 216.9 L 227.2 216.6 L 227.5 207.8 L 223.9 210.3 L 221.4 206.2 L 219.4 205.8 L 220.1 203.3 L 217.0 202.6 L 212.9 198.7 L 216.6 192.1 L 211.7 185.4 L 217.3 181.6 L 218.2 178.9 L 217.2 177.2 L 210.1 176.9 L 212.1 171.4 L 210.5 168.9 L 207.6 168.7 L 211.5 163.4 L 211.8 160.2 L 215.6 160.4 L 220.6 157.5 L 249.9 164.9 L 265.3 157.7 L 269.7 158.6 L 271.2 154.3 L 276.4 153.9 L 276.9 151.4 L 279.8 150.9 L 294.0 139.3 L 295.7 141.2 Z",
    "centroid": {
      "lng": 76.61,
      "lat": 33.76,
      "x": 268,
      "y": 184
    }
  },
  {
    "name": "Jharkhand",
    "stateCode": "JH",
    "path": "M 502.2 391.4 L 506.1 393.0 L 506.0 396.6 L 510.2 401.2 L 506.8 404.3 L 508.6 405.3 L 508.8 408.3 L 505.8 408.6 L 506.7 412.7 L 503.0 416.5 L 504.1 418.7 L 499.9 419.5 L 499.2 422.6 L 494.5 421.2 L 495.7 424.5 L 494.6 426.2 L 492.2 425.3 L 492.1 426.9 L 487.2 425.0 L 486.9 426.5 L 485.0 426.1 L 485.0 429.4 L 477.5 430.8 L 474.5 435.6 L 469.1 431.8 L 469.1 433.9 L 465.1 434.9 L 464.6 440.9 L 466.3 442.4 L 468.9 442.1 L 472.7 445.6 L 479.6 445.7 L 477.4 447.1 L 477.0 450.5 L 481.3 452.9 L 482.0 455.2 L 484.3 455.3 L 484.1 458.1 L 487.0 462.6 L 484.1 463.6 L 478.8 460.6 L 477.4 461.5 L 469.0 455.5 L 467.1 457.9 L 468.7 464.2 L 466.1 469.2 L 463.0 468.7 L 463.9 465.9 L 461.4 467.3 L 455.2 464.8 L 451.8 468.4 L 448.9 466.1 L 446.4 466.5 L 449.3 461.7 L 448.2 457.4 L 431.7 460.7 L 425.6 456.4 L 427.3 453.8 L 430.2 453.0 L 433.8 446.8 L 429.6 444.8 L 428.7 446.2 L 426.3 442.2 L 427.0 437.7 L 424.8 436.5 L 425.7 430.7 L 424.2 432.3 L 420.8 431.5 L 419.1 426.3 L 416.2 425.4 L 415.0 421.5 L 411.1 419.8 L 413.9 413.6 L 412.7 410.4 L 422.7 409.7 L 425.4 407.2 L 427.9 410.9 L 431.9 409.0 L 431.8 411.6 L 436.1 415.5 L 436.7 413.4 L 439.6 413.0 L 442.5 409.8 L 444.7 413.5 L 448.5 411.9 L 448.7 413.3 L 452.9 409.9 L 461.0 408.6 L 462.5 402.9 L 467.1 405.0 L 469.2 403.9 L 471.0 408.1 L 475.0 408.5 L 474.1 411.4 L 477.8 413.6 L 481.0 408.0 L 482.4 409.1 L 484.7 407.7 L 487.5 409.6 L 487.9 407.1 L 490.5 408.0 L 493.2 397.3 L 495.6 396.7 L 496.3 393.5 L 499.4 394.2 L 499.9 391.6 L 502.2 391.4 Z",
    "centroid": {
      "lng": 85.55,
      "lat": 23.65,
      "x": 459,
      "y": 430
    }
  },
  {
    "name": "Karnataka",
    "stateCode": "KA",
    "path": "M 283.7 549.3 L 285.2 550.4 L 284.2 552.2 L 289.3 552.9 L 288.1 557.9 L 290.4 559.8 L 285.9 568.4 L 291.2 570.3 L 287.4 571.9 L 284.6 576.5 L 287.1 581.3 L 285.4 588.9 L 286.4 590.7 L 281.5 593.2 L 289.1 597.2 L 286.9 598.1 L 287.3 605.4 L 280.3 604.7 L 277.0 607.3 L 279.2 611.2 L 277.1 611.7 L 275.9 614.9 L 280.0 622.2 L 278.2 625.7 L 271.7 624.1 L 271.5 626.4 L 273.6 627.1 L 271.4 634.6 L 273.7 637.4 L 275.9 637.2 L 274.0 639.1 L 275.3 642.5 L 278.7 643.0 L 279.7 640.3 L 282.5 640.4 L 284.7 643.5 L 284.7 640.6 L 287.1 642.0 L 287.2 644.4 L 283.9 645.0 L 285.0 650.3 L 283.2 647.2 L 279.6 647.9 L 277.0 646.5 L 276.9 643.9 L 274.2 644.2 L 277.3 649.3 L 276.4 653.4 L 280.0 653.1 L 280.3 649.5 L 280.3 650.8 L 285.5 651.3 L 286.6 654.8 L 290.3 652.6 L 291.6 653.6 L 293.9 649.1 L 297.3 648.9 L 296.6 651.7 L 298.7 650.2 L 300.2 651.2 L 299.5 655.7 L 301.1 655.4 L 301.7 657.4 L 306.1 657.0 L 305.6 662.6 L 310.1 663.9 L 306.8 670.3 L 307.5 672.8 L 305.1 671.2 L 302.5 675.0 L 294.1 672.7 L 292.1 676.9 L 289.1 677.1 L 289.7 682.5 L 286.4 687.0 L 292.0 687.8 L 292.9 689.1 L 290.7 692.7 L 286.8 692.9 L 285.4 696.8 L 281.6 695.7 L 278.8 697.7 L 276.6 695.7 L 274.4 696.1 L 273.0 700.7 L 267.1 699.9 L 265.9 698.0 L 263.9 698.7 L 263.9 696.8 L 257.5 694.7 L 257.5 692.1 L 252.4 692.6 L 250.9 689.9 L 242.8 685.2 L 242.7 680.6 L 241.2 681.5 L 239.7 679.7 L 240.9 678.7 L 234.9 677.0 L 233.8 674.2 L 231.1 675.0 L 226.1 651.0 L 223.3 647.2 L 220.9 635.7 L 219.2 636.3 L 217.9 631.5 L 214.6 630.1 L 214.8 627.8 L 218.4 626.5 L 219.5 621.7 L 218.1 620.0 L 219.9 619.3 L 218.1 611.3 L 214.7 610.9 L 217.5 608.4 L 220.4 608.6 L 222.6 602.7 L 220.5 602.4 L 223.2 601.4 L 223.3 598.5 L 219.7 597.6 L 220.5 594.9 L 218.5 591.5 L 220.9 591.9 L 222.8 589.0 L 224.8 591.4 L 227.3 590.2 L 227.5 587.7 L 232.3 586.5 L 232.6 582.7 L 235.8 582.6 L 238.5 585.0 L 240.1 582.4 L 248.3 582.3 L 248.0 575.6 L 246.2 572.9 L 247.4 570.8 L 251.0 573.2 L 252.8 572.1 L 253.7 574.2 L 257.8 573.2 L 258.9 574.8 L 260.4 573.1 L 263.3 574.5 L 262.3 568.1 L 265.6 566.7 L 266.4 564.5 L 269.9 566.2 L 272.0 563.0 L 271.0 561.4 L 274.7 561.0 L 275.5 554.9 L 278.8 555.7 L 281.6 549.9 L 283.7 549.3 Z",
    "centroid": {
      "lng": 76.17,
      "lat": 14.69,
      "x": 259,
      "y": 632
    }
  },
  {
    "name": "Kerala",
    "stateCode": "KE",
    "path": "M 260.8 735.4 L 261.5 736.4 L 260.8 735.4 Z M 237.3 689.0 L 237.8 690.3 L 237.3 689.0 Z M 236.6 687.0 L 237.3 689.0 L 236.6 687.0 Z M 233.8 674.2 L 234.9 677.0 L 240.9 678.7 L 239.7 679.4 L 241.1 681.4 L 242.7 680.6 L 242.8 685.2 L 246.2 688.1 L 250.8 689.8 L 252.6 692.7 L 257.5 692.1 L 257.7 694.8 L 263.9 696.8 L 264.5 699.4 L 260.0 700.9 L 260.3 703.2 L 266.7 705.5 L 264.8 709.2 L 270.7 708.6 L 269.9 710.0 L 272.1 712.2 L 269.0 714.8 L 274.3 718.1 L 273.8 721.2 L 272.3 721.3 L 272.7 728.4 L 275.9 730.3 L 281.2 727.4 L 282.5 730.3 L 280.5 732.8 L 282.1 735.6 L 279.7 743.3 L 283.8 743.6 L 284.9 745.7 L 279.3 756.1 L 281.6 759.3 L 279.8 762.1 L 282.1 766.3 L 279.9 771.2 L 276.0 769.7 L 266.8 758.5 L 262.4 747.4 L 260.3 735.6 L 262.6 741.0 L 262.0 737.6 L 263.1 738.7 L 262.8 745.1 L 265.4 745.4 L 263.2 737.7 L 259.6 731.6 L 260.0 735.3 L 256.6 723.0 L 253.3 717.7 L 252.2 710.1 L 244.6 695.8 L 243.6 696.4 L 240.3 692.7 L 241.9 692.4 L 239.6 691.3 L 242.5 688.4 L 238.7 689.1 L 238.2 691.3 L 231.1 675.0 L 233.8 674.2 Z",
    "centroid": {
      "lng": 76.41,
      "lat": 10.45,
      "x": 264,
      "y": 725
    }
  },
  {
    "name": "Lakshadweep",
    "stateCode": "LA",
    "path": "M 193.1 770.9 L 191.7 772.1 L 193.1 770.9 Z M 173.7 717.1 L 174.4 715.8 L 173.7 717.1 Z M 186.9 707.5 L 186.2 709.2 L 186.9 707.5 Z",
    "centroid": {
      "lng": 72.94,
      "lat": 10.45,
      "x": 190,
      "y": 725
    }
  },
  {
    "name": "Madhya Pradesh",
    "stateCode": "MA",
    "path": "M 305.6 354.5 L 309.8 357.2 L 313.0 356.1 L 318.9 358.9 L 318.7 361.5 L 321.8 364.6 L 320.7 366.6 L 321.9 367.0 L 317.9 371.9 L 319.2 373.2 L 316.1 379.9 L 315.1 379.2 L 313.7 381.1 L 314.9 384.0 L 306.9 385.5 L 304.1 389.9 L 307.2 395.7 L 304.8 396.7 L 304.8 398.8 L 301.3 402.1 L 303.5 406.6 L 302.5 409.9 L 305.9 415.8 L 308.6 413.0 L 314.7 418.0 L 318.4 413.9 L 316.6 407.2 L 313.8 408.0 L 314.4 403.1 L 311.0 399.6 L 309.9 392.7 L 306.9 392.0 L 311.7 388.3 L 314.1 390.3 L 315.1 388.6 L 313.4 387.0 L 315.6 388.6 L 316.6 385.6 L 318.6 389.9 L 316.4 389.6 L 314.5 391.6 L 315.7 393.4 L 316.5 390.7 L 318.1 390.6 L 316.5 394.9 L 319.0 394.2 L 319.2 392.2 L 319.6 395.4 L 320.9 394.2 L 321.7 396.1 L 325.0 395.9 L 324.9 392.9 L 326.5 393.7 L 324.5 392.2 L 325.6 390.8 L 326.6 392.5 L 329.5 392.4 L 327.6 396.1 L 329.5 396.8 L 331.1 394.6 L 337.2 396.5 L 337.1 393.1 L 345.8 388.7 L 349.4 394.7 L 346.4 397.3 L 347.1 398.7 L 349.1 397.0 L 350.9 397.7 L 350.5 396.4 L 353.3 397.1 L 353.0 395.1 L 354.7 397.5 L 356.9 397.3 L 355.3 395.5 L 358.0 396.2 L 359.1 394.2 L 357.5 400.1 L 363.3 399.9 L 364.5 401.3 L 366.2 400.3 L 367.4 394.8 L 372.0 397.0 L 373.7 394.2 L 374.5 397.3 L 380.8 398.5 L 382.1 402.7 L 387.1 402.9 L 386.6 404.9 L 388.2 404.0 L 389.2 407.8 L 391.7 408.2 L 391.9 405.7 L 394.2 406.9 L 397.0 405.8 L 399.9 408.1 L 398.1 409.2 L 399.2 415.3 L 397.0 419.0 L 400.2 423.0 L 396.4 425.9 L 393.5 427.2 L 381.2 425.1 L 379.0 426.6 L 375.8 423.9 L 374.4 424.7 L 376.3 428.6 L 373.8 431.7 L 374.6 433.6 L 377.3 432.2 L 381.2 433.0 L 382.5 435.8 L 386.9 437.8 L 386.2 442.1 L 381.6 443.6 L 381.7 446.4 L 378.1 448.3 L 377.9 453.1 L 374.8 456.0 L 370.1 458.3 L 368.5 456.4 L 364.0 458.3 L 361.8 466.8 L 359.7 465.8 L 357.7 474.2 L 355.7 475.0 L 354.5 483.6 L 349.0 482.7 L 345.9 477.1 L 338.6 479.3 L 334.7 477.5 L 330.5 478.9 L 329.5 475.9 L 324.0 474.8 L 323.8 476.4 L 317.2 477.8 L 317.6 480.2 L 307.0 479.8 L 305.9 477.2 L 296.5 482.5 L 288.9 483.0 L 286.9 482.7 L 285.4 479.1 L 289.4 478.9 L 288.0 475.3 L 286.6 473.7 L 282.6 473.9 L 272.1 477.7 L 271.9 480.7 L 268.5 483.7 L 268.5 486.9 L 265.6 486.8 L 263.2 489.5 L 258.9 489.4 L 257.3 482.8 L 238.6 481.9 L 231.8 476.9 L 224.5 475.7 L 222.1 467.8 L 218.8 469.9 L 215.7 469.5 L 214.7 468.1 L 216.5 466.4 L 214.2 460.1 L 216.7 461.0 L 218.9 459.4 L 216.7 457.4 L 215.2 458.7 L 213.6 456.0 L 215.9 456.5 L 218.3 453.6 L 220.7 453.7 L 222.8 448.6 L 219.5 443.9 L 228.5 440.5 L 223.7 437.8 L 225.7 434.7 L 232.6 430.8 L 231.9 425.1 L 233.8 421.5 L 231.7 416.1 L 228.7 415.6 L 230.9 411.2 L 227.8 410.2 L 230.0 406.5 L 229.6 403.6 L 231.6 406.8 L 234.4 404.1 L 230.7 403.6 L 230.4 399.5 L 234.8 402.1 L 237.3 397.7 L 241.3 397.8 L 239.5 401.3 L 242.8 402.0 L 240.4 403.1 L 238.3 400.9 L 238.5 405.3 L 251.8 405.1 L 253.3 411.5 L 250.8 411.1 L 249.4 412.7 L 251.5 416.4 L 249.7 418.9 L 251.7 420.4 L 248.8 422.9 L 244.9 421.0 L 243.6 424.0 L 246.3 426.8 L 248.5 427.7 L 248.9 424.4 L 250.5 425.6 L 254.7 423.7 L 254.4 421.6 L 258.1 419.9 L 259.2 414.4 L 259.8 417.1 L 265.2 416.8 L 266.5 418.3 L 270.0 415.5 L 270.1 418.2 L 274.4 419.1 L 275.3 417.3 L 272.6 409.7 L 274.6 409.5 L 275.8 411.4 L 277.9 408.8 L 277.1 405.5 L 272.3 403.0 L 275.4 401.7 L 273.4 398.5 L 285.0 396.1 L 284.2 389.0 L 282.5 388.8 L 280.9 391.4 L 271.6 391.4 L 267.2 388.3 L 265.5 381.8 L 274.3 372.8 L 293.8 362.0 L 295.5 359.4 L 299.6 358.9 L 300.0 356.1 L 305.6 354.5 Z",
    "centroid": {
      "lng": 78.28,
      "lat": 23.54,
      "x": 304,
      "y": 433
    }
  },
  {
    "name": "Maharashtra",
    "stateCode": "MA",
    "path": "M 221.9 467.7 L 225.2 476.1 L 231.8 476.9 L 240.3 482.4 L 257.3 482.8 L 258.1 488.4 L 261.2 489.6 L 268.5 486.9 L 268.5 483.7 L 271.9 480.7 L 272.1 477.7 L 282.6 473.9 L 286.6 473.7 L 288.0 475.3 L 289.4 478.9 L 285.4 479.1 L 286.9 482.7 L 288.9 483.0 L 296.5 482.5 L 305.9 477.2 L 307.0 479.8 L 317.6 480.2 L 317.2 477.8 L 323.8 476.4 L 324.0 474.8 L 329.5 475.9 L 330.5 478.9 L 334.7 477.5 L 338.6 479.3 L 345.9 477.1 L 349.0 482.7 L 354.7 484.3 L 349.6 489.1 L 352.7 498.5 L 350.6 500.0 L 353.6 500.3 L 353.5 506.5 L 348.5 508.6 L 348.8 510.8 L 352.0 512.6 L 351.5 515.6 L 349.0 515.6 L 351.0 517.0 L 348.8 518.7 L 351.9 518.1 L 354.4 522.8 L 359.1 524.9 L 357.2 527.0 L 358.4 528.5 L 355.9 530.2 L 353.4 529.7 L 352.5 527.6 L 350.5 529.1 L 346.1 536.9 L 347.8 540.9 L 342.7 543.9 L 338.1 540.4 L 339.0 536.1 L 337.4 534.3 L 339.2 532.8 L 339.8 527.6 L 335.8 523.2 L 329.1 525.4 L 324.3 522.8 L 322.9 526.2 L 318.1 524.2 L 318.4 522.0 L 316.1 521.8 L 315.8 519.5 L 308.3 518.7 L 304.4 516.0 L 305.6 519.0 L 303.5 521.7 L 304.4 526.3 L 301.7 527.3 L 301.4 531.3 L 296.7 528.9 L 294.8 529.8 L 294.6 534.6 L 292.6 536.0 L 296.6 540.6 L 292.1 543.9 L 292.2 546.6 L 289.2 546.8 L 287.7 549.5 L 288.6 552.2 L 284.2 552.2 L 285.2 550.4 L 283.3 548.9 L 278.8 555.7 L 275.5 554.9 L 274.7 561.0 L 271.0 561.4 L 272.0 563.0 L 269.9 566.2 L 266.4 564.5 L 265.6 566.7 L 262.3 568.1 L 263.3 574.5 L 260.4 573.1 L 258.9 574.8 L 257.8 573.2 L 253.7 574.2 L 252.8 572.1 L 251.0 573.2 L 247.4 570.8 L 246.2 572.9 L 248.0 575.6 L 248.3 582.3 L 240.1 582.4 L 238.5 585.0 L 235.8 582.6 L 232.6 582.7 L 232.3 586.5 L 227.5 587.7 L 227.3 590.2 L 224.8 591.4 L 222.8 589.0 L 220.9 591.9 L 218.4 591.7 L 220.5 594.9 L 219.7 597.7 L 223.6 599.2 L 223.0 601.7 L 220.5 602.4 L 222.6 602.7 L 220.4 608.6 L 217.5 608.4 L 213.2 612.4 L 209.9 608.2 L 205.7 609.7 L 201.0 602.4 L 200.0 594.6 L 198.1 592.2 L 199.7 591.4 L 198.1 590.3 L 196.7 580.8 L 198.1 580.6 L 195.4 574.8 L 196.5 574.6 L 194.9 572.4 L 194.2 562.9 L 189.9 554.1 L 190.6 552.8 L 193.2 555.7 L 193.2 551.8 L 191.9 553.2 L 189.5 551.1 L 188.2 543.5 L 188.5 541.0 L 191.0 540.9 L 189.4 538.8 L 192.0 536.6 L 190.5 535.3 L 187.2 539.1 L 187.9 530.6 L 186.7 532.3 L 186.8 524.8 L 185.3 524.5 L 183.9 517.3 L 184.7 515.0 L 186.1 515.7 L 185.7 510.9 L 188.7 508.9 L 190.7 509.2 L 192.3 512.4 L 195.2 512.9 L 198.0 509.3 L 200.4 509.5 L 199.7 505.2 L 202.0 501.8 L 199.9 499.3 L 201.1 497.8 L 205.6 501.3 L 211.5 497.2 L 210.6 491.7 L 203.9 487.5 L 208.8 487.4 L 211.6 482.1 L 219.8 479.0 L 209.7 480.0 L 208.1 477.0 L 210.4 475.3 L 208.6 472.5 L 221.9 467.7 Z",
    "centroid": {
      "lng": 76.09,
      "lat": 19.45,
      "x": 257,
      "y": 526
    }
  },
  {
    "name": "Manipur",
    "stateCode": "MA",
    "path": "M 650.8 383.5 L 650.4 386.7 L 653.0 387.9 L 650.9 393.7 L 654.4 395.5 L 654.3 398.2 L 645.4 414.2 L 641.9 425.6 L 637.5 423.3 L 634.6 423.8 L 633.3 421.9 L 628.0 423.3 L 624.7 419.5 L 622.6 421.6 L 622.5 420.2 L 619.3 421.1 L 616.7 419.5 L 619.5 403.2 L 621.4 403.2 L 625.8 392.6 L 627.3 391.5 L 630.1 394.0 L 635.0 385.5 L 638.8 384.7 L 645.1 387.1 L 650.7 382.3 L 650.8 383.5 Z",
    "centroid": {
      "lng": 93.88,
      "lat": 24.74,
      "x": 636,
      "y": 405
    }
  },
  {
    "name": "Meghalaya",
    "stateCode": "ME",
    "path": "M 592.8 372.7 L 594.2 375.2 L 602.3 373.4 L 599.2 376.5 L 600.7 377.4 L 599.3 382.9 L 604.1 381.0 L 608.1 385.6 L 609.8 384.8 L 608.0 387.8 L 612.6 390.9 L 613.0 393.6 L 609.1 396.0 L 607.1 395.5 L 605.0 398.0 L 597.4 394.3 L 588.3 395.9 L 580.4 394.0 L 562.9 395.4 L 549.8 391.8 L 550.5 385.9 L 553.7 384.4 L 551.1 381.2 L 555.8 376.1 L 563.5 374.8 L 564.2 377.6 L 565.7 376.1 L 566.6 377.6 L 573.4 376.4 L 575.2 377.8 L 574.6 379.4 L 578.8 378.5 L 579.4 381.7 L 581.7 379.0 L 585.8 378.2 L 586.9 374.4 L 588.9 377.4 L 590.2 373.8 L 592.8 372.7 Z",
    "centroid": {
      "lng": 91.28,
      "lat": 25.54,
      "x": 581,
      "y": 386
    }
  },
  {
    "name": "Mizoram",
    "stateCode": "MI",
    "path": "M 612.9 412.4 L 617.7 413.0 L 616.7 419.5 L 619.3 421.1 L 624.4 420.9 L 626.7 429.6 L 625.6 442.2 L 623.5 445.2 L 620.0 444.3 L 619.1 452.1 L 621.6 462.4 L 620.5 464.3 L 618.2 463.9 L 617.4 468.8 L 616.2 467.7 L 615.3 469.7 L 614.4 466.9 L 611.2 464.9 L 608.9 469.0 L 607.1 452.9 L 603.9 446.9 L 604.6 439.7 L 601.4 426.5 L 602.9 424.2 L 602.2 416.3 L 604.9 416.3 L 605.8 419.0 L 612.2 410.0 L 612.9 412.4 Z",
    "centroid": {
      "lng": 92.84,
      "lat": 23.31,
      "x": 614,
      "y": 438
    }
  },
  {
    "name": "Nagaland",
    "stateCode": "NA",
    "path": "M 664.3 352.9 L 664.8 358.9 L 661.2 364.3 L 662.7 366.0 L 662.3 372.6 L 663.7 373.3 L 660.2 377.3 L 660.9 380.8 L 657.8 385.4 L 652.0 387.8 L 650.4 386.7 L 650.7 382.3 L 645.2 387.1 L 638.8 384.7 L 635.0 385.5 L 630.2 393.9 L 627.9 393.0 L 627.0 388.5 L 624.3 385.9 L 633.6 376.0 L 634.1 379.6 L 638.0 377.1 L 638.6 371.1 L 644.4 361.9 L 645.2 364.2 L 648.4 359.3 L 654.6 356.8 L 658.2 352.5 L 660.2 353.2 L 663.9 350.3 L 664.3 352.9 Z",
    "centroid": {
      "lng": 94.47,
      "lat": 26.07,
      "x": 648,
      "y": 374
    }
  },
  {
    "name": "Orissa",
    "stateCode": "OR",
    "path": "M 442.2 534.1 L 441.1 534.6 L 442.2 534.1 Z M 485.2 504.5 L 485.3 505.6 L 485.2 504.5 Z M 486.7 496.5 L 489.5 497.8 L 486.4 498.9 L 486.8 497.4 L 484.6 499.4 L 486.7 496.5 Z M 486.9 496.1 L 488.4 496.4 L 486.9 496.1 Z M 469.8 456.2 L 477.4 461.5 L 478.8 460.6 L 483.5 463.4 L 483.4 465.1 L 488.7 466.6 L 490.1 471.5 L 494.4 469.5 L 495.2 472.9 L 499.4 474.7 L 499.7 477.4 L 491.7 479.5 L 485.7 486.9 L 488.8 495.3 L 485.8 496.5 L 484.2 500.1 L 490.4 497.9 L 483.8 503.2 L 484.5 506.5 L 477.9 510.4 L 478.2 511.8 L 480.0 509.5 L 476.4 514.6 L 473.5 512.8 L 475.9 515.1 L 455.8 522.6 L 442.1 534.2 L 439.7 533.1 L 438.1 536.3 L 437.6 535.2 L 435.6 537.1 L 434.4 536.3 L 434.7 538.6 L 432.2 541.6 L 423.1 541.0 L 417.5 533.2 L 415.6 536.5 L 414.0 535.1 L 414.0 537.9 L 410.8 536.9 L 412.7 540.4 L 408.6 543.0 L 407.1 541.8 L 404.5 544.8 L 406.2 547.0 L 404.6 549.1 L 405.4 550.7 L 402.2 551.1 L 400.0 549.2 L 396.3 554.0 L 393.1 547.0 L 390.7 549.9 L 390.1 552.0 L 391.3 552.2 L 389.5 554.7 L 390.7 556.1 L 388.7 559.4 L 383.5 557.8 L 374.7 563.2 L 369.9 563.4 L 372.9 553.3 L 377.5 551.3 L 381.8 546.5 L 380.5 544.5 L 384.6 543.1 L 388.1 538.6 L 386.4 533.8 L 386.9 527.2 L 383.4 525.3 L 384.2 519.0 L 379.8 516.1 L 380.1 513.2 L 381.7 511.7 L 383.5 513.8 L 387.9 514.1 L 390.2 517.9 L 392.4 516.2 L 395.6 517.1 L 395.4 519.2 L 397.9 517.9 L 398.0 514.3 L 391.3 512.7 L 392.1 504.4 L 389.9 501.5 L 390.3 494.0 L 392.7 495.3 L 396.5 487.9 L 403.3 487.3 L 406.8 489.0 L 410.0 482.7 L 412.8 483.4 L 411.4 480.0 L 412.4 477.3 L 414.6 477.0 L 413.2 475.9 L 414.2 473.4 L 416.7 472.0 L 415.6 467.6 L 417.6 463.7 L 425.6 460.0 L 425.4 456.3 L 431.7 460.7 L 448.2 457.4 L 449.3 461.7 L 446.6 466.7 L 448.9 466.1 L 451.8 468.4 L 454.6 464.9 L 461.4 467.3 L 463.9 465.9 L 463.0 468.7 L 466.1 469.2 L 469.1 461.4 L 467.2 457.5 L 469.8 456.2 Z",
    "centroid": {
      "lng": 84.41,
      "lat": 20.5,
      "x": 434,
      "y": 503
    }
  },
  {
    "name": "Puducherry",
    "stateCode": "PU",
    "path": "M 335.0 713.6 L 337.3 713.7 L 337.2 717.2 L 334.1 714.9 L 335.0 713.6 Z M 333.8 691.4 L 334.8 693.4 L 336.9 692.7 L 336.1 695.6 L 333.1 694.3 L 334.5 693.8 L 332.8 691.9 L 333.8 691.4 Z M 241.9 688.2 L 239.5 691.0 L 240.2 692.6 L 238.6 689.2 L 241.9 688.2 Z M 387.5 587.5 L 389.4 587.6 L 387.5 587.5 Z",
    "centroid": {
      "lng": 78.86,
      "lat": 11.88,
      "x": 316,
      "y": 694
    }
  },
  {
    "name": "Punjab",
    "stateCode": "PU",
    "path": "M 252.4 216.7 L 253.8 218.5 L 247.2 223.1 L 248.0 224.8 L 246.2 226.9 L 253.0 230.2 L 258.9 246.3 L 261.5 246.0 L 262.9 243.0 L 264.4 246.9 L 268.5 248.3 L 268.2 253.9 L 273.2 259.1 L 269.9 260.2 L 273.6 261.9 L 275.0 269.1 L 271.3 267.9 L 270.4 270.5 L 266.9 272.1 L 268.8 273.6 L 268.0 276.7 L 264.8 276.2 L 263.9 273.7 L 262.1 276.0 L 259.5 274.8 L 260.6 276.1 L 258.7 280.4 L 260.4 281.9 L 256.1 284.8 L 252.6 284.9 L 250.3 283.0 L 246.0 285.0 L 243.4 283.4 L 238.7 289.8 L 237.3 287.0 L 238.8 284.8 L 237.8 282.6 L 235.8 283.4 L 235.7 280.8 L 233.7 282.2 L 229.7 278.9 L 226.2 281.0 L 210.3 279.4 L 211.9 274.1 L 209.9 269.2 L 224.5 252.3 L 227.4 251.6 L 223.4 250.5 L 226.3 242.5 L 224.7 241.5 L 223.6 235.9 L 225.4 231.9 L 232.1 227.3 L 239.0 226.8 L 241.6 223.1 L 240.8 220.4 L 244.0 220.4 L 244.5 222.1 L 252.5 214.5 L 252.4 216.7 Z",
    "centroid": {
      "lng": 75.41,
      "lat": 30.84,
      "x": 243,
      "y": 258
    }
  },
  {
    "name": "Rajasthan",
    "stateCode": "RA",
    "path": "M 210.3 279.2 L 223.7 280.1 L 224.4 282.0 L 222.5 283.9 L 225.5 284.7 L 225.7 290.3 L 223.9 292.2 L 225.3 295.1 L 230.5 293.3 L 235.6 297.5 L 242.3 296.8 L 241.6 299.7 L 244.8 302.9 L 243.9 304.9 L 245.7 312.5 L 250.3 317.5 L 253.6 318.5 L 257.2 323.6 L 253.8 325.1 L 256.0 325.6 L 253.6 329.0 L 254.4 330.6 L 260.0 331.2 L 258.5 327.4 L 259.0 325.9 L 262.4 326.7 L 261.4 323.0 L 265.2 323.6 L 264.9 326.2 L 266.7 326.4 L 266.7 328.1 L 272.4 322.2 L 274.4 322.4 L 275.7 323.9 L 274.4 335.6 L 278.2 333.7 L 277.3 331.7 L 282.8 332.2 L 283.6 338.7 L 285.7 341.8 L 289.6 343.2 L 290.8 346.6 L 287.1 349.1 L 292.6 350.8 L 285.5 354.5 L 286.0 357.4 L 287.1 355.0 L 289.4 355.4 L 292.5 352.9 L 298.3 354.7 L 300.2 352.5 L 303.4 353.2 L 301.6 356.3 L 299.9 356.2 L 299.6 358.9 L 295.5 359.4 L 293.8 362.0 L 279.1 369.5 L 271.1 377.3 L 267.8 378.1 L 265.5 381.8 L 267.2 388.3 L 271.6 391.4 L 280.9 391.4 L 282.5 388.8 L 284.2 389.0 L 285.0 396.1 L 273.4 398.5 L 275.4 401.7 L 272.3 403.0 L 277.1 405.5 L 277.9 408.8 L 275.8 411.4 L 274.6 409.5 L 272.6 409.7 L 275.3 417.3 L 274.4 419.1 L 270.1 418.2 L 270.0 415.5 L 266.5 418.3 L 265.2 416.8 L 259.8 417.1 L 259.2 414.4 L 258.1 419.9 L 254.4 421.6 L 254.7 423.7 L 250.5 425.6 L 248.9 424.4 L 248.5 427.7 L 246.3 426.8 L 243.6 424.0 L 244.9 421.0 L 248.8 422.9 L 251.7 420.4 L 249.7 418.9 L 251.5 416.4 L 249.4 412.7 L 250.8 411.1 L 253.3 411.5 L 251.8 405.1 L 238.5 405.3 L 238.3 400.9 L 240.4 403.1 L 242.8 402.0 L 239.5 401.3 L 241.3 397.8 L 237.3 397.7 L 234.8 402.1 L 230.6 399.4 L 230.7 403.6 L 234.3 404.6 L 231.6 406.8 L 229.6 403.6 L 230.0 406.5 L 227.8 410.2 L 230.9 411.2 L 228.7 415.6 L 231.7 416.1 L 233.8 421.5 L 231.9 425.1 L 232.6 430.8 L 225.7 434.7 L 223.7 437.8 L 228.5 440.5 L 219.5 443.9 L 212.0 436.6 L 210.4 437.6 L 209.0 435.0 L 204.8 434.9 L 205.4 430.9 L 202.3 431.1 L 202.2 429.1 L 199.1 427.1 L 200.4 423.8 L 199.3 419.2 L 196.6 421.9 L 193.1 417.8 L 196.3 413.6 L 193.1 412.9 L 193.3 410.6 L 189.7 414.5 L 185.6 413.7 L 184.9 411.5 L 181.6 410.3 L 179.9 412.7 L 179.5 410.4 L 175.4 408.6 L 177.6 407.7 L 173.6 407.8 L 171.2 405.7 L 168.8 407.5 L 167.4 406.4 L 167.0 408.0 L 165.8 406.5 L 155.1 408.0 L 151.3 406.5 L 146.5 395.4 L 141.8 389.6 L 141.6 382.3 L 133.4 382.2 L 129.5 376.5 L 131.0 362.1 L 123.5 361.1 L 116.5 356.0 L 118.6 347.1 L 127.8 338.1 L 130.8 331.4 L 135.2 327.2 L 139.4 326.9 L 143.6 334.2 L 146.3 334.6 L 167.9 328.4 L 168.6 324.3 L 174.0 318.7 L 178.2 308.9 L 190.1 302.5 L 197.1 289.5 L 199.7 280.2 L 211.9 273.9 L 210.3 279.2 Z",
    "centroid": {
      "lng": 73.85,
      "lat": 26.58,
      "x": 209,
      "y": 361
    }
  },
  {
    "name": "Sikkim",
    "stateCode": "SI",
    "path": "M 524.5 325.0 L 528.4 327.0 L 529.5 330.0 L 527.1 337.8 L 530.0 344.6 L 526.3 348.1 L 523.3 346.7 L 519.9 349.4 L 513.6 348.6 L 511.1 346.1 L 511.7 339.5 L 515.0 332.4 L 513.4 328.6 L 519.0 327.9 L 524.5 325.0 Z",
    "centroid": {
      "lng": 88.47,
      "lat": 27.57,
      "x": 521,
      "y": 338
    }
  },
  {
    "name": "Tamil Nadu",
    "stateCode": "TA",
    "path": "M 325.7 749.3 L 328.5 753.0 L 323.7 750.9 L 325.7 749.3 Z M 342.0 658.1 L 347.4 661.6 L 347.3 659.9 L 345.8 674.4 L 336.9 692.7 L 334.8 693.4 L 335.0 691.7 L 332.8 691.9 L 334.5 693.8 L 333.1 694.3 L 336.1 695.6 L 335.2 700.9 L 337.3 713.6 L 334.7 713.4 L 334.1 714.9 L 337.2 717.2 L 337.9 728.3 L 334.9 728.9 L 332.5 726.9 L 330.8 728.0 L 334.8 728.8 L 330.7 727.3 L 325.4 729.2 L 324.8 734.0 L 316.9 745.8 L 319.8 749.5 L 323.1 750.3 L 315.5 750.6 L 305.6 754.4 L 301.4 758.9 L 301.1 761.3 L 302.7 761.8 L 300.0 763.9 L 299.2 770.0 L 288.2 776.3 L 283.2 775.3 L 278.4 771.5 L 282.1 766.4 L 279.8 762.1 L 281.6 759.3 L 279.3 756.1 L 284.9 745.7 L 283.8 743.6 L 279.7 743.3 L 282.1 735.6 L 280.5 732.7 L 282.5 730.3 L 281.2 727.4 L 275.9 730.3 L 272.7 728.4 L 272.3 721.3 L 273.8 721.2 L 274.3 718.1 L 269.0 714.8 L 272.1 712.2 L 269.9 710.0 L 270.7 708.6 L 264.8 709.2 L 266.7 705.5 L 260.3 703.2 L 260.0 700.9 L 265.9 698.0 L 267.1 699.9 L 273.0 700.7 L 274.4 696.1 L 276.6 695.7 L 278.8 697.7 L 281.6 695.7 L 285.4 696.8 L 286.8 692.9 L 290.7 692.7 L 292.8 689.0 L 286.4 686.1 L 289.4 683.6 L 289.1 677.1 L 292.1 676.9 L 294.1 672.7 L 296.2 672.3 L 297.4 674.1 L 298.8 673.1 L 302.5 675.0 L 301.8 676.6 L 307.5 678.1 L 312.8 668.4 L 316.4 667.7 L 317.5 669.2 L 318.7 667.9 L 322.3 669.5 L 323.7 666.6 L 325.6 667.5 L 328.1 665.5 L 327.1 663.0 L 328.2 662.5 L 331.4 664.2 L 333.3 663.4 L 334.9 665.3 L 334.4 663.7 L 338.8 662.3 L 341.1 659.0 L 340.2 658.1 L 342.0 658.1 Z",
    "centroid": {
      "lng": 78.4,
      "lat": 11,
      "x": 306,
      "y": 713
    }
  },
  {
    "name": "Tripura",
    "stateCode": "TR",
    "path": "M 599.8 409.9 L 601.7 413.1 L 600.4 416.3 L 602.9 417.7 L 602.8 425.2 L 600.7 430.1 L 599.7 428.1 L 597.4 430.4 L 595.1 428.5 L 595.4 434.2 L 591.0 439.3 L 592.4 443.2 L 587.8 446.7 L 583.5 438.9 L 583.6 444.0 L 582.2 443.2 L 578.0 428.2 L 579.4 428.2 L 580.6 422.6 L 582.7 422.7 L 582.6 419.7 L 587.3 420.3 L 588.8 416.8 L 590.8 418.9 L 590.4 416.4 L 593.8 418.9 L 594.2 414.3 L 598.4 413.2 L 599.8 409.9 Z",
    "centroid": {
      "lng": 91.74,
      "lat": 23.75,
      "x": 590,
      "y": 428
    }
  },
  {
    "name": "Uttar Pradesh",
    "stateCode": "UT",
    "path": "M 289.0 268.6 L 296.3 272.6 L 291.4 281.8 L 293.4 286.5 L 296.8 285.9 L 297.5 289.8 L 304.9 283.7 L 306.6 284.3 L 310.7 289.4 L 317.4 292.0 L 313.0 295.4 L 315.9 296.8 L 317.0 299.5 L 321.9 300.0 L 322.5 302.6 L 326.7 303.9 L 327.8 306.6 L 335.6 305.8 L 335.8 307.9 L 337.3 306.9 L 339.7 310.1 L 342.9 307.3 L 351.4 314.0 L 351.1 311.3 L 352.5 310.7 L 359.9 316.3 L 366.2 318.7 L 368.5 324.1 L 371.2 323.5 L 380.6 330.8 L 384.5 329.2 L 392.6 335.1 L 398.1 334.1 L 398.7 339.3 L 408.3 340.5 L 411.1 343.5 L 412.6 339.9 L 417.4 340.1 L 423.8 343.6 L 426.7 354.0 L 430.7 354.7 L 430.5 357.6 L 434.4 360.3 L 427.3 359.9 L 426.6 362.3 L 423.5 362.9 L 423.5 364.5 L 429.2 366.3 L 428.9 369.3 L 425.8 369.5 L 425.6 370.9 L 429.1 375.4 L 436.8 378.1 L 439.0 381.6 L 436.0 382.8 L 432.6 381.2 L 431.6 383.2 L 427.6 381.8 L 422.1 388.5 L 411.4 394.4 L 411.8 401.8 L 415.8 407.6 L 412.6 410.5 L 413.9 413.6 L 408.3 424.0 L 403.0 425.0 L 397.1 419.3 L 399.2 415.3 L 398.0 413.2 L 398.1 409.2 L 400.0 409.2 L 399.2 407.1 L 392.2 405.6 L 391.7 408.2 L 389.2 407.8 L 388.2 404.0 L 386.6 404.9 L 387.1 402.9 L 382.1 402.7 L 380.8 398.5 L 374.5 397.3 L 373.7 394.2 L 372.0 397.0 L 367.4 394.8 L 366.2 400.3 L 364.5 401.3 L 363.3 399.9 L 357.5 400.1 L 359.1 394.2 L 358.0 396.2 L 355.3 395.5 L 356.9 397.3 L 354.7 397.5 L 353.0 395.1 L 353.3 397.1 L 350.5 396.4 L 350.9 397.7 L 346.3 398.2 L 349.4 394.7 L 345.8 388.7 L 337.1 393.1 L 337.3 396.4 L 331.1 394.6 L 329.5 396.8 L 327.6 396.1 L 329.5 392.4 L 326.6 392.5 L 325.4 390.8 L 325.5 395.6 L 321.8 396.2 L 320.9 394.2 L 319.6 395.4 L 319.2 392.2 L 319.0 394.2 L 316.4 394.9 L 318.1 390.5 L 316.5 390.7 L 315.7 393.4 L 314.5 391.8 L 316.4 389.6 L 318.6 389.9 L 317.0 388.2 L 317.6 385.6 L 315.4 386.8 L 315.6 388.6 L 313.4 387.0 L 315.1 388.6 L 314.1 390.3 L 311.7 388.3 L 306.9 392.0 L 309.9 392.7 L 311.0 399.6 L 314.4 403.1 L 313.8 408.0 L 316.6 407.2 L 318.4 413.9 L 314.7 418.0 L 308.6 413.0 L 306.5 415.7 L 305.1 415.0 L 301.3 402.1 L 304.8 398.8 L 304.8 396.7 L 307.2 395.7 L 304.1 389.9 L 306.9 385.5 L 314.9 384.0 L 313.7 381.1 L 315.1 379.2 L 316.1 379.9 L 319.2 373.2 L 317.9 371.9 L 321.8 367.7 L 321.8 364.6 L 318.7 361.5 L 318.9 358.9 L 313.0 356.1 L 309.8 357.2 L 305.3 354.4 L 302.3 355.3 L 302.4 352.5 L 298.3 354.7 L 292.5 352.9 L 285.6 356.9 L 285.5 354.5 L 292.6 350.8 L 287.5 349.7 L 290.8 346.6 L 289.6 343.2 L 285.7 341.8 L 283.1 336.7 L 282.4 332.0 L 287.9 328.6 L 286.5 325.3 L 288.0 321.4 L 286.5 320.9 L 286.6 317.4 L 282.8 313.8 L 283.4 310.0 L 280.6 307.9 L 278.3 288.5 L 280.5 280.6 L 285.3 276.0 L 289.0 268.6 Z",
    "centroid": {
      "lng": 80.59,
      "lat": 26.92,
      "x": 353,
      "y": 353
    }
  },
  {
    "name": "Uttaranchal",
    "stateCode": "UT",
    "path": "M 323.2 245.2 L 327.9 253.0 L 331.6 255.4 L 337.3 254.5 L 342.6 259.4 L 345.1 259.8 L 345.0 264.4 L 351.6 267.5 L 352.8 266.7 L 362.1 272.4 L 348.3 284.8 L 349.1 288.6 L 345.6 292.3 L 346.7 298.1 L 343.5 300.6 L 340.1 310.0 L 337.3 306.9 L 335.8 307.9 L 335.6 305.8 L 327.8 306.6 L 326.7 303.9 L 322.5 302.6 L 321.9 300.0 L 317.0 299.5 L 315.9 296.8 L 313.0 295.4 L 317.4 292.0 L 310.7 289.4 L 307.9 284.8 L 304.9 283.7 L 297.5 289.8 L 296.8 285.9 L 293.4 286.5 L 291.4 281.8 L 296.3 272.6 L 288.5 268.4 L 293.8 265.5 L 291.2 259.7 L 295.4 250.1 L 305.4 246.7 L 307.8 248.9 L 314.7 248.9 L 317.9 251.3 L 319.0 251.0 L 317.4 245.9 L 320.0 242.3 L 323.2 245.2 Z",
    "centroid": {
      "lng": 79.2,
      "lat": 30.16,
      "x": 323,
      "y": 275
    }
  },
  {
    "name": "West Bengal",
    "stateCode": "WE",
    "path": "M 521.3 477.6 L 522.0 478.9 L 521.3 477.6 Z M 528.5 477.4 L 530.0 478.6 L 528.5 477.4 Z M 526.2 476.7 L 526.4 478.2 L 526.2 476.7 Z M 522.2 476.7 L 522.4 478.4 L 522.2 476.7 Z M 527.2 476.4 L 526.7 478.1 L 527.2 476.4 Z M 523.0 475.5 L 523.3 477.2 L 523.0 475.5 Z M 531.7 475.2 L 532.6 477.5 L 531.7 475.2 Z M 527.9 475.2 L 526.3 475.7 L 527.9 475.2 Z M 517.3 475.2 L 517.4 477.4 L 517.3 475.2 Z M 520.4 475.1 L 520.1 477.3 L 520.4 475.1 Z M 525.6 475.0 L 526.7 476.5 L 525.6 475.0 Z M 515.1 474.8 L 515.2 477.6 L 515.1 474.8 Z M 533.3 474.8 L 533.1 477.2 L 533.3 474.8 Z M 531.5 474.7 L 532.2 476.4 L 531.5 474.7 Z M 522.3 474.5 L 522.4 476.8 L 522.3 474.5 Z M 529.5 474.3 L 530.3 476.9 L 529.5 474.3 Z M 519.5 474.6 L 519.2 477.7 L 519.5 474.6 Z M 515.4 473.9 L 517.4 476.0 L 516.6 478.5 L 515.4 473.9 Z M 530.5 473.9 L 531.7 475.2 L 530.5 473.9 Z M 518.5 473.8 L 518.4 475.6 L 518.5 473.8 Z M 532.1 473.8 L 533.3 474.7 L 532.1 473.8 Z M 528.4 473.8 L 528.7 477.1 L 527.0 475.3 L 528.4 473.8 Z M 523.1 473.5 L 523.3 474.9 L 523.1 473.5 Z M 517.2 474.7 L 516.9 473.5 L 517.2 474.7 Z M 532.0 473.3 L 532.1 474.9 L 532.0 473.3 Z M 523.7 473.2 L 523.7 475.1 L 523.7 473.2 Z M 520.5 473.3 L 519.9 475.2 L 520.5 473.3 Z M 526.0 472.8 L 526.7 476.3 L 526.0 472.8 Z M 522.3 472.8 L 521.8 474.9 L 522.3 472.8 Z M 519.7 472.8 L 519.7 474.9 L 519.7 472.8 Z M 532.0 472.7 L 532.5 474.0 L 532.0 472.7 Z M 528.4 472.9 L 527.6 474.2 L 528.4 472.9 Z M 527.5 474.3 L 527.4 472.4 L 527.5 474.3 Z M 530.2 472.4 L 529.8 474.1 L 530.2 472.4 Z M 530.8 471.9 L 530.2 474.0 L 530.8 471.9 Z M 523.3 471.9 L 523.8 473.1 L 523.3 471.9 Z M 517.8 471.6 L 518.8 473.3 L 517.5 475.1 L 516.3 472.9 L 517.8 471.6 Z M 529.0 471.5 L 530.2 474.7 L 528.5 473.4 L 529.0 471.5 Z M 513.6 471.3 L 513.0 477.0 L 511.5 475.9 L 513.6 471.3 Z M 527.5 471.2 L 527.7 473.2 L 527.5 471.2 Z M 531.6 470.9 L 532.7 472.2 L 531.4 473.6 L 531.6 470.9 Z M 524.0 470.8 L 524.3 473.4 L 524.0 470.8 Z M 522.7 470.8 L 522.5 472.6 L 522.7 470.8 Z M 520.2 470.6 L 520.5 473.2 L 519.1 472.3 L 520.2 470.6 Z M 526.0 470.6 L 526.9 473.4 L 526.0 470.6 Z M 524.4 470.2 L 524.2 471.4 L 524.4 470.2 Z M 528.5 470.3 L 531.5 471.5 L 529.6 472.7 L 528.5 470.3 Z M 526.1 470.0 L 527.9 471.1 L 526.1 470.0 Z M 526.6 468.9 L 527.7 470.1 L 526.6 468.9 Z M 524.8 468.0 L 525.2 469.7 L 524.8 468.0 Z M 513.7 467.8 L 511.7 470.5 L 513.7 467.8 Z M 528.0 468.0 L 530.0 468.2 L 530.0 470.1 L 526.7 469.4 L 528.0 468.0 Z M 532.4 467.3 L 533.7 468.7 L 532.7 470.1 L 531.3 468.1 L 532.4 467.3 Z M 529.3 466.6 L 528.6 467.9 L 529.3 466.6 Z M 527.8 466.5 L 526.7 467.1 L 527.8 466.5 Z M 528.1 465.6 L 529.2 466.5 L 528.1 465.6 Z M 529.1 464.6 L 530.2 466.4 L 528.4 465.5 L 529.1 464.6 Z M 531.0 464.1 L 530.4 467.9 L 531.2 467.1 L 532.3 470.7 L 530.2 468.6 L 529.8 464.5 L 531.0 464.1 Z M 532.1 463.8 L 533.1 465.4 L 531.5 467.5 L 532.1 463.8 Z M 525.5 463.6 L 527.5 464.5 L 525.3 466.6 L 526.1 468.3 L 524.2 466.0 L 525.5 463.6 Z M 528.7 464.1 L 525.8 467.0 L 528.7 464.1 Z M 530.6 463.3 L 530.6 464.4 L 530.6 463.3 Z M 528.0 461.9 L 528.5 464.6 L 526.6 463.9 L 528.0 461.9 Z M 528.8 460.1 L 530.7 461.5 L 530.2 463.4 L 528.7 461.8 L 530.3 464.6 L 529.4 462.6 L 529.5 463.8 L 527.8 463.2 L 528.8 460.1 Z M 531.7 459.6 L 533.3 465.5 L 530.9 462.6 L 531.7 459.6 Z M 529.1 459.3 L 529.9 460.7 L 529.1 459.3 Z M 527.4 456.9 L 528.5 458.4 L 527.4 456.9 Z M 529.8 455.8 L 529.8 460.0 L 528.7 456.8 L 529.8 455.8 Z M 530.3 455.4 L 532.0 458.5 L 530.8 461.3 L 530.3 455.4 Z M 513.4 348.4 L 519.9 349.4 L 523.3 346.7 L 527.8 348.1 L 529.2 348.8 L 529.4 352.5 L 530.3 351.5 L 532.5 352.8 L 534.8 356.0 L 540.0 354.6 L 545.7 356.6 L 545.5 358.1 L 550.3 358.4 L 550.5 364.5 L 547.3 368.0 L 547.6 371.1 L 545.6 369.8 L 544.7 372.8 L 545.9 373.7 L 543.8 376.0 L 535.6 372.0 L 534.0 365.7 L 531.3 364.2 L 530.3 366.4 L 533.5 369.1 L 529.6 368.2 L 528.8 369.6 L 523.9 364.0 L 520.0 362.2 L 519.6 360.1 L 518.8 361.1 L 517.8 363.8 L 521.0 364.2 L 521.9 366.6 L 514.6 371.7 L 513.2 380.0 L 516.5 379.7 L 522.3 386.8 L 528.0 386.5 L 528.7 390.2 L 532.3 391.9 L 530.4 394.8 L 520.2 394.1 L 519.3 400.0 L 517.6 401.9 L 515.6 399.7 L 513.7 400.3 L 514.5 402.0 L 510.9 406.6 L 517.8 413.2 L 526.4 415.7 L 525.5 419.5 L 527.1 422.5 L 523.0 425.4 L 522.7 430.5 L 527.7 433.9 L 526.1 439.5 L 531.9 440.5 L 528.8 445.3 L 531.3 449.0 L 530.9 453.2 L 527.9 451.5 L 531.1 454.4 L 528.9 458.5 L 525.1 454.8 L 529.4 460.3 L 526.3 463.9 L 524.2 463.5 L 524.9 460.6 L 523.9 465.9 L 522.9 464.1 L 523.6 470.4 L 522.4 469.0 L 522.9 470.6 L 521.2 471.2 L 522.5 467.6 L 520.8 470.8 L 520.5 468.2 L 519.4 471.1 L 518.7 469.1 L 519.0 473.0 L 518.2 470.1 L 518.3 471.7 L 516.2 471.4 L 517.4 471.9 L 516.5 474.6 L 514.2 471.2 L 515.0 464.6 L 512.2 463.6 L 513.0 461.4 L 511.8 463.4 L 510.4 462.8 L 508.2 458.3 L 509.4 462.4 L 514.7 466.1 L 512.0 468.1 L 509.9 466.0 L 511.9 468.2 L 509.2 473.0 L 499.7 477.4 L 498.9 473.9 L 495.0 472.7 L 494.4 469.5 L 490.1 471.5 L 489.8 467.5 L 483.4 465.1 L 487.0 461.7 L 484.4 458.6 L 484.3 455.3 L 482.0 455.2 L 481.3 452.9 L 477.0 450.5 L 477.4 447.1 L 479.6 445.7 L 472.5 445.5 L 468.9 442.1 L 466.3 442.4 L 464.4 439.3 L 465.3 434.5 L 469.1 433.9 L 468.9 431.9 L 474.5 435.6 L 477.5 430.8 L 485.0 429.4 L 485.0 426.1 L 486.9 426.5 L 487.2 425.0 L 492.1 426.9 L 492.2 425.3 L 494.6 426.2 L 495.7 424.5 L 494.5 421.2 L 499.2 422.6 L 499.9 419.5 L 504.2 418.6 L 503.0 416.5 L 506.7 412.7 L 505.8 408.6 L 508.8 408.3 L 508.6 405.3 L 506.8 404.3 L 510.2 401.2 L 505.9 396.4 L 507.7 392.2 L 505.6 389.1 L 509.1 386.1 L 512.3 386.9 L 511.8 382.5 L 506.5 377.0 L 507.4 374.1 L 516.9 366.8 L 514.5 363.5 L 515.6 362.1 L 513.0 362.4 L 514.8 356.8 L 513.7 351.7 L 510.6 348.9 L 511.1 346.1 L 513.4 348.4 Z",
    "centroid": {
      "lng": 87.97,
      "lat": 23.8,
      "x": 510,
      "y": 427
    }
  }
];
