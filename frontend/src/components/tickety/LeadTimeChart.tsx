import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { daysUntil, money, type HistoryPoint, type LeadPoint } from './data';
import { State } from './FareComponents';

export function LeadTimeChart({ points, departureDate, observedWindow }: { points: LeadPoint[]; departureDate: string; observedWindow?: number }) {
  const days = daysUntil(departureDate);
  const available = points.filter(point => point.fare != null);
  return <section className="tk-section tk-lead-section" id="price-trends">
    <div className="tk-section-heading"><div><p className="tk-kicker">The timing behind the price</p><h2>How this route’s fares change.</h2><p>Five booking windows. A clearer view of the approach to departure.</p></div>
      <div className="tk-window-position"><span>{days >= 0 ? 'You are here' : 'Past departure'}</span><strong>{days >= 0 ? `${days} ${days === 1 ? 'day' : 'days'} before departure` : `${Math.abs(days)} days ago`}</strong></div>
    </div>
    <div className="tk-chart-surface"><div className="tk-chart-meta"><span>Fare (₹)</span><span>{available.length} of {points.length} windows observed</span></div>
      {available.length ? <div className="tk-lead-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 18, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#dce4e0" strokeDasharray="3 5" />
        <XAxis dataKey="days" axisLine={false} tickLine={false} tickMargin={12} tick={{ fill: '#63746f', fontSize: 12 }} />
        <YAxis width={65} axisLine={false} tickLine={false} tick={{ fill: '#63746f', fontSize: 11 }} tickFormatter={value => Number(value).toLocaleString('en-IN')} domain={[0, 'auto']} />
        <Tooltip contentStyle={{ border: '1px solid #dce4e0', borderRadius: 6, fontSize: 12 }} formatter={value => money(value == null ? null : Number(value))} labelFormatter={value => `${value} days before departure`} />
        <Line dataKey="fare" name="Lowest observed fare" type="linear" stroke="#1c6557" strokeWidth={2.5} connectNulls={false} isAnimationActive={false} dot={{ r: 5, fill: '#1c6557', stroke: '#fafbf8', strokeWidth: 3 }} activeDot={{ r: 7 }} />
      </LineChart></ResponsiveContainer></div> : <State title="No lead-time observations yet." detail="Available booking windows will appear here as observations are collected." />}
      <p className="tk-axis-title">Days before departure</p>
      <div className="tk-window-values">{points.map(point => <div key={point.days} className={days === point.days ? 'tk-window-current' : ''}><span>{point.days} days</span><strong>{money(point.fare)}</strong><small>{days === point.days ? 'You are here' : point.days === observedWindow ? 'Latest observed window' : point.fare == null ? 'Not observed' : `${point.count} observations`}</small></div>)}</div>
    </div>
    {available.length === 1 && <p className="tk-chart-note">Not enough lead-time observations to show a trend. The single available observation is shown.</p>}
    <p className="tk-chart-note">Lowest stored fare for this route and departure date in each window. Missing windows remain empty. Flights may differ between observations; this is not a prediction.{![60, 30, 15, 7, 1].includes(days) && days >= 0 ? ' Your current booking window falls between or outside the five collection windows.' : ''}</p>
  </section>;
}

export function PriceHistory({ points }: { points: HistoryPoint[] }) {
  return <details className="tk-history"><summary>See the daily price history <span>{points.length} observation dates</span></summary>
    {points.length < 2 ? <State title="Not enough observations for a daily price trend." /> : <div className="tk-history-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ right: 24, top: 24, left: 5, bottom: 12 }}>
      <CartesianGrid vertical={false} stroke="#dce4e0" /><XAxis dataKey="date" tickFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} tick={{ fontSize: 11 }} /><YAxis width={65} tick={{ fontSize: 11 }} tickFormatter={value => money(Number(value))} /><Tooltip formatter={value => money(Number(value))} /><Line dataKey="fare" name="Lowest observed fare" stroke="#1c6557" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
    </LineChart></ResponsiveContainer></div>}
    <p className="tk-chart-note">Daily route minima for the selected departure date. Individual flights may differ.</p>
  </details>;
}
