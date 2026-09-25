import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Braces,
  Check,
  Clipboard,
  Clock3,
  Code2,
  Database,
  ExternalLink,
  FileJson,
  LoaderCircle,
  Play,
  Route,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

import { API_BASE } from '../apiConfig';
const SERVICE_BASE = API_BASE.replace(/\/api$/, '');

type Endpoint = {
  id: string;
  method: 'GET';
  path: string;
  title: string;
  description: string;
  category: 'System' | 'APIx' | 'Routes' | 'Analytics';
  icon: typeof Activity;
  query?: string;
  parameters: Array<{ name: string; type: string; required?: boolean; description: string }>;
};

const ENDPOINTS: Endpoint[] = [
  {
    id: 'health', method: 'GET', path: '/health', title: 'Service health', category: 'System', icon: Activity,
    description: 'Verify API availability and PostgreSQL connectivity.', parameters: [],
  },
  {
    id: 'index', method: 'GET', path: '/index', title: 'Current APIx', category: 'APIx', icon: BarChart3,
    description: 'Calculate the fixed-base modified Laspeyres APIx for a selected date and booking window.',
    query: '?advance_purchase=7',
    parameters: [
      { name: 'target_date', type: 'date', description: 'Observation date in YYYY-MM-DD; defaults to latest.' },
      { name: 'base_date', type: 'date', description: 'Reference date in YYYY-MM-DD; defaults to earliest.' },
      { name: 'advance_purchase', type: 'integer', description: 'Lead-time window in days; default is 7.' },
    ],
  },
  {
    id: 'history', method: 'GET', path: '/index/history', title: 'APIx history', category: 'APIx', icon: Clock3,
    description: 'Retrieve the calculated daily APIx time series and route-coverage metadata.',
    query: '?advance_purchase=7',
    parameters: [
      { name: 'start_date', type: 'date', description: 'Optional inclusive start date in YYYY-MM-DD.' },
      { name: 'end_date', type: 'date', description: 'Optional inclusive end date in YYYY-MM-DD.' },
      { name: 'advance_purchase', type: 'integer', description: 'Lead-time window in days.' },
    ],
  },
  {
    id: 'routes', method: 'GET', path: '/routes', title: 'Route basket', category: 'Routes', icon: Route,
    description: 'List representative DGCA city pairs, traffic totals and configured route weights.',
    parameters: [
      { name: 'offset', type: 'integer', description: 'Number of records to skip; default is 0.' },
      { name: 'limit', type: 'integer', description: 'Maximum records returned; default is 50 and maximum is 500.' },
      { name: 'search', type: 'string', description: 'Optional route, origin or destination search text.' },
    ],
  },
  {
    id: 'analytics', method: 'GET', path: '/analytics', title: 'Fare analytics', category: 'Analytics', icon: Braces,
    description: 'Retrieve route movements, anomaly detection results and aggregate fare analytics.',
    parameters: [
      { name: 'route_id', type: 'string', description: 'Optional route identifier such as DELHI-MUMBAI.' },
    ],
  },
  {
    id: 'status', method: 'GET', path: '/fare-status', title: 'Repository status', category: 'System', icon: Database,
    description: 'Inspect persisted observation counts, date coverage and the latest collection state.',
    parameters: [],
  },
  {
    id: 'dashboard', method: 'GET', path: '/dashboard/live', title: 'Dashboard snapshot', category: 'Analytics', icon: FileJson,
    description: 'Return the shared live dashboard payload used by the VAYUSETU frontend.',
    parameters: [],
  },
  {
    id: 'backtest', method: 'GET', path: '/backtest', title: 'APIx backtest', category: 'APIx', icon: ShieldCheck,
    description: 'Run historical APIx diagnostics against the persisted observation repository.',
    query: '?advance_purchase=7',
    parameters: [
      { name: 'advance_purchase', type: 'integer', description: 'Lead-time window used for the historical test.' },
    ],
  },
];

type CodeLanguage = 'curl' | 'javascript' | 'python';

const codeFor = (language: CodeLanguage, url: string): string => {
  if (language === 'javascript') {
    return `const response = await fetch('${url}', {\n  headers: { 'Accept': 'application/json' }\n});\n\nif (!response.ok) throw new Error(\`API error: \${response.status}\`);\nconst data = await response.json();\nconsole.log(data);`;
  }
  if (language === 'python') {
    return `import requests\n\nresponse = requests.get(\n    '${url}',\n    headers={'Accept': 'application/json'},\n    timeout=30,\n)\nresponse.raise_for_status()\nprint(response.json())`;
  }
  return `curl --request GET \\\n  --url '${url}' \\\n  --header 'Accept: application/json'`;
};

