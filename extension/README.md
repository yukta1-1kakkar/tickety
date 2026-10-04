# Tickety — Airfare Intelligence extension

A separately loadable Chrome/Chromium Manifest V3 companion for the existing
Tickety website. A small bubble appears on Google Flights; click it to compare
your flight against **real stored observations**. This is not a booking tool.
The website and government dashboard are not redesigned or replaced.

## Load locally

1. Start the existing backend from `backend`:
   `venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`.
2. Start the existing website from `frontend`: `npm run dev`.
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and select this repository's **extension** directory (not the repository root).
4. Pin Tickety and visit Google Flights on `www.google.com` or `www.google.co.in`.
   Click the Tickety bubble. Confirm uncertain context or choose manual entry.
5. After changing extension files, click **Reload** in `chrome://extensions`
   and reload the flight page. Backend changes need a reload/restart too.

No extension build, npm install, account, or API key is required to load it.

## Animated plane, fare indicators, events, and alerts

The website name is Tickety again. The website, popup and floating launcher now
use a green animated aircraft, with a transparent launcher and matching static
Chrome toolbar PNG. This replaces the previous Bloub character; the old vendored
source is retained for attribution/history but is not imported or bundled.
`mascot/entry.ts` is now a small local SVG renderer. Hidden documents pause it,
dismissal disposes it, and reduced-motion renders a still aircraft. Rebuild with
`npm run build:mascot` and check types with `npm run typecheck:mascot`.

Four colour-coded indicators appear immediately below the fare in a 2x2 grid:
fare level (green Low / blue Typical / red High), approaching/recent event,
booking window, and difference from the observed typical range. Missing evidence
is labelled unavailable rather than assigned a price level.

