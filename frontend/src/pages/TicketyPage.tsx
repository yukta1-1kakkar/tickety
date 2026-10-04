import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChartNoAxesCombined, Layers3, Menu, Plane, X } from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { FareCard, FlightComparison, FlightJourneyVisual, PriceContext, SearchProgress, State } from '../components/tickety/FareComponents';
import { FarePressureCalendar } from '../components/tickety/FarePressureCalendar';
import { FareSearch } from '../components/tickety/FareSearch';
import { LeadTimeElasticityChart, NetworkLeadTimeTrend } from '../components/tickety/LeadTimeChart';
import { RouteExplorer } from '../components/tickety/RouteExplorer';
import { timestampLabel, useApi, useRouteCatalog, validDate, type Catalog, type Coverage, type Intelligence, type Resource } from '../components/tickety/data';
import './TicketyPage.css';

type TicketyContext = { catalog: Resource<Catalog> };

function TicketyMark() {
  return <span className="tk-brand"><span className="tk-brand-mark" aria-hidden="true"><img src="/tickety-plane.svg" width="36" height="36" alt="" /></span>tickety<span className="tk-brand-period">.</span></span>;
}

function ConsumerNav() {
  const [open, setOpen] = useState(false);
  return <header className="tk-nav"><div className="tk-nav-inner"><Link to="/" aria-label="Tickety home"><TicketyMark /></Link>
    <nav className={open ? 'tk-nav-links is-open' : 'tk-nav-links'} aria-label="Main navigation"><NavLink to="/" end>Check Fare</NavLink><NavLink to="/explore">Explore Routes</NavLink><NavLink to="/trends">Price Trends</NavLink></nav>
    <button className="tk-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open}>{open ? <X size={21} /> : <Menu size={21} />}</button>
  </div></header>;
}

export function TicketyLayout() {
  const catalog = useRouteCatalog();
  const location = useLocation();
  useEffect(() => { document.title = 'Tickety – Know your fare before you book.'; }, []);
  return <div className="tickety"><a className="tk-skip" href="#main-content">Skip to content</a><ConsumerNav key={location.pathname} />
    <main id="main-content"><Outlet context={{ catalog } satisfies TicketyContext} /></main>
    <section className="tk-engine"><div className="tk-container tk-engine-inner"><div><p className="tk-kicker">Powered by VayuSetu</p><h2>Want to see<br />the bigger picture?</h2><p>Tickety helps you understand your fare.<br />VayuSetu helps policymakers understand India’s airfare.</p></div>
      <div className="tk-engine-index" aria-label="VayuSetu intelligence capabilities"><span><ChartNoAxesCombined size={18} /> Airfare index & historical trends</span><span><Layers3 size={18} /> Route analytics & sector heatmaps</span><span><Plane size={18} /> Lead-time analysis & data coverage</span><p>The intelligence engine behind your fare picture.</p></div>
    </div></section>
    <footer className="tk-footer tk-container"><Link to="/" aria-label="Tickety home"><TicketyMark /></Link><p>Know your fare before you book.</p><span>Google Flights data via SerpAPI</span></footer>
  </div>;
}

function CoverageStrip() {
  const resource = useApi<Coverage>('/fares/coverage');
  if (resource.loading) return <p className="tk-coverage-status" role="status">Checking data coverage…</p>;
  if (resource.error) return <p className="tk-coverage-status">Data coverage unavailable. <button onClick={resource.retry}>Retry</button></p>;
  const data = resource.data;
  if (!data) return null;
  return <div className="tk-coverage"><p>Tracking domestic airfare across<br /><strong>India’s major city pairs.</strong></p><dl><div><dt>Routes in the network</dt><dd>{data.registeredRoutes.toLocaleString('en-IN')}</dd></div><div><dt>Routes with fare data</dt><dd>{data.observedRoutes.toLocaleString('en-IN')}</dd></div><div><dt>Booking windows observed</dt><dd>{data.observedWindows.length}</dd></div></dl><p className="tk-coverage-time">Last observation<br /><span>{data.updatedAt ? timestampLabel(data.updatedAt) : 'No observations yet'}</span></p></div>;
}

