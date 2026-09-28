# VAYUSETU SerpAPI Google Flights collector

`google_flights.py` reads the top-24 directional basket from
`config/routes.json`, validates both endpoints against
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

The complete run performs 120 searches (24 routes x 5 lead times):

```powershell
python google_flights.py
```

If a quota-limited run stops after complete routes, resume from the next
one-based configured route number without repeating earlier paid searches:

```powershell
python google_flights.py --start-route 12
```

Every response is retained under `backend/data/raw/google_flights`, grouped
normalized output is stored under `backend/data/processed/google_flights`, and
the run folder contains the flat scraper payload plus `failed_routes.json`.
Timestamped filenames prevent a later scrape from overwriting an earlier one.

Google Flights output is automatically loaded by the ETL when `DATABASE_URL`
is configured. The adapter maps airport-code records to the existing weighted
city route, accepts T+60, and persists SerpAPI price-insight fields. Use
`--no-etl` when only JSON artifacts are wanted.

Google Flights via SerpAPI is the only active scraper source. Individual
airline and OTA browser collectors are not included.

## Install

```powershell
cd scraper
python -m pip install -r requirements.txt
```

## Cloud ETL

Every completed full scrape writes its JSON output and then invokes the backend
ETL automatically when `DATABASE_URL` is set. The ETL validates required
fields, preserves unavailable rows, stores available Google price insights,
deduplicates daily flight offers, quarantines IQR outliers, and stores raw
payloads for audit.

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/vayusetu?sslmode=require"
python google_flights.py
```

Disable automatic loading when debugging locally:

```powershell
$env:VAYUSETU_AUTO_ETL="false"
```

The database retains `observation_date` in the daily fingerprint. Re-running
the same offer on the same day updates that snapshot; the following day's run
inserts a new snapshot, producing the required 30-day backtest history.
