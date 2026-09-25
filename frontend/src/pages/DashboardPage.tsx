import React, { useState } from 'react';
import { KpaiSection } from '../components/dashboard/KpaiSection';
import { ApixOverviewChart } from '../components/dashboard/ApixOverviewChart';
import { PriceTrendChart } from '../components/dashboard/PriceTrendChart';
import { SectorHeatmap } from '../components/dashboard/SectorHeatmap';
import { LeadTimeElasticityChart } from '../components/dashboard/LeadTimeElasticityChart';
import { IndiaMap } from '../components/india-map/IndiaMap';
import { FLIGHT_ROUTES } from '../mock/airfareData';
import { formatINR, formatDelta } from '../utils/geo';
import { RouteIntelligenceModal } from '../components/command-center/RouteIntelligenceModal';
import { AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLiveDataRevision } from '../components/LiveDataGate';

export const DashboardPage: React.FC = () => {
  // Re-render live visualizations in place when a background snapshot arrives.
  // Unlike the previous keyed wrapper, this preserves the route and UI state.
  useLiveDataRevision();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const topRoutes = FLIGHT_ROUTES.slice(0, 6);
  const anomalies = FLIGHT_ROUTES.filter((r) => r.isAnomaly);

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1769AA] uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-[#1769AA]" />
            <span>VAYUSETU INTELLIGENCE · GOVERNMENT DASHBOARD</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[#172033] tracking-tight">
            National Aviation Fare Intelligence Console
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Airfare index benchmarks and route volatility calculated from persisted observations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/vayusetu/cpi"
            className="px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] hover:border-[#1769AA] text-xs font-bold text-[#172033] flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span>CPI Benchmark</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/vayusetu/index"
            className="px-4 py-2 rounded-xl bg-[#1769AA] hover:bg-[#12558A] text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span>APIx Deep Dive</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. DASHBOARD KPAIs with informative Tooltips */}
      <KpaiSection />

      {/* 3. APIX SUMMARY & INTERACTIVE GRAPH (Filters: 3M, 6M, 1Y, FY, ALL) */}
      <ApixOverviewChart />

      {/* 4. PRICE TREND GRAPH */}
      <PriceTrendChart />

      {/* 5. VIBRANT GREEN-YELLOW-RED SECTOR TARIFF HEATMAP */}
      <SectorHeatmap />

      {/* 6. LEAD TIME ELASTICITY CURVE (45 DAYS TO 0 DAYS WITH ALL 24 ROUTES SELECTOR) */}
      <LeadTimeElasticityChart />

      {/* 7. SHARED AUTHENTIC INDIA MAP + ROUTE DETAILS PANEL */}
      <IndiaMap onSelectRoute={(id) => setSelectedRouteId(id)} />

      {/* 8. ROUTE INSIGHTS & ANOMALIES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Top High-Frequency Trunk Corridors */}
        <div className="lg:col-span-8 intel-card p-6 sm:p-7 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-lg font-bold font-heading text-[#172033] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#1769AA]" />
                <span>Primary Trunk Corridors</span>
              </h3>
              <p className="text-xs text-[#64748B]">
                High-capacity routes sampled continuously across verified airline yield classes.
              </p>
            </div>
            <Link
              to="/vayusetu/routes"
              className="text-xs font-bold text-[#1769AA] hover:text-[#12558A] flex items-center gap-1 cursor-pointer"
            >
              <span>View all routes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topRoutes.map((route) => (
              <div
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#1769AA] hover:bg-white transition-all cursor-pointer space-y-2 group shadow-2xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-[#172033] text-sm group-hover:text-[#1769AA] transition-colors">
                      {route.originCity} ➔ {route.destCity}
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono block">
                      {route.id} • {route.distanceKm} km
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      route.isAnomaly
                        ? 'bg-rose-50 text-[#DC2626] border border-rose-200'
                        : route.changePercent >= 10
                        ? 'bg-amber-50 text-[#D97706] border border-amber-200'
                        : 'bg-blue-50 text-[#1769AA] border border-blue-200'
                    }`}
                  >
                    {route.isAnomaly ? 'Anomaly' : route.changePercent >= 10 ? 'Elevated' : 'Normal'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-[#E2E8F0]/60">
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase font-semibold">Current Fare</div>
                    <div className="text-xl font-black font-heading text-[#172033]">
                      {formatINR(route.currentFare)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#64748B] uppercase font-semibold">Shift</div>
                    <div className={`text-xs font-bold ${route.changePercent >= 15 ? 'text-[#DC2626]' : 'text-[#1769AA]'}`}>
                      {formatDelta(route.changePercent)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-[#64748B] pt-1">
                  <span>Carrier: {route.dominantCarrier}</span>
                  <span>Volatility: {route.volatilityIndex}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Active Anomalies Column */}
        <div className="lg:col-span-4 intel-card p-6 sm:p-7 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-lg font-bold font-heading text-[#172033] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                <span>Yield Anomaly Trigger</span>
              </h3>
              <p className="text-xs text-[#64748B]">Corridors violating standard variance.</p>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-pulse" />
          </div>

          <div className="space-y-3">
            {anomalies.map((anom) => (
              <div
                key={anom.id}
                onClick={() => setSelectedRouteId(anom.id)}
                className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 hover:bg-rose-50 transition-all cursor-pointer space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-[#DC2626] text-sm">
                      {anom.originCity} ➔ {anom.destCity}
                    </span>
                    <span className="text-[10px] text-[#64748B] block font-mono">
                      Corridor {anom.id}
                    </span>
                  </div>
                  <span className="text-xs font-black text-[#DC2626] bg-white px-2 py-0.5 rounded border border-rose-200">
                    +{anom.changePercent}%
                  </span>
                </div>

                <p className="text-xs text-[#172033] leading-relaxed">
                  {anom.anomalyReason}
                </p>

                <div className="flex justify-between items-center text-[10px] text-[#64748B] pt-1 border-t border-rose-200/60 font-semibold">
                  <span>Current: {formatINR(anom.currentFare)}</span>
                  <span>Ref: {formatINR(anom.referenceFare)}</span>
                  <span className="text-[#DC2626] font-bold">Inspect Dossier →</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] leading-relaxed">
            <span className="font-bold text-[#172033]">Algorithmic Scrubbing: </span>
            Anomalies compare the latest mean fare with the persisted reference baseline across the five booking windows: T+1, T+7, T+15, T+30 and T+60 (with historical T+45 observations retained).
          </div>
        </div>
      </div>

      {/* Intelligence Modal */}
      {selectedRouteId && (
        <RouteIntelligenceModal
          routeId={selectedRouteId}
          onClose={() => setSelectedRouteId(null)}
        />
      )}
    </div>
  );
};
