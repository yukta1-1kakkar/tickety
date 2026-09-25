import React, { useState } from 'react';
import { FLIGHT_ROUTES, getLeadTimeCurveForRoute } from '../../mock/airfareData';
import type { FlightRoute } from '../../types';
import { useLiveDataRevision } from '../LiveDataGate';
import { formatINR } from '../../utils/geo';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import { Clock, Navigation } from 'lucide-react';

const DIRECT_AIRLINE_SOURCES = ['Akasa Air', 'Air India Express', 'SpiceJet'] as const;

function fetchedAirlineLabel(route: FlightRoute) {
  const directSources = DIRECT_AIRLINE_SOURCES.filter((airline) =>
    route.sources?.includes(airline)
    || route.dominantCarrier.includes(airline)
    || route.primaryAirline === airline
  );

  return directSources.length ? directSources.join(' / ') : 'OTA data only';
}

export const LeadTimeElasticityChart: React.FC = () => {
  useLiveDataRevision();
  // All 24 routes + ALL option
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ALL');

  const selectedRouteObj = selectedRouteId === 'ALL' ? null : FLIGHT_ROUTES.find(r => r.id === selectedRouteId) || null;

  // Backend averages for the five collection windows in the problem statement.
  const elasticityData = getLeadTimeCurveForRoute(selectedRouteId);

  const shortLeadPoint = elasticityData[elasticityData.length - 1];
  const advancePoint = elasticityData[0];
  if (!shortLeadPoint || !advancePoint) {
    return <section className="intel-card p-6 sm:p-7"><h3 className="text-xl font-bold">Lead Time Elasticity</h3><p className="mt-2 text-sm text-[#64748B]">Not enough observations for a lead-time trend.</p></section>;
  }
  const risesTowardDeparture = shortLeadPoint.avgFare >= advancePoint.avgFare;

  return (
    <div className="intel-card p-6 sm:p-7 w-full space-y-6">
      {/* Header with Route Selector */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F8B8D] uppercase tracking-wider mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>DYNAMIC YIELD MANAGEMENT</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold font-heading text-[#172033]">
            Lead Time Elasticity Curve ({advancePoint.window} → {shortLeadPoint.window})
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Observed mean fares across the available collection windows. Missing windows are not estimated.
          </p>
        </div>

        {/* Route Selector Dropdown across all 24 routes */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-[#64748B] whitespace-nowrap">Select Corridor:</span>
            <div className="relative flex-1 sm:w-64">
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#1769AA] shadow-xs cursor-pointer"
              >
                <option value="ALL">All Routes (National Average)</option>
                <optgroup label="Top 6 Primary Trunk Corridors">
                  {FLIGHT_ROUTES.slice(0, 6).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}: {r.originCity} ➔ {r.destCity} ({fetchedAirlineLabel(r)})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Arterial & Regional Corridors (7-24)">
                  {FLIGHT_ROUTES.slice(6).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}: {r.originCity} ➔ {r.destCity} ({fetchedAirlineLabel(r)})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${risesTowardDeparture ? 'bg-rose-50 border-rose-200 text-[#DC2626]' : 'bg-amber-50 border-amber-200 text-[#B45309]'}`}>
            <span>{shortLeadPoint.window} difference: {shortLeadPoint.markupPercent >= 0 ? '+' : ''}{shortLeadPoint.markupPercent}%</span>
          </div>
        </div>
      </div>

      {/* Selected Route Badge summary */}
      {selectedRouteObj && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
          <div className="flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-[#1769AA]" />
            <span className="font-bold text-[#172033]">{selectedRouteObj.originCity} ({selectedRouteObj.origin}) ➔ {selectedRouteObj.destCity} ({selectedRouteObj.destination})</span>
            <span className="text-[#64748B]">({selectedRouteObj.distanceKm} km • {fetchedAirlineLabel(selectedRouteObj)})</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{advancePoint.window} Fare: <strong className="text-[#16A34A]">{formatINR(advancePoint.avgFare)}</strong></span>
            <span>Equilibrium Base: <strong className="text-[#1769AA]">{formatINR(selectedRouteObj.referenceFare)}</strong></span>
            <span>{shortLeadPoint.window} Fare: <strong className="text-[#DC2626]">{formatINR(shortLeadPoint.avgFare)}</strong></span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="h-80 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={elasticityData} margin={{ top: 15, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="window" stroke="#94A3B8" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
            <YAxis
              yAxisId="fare"
              domain={['auto', 'auto']}
              stroke="#94A3B8"
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <YAxis
              yAxisId="multiplier"
              orientation="right"
              domain={[0.5, 2.5]}
              stroke="#94A3B8"
              tick={{ fontSize: 11, fill: '#0F8B8D' }}
              tickFormatter={(v) => `${v.toFixed(2)}x`}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3.5 rounded-xl border border-[#CBD5E1] shadow-lg text-xs space-y-1.5 min-w-[210px]">
                      <div className="font-bold text-[#172033] border-b border-[#F1F5F9] pb-1 flex justify-between">
                        <span>Window: {data.window}</span>
                        <span className="text-[#64748B] font-normal">{data.daysAdvance}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#1769AA]">
                        <span>Comparable Fare:</span>
                        <span className="font-bold text-sm">{formatINR(data.avgFare)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#0F8B8D]">
                        <span>Yield Multiplier:</span>
                        <span className="font-bold">{data.multiplier}x (Base 1.0x)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#64748B]">Price Delta:</span>
                        <span className={`font-semibold ${data.markupPercent > 0 ? 'text-[#DC2626]' : data.markupPercent < 0 ? 'text-[#16A34A]' : 'text-[#1769AA]'}`}>
                          {data.markupPercent > 0 ? `+${data.markupPercent}%` : `${data.markupPercent}%`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-[#94A3B8] pt-1">
                        <span>Volatility: {data.volatility}/100</span>
                        <span>{data.seatInventoryShare}% of clean observations</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
            
            <Bar yAxisId="fare" dataKey="avgFare" name="Estimated Ticket Fare (₹)" radius={[6, 6, 0, 0]}>
              {elasticityData.map((entry, index) => (
                <Cell
                  key={`lead-cell-${index}`}
                  fill={
                    entry.multiplier >= 1.6
                      ? '#DC2626' // Red (Last-minute / Same day)
                      : entry.multiplier >= 1.15
                      ? '#D97706' // Yellow / Amber (Short lead)
                      : '#16A34A' // Green (Discounted / Early-bird)
                  }
                />
              ))}
            </Bar>

            <Line
              yAxisId="multiplier"
              type="monotone"
              dataKey="multiplier"
              name="Yield Multiplier (x)"
              stroke="#0F8B8D"
              strokeWidth={3}
              dot={{ r: 4, fill: '#0F8B8D', strokeWidth: 2, stroke: '#FFFFFF' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Color-Coded Advance Booking Windows */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#F1F5F9] text-xs">
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <div className="flex items-center gap-1.5 font-bold text-[#16A34A]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <span>Green = Lower Fare Pressure</span>
          </div>
          <span className="text-[#64748B] text-[11px] mt-1 block">
            Observed yield multiplier below 1.15× relative to the available baseline.
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
          <div className="flex items-center gap-1.5 font-bold text-[#D97706]">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" />
            <span>Yellow = Moderate Fare Pressure</span>
          </div>
          <span className="text-[#64748B] text-[11px] mt-1 block">
            Observed yield multiplier from 1.15× to below 1.60× relative to the available baseline.
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
          <div className="flex items-center gap-1.5 font-bold text-[#DC2626]">
            <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
            <span>Red = High Fare Pressure</span>
          </div>
          <span className="text-[#64748B] text-[11px] mt-1 block">
            Observed yield multiplier of 1.60× or more. Collection windows may have different available inventory; this is not a forecast.
          </span>
        </div>
      </div>
    </div>
  );
};
