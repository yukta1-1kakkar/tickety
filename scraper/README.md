# VAYUSETU airfare collectors

## Primary collector: SerpAPI Google Flights

`google_flights.py` reads the complete directional basket from
`backend/data/processed/route_weights.csv`, validates both endpoints against
the Indian-airport registry, and searches T+1, T+7, T+15, T+30 and T+60.
It sends one-way Economy searches for one adult with `gl=in`, `hl=en`
and `currency=INR`.

Configure `SERPAPI_API_KEY` in `backend/.env` (see `backend/.env.example`). A
validation-only run makes no paid request:

```powershell
python google_flights.py --dry-run
```

Run a one-route smoke test before committing quota to the full basket:

```powershell
python google_flights.py --max-routes 1 --no-etl
```

The complete run performs 3,825 searches (765 routes x 5 lead times):

```powershell
python google_flights.py
```

Every response is retained under `backend/data/raw/google_flights`, grouped
normalized output is stored under `backend/data/processed/google_flights`, and
the run folder contains the flat scraper payload plus `failed_routes.json`.
Timestamped filenames prevent a later scrape from overwriting an earlier one.

Google Flights output is intentionally not auto-loaded into the unchanged ETL:
its scraper-only airport-code schema and T+60 window differ from the existing
database ingestion contract.

`run_daily.py` now defaults to this collector. Legacy browser collectors remain
available only when explicitly selected with `--source`.

## Legacy collectors

The implemented collectors cover the same 24 DGCA-weighted routes and T+1,
T+7, T+15, T+30 and T+45 advance-purchase windows.

| Source | Collector | Access |
|---|---|---|
| Air India Express | `airindiaexpress.py` | Public browser flow; permission/policy review required |
| Akasa Air | `akasaair.py` | Browser flow; written permission required |
| SpiceJet | `spicejet.py` | Browser flow; written permission required |
| Yatra | `yatra.py` | Reviewed public `/flight-schedule/` pages only |

The non-functional API placeholders for IndiGo, Air India, Skyscanner,
Cleartrip, Ixigo, MakeMyTrip, Goibibo and EaseMyTrip were removed. They can be
restored later only when the team has an approved API/feed or written access.

## Install

```powershell
cd scraper
python -m pip install -r requirements.txt
playwright install chromium firefox
```

## Cloud ETL

Every completed full scrape writes its JSON output and then invokes the backend
ETL automatically when `DATABASE_URL` is set. The ETL validates required
fields, preserves unavailable/sold-out rows, separates available fare
components, deduplicates daily flight offers, quarantines inconsistent records
and IQR outliers, and stores raw payloads for audit.

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/vayusetu?sslmode=require"
python run_daily.py
```

`run_daily.py` starts all selected collectors simultaneously with a
`ThreadPoolExecutor`. At completion it prints the measured thread-pool wall
time, the equivalent sequential time (sum of the same collector durations),
time saved, and speedup. The latest report is written to
`last_tpe_benchmark.json`.

Limit concurrency when the machine has less memory:

```powershell
python run_daily.py --workers 2
```

Run a selected authorized source:

```powershell
python run_daily.py --source yatra --headed
python run_daily.py --source akasaair
```

Disable automatic loading when debugging locally:

```powershell
$env:VAYUSETU_AUTO_ETL="false"
```

The database retains `observation_date` in the daily fingerprint. Re-running
the same offer on the same day updates that snapshot; the following day's run
inserts a new snapshot, producing the required 30-day backtest history.