export function TicketyHome() {
  const { catalog } = useOutletContext<TicketyContext>();
  return <><section className="tk-hero tk-container"><div className="tk-hero-path" aria-hidden="true"><span /><i /><span /></div><p className="tk-kicker">Airfare intelligence, made personal</p><h1>Is this a <em>good fare?</em></h1><p className="tk-hero-copy">Check the price. Understand the trend. Book with context.</p><FareSearch catalog={catalog} />
    <div className="tk-hero-footnote"><span className="tk-status-dot" /> Price context, powered by Google Flights data via SerpAPI</div>
  </section>
  <div className="tk-container"><section className="tk-how"><div><p className="tk-kicker">A price is just the beginning</p><h2>Know what’s<br />behind the number.</h2></div><div className="tk-how-item"><span>01 / The price</span><h3>Low, typical or high?</h3><p>See where the fare sits against Google Flights’ typical range.</p></div><div className="tk-how-item"><span>02 / The timing</span><h3>A little more perspective.</h3><p>Explore how observed fares change across five booking windows.</p></div><div className="tk-how-item"><span>03 / The evidence</span><h3>Context. Not guesswork.</h3><p>Real observations, clear sources and collection timestamps.</p></div></section><FlightJourneyVisual /><CoverageStrip /></div></>;
}

export function TicketyExplore() {
  const { catalog } = useOutletContext<TicketyContext>();
  const [params] = useSearchParams();
  return <div className="tk-container tk-page tk-explore-page"><RouteExplorer key={params.toString()} catalog={catalog} initialDate={params.get('date') || ''} /><CoverageStrip /></div>;
}

export function TicketyTrends() {
  return <div className="tk-container tk-trends-page"><NetworkLeadTimeTrend /><LeadTimeElasticityChart /></div>;
}

function FareResult({ route, date }: { route: string; date: string }) {
  const { catalog } = useOutletContext<TicketyContext>();
  const [edit, setEdit] = useState(false);
  const location = useLocation();
  const resource = useApi<Intelligence>(`/fares?route_id=${encodeURIComponent(route)}&departure_date=${date}`);
  useEffect(() => {
    if (resource.data && location.hash === '#price-trends') document.getElementById('price-trends')?.scrollIntoView();
  }, [resource.data, location.hash]);
  return <div className="tk-container tk-result-page"><div className="tk-result-toolbar"><Link to="/"><ArrowLeft size={16} /> Check another fare</Link><button onClick={() => setEdit(!edit)} aria-expanded={edit}>{edit ? 'Close search' : 'Edit search'} <ArrowRight size={15} /></button></div>
    {edit && <FareSearch catalog={catalog} initialRoute={route} initialDate={date} />}
    {resource.loading ? <SearchProgress /> : resource.error ? <State error title="We couldn’t build your fare picture." detail="Your route and date are saved. Try again to retrieve the latest observations." retry={resource.retry} />
      : resource.data?.current ? <><div className="tk-result-top"><FareCard fare={resource.data.current} /><PriceContext fare={resource.data.current} /></div><p className="tk-data-credit">Google Flights via SerpAPI <span>·</span> Price intelligence by VayuSetu</p>
        <FarePressureCalendar departureDate={date} routeId={route} fare={resource.data.current} />
        <FlightComparison flights={resource.data.flights ?? []} />
      </> : !resource.loading && !resource.error ? <FarePressureCalendar departureDate={date} routeId={route} fare={null} /> : null}
    {!resource.loading && <FlightJourneyVisual />}
  </div>;
}

export function TicketyFare() {
  const [params] = useSearchParams();
  const route = params.get('route') || '';
  const date = params.get('date') || '';
  if (!route || route.length > 50 || !validDate(date)) return <div className="tk-container tk-page"><State title="Let’s start with your route." detail="Choose a route and a valid departure date to check a fare."><Link className="tk-button" to="/">Check a fare <ArrowRight size={16} /></Link></State></div>;
  return <FareResult key={params.toString()} route={route} date={date} />;
}

export function TicketyLegacyRedirect() {
  const [params] = useSearchParams();
  const location = useLocation();
  return <Navigate to={params.get('route') ? `/fare?${params.toString()}${location.hash}` : '/'} replace />;
}
