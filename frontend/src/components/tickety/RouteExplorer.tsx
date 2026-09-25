import { useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cityLabel, dateLabel, defaultDate, fareUrl, levelName, useApi, validDate, type Catalog, type Fare, type Resource } from './data';
import { RouteCard, State } from './FareComponents';

export function RouteExplorer({ catalog, initialDate = '', compact = false }: { catalog: Resource<Catalog>; initialDate?: string; compact?: boolean }) {
  const navigate = useNavigate();
  const [date, setDate] = useState(validDate(initialDate) ? initialDate : defaultDate);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('all');
  const [level, setLevel] = useState('all');
  const [page, setPage] = useState(0);
  const data = useApi<{ fares: Fare[] }>(validDate(date) ? `/fares/compare?departure_date=${encodeURIComponent(date)}` : null);
  const routes = catalog.data?.routes ?? [];
  const cities = [...new Set(routes.flatMap(r => [r.origin, r.destination]))].sort();
  const filtered = (data.data?.fares ?? []).filter(fare => {
    const metadata = routes.find(route => route.route_id === fare.route_id);
    const cityMatch = city === 'all' || metadata?.origin === city || metadata?.destination === city;
    const searchText = `${fare.route_id} ${metadata?.origin ?? ''} ${metadata?.destination ?? ''} ${fare.airline}`.toLowerCase();
    return cityMatch && searchText.includes(query.toLowerCase()) && (level === 'all' || levelName(fare.price_level) === level);
  }).sort((a, b) => (a.fare ?? Infinity) - (b.fare ?? Infinity));
  const pageSize = compact ? 6 : 12;
  const pageCount = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <section className="tk-section tk-explorer" id="explore-routes">
    <div className="tk-section-heading"><div><p className="tk-kicker">Explore India</p><h2>{compact ? 'Different routes. The same clarity.' : 'A country of connections.'}</h2><p>Domestic airfare, with the context that matters.</p></div>
      {compact && <Link className="tk-text-button" to={`/explore?date=${date}`}>Explore all routes <ArrowRight size={16} /></Link>}
    </div>
    <div className={`tk-explore-controls ${compact ? 'tk-explore-compact' : ''}`}>
      {!compact && <><label className="tk-explore-query"><span>Search routes</span><div><Search size={17} /><input aria-label="Search routes" type="search" value={query} placeholder="City, route or airline" onChange={e => { setQuery(e.target.value); setPage(0); }} /></div></label>
        <label><span>City</span><select aria-label="City" value={city} onChange={e => { setCity(e.target.value); setPage(0); }} disabled={catalog.loading || catalog.error}><option value="all">All cities</option>{cities.map(value => <option key={value} value={value}>{cityLabel(value)}</option>)}</select></label>
        <label><span>Price level</span><select aria-label="Price level" value={level} onChange={e => { setLevel(e.target.value); setPage(0); }}><option value="all">All price levels</option>{['low', 'typical', 'high', 'unavailable'].map(value => <option key={value} value={value}>{cityLabel(value)}</option>)}</select></label></>}
      <label><span>Departure date</span><input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(0); }} /></label>
      {compact && <p>Latest stored fares for {dateLabel(date)}.<br />One way · Economy · Lowest fares first</p>}
    </div>
    {!compact && catalog.error && <p className="tk-chart-note">City filters are unavailable. <button className="tk-text-button" onClick={catalog.retry}>Reload cities</button></p>}
    {!validDate(date) ? <State title="Choose a departure date to explore fares." />
      : data.loading ? <div className="tk-route-loading" role="status"><span className="tk-loading-dot" /> Finding observed fares across India…</div>
      : data.error ? <State error title="Route intelligence is temporarily unavailable." detail="Your search is saved. Try loading the observations again." retry={data.retry} />
      : !filtered.length ? <State title={data.data?.fares.length ? 'No routes match those filters.' : 'No airfare observations yet.'} detail={data.data?.fares.length ? 'Try a different city or price level.' : 'There are no stored fares for this departure date. Choose another date to explore.'} />
      : <><div className="tk-route-grid">{visible.map(fare => <RouteCard key={fare.id} fare={fare} onExplore={() => navigate(fareUrl(fare.route_id, date))} />)}</div>
        {!compact && <div className="tk-pagination"><p>{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)} of {filtered.length} observed routes</p><div><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next <ArrowRight size={15} /></button></div></div>}
        <p className="tk-fine-print">Collection times can differ across routes. Open a route to see its price context and timestamp.</p></>}
  </section>;
}
