import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { daysUntil, money, useApi, type FareHeatmap, type HeatmapCell, type HistoryPoint, type LeadPoint, type NetworkTrend } from './data';
import { State } from './FareComponents';

function heatClass(cell: HeatmapCell) {
  if (cell.fare == null || cell.changePercent == null) return 'tk-heat-empty';
  if (cell.changePercent < -5) return 'tk-heat-discount';
  if (cell.changePercent <= 5) return 'tk-heat-baseline';
  if (cell.changePercent <= 20) return 'tk-heat-elevated';
  return 'tk-heat-premium';
}

export function NetworkLeadTimeTrend() {
  const resource = useApi<FareHeatmap>('/fares/trends/heatmap');
  const routes = resource.data?.routes ?? [];
  return <section className="tk-section tk-lead-section tk-network-trend" aria-label="Route fare movement heatmap">
    <div className="tk-section-heading"><div><p className="tk-kicker">Price trends</p><h2>Fare movement by route and ticket window</h2></div></div>
    <div className="tk-heat-legend" aria-label="Fare movement versus T plus 60 baseline">
      <strong>Fare movement vs baseline</strong><span><i className="tk-heat-discount" /> Discounted <small>&lt; −5%</small></span><span><i className="tk-heat-baseline" /> Near baseline <small>−5% to +5%</small></span><span><i className="tk-heat-elevated" /> Elevated <small>+5% to +20%</small></span><span><i className="tk-heat-premium" /> High premium <small>&gt; +20%</small></span>
    </div>
    {resource.loading ? <div className="tk-route-loading" role="status"><span className="tk-loading-dot" /> Building the route heatmap…</div>
      : resource.error ? <State error title="The fare heatmap is temporarily unavailable." detail="Try loading the stored observations again." retry={resource.retry} />
      : !routes.length ? <State title="No booking-window observations yet." detail="The heatmap will appear after fare observations are stored." />
      : <div className="tk-heatmap-scroll"><table className="tk-heatmap"><thead><tr><th><span>24-route basket</span>Route</th>{resource.data?.windows.map(days => <th key={days}>T+{days}<span>{days === 1 ? 'Tomorrow' : `${days} days ahead`}</span></th>)}</tr></thead>
        <tbody>{routes.map(route => <tr key={route.routeId}><th scope="row"><div><strong>{route.displayId.replace('-', ' → ')}</strong><small>{(route.weight * 100).toFixed(2)}% basket weight</small></div></th>{route.cells.map(cell => <td key={cell.days}><div className={`tk-heat-cell ${heatClass(cell)}`}><strong>{money(cell.fare)}</strong><span>{cell.changePercent == null ? 'No observation' : `${cell.changePercent > 0 ? '+' : ''}${cell.changePercent.toFixed(1)}%`}</span></div></td>)}</tr>)}</tbody>
      </table></div>}
  </section>;
}

function pressureColor(multiplier: number | null) {
  if (multiplier == null || multiplier < 1.15) return '#1aa64b';
  if (multiplier < 1.6) return '#df7b00';
  return '#dc3434';
}

export function LeadTimeElasticityChart({ routeId }: { routeId?: string }) {
  const resource = useApi<NetworkTrend>(`/fares/trends${routeId ? `?route_id=${encodeURIComponent(routeId)}` : ''}`);
  const rawPoints = resource.data?.points ?? [];
  const baseline = rawPoints.find(point => point.fare != null)?.fare ?? null;
  const points = rawPoints.map(point => {
    const multiplier = point.index != null
      ? point.index / 100
      : point.fare != null && baseline != null && baseline > 0 ? point.fare / baseline : null;
    return { ...point, multiplier };
  });
  const available = points.filter(point => point.fare != null && point.multiplier != null);

  return <section className="tk-section tk-lead-section tk-elasticity-chart-section" id={routeId ? 'price-trends' : undefined} aria-label="Lead-time elasticity graph">
    <div className="tk-section-heading"><div><p className="tk-kicker">Lead-time elasticity</p><h2>Lead Time Elasticity Curve (T+60 → T+1)</h2></div></div>
    {resource.loading ? <div className="tk-route-loading" role="status"><span className="tk-loading-dot" /> Building the elasticity graph…</div>
      : resource.error ? <State error title="The elasticity graph is temporarily unavailable." retry={resource.retry} />
      : !available.length ? <State title="No booking-window observations yet." detail="The graph will appear after fares are stored." />
      : <div className="tk-chart-surface tk-elasticity-surface">
        <div className="tk-elasticity-legend" aria-hidden="true"><span><i className="tk-legend-fare" /> Estimated ticket fare</span><span><i className="tk-legend-yield" /> Yield multiplier</span></div>
        <div className="tk-lead-chart tk-elasticity-chart" role="img" aria-label="Ticket fares as bars with a yield multiplier line across ticket windows">
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{ top: 18, right: 8, bottom: 8, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#dce4e0" strokeDasharray="3 5" />
            <XAxis dataKey="days" axisLine={false} tickLine={false} tickMargin={12} tick={{ fill: '#63746f', fontSize: 12 }} tickFormatter={value => `T+${value}`} />
            <YAxis yAxisId="fare" width={68} axisLine={false} tickLine={false} tick={{ fill: '#63746f', fontSize: 11 }} tickFormatter={value => `₹${(Number(value) / 1000).toFixed(1)}k`} domain={['auto', 'auto']} />
            <YAxis yAxisId="yield" orientation="right" width={56} axisLine={false} tickLine={false} tick={{ fill: '#087f8c', fontSize: 11 }} tickFormatter={value => `${Number(value).toFixed(2)}x`} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ border: '1px solid #dce4e0', borderRadius: 6, fontSize: 12 }} formatter={(value, name) => name === 'Yield multiplier' ? [`${Number(value).toFixed(2)}x`, name] : [money(Number(value)), name]} labelFormatter={value => `T+${value} ticket window`} />
            <Bar yAxisId="fare" dataKey="fare" name="Estimated ticket fare" radius={[7, 7, 0, 0]} maxBarSize={180} isAnimationActive={false}>{points.map(point => <Cell key={point.days} fill={pressureColor(point.multiplier)} />)}</Bar>
            <Line yAxisId="yield" dataKey="multiplier" name="Yield multiplier" type="monotone" stroke="#078b96" strokeWidth={3} connectNulls={false} isAnimationActive={false} dot={{ r: 5, fill: '#078b96', stroke: '#ffffff', strokeWidth: 2.5 }} activeDot={{ r: 7 }} />
          </ComposedChart></ResponsiveContainer>
        </div>
      </div>}
  </section>;
}

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
