import React, { useState } from 'react';
import { useLiveDataRevision } from '../LiveDataGate';
import {
  FLIGHT_ROUTES,
  ROUTE_WEIGHTS_DATA,
  getLeadTimeCurveForRoute,
} from '../../mock/airfareData';
import { formatINR, formatDelta } from '../../utils/geo';
import type { LeadTimeDataPoint } from '../../types';
import { CalendarRange, Grid3X3, Info, Plane, Route, Sparkles } from 'lucide-react';


type SelectedCell = {
  route: string;
  airline: string;
  point: LeadTimeDataPoint;
};

const windowNumber = (window: string): number => Number(window.replace('T+', ''));

const heatTone = (change: number) => {
  if (change >= 20) {
    return {
      cell: 'border-rose-300 bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-100',
      label: 'High premium',
    };
  }
  if (change >= 5) {
    return {
      cell: 'border-amber-300 bg-gradient-to-br from-amber-300 to-amber-400 text-amber-950 shadow-amber-100',
      label: 'Elevated',
    };
  }
  if (change >= -5) {
    return {
      cell: 'border-sky-300 bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sky-100',
      label: 'Near baseline',
    };
  }
  return {
    cell: 'border-emerald-300 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-100',
    label: 'Discounted',
  };
};

export const SectorHeatmap: React.FC = () => {
  useLiveDataRevision();
  const WINDOWS = [1, 7, 15, 30, getLeadTimeCurveForRoute("ALL").some(point => point.window === "T+60") ? 60 : getLeadTimeCurveForRoute("ALL").some(point => point.window === "T+45") ? 45 : 60];
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const rows = (() => {
    const weights = new Map(ROUTE_WEIGHTS_DATA.map((route) => [route.routeId, route.weight]));

    return FLIGHT_ROUTES.map((routeItem) => {
      const points = new Map(
        getLeadTimeCurveForRoute(routeItem.id).map((point) => [windowNumber(point.window), point]),
      );
      return {
        id: routeItem.id,
        origin: routeItem.origin,
        destination: routeItem.destination,
        airline: routeItem.primaryAirline,
        weight: weights.get(routeItem.id) ?? 0,
        points,
      };
    }).sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id));
  })();

  const availableCells = rows.reduce(
    (total, row) => total + WINDOWS.filter((days) => row.points.has(days)).length,
    0,
  );
  const possibleCells = rows.length * WINDOWS.length;
  const coverage = possibleCells ? Math.round((availableCells / possibleCells) * 100) : 0;

  const columnAverages = WINDOWS.map((days) => {
    const fares = rows
      .map((row) => row.points.get(days)?.avgFare)
      .filter((fare): fare is number => typeof fare === 'number' && fare > 0);
    return fares.length ? Math.round(fares.reduce((sum, fare) => sum + fare, 0) / fares.length) : null;
  });

  return (
    <section className="intel-card w-full overflow-hidden">
      <header className="relative overflow-hidden border-b border-[#E2E8F0] bg-gradient-to-r from-white via-sky-50/70 to-indigo-50/60 px-5 py-6 sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1769AA]">
              <Grid3X3 className="h-4 w-4" />
              Route × booking-window intelligence
            </div>
            <h3 className="font-heading text-2xl font-extrabold tracking-tight text-[#172033] sm:text-3xl">
              Advance-Purchase Fare Heatmap
            </h3>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#64748B] sm:text-sm">
              Domestic route fares across the available booking windows. Colours show each fare's movement against its available reference baseline.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
            {[
              { icon: Route, label: 'Routes', value: rows.length },
              { icon: CalendarRange, label: 'Windows', value: WINDOWS.length },
              { icon: Sparkles, label: 'Coverage', value: `${coverage}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  <Icon className="h-3.5 w-3.5 text-[#1769AA]" /> {label}
                </div>
                <div className="mt-1 font-heading text-xl font-black text-[#172033]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[11px]">
          <span className="mr-1 flex items-center gap-1.5 font-bold text-[#475569]"><Info className="h-3.5 w-3.5" /> Fare movement vs baseline</span>
          {[
            ['bg-emerald-500', 'Discounted', '< -5%'],
            ['bg-sky-500', 'Near baseline', '-5% to +5%'],
            ['bg-amber-400', 'Elevated', '+5% to +20%'],
            ['bg-rose-500', 'High premium', '> +20%'],
          ].map(([colour, label, range]) => (
            <span key={label} className="flex items-center gap-1.5 text-[#64748B]">
              <span className={`h-2.5 w-2.5 rounded-full ${colour}`} />
              <strong className="text-[#334155]">{label}</strong> {range}
            </span>
          ))}
        </div>

        <div className="max-h-[760px] overflow-auto rounded-2xl border border-[#DCE4EE] bg-white shadow-inner shadow-slate-100">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-30">
              <tr className="bg-[#0B2942] text-white shadow-sm">
                <th className="sticky left-0 z-40 min-w-[210px] border-r border-white/10 bg-[#0B2942] px-4 py-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200">DGCA basket</div>
                  <div className="mt-0.5 text-sm font-extrabold">Route</div>
                </th>
                {WINDOWS.map((days) => (
                  <th key={days} className="min-w-[128px] border-r border-white/10 px-3 py-3 text-center last:border-r-0">
                    <div className="font-heading text-base font-black">T+{days}</div>
                    <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-200">
                      {days === 1 ? 'Tomorrow' : `${days} days ahead`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className="group">
                  <th className={`sticky left-0 z-20 border-b border-r border-[#E2E8F0] px-4 py-2.5 ${rowIndex % 2 ? 'bg-[#F8FAFC]' : 'bg-white'} group-hover:bg-sky-50`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 font-heading text-sm font-black text-[#172033]">
                          <span>{row.origin}</span>
                          <Plane className="h-3.5 w-3.5 text-[#1769AA]" />
                          <span>{row.destination}</span>
                        </div>
                        <div className="mt-1 max-w-[135px] truncate text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]" title={row.airline}>
                          {row.airline}
                        </div>
                      </div>
                      <span className="rounded-lg border border-blue-100 bg-blue-50 px-1.5 py-1 text-[9px] font-extrabold text-[#1769AA]">
                        {row.weight.toFixed(2)}%
                      </span>
                    </div>
                  </th>

                  {WINDOWS.map((days) => {
                    const point = row.points.get(days);
                    if (!point) {
                      return (
                        <td key={days} className="border-b border-r border-[#EEF2F6] p-1.5 last:border-r-0">
                          <div className="flex h-[54px] items-center justify-center rounded-xl border border-dashed border-[#D7E0EA] bg-slate-50 text-[10px] font-semibold text-[#94A3B8]">
                            No observation
                          </div>
                        </td>
                      );
                    }

                    const tone = heatTone(point.markupPercent);
                    const active = selected?.route === row.id && selected.point.window === point.window;
                    return (
                      <td key={days} className="border-b border-r border-[#EEF2F6] p-1.5 last:border-r-0">
                        <button
                          type="button"
                          onClick={() => setSelected({ route: row.id, airline: row.airline, point })}
                          aria-label={`${row.origin} to ${row.destination}, ${point.window}, ${formatINR(point.avgFare)}, ${formatDelta(point.markupPercent)} versus available baseline`}
                          className={`flex h-[54px] w-full flex-col items-center justify-center rounded-xl border px-2 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1769AA] focus:ring-offset-2 ${tone.cell} ${active ? 'ring-2 ring-[#172033] ring-offset-2' : ''}`}
                        >
                          <span className="text-[13px] font-black leading-none">{formatINR(point.avgFare)}</span>
                          <span className="mt-1 font-mono text-[9px] font-bold opacity-90">{formatDelta(point.markupPercent)}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-slate-100/95 backdrop-blur">
                <th className="sticky left-0 z-30 border-r border-t border-[#DCE4EE] bg-slate-100 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#475569]">
                  Cross-route average
                </th>
                {columnAverages.map((fare, index) => (
                  <td key={WINDOWS[index]} className="border-r border-t border-[#DCE4EE] px-3 py-3 text-center last:border-r-0">
                    <span className="font-heading text-sm font-black text-[#172033]">{fare ? formatINR(fare) : '—'}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {selected ? (
          <div className="grid gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50 p-4 sm:grid-cols-[1.35fr_repeat(4,1fr)]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#1769AA]">Selected observation</div>
              <div className="mt-1 font-heading text-base font-black text-[#172033]">{selected.route} · {selected.point.window}</div>
              <div className="mt-0.5 truncate text-[10px] text-[#64748B]">Dominant carrier: {selected.airline}</div>
            </div>
            {[
              ['Average fare', formatINR(selected.point.avgFare)],
              ['vs baseline', formatDelta(selected.point.markupPercent)],
              ['Volatility', `${selected.point.volatility}/100`],
              ['Fare coverage', `${selected.point.seatInventoryShare.toFixed(1)}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white bg-white/80 px-3 py-2.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</div>
                <div className="mt-0.5 text-sm font-black text-[#172033]">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[11px] text-[#94A3B8]">Select any coloured cell to inspect its fare, movement, volatility and observation coverage.</p>
        )}
      </div>
    </section>
  );
};
