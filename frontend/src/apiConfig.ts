// Local development uses the local FastAPI server. Production keeps the
// deployed API, and either environment can explicitly override the URL.
export const API_BASE = (
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : 'https://vayusetu.onrender.com/api')
).replace(/\/+$/, '');