export function ApiExplorerPage() {
  const [selectedId, setSelectedId] = useState('index');
  const [language, setLanguage] = useState<CodeLanguage>('curl');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: number; elapsed: number; body: unknown } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const endpoint = ENDPOINTS.find((item) => item.id === selectedId) ?? ENDPOINTS[1];
  const requestUrl = `${API_BASE}${endpoint.path}${endpoint.query ?? ''}`;
  const snippet = useMemo(() => codeFor(language, requestUrl), [language, requestUrl]);

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const testEndpoint = async () => {
    setLoading(true);
    setResult(null);
    setRequestError(null);
    const startedAt = performance.now();
    try {
      const response = await fetch(requestUrl, { headers: { Accept: 'application/json' } });
      const body = await response.json().catch(() => ({ detail: 'Response was not valid JSON.' }));
      setResult({ status: response.status, elapsed: Math.round(performance.now() - startedAt), body });
      if (!response.ok) setRequestError(`The API returned HTTP ${response.status}.`);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'The API request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-7 pb-16">
      <header className="relative overflow-hidden rounded-3xl bg-[#092A43] px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-70px] left-1/3 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-100">
              <Code2 className="h-3.5 w-3.5" /> Institutional data services
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">VAYUSETU API Explorer</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Documented, machine-readable access to APIx, representative routes, historical series and analytical outputs for NSO and RBI workflows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`${SERVICE_BASE}/docs`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#092A43] transition hover:bg-sky-50">
              Swagger documentation <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a href={`${SERVICE_BASE}/openapi.json`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15">
              OpenAPI schema <FileJson className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="intel-card h-fit overflow-hidden lg:sticky lg:top-24">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#64748B]">Read-only endpoints</div>
            <div className="mt-1 font-mono text-[11px] text-[#1769AA]">{API_BASE}</div>
          </div>
          <div className="max-h-[620px] space-y-1 overflow-y-auto p-2">
            {ENDPOINTS.map((item) => {
              const Icon = item.icon;
              const active = item.id === endpoint.id;
              return (
                <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setResult(null); setRequestError(null); }} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${active ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-transparent hover:border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#1769AA] text-white' : 'bg-slate-100 text-[#64748B]'}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[8px] font-black text-emerald-700">GET</span><span className="truncate text-xs font-extrabold text-[#172033]">{item.title}</span></span>
                    <span className="mt-1 block truncate font-mono text-[9px] text-[#94A3B8]">{item.path}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <article className="intel-card overflow-hidden">
            <div className="border-b border-[#E2E8F0] bg-gradient-to-r from-white to-sky-50/50 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><span className="rounded-lg bg-emerald-100 px-2 py-1 font-mono text-[10px] font-black text-emerald-700">{endpoint.method}</span><span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{endpoint.category}</span></div>
                  <h2 className="mt-2 font-heading text-2xl font-black text-[#172033]">{endpoint.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#64748B]">{endpoint.description}</p>
                </div>
                <button type="button" onClick={testEndpoint} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#1769AA] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#12598F] disabled:cursor-wait disabled:opacity-70">
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {loading ? 'Requesting…' : 'Send live request'}
                </button>
              </div>
              <div className="mt-5 overflow-x-auto rounded-xl border border-[#DCE4EE] bg-white px-4 py-3 font-mono text-xs text-[#172033]">
                <span className="mr-3 font-black text-emerald-600">GET</span>{requestUrl}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">Query parameters</h3>
              {endpoint.parameters.length ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[#E2E8F0]">
                  {endpoint.parameters.map((parameter, index) => (
                    <div key={parameter.name} className={`grid gap-1 px-4 py-3 sm:grid-cols-[150px_90px_1fr] sm:gap-4 ${index ? 'border-t border-[#E2E8F0]' : ''}`}>
                      <code className="text-xs font-bold text-[#1769AA]">{parameter.name}</code>
                      <span className="text-[10px] font-bold uppercase text-[#94A3B8]">{parameter.type}</span>
                      <span className="text-xs text-[#64748B]">{parameter.description}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 text-xs text-[#64748B]">This endpoint has no query parameters.</div>}
            </div>
          </article>

          <article className="intel-card overflow-hidden">
            <div className="flex flex-col justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#172033]"><Terminal className="h-4 w-4 text-[#1769AA]" /> Request example</div>
              <div className="flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-white p-1">
                {(['curl', 'javascript', 'python'] as const).map((item) => <button key={item} type="button" onClick={() => setLanguage(item)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition ${language === item ? 'bg-[#1769AA] text-white' : 'text-[#64748B] hover:bg-slate-50'}`}>{item}</button>)}
              </div>
            </div>
            <div className="relative bg-[#081C2C] p-5">
              <button type="button" onClick={copySnippet} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-white/15">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Clipboard className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <pre className="overflow-x-auto pr-20 text-[11px] leading-6 text-sky-100"><code>{snippet}</code></pre>
            </div>
          </article>

          {(result || requestError) && (
            <article className="intel-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-3">
                <div className="text-xs font-extrabold text-[#172033]">Live response</div>
                {result && <div className="flex items-center gap-2 text-[10px]"><span className={`rounded-full px-2 py-1 font-black ${result.status < 400 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>HTTP {result.status}</span><span className="text-[#64748B]">{result.elapsed} ms</span></div>}
              </div>
              {requestError && !result ? <div className="bg-rose-50 px-5 py-4 text-xs font-semibold text-rose-700">{requestError}</div> : null}
              {result ? <pre className="max-h-[430px] overflow-auto bg-[#0B1220] p-5 text-[11px] leading-5 text-emerald-100"><code>{JSON.stringify(result.body, null, 2)}</code></pre> : null}
            </article>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#172033]"><ShieldCheck className="h-4 w-4 text-[#1769AA]" /> Institutional integration</div>
              <p className="mt-2 text-xs leading-5 text-[#64748B]">The prototype exposes read-only analytical endpoints. A production NSO/RBI integration should add OAuth 2.0 or signed API keys, per-client quotas, audit logs and versioned contracts.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#172033]"><Database className="h-4 w-4 text-amber-600" /> Data interpretation</div>
              <p className="mt-2 text-xs leading-5 text-[#64748B]">APIx responses should be consumed with their base date, lead-time window, observation count and route coverage. Missing coverage must never be interpreted as a zero fare.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
