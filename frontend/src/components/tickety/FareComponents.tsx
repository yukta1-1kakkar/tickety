import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, CircleCheck, Plane, RefreshCw } from 'lucide-react';
import {
  collectedLabel, dateLabel, durationLabel, levelName, money, priceEvidence,
  routeParts, stopsLabel, timeLabel, type Fare,
} from './data';

export function PriceLevel({ value }: { value: string | null }) {
  const level = levelName(value);
  return <span className={`tk-level tk-level-${level}`}><span aria-hidden="true" />{level === 'unavailable' ? 'Price level unavailable' : level}</span>;
}

export function RouteHeading({ route }: { route: string }) {
  const [origin, destination] = routeParts(route);
  return <span className="tk-route-name"><span>{origin}</span><ArrowRight aria-hidden="true" /><span>{destination || 'Unavailable'}</span></span>;
}

export function FareCard({ fare }: { fare: Fare }) {
  return <section className="tk-fare-card" aria-label="Your fare">
    <p className="tk-kicker">Your fare picture</p>
    <h1><RouteHeading route={fare.route_id} /></h1>
    <p className="tk-trip-meta">{dateLabel(fare.travel_date)} <span>·</span> One way <span>·</span> Economy</p>
    <div className="tk-price-block"><p className="tk-label">Current fare</p><p className="tk-big-fare">{money(fare.fare)}</p><PriceLevel value={fare.price_level} /></div>
    <p className="tk-fare-caption">Total fare for one adult · Lowest itinerary in the latest stored search</p>
    <p className="tk-evidence"><ArrowDownRight size={19} aria-hidden="true" />{priceEvidence(fare)}</p>
    <p className="tk-source-note">Collected {collectedLabel(fare)}. Prices may have changed since this observation.</p>
  </section>;
}

export function PriceContext({ fare }: { fare: Fare }) {
  const level = levelName(fare.price_level);
  const rangeAvailable = fare.typical_price_low != null && fare.typical_price_high != null && fare.typical_price_low <= fare.typical_price_high;
  return <aside className="tk-price-context" aria-label="Price context">
    <div className="tk-context-title"><CircleCheck size={19} /><h2>Price context</h2></div>
    <p>A little perspective on the price you’re looking at.</p>
    <dl><div><dt>Your fare</dt><dd>{money(fare.fare)}</dd></div><div><dt>Typical range</dt><dd>{rangeAvailable ? `${money(fare.typical_price_low)} – ${money(fare.typical_price_high)}` : 'Unavailable'}</dd></div><div><dt>Lowest observed</dt><dd>{money(fare.lowest_price)}</dd></div></dl>
    <p className="tk-context-reading">{level === 'unavailable' ? 'Price insight unavailable.' : <>Google Flights classifies this search as <strong>{level}</strong>.</>}</p>
    <p className="tk-fine-print">Google’s classification describes the route search, not each individual flight. This is price context, not a prediction or a booking recommendation.</p>
  </aside>;
}

export function FlightCard({ fare }: { fare: Fare }) {
  return <article className="tk-flight-card" aria-label={`${fare.airline} ${fare.flight_number || ''}`}>
    <div className="tk-airline"><span className="tk-airline-symbol"><Plane size={19} /></span><div><h3>{fare.airline || 'Airline unavailable'}</h3><p>{fare.flight_number || 'Flight number unavailable'} · {fare.cabin || 'Cabin unavailable'}</p></div></div>
    <div className="tk-flight-times"><strong>{timeLabel(fare.departure_time)}</strong><span className="tk-flight-line"><span /><ArrowRight size={14} /></span><strong>{timeLabel(fare.arrival_time)}</strong><small>Local airport time · IST</small></div>
    <div className="tk-flight-duration"><strong>{durationLabel(fare.duration_minutes)}</strong><span>{stopsLabel(fare.stops)}</span></div>
    <div className="tk-flight-price"><strong>{money(fare.fare)}</strong><span>Total fare</span></div>
  </article>;
}

export function FlightComparison({ flights }: { flights: Fare[] }) {
  const [sort, setSort] = useState('price');
  const [limit, setLimit] = useState(6);
  const rows = [...flights].sort((a, b) => sort === 'duration' ? (a.duration_minutes ?? Infinity) - (b.duration_minutes ?? Infinity)
    : sort === 'stops' ? (a.stops ?? Infinity) - (b.stops ?? Infinity) : (a.fare ?? Infinity) - (b.fare ?? Infinity));
  return <section className="tk-section" id="flights">
    <div className="tk-section-heading"><div><p className="tk-kicker">Explore this route</p><h2>Different flights. More context.</h2><p>{flights.length} observed itineraries · {[...new Set(flights.map(f => f.airline))].length} airlines in the latest stored search</p></div>
      <label className="tk-sort">Sort flights<select value={sort} onChange={e => setSort(e.target.value)}><option value="price">Price</option><option value="duration">Duration</option><option value="stops">Stops</option></select></label>
    </div>
    {rows.length ? <div className="tk-flight-list">{rows.slice(0, limit).map(fare => <FlightCard key={fare.id} fare={fare} />)}</div> : <State title="No flight details available." detail="The fare may still have route-level price insights above." />}
    {rows.length > limit && <button className="tk-text-button" onClick={() => setLimit(value => value + 6)}>Show more flights <ArrowRight size={16} /></button>}
    <p className="tk-fine-print">Observed prices for comparison. Tickety does not sell tickets or make reservations.</p>
  </section>;
}

export function RouteCard({ fare, onExplore }: { fare: Fare; onExplore: () => void }) {
  return <button className="tk-route-card" onClick={onExplore}>
    <span className="tk-route-card-top"><RouteHeading route={fare.route_id} /><ArrowRight className="tk-route-card-arrow" size={18} /></span>
    <span className="tk-route-card-bottom"><strong>{money(fare.fare)}</strong><PriceLevel value={fare.price_level} /></span>
    <span className="tk-route-card-caption">{fare.airline} · {stopsLabel(fare.stops)}</span>
    <span className="tk-route-card-caption">Collected {collectedLabel(fare)}</span>
  </button>;
}

export function State({ title, detail, retry, error = false, children }: { title: string; detail?: string; retry?: () => void; error?: boolean; children?: ReactNode }) {
  return <div className={`tk-state ${error ? 'tk-state-error' : ''}`} role={error ? 'alert' : 'status'}><span className="tk-state-mark" aria-hidden="true"><Plane size={22} /></span><h3>{title}</h3>{detail && <p>{detail}</p>}{retry && <button className="tk-text-button" onClick={retry}><RefreshCw size={15} /> Try again</button>}{children}</div>;
}

export function SearchProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const first = window.setTimeout(() => setStep(1), 1800);
    const second = window.setTimeout(() => setStep(2), 4200);
    return () => { window.clearTimeout(first); window.clearTimeout(second); };
  }, []);
  return <div className="tk-search-progress" role="status" aria-live="polite"><div className="tk-progress-line"><Plane size={20} /></div><h1>{['Checking airfare intelligence…', 'Comparing price context…', 'Building your fare picture…'][step]}</h1><p>Finding the latest stored observations for your route.</p></div>;
}
