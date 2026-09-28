import type { RouteBasketItem } from '../types';
import routeConfig from '../../../config/routes.json';

export interface BasketAirport {
  code: string;
  city: string;
  lat: number;
  lng: number;
}

export const BASKET_AIRPORTS: readonly BasketAirport[] = [
  { code: 'DEL', city: 'Delhi', lat: 28.5562, lng: 77.1 },
  { code: 'BOM', city: 'Mumbai', lat: 19.0896, lng: 72.8656 },
  { code: 'BLR', city: 'Bengaluru', lat: 13.1986, lng: 77.7066 },
  { code: 'HYD', city: 'Hyderabad', lat: 17.2403, lng: 78.4294 },
  { code: 'CCU', city: 'Kolkata', lat: 22.6547, lng: 88.4467 },
  { code: 'PNQ', city: 'Pune', lat: 18.5822, lng: 73.9197 },
  { code: 'GOI', city: 'Goa', lat: 15.3808, lng: 73.8314 },
  { code: 'AMD', city: 'Ahmedabad', lat: 23.0772, lng: 72.6347 },
  { code: 'MAA', city: 'Chennai', lat: 12.9941, lng: 80.1709 },
  { code: 'SXR', city: 'Srinagar', lat: 33.9871, lng: 74.7743 },
  { code: 'GAU', city: 'Guwahati', lat: 26.1061, lng: 91.5859 },
  { code: 'PAT', city: 'Patna', lat: 25.5913, lng: 85.088 },
  { code: 'LKO', city: 'Lucknow', lat: 26.7606, lng: 80.8893 },
  { code: 'COK', city: 'Kochi', lat: 10.1556, lng: 76.3906 },
] as const;

const UPDATED_DATE = '27 Aug 2026';

const selectedWeight = routeConfig.routes.reduce((sum, route) => sum + route.weight, 0);

// Derived from the same config/routes.json consumed by the scraper and API.
export const INITIAL_ROUTE_BASKET: RouteBasketItem[] = routeConfig.routes.map((route, index) => ({
  id: `basket-${index + 1}`,
  route: route.displayId,
  originCode: route.originAirport.split(',')[0],
  destinationCode: route.destinationAirport.split(',')[0],
  originCity: route.origin.charAt(0) + route.origin.slice(1).toLowerCase(),
  destinationCity: route.destination.charAt(0) + route.destination.slice(1).toLowerCase(),
  weight: Number((route.weight / selectedWeight * 100).toFixed(2)),
  status: 'Active',
  lastUpdated: UPDATED_DATE,
}));
