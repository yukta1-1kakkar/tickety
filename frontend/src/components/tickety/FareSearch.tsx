import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowRightLeft, CalendarDays, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cityLabel, defaultDate, fareUrl, validDate, type Catalog, type Resource } from './data';
import { State } from './FareComponents';

export function FareSearch({ catalog, initialRoute = '', initialDate = '', trends = false }: {
  catalog: Resource<Catalog>; initialRoute?: string; initialDate?: string; trends?: boolean;
}) {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(validDate(initialDate) ? initialDate : defaultDate);
  const routes = catalog.data?.routes ?? [];
  const preferred = routes.find(r => r.route_id === initialRoute)
    ?? routes.find(r => /^(DEL|DELHI|NEWDELHI)[-_](BOM|MUMBAI)$/.test(r.route_id)) ?? routes[0];
  const from = origin || preferred?.origin || '';
  const choices = routes.filter(r => r.origin === from);
  const to = choices.some(r => r.destination === destination) ? destination
    : (choices.find(r => r.destination === preferred?.destination) ?? choices[0])?.destination || '';
  const selected = choices.find(r => r.destination === to);
  const canSwap = routes.some(r => r.origin === to && r.destination === from);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selected && validDate(date)) navigate(fareUrl(selected.route_id, date) + (trends ? '#price-trends' : ''));
  };
  return <div className="tk-search-area" id="check-fare">
    <form className="tk-search" onSubmit={submit} aria-label="Check a fare">
      <label className="tk-search-field"><span><MapPin size={13} />From</span><select aria-label="From" value={from} disabled={!routes.length} onChange={e => { setOrigin(e.target.value); setDestination(''); }}>
        {!routes.length && <option>{catalog.loading ? 'Loading cities…' : 'No cities available'}</option>}
        {[...new Set(routes.map(r => r.origin))].sort().map(value => <option key={value} value={value}>{cityLabel(value)}</option>)}
      </select></label>
      <button className="tk-swap" type="button" title={canSwap ? 'Swap cities' : 'Reverse route not in the catalogue'} aria-label="Swap cities" disabled={!canSwap} onClick={() => { setOrigin(to); setDestination(from); }}><ArrowRightLeft size={16} /></button>
      <label className="tk-search-field"><span><MapPin size={13} />To</span><select aria-label="To" value={to} disabled={!choices.length} onChange={e => setDestination(e.target.value)}>
        {!choices.length && <option>{catalog.loading ? 'Loading cities…' : 'No cities available'}</option>}
        {[...new Set(choices.map(r => r.destination))].sort().map(value => <option key={value} value={value}>{cityLabel(value)}</option>)}
      </select></label>
      <label className="tk-search-field tk-date-field"><span><CalendarDays size={13} />Departure date</span><input aria-label="Departure date" type="date" value={date} required onChange={e => setDate(e.target.value)} /></label>
      <button className="tk-button" disabled={!selected || !validDate(date)} type="submit">Check Fare <ArrowRight size={18} /></button>
    </form>
    {catalog.error && <State error title="We couldn’t load the route catalogue." detail="Please try again in a moment." retry={catalog.retry} />}
    {!catalog.loading && !catalog.error && !routes.length && <State title="No routes available yet." detail="The search will be ready when domestic routes are added." />}
    <p className="tk-search-caption">One way. One adult. Economy. <span>A little more context before you book.</span></p>
  </div>;
}
