import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Database, LoaderCircle, RefreshCw } from 'lucide-react';
import { applyLiveDashboard, type LiveDashboardPayload } from '../mock/airfareData';

import { API_BASE } from '../apiConfig';
const REFRESH_INTERVAL_MS = 60 * 1000;
// Render cold starts and the first uncached aggregation can exceed 30 seconds.
// Subsequent responses are served by the API's shared 60-second snapshot cache.
const REQUEST_TIMEOUT_MS = 90_000;
const DASHBOARD_CACHE_KEY = 'vayusetu-live-dashboard-cache';

let activeDashboardRequest: Promise<LiveDashboardPayload> | null = null;
const LiveDataRevisionContext = createContext(0);

// Components that read the module-backed live store can subscribe to this
// revision without forcing the whole routed application to remount.
export const useLiveDataRevision = () => useContext(LiveDataRevisionContext);

function requestLiveDashboard(): Promise<LiveDashboardPayload> {
  if (activeDashboardRequest) return activeDashboardRequest;

  activeDashboardRequest = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/dashboard/live`, {
        headers: { Accept: 'application/json' },
        // Honour the API cache so page navigation and multiple tabs do
        // not force the backend to rebuild the same dashboard payload.
        cache: 'default',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
      return await response.json() as LiveDashboardPayload;
    } finally {
      window.clearTimeout(timeout);
    }
  })().finally(() => { activeDashboardRequest = null; });

  return activeDashboardRequest;
}

function readCachedDashboard(): LiveDashboardPayload | null {
  try {
    const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
    return cached ? JSON.parse(cached) as LiveDashboardPayload : null;
  } catch {
    return null;
  }
}

function cacheDashboard(payload: LiveDashboardPayload) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A full or unavailable browser cache must never interrupt live rendering.
  }
}

export function LiveDataGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to the airfare database...');
  const [revision, setRevision] = useState(0);
  const hasValidData = useRef(false);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setStatus('loading');
    try {
      const payload = await requestLiveDashboard();
      if (!payload.hasData) {
        if (hasValidData.current) return;
        setMessage('PostgreSQL is connected, but it has no clean airfare observations yet. Run an authorized scraper to populate it.');
        setStatus('empty');
        return;
      }
      applyLiveDashboard(payload);
      cacheDashboard(payload);
      hasValidData.current = true;
      setRevision((value) => value + 1);
      setStatus('ready');
    } catch (error) {
      if (hasValidData.current) return;

      const cached = readCachedDashboard();
      if (cached?.hasData) {
        applyLiveDashboard(cached);
        hasValidData.current = true;
        setRevision((value) => value + 1);
        setStatus('ready');
        return;
      }
      setMessage(error instanceof Error ? error.message : 'Unable to load live airfare data.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    // Render a previously validated snapshot immediately while checking for a
    // newer one in the background. This avoids replacing the whole dashboard
    // with an error screen during a Render cold start.
    const cached = readCachedDashboard();
    if (cached?.hasData) {
      applyLiveDashboard(cached);
      hasValidData.current = true;
      setRevision((value) => value + 1);
      setStatus('ready');
    }

    const runRefreshCycle = async () => {
      await refresh(hasValidData.current);
      if (!disposed) timer = window.setTimeout(() => void runRefreshCycle(), REFRESH_INTERVAL_MS);
    };

    void runRefreshCycle();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refresh]);

  if (status === 'ready') {
    return (
      <LiveDataRevisionContext.Provider value={revision}>
        {children}
      </LiveDataRevisionContext.Provider>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#F6F8FB] px-6">
      <div className="max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
        {status === 'loading' ? <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-[#1769AA]" />
          : status === 'empty' ? <Database className="mx-auto h-10 w-10 text-[#1769AA]" />
          : <AlertTriangle className="mx-auto h-10 w-10 text-[#DC2626]" />}
        <h2 className="mt-4 text-xl font-bold text-[#172033]">
          {status === 'loading' ? 'Loading live airfare data' : status === 'empty' ? 'Waiting for the first scrape' : 'Live API unavailable'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#64748B]">{message}</p>
        {status !== 'loading' && (
          <button onClick={() => void refresh()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1769AA] px-4 py-2 text-sm font-bold text-white">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