Website and backend share `config/holidays.json` (2026 coverage), sourced from
[the government holiday calendar](https://nhai.gov.in/assets/pdf/List_of_holidays-2026.pdf).
The extension displays the closest event within 45 days after the selected travel
date or up to three days before it. Its seven-date strip marks **departure dates**:
three days before (amber), the event (purple), three days after (blue). These
colours express calendar position, not a fare prediction. Each date links to the
existing website analysis; only actual latest eligible observations appear as
prices. No 2027 or regional event dates are invented.

Booking notes describe the cheapest observed lead-time window only when at least
two windows have data. They do not claim an optimal future purchase date. The
off-hours note suggests comparing at quieter times, while making clear that the
dataset does not establish cheaper booking hours. Event departure-date comparisons
and booking lead time are explicitly separate.

### Route alerts

1. Check a route/date and expand **Set a route fare alert**.
2. Enter your target INR fare and save. Up to ten route/date pairs are supported.
3. Open **My fare alerts** in the extension toolbar popup to view, check, or remove.
4. Click **Enable desktop notifications** there if you want system notifications.
   Chrome asks for the optional notification permission; without it, the status
   remains available in the popup.

A Chrome alarm checks hourly while Chrome runs. It reads the existing API; it
never initiates SerpAPI scraping. Alerts use the stored fare, never a price supplied
by the user, and only trigger on observations at most 48 hours old. A target match
notifies once, re-arms after the fare rises above the target, and can notify again
on a later drop. Expired travel dates stop checking. Alerts remember the backend
environment in which they were saved, so switching Settings does not silently
move them to another database. Existing alerts and their latest status are stored
locally; no new database table or external notification service is used. Browser/
OS notification settings may suppress system banners.

After updating, reload the extension in `chrome://extensions` and refresh the
flight page. The added alarms permission enables scheduled checks; notifications
are optional. Restart the backend to expose the added event-context field.

## Configuration

`config.js` is the only source of API and website URLs. The toolbar popup's
**Settings → Backend environment** selects local development (default) or production.
Local uses `http://127.0.0.1:8000/api` and `http://localhost:5173`.
Production uses the repository's existing Render API and Vercel website.
Deploy the new backend route before selecting production. Deployment is not
performed by this change. To add another deployment, edit the central config and
the matching `host_permissions` in `manifest.json`; do not insert secrets.

## Architecture and existing integration

```text
Flight page → site detector → normalized context → shadow-DOM widget
                                                ↓ click/confirm
                                     extension service worker
                                                ↓
                              GET /api/tickety/insights
                                                ↓
                         existing eligible fare query / SQLAlchemy
                                                ↓
                           existing Prisma-managed PostgreSQL tables
```

Repository inspection: the website is React/Vite/TypeScript, the API is FastAPI,
Prisma defines/migrates PostgreSQL tables, and Python accesses those same tables
through SQLAlchemy. The new endpoint adapts the existing `/api/fares` query and
`config/routes.json` basket; it does not create a database, migration, or scraper.
SerpAPI remains in the server-side collection pipeline. This extension only reads
stored results. VayuSetu authentication and CORS settings are unchanged.

The service worker performs cross-origin API requests with narrowly enumerated
host permissions. Content scripts never fetch the API from a booking site's
origin. Therefore no wildcard CORS or `chrome-extension://*` allowance is needed.
See [Chrome's cross-origin request documentation](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

## API contract

```http
GET /api/tickety/insights?origin=DEL&destination=BOM&departureDate=2026-10-05&currentFare=5240
```

`origin` and `destination` are three-letter airport codes; `departureDate` is an
ISO date. `currentFare` is optional, finite, positive INR (up to 10,000,000).
Validation errors return 422; unsupported **directional** basket routes return
404. Valid routes without observations return 200 with `hasData: false` and null
insights. This read-only endpoint has no caller-selected target URL, write action,
raw scraper payload, or billable API call. It has the same public-read access
model as the existing consumer endpoints.

Response fields:

- `route`: detected airport pair, canonical `routeId`, `scope: "city_pair"`.
- `departureDate`, `currency: "INR"`, `hasData`.
- `currentFare`, `fareSource` (`provided` or `stored`), `storedFare`.
- Nullable `priceLevel`, `classificationBasis`, `differenceFromRange`.
- Nullable `typicalPriceRange: {low, high}` and `lowestPrice`.
- `leadTime`: `{days, fare, count}` at 60, 30, 15, 7, 1 days; gaps stay null.
- `collectedAt`, `observationDate`, `source`, `tripType`, `cabin`.
- `eventContext`: coverage flag, source URL, nearest event with travel offset, and
  seven dated observations (fare, classification, collection time, relative phase).

Only clean, available, non-synthetic, non-outlier Google Flights via SerpAPI
observations for the exact city pair, date, INR, one-way economy are eligible.
The latest stored search supplies the typical range. A user-supplied fare is
classified mathematically against that range, **not** by copying a potentially
unrelated stored Google classification. Without a supplied fare, the stored
Google search classification is attributed explicitly. Missing ranges do not
produce a classification for a supplied fare. `lowestPrice` is the minimum
eligible stored observation for that date, not a promise of today's lowest quote.
Goa airports are mapped to the existing shared city-pair basket; UI labels that
scope. Reverse routes are never silently substituted.

Deep links use the website's actual contract:
`/fare?route=DELHI-MUMBAI&date=2026-10-05`.

## Detection and supported websites

**Google Flights** is the first adapter. English search fields on google.com and
google.co.in are enabled automatically. A live google.com Delhi–Mumbai search
was tested for route and date detection; google.co.in and other languages have
not been live-tested. Flight-price capture is tested using a DOM fixture with
an explicitly selected flight; do not assume every live Google layout exposes
its selected fare. Manual fare entry is available.

`detectors/googleFlights.js` centralizes accessible selectors. It uses search
controls, a unique selected/expanded flight, and explicit dates from the URL.
Google's yearless English date field is combined with a URL-provided year only
when the month and day agree. `tfs` decoding is best effort, bounded to 12 KB,
and accepts exactly one valid date; multiple segment dates remain ambiguous.
It does not guess dates from the current year or choose the minimum price from
an entire results page. Unexpected layouts, multi-airport fields, uncertain dates,
and conflicting signals fail to confirmation/manual entry.

- **HIGH:** complete consistent route/date plus one-way economy/single-passenger
  controls. Opening the bubble may retrieve insights.
- **MEDIUM:** complete route/date with uncertain scope; requires confirmation.
- **LOW:** incomplete or conflicting context; manual form.

The generic detector reads a single Schema.org `Flight` object in JSON-LD or
explicit route/date query parameters. It is experimental and runs on other sites
only after the user clicks **Detect on this page**, using temporary `activeTab`
permission. It does not claim automatic MakeMyTrip, Cleartrip, EaseMyTrip, airline,
or arbitrary-site support. Airline and itinerary details are populated only when
explicit structured fields exist. Opaque international airports outside the
current Indian basket require future support rather than guessed mappings.

To add an adapter: create `detectors/siteName.js`, expose `detect(document, url)`
returning `{context, confidence, reason, site}`, register its host in the manager,
and include its script in the manifest and popup injection list. Add fixtures and
live tests before adding it to the supported-sites list. Extend host access only
for sites actually supported. Do not mix page prices from different itineraries.

## UI, performance and privacy

- Compact, dismissible bubble; no automatic full-panel opening. Shared popup and
  widget renderer, Tickety green/paper colors, local font fallbacks, reduced-motion
  support, keyboard controls, and shadow-DOM CSS isolation.
- Manual route/date/optional INR fare search works without a supported page.
- Compact observed lead-time bars, missing gaps, exact matching booking-window
  highlight, and a clear insufficient-history state. No predictions or advice.
- Debounced scoped signals, bounded JSON-LD/control scans, context-change
  detection, in-flight deduplication, and a five-minute/100-entry memory cache.
  Cache keys include environment, route, date **and supplied fare**, preventing
  stale classifications when a user changes price. Worker termination clears it.
- `storage` stores the environment preference and user-created route alerts. No browsing-history permission,
  cookies, analytics, tracking, arbitrary-page uploads, database credentials, or
  SerpAPI secrets. Route/date/fare are sent after opening a high-confidence
  result or confirming/submitting a search. Saved alerts send route/date during
  their hourly checks. The API request omits credentials.
- Default host permissions cover only the two loopback API hosts and Render.
  Content scripts run automatically only on the two listed Google Flights hosts.
  `activeTab` and `scripting` enable user-invoked generic detection. `alarms`
  schedules saved route checks; optional `notifications` enables user-requested
  desktop alerts. The shared
  stylesheet is web-accessible for injection, not a grant to read every website.
- API data and host strings use text nodes; no remote scripts, inline executable
  handlers, `eval`, or host-provided HTML injection. The worker accepts internal
  messages and constructs fixed endpoint URLs from validated fields only.

## Validation

From `extension`:

```powershell
npm test
npm run check
npm run test:browser
```

Browser tests reuse the existing `frontend/node_modules/@playwright/test`
installation and require its Chromium browser. They load the actual unpacked
extension in a new disposable profile. They never use your personal profile.
To enable the live checks with the local backend running:

```powershell
$env:TICKETY_LIVE_API='1'
$env:TICKETY_LIVE_GOOGLE='1'
npm run test:browser
```

The live API assertion uses real stored DEL–BOM observations for 2026-10-05;
update that date if the deployment's retained dataset changes. Fixtures are
test-only and are never inserted into the application database.

Verified for this change:

- Backend: 54 tests pass, including extension validation, alias resolution,
  missing data, source filtering, and classification semantics.
- Extension: 14 unit tests pass; JavaScript syntax, manifest resources,
  permissions, and credential-pattern checks pass.
- Chromium: unpacked Manifest V3 service worker loads; real local API request
  returns stored data; fixture detection, bubble/expand/collapse/dismiss, manual
  fallback, range comparison, missing-data/retry, chart gaps and website links pass.
- Live Google Flights: English Delhi–Mumbai route/date detection and widget
  expansion pass. No live tests on other booking websites or Google country hosts.
- Existing website production build passes. Existing lint completes with warnings.
- Existing website browser suite: **8 pass, 6 fail** (three expectations repeated
  on desktop/mobile): fare-page lead-time elements no longer exist; explorer
  shows unavailable route cards too; the old empty-result heading is absent.
  These tests refer to earlier website layouts. The current follow-up updates branding and event-calendar colours, and adds a
  focused calendar test. Four focused desktop/mobile calendar/branding/government
  navigation checks pass. The older six failures were not addressed here. Government navigation, authentication boundary,
  analytics/heatmap and responsive-layout checks pass. The website suite is
  **not fully green**; its stale assertions need a separate update.

## Limitations

Stored data may be stale or missing for a selected date. Prices aren't refreshed
by this extension. One-way economy/single adult/INR and the existing 24-direction
basket are the supported comparison scope. Live result-card fare extraction is
conservative; enter the quote manually when selection is ambiguous. Google DOM,
URL encoding, localization, consent pages, and anti-automation changes can require
adapter updates. No bookings, new pipeline, or production deployment is included. Route alerts
are opt-in local watches of the existing dataset, not live booking-site monitoring.

Latest follow-up validation: 54 backend tests, 14 extension unit tests, five
extension browser checks (including event/alert flows), four focused website
browser checks, mascot type checks, manifest checks and the website build pass.
Live Google Flights was not rechecked for this follow-up; detector code is unchanged.
