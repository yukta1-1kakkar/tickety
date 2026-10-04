globalThis.Tickety = globalThis.Tickety || {};
Tickety.config = Object.freeze({
  environments: {
    local: { api: 'http://127.0.0.1:8000/api', web: 'http://localhost:5173' },
    production: { api: 'https://vayusetu-serpapi.onrender.com/api', web: 'https://tickety-airfare.vercel.app' },
  },
  defaultEnvironment: 'local',
  cacheMs: 5 * 60 * 1000,
  timeoutMs: 20000,
});
