# Tickety fare intelligence

The existing government dashboard remains at `/` (`/dashboard` redirects there),
with its original authentication, navigation, heatmap and analytics. Tickety is
a separate public workspace at `/tickety`, linked from the dashboard navigation
and institutional sign-in screen. The cinematic intro now plays only on request.

Tickety reuses `/api/routes` and adds two read-only endpoints to the existing
FastAPI backend and SQLAlchemy models (the same tables described by Prisma):

- `/api/fares?route_id=DELHI-MUMBAI&departure_date=2026-10-15`
- `/api/fares/compare?departure_date=2026-10-15`

Use route identifiers returned by `/api/routes`; city and airport identifiers
are not substituted. No scraper run or billable SerpAPI request is triggered by
search. No migration is needed. Deploy both frontend and backend for the new
workspace; point `VITE_API_URL` at the backend's `/api` URL.

Local development automatically connects to `http://127.0.0.1:8000/api`.
Run FastAPI on port 8000 and `npm run dev` in `frontend`. To use a different
backend, set `VITE_API_URL` in `frontend/.env.local` and restart Vite.
Production uses `frontend/.env.production`. Tickety, the dashboard, and the
API explorer share the same API configuration.

Results use clean, available, non-synthetic, non-outlier Google Flights via
SerpAPI observations for one-way economy travel in INR. Current fare is the
cheapest itinerary in the most recently collected search for the exact route
and departure date. Missing Google price insights remain unavailable.
Google's search-level classification is passed through rather than recalculated.

Lead-time points show stored route minima at 60, 30, 15, 7 and 1 day before the
selected departure date. Historical points show daily route minima for that
same departure date. These can represent different flights and are labelled
accordingly; missing windows are never interpolated. Comparison uses the same
departure date and displays collection timestamps. Existing government index
and historical cohort calculations are unchanged.

Validation: `npm run build` and `npm run lint` in `frontend`; `python -m pytest
tests -q` in `backend`. Backend regression tests use an isolated in-memory
database; their fixtures are never loaded into the application.
