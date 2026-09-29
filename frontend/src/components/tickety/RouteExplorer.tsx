import { useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cityLabel, dateLabel, defaultDate, fareUrl, levelName, useApi, validDate, type Catalog, type Fare, type Resource, type RouteInfo } from './data';
import { PriceLevel, RouteCard, RouteHeading, State } from './FareComponents';

function UnavailableRouteCard({ route, onExplore }: { route: RouteInfo; onExplore: () => void }) {
  return <button className="tk-route-card" onClick={onExplore}>
    <span className="tk-route-card-top"><RouteHeading route={route.route_id} /><ArrowRight className="tk-route-card-arrow" size={18} /></span>
    <span className="tk-route-card-bottom"><strong className="tk-route-fare-unavailable">Fare unavailable</strong><PriceLevel value={null} /></span>
    <span className="tk-route-card-caption">Open route calendar and travel context</span>
  </button>;
}

export function RouteExplorer({ catalog, initialDate = '', compact = false }: { catalog: Resource<Catalog>; initialDate?: string; compact?: boolean }) {
  const navigate = useNavigate();
  const [date, setDate] = useState(validDate(initialDate) ? initialDate : defaultDate);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [page, setPage] = useState(0);
  const data = useApi<{ fares: Fare[] }>(compact
    ? validDate(date) ? `/fares/compare?departure_date=${encodeURIComponent(date)}` : null
    : '/fares/latest');
  const routes = catalog.data?.routes ?? [];
  const fareByRoute = new Map((data.data?.fares ?? []).map(fare => [fare.route_id, fare]));
  const items = compact
    ? (data.data?.fares ?? []).map(fare => ({ fare, route: routes.find(route => route.route_id === fare.route_id) }))
    : routes.map(route => ({ route, fare: fareByRoute.get(route.route_id) ?? null }));
  const filtered = items.filter(({ fare, route }) => {
    const searchText = `${route?.route_id ?? fare?.route_id ?? ''} ${route?.origin ?? ''} ${route?.destination ?? ''} ${fare?.airline ?? ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase()) && (level === 'all' || levelName(fare?.price_level ?? null) === level);
  });
  if (compact) filtered.sort((a, b) => (a.fare?.fare ?? Infinity) - (b.fare?.fare ?? Infinity));
  const pageSize = compact ? 6 : Math.max(filtered.length, 1);
  const pageCount = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <section className="tk-section tk-explorer" id="explore-routes">
    <div className="tk-section-heading"><div><p className="tk-kicker">Explore India</p><h2>{compact ? 'Different routes. The same clarity.' : 'A country of connections.'}</h2><p>Domestic airfare, with the context that matters.</p></div>
      {compact && <Link className="tk-text-button" to={`/explore?date=${date}`}>Explore all routes <ArrowRight size={16} /></Link>}
    </div>
    <div className={`tk-explore-controls ${compact ? 'tk-explore-compact' : ''}`}>
      {!compact && <><label className="tk-explore-query"><span>Search routes</span><div><Search size={17} /><input aria-label="Search routes" type="search" value={query} placeholder="City, route or airline" onChange={e => { setQuery(e.target.value); setPage(0); }} /></div></label>
        <label><span>Price level</span><select aria-label="Price level" value={level} onChange={e => { setLevel(e.target.value); setPage(0); }}><option value="all">All price levels</option>{['low', 'typical', 'high', 'unavailable'].map(value => <option key={value} value={value}>{cityLabel(value)}</option>)}</select></label></>}
      {compact && <label><span>Departure date</span><input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(0); }} /></label>}
      {compact && <p>Latest stored fares for {dateLabel(date)}.<br />One way · Economy · Lowest fares first</p>}
    </div>
    {!compact && catalog.error && <p className="tk-chart-note">Routes are unavailable. <button className="tk-text-button" onClick={catalog.retry}>Reload routes</button></p>}
    {data.loading || catalog.loading ? <div className="tk-route-loading" role="status"><span className="tk-loading-dot" /> Finding observed fares across India…</div>
      : data.error ? <State error title="Route intelligence is temporarily unavailable." detail="Your search is saved. Try loading the observations again." retry={data.retry} />
      : !filtered.length ? <State title="No routes match those filters." detail="Try a different route search or price level." />
      : <><div className="tk-route-grid">{visible.map(({ fare, route }) => fare
          ? <RouteCard key={fare.id} fare={fare} onExplore={() => navigate(fareUrl(fare.route_id, compact ? date : fare.travel_date))} />
          : route ? <UnavailableRouteCard key={route.route_id} route={route} onExplore={() => navigate(fareUrl(route.route_id, defaultDate()))} /> : null)}</div>
        {!compact && <p className="tk-route-count">Showing all {filtered.length} routes</p>}
        <p className="tk-fine-print">Collection times can differ across routes. Open a route to see its price context and timestamp.</p></>}
  </section>;
}
