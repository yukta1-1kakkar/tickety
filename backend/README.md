# ?? VAYUSETU: Real-time Airfare Price Index for India

> **A Real-time Airfare Price Index for India through Automated Web Scraping of Airline and Online Travel Aggregator Portals for Augmentation of the Consumer Price Index (CPI).**

---

## ?? Overview

The **VAYUSETU Backend** calculates high-frequency airfare indices across Indian domestic routes. By combining **DGCA (Directorate General of Civil Aviation)** city-pair passenger traffic with base-period airfares, VAYUSETU computes a fixed-base **Modified Laspeyres Airfare Price Index** to augment the transport basket of India's Consumer Price Index (CPI).

---

## ?? Mathematical Methodology

### 1. DGCA Route Passenger Weights
Passenger traffic weights are calculated by aggregating directional and bi-directional passenger traffic across all DGCA city-pair monthly reports:

$$\\text{Weight}(r) = \\frac{\\text{Passengers}_r}{\\sum_{k \\in \\text{All Routes}} \\text{Passengers}_k}, \\quad \\sum_{r} \\text{Weight}(r) = 1.000000$$

### 2. Base-Period Expenditure Weights
For each route, DGCA passenger share acts as the base quantity and the base-period representative fare is its geometric cohort mean:

$$p_{r,0}=\left(\prod_{c \in C_{r,0}}p_{r,c,0}\right)^{1/|C_{r,0}|},\qquad W_{r,0}=\frac{q_{r,0}p_{r,0}}{\sum_k q_{k,0}p_{k,0}}$$

### 3. Fixed-Base Matched Price-Relative Index
For target observation date $t$, base date $0$, and advance-purchase window $d$:

$$R_{r,t,d}=\left(\prod_{c \in C_{r,0}\cap C_{r,t}}\frac{p_{r,c,t,d}}{p_{r,c,0,d}}\right)^{1/|C_{r,0}\cap C_{r,t}|}$$

$$\text{APIx}_{t,d}=100\sum_{r \in M_t}\widetilde{W}_{r,0}R_{r,t,d},\qquad \widetilde{W}_{r,0}=\frac{q_{r,0}p_{r,0}}{\sum_{k \in M_t}q_{k,0}p_{k,0}}$$

Where:
- $q_{r,0}$ is the route's DGCA passenger-traffic share and $p_{r,0}$ is its base fare level.
- $M_t$ is the subset of the top-24 basket observed in both base and target periods.
- The lower level uses the geometric mean of identical `(route, airline, source)` cohort relatives, reducing source-mix and extreme-relative bias.
- The upper level uses arithmetic base-expenditure weights, as required by a modified Laspeyres structure. `coverage_weight` reports the original DGCA traffic share represented.
- The base date therefore evaluates to 100. Unknown or unweighted routes do not enter APIx.

### 4. Percentage Change From Base
Because the base is normalized to 100:

$$\\Delta \\% = \\text{APIx}_t - 100$$

### 5. Anomaly Detection (Statistical Z-Score)
Pricing anomalies and fare surges are flagged when:

$$Z = \\frac{\\text{Fare} - \\mu}{\\sigma}, \\quad |Z| > 2.0$$

---

## ??? Project Architecture & Directory Structure

```
VAYUSETU/backend/
??? app/
?   ??? __init__.py
?   ??? main.py                     # FastAPI application entry point & CORS
?   ??? api/
?   ?   ??? __init__.py
?   ?   ??? health.py               # GET /health
?   ?   ??? routes.py               # GET /routes, GET /routes/{route_id}
?   ?   ??? index.py                # GET /index, GET /index/history
?   ?   ??? analytics.py            # GET /analytics, GET /fare-status
?   ?   ??? ingest.py               # POST /ingest/fare, POST /ingest/bulk, POST /ingest/compute-weights
?   ??? services/
?   ?   ??? __init__.py
?   ?   ??? loader.py               # Multi-format Excel ingestion (City-Pair, Airline, CPI)
?   ?   ??? cleaner.py              # City name standardization & traffic aggregation
?   ?   ??? route_weights.py        # DGCA traffic weights computation (sum=1.0)
?   ?   ??? fare_adapter.py         # Ingestion, validation & upserting for scrapers
?   ?   ??? index_engine.py         # DGCA-weighted matched price-relative APIx engine
?   ?   ??? analytics.py            # 7-day changes, rolling mean, Z-score anomalies
?   ??? database/
?   ?   ??? __init__.py
?   ?   ??? db.py                   # PostgreSQL/SQLite engine and session handling
?   ?   ??? models.py               # RouteWeight, FareObservation, CPIReference
?   ??? schemas/
?       ??? __init__.py
?       ??? ingest.py               # Pydantic v2 schemas for scraper input
?       ??? response.py             # Pydantic response schemas
??? data/
?   ??? raw/                        # Raw DGCA Excel files go here
?   ??? processed/                  # Processed datasets (route_weights.csv)
??? tests/
?   ??? __init__.py
?   ??? test_loader.py              # Tests for Excel loaders & section parser
?   ??? test_cleaner.py             # Tests for city normalization & aggregation
?   ??? test_index.py               # Tests for weighting math, index engine, analytics & API
??? requirements.txt
??? README.md
```

---

## ? Quick Start Guide (Windows / PowerShell)

### 1. Create and Activate Virtual Environment
```powershell
cd VAYUSETU/backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 3. Apply the PostgreSQL Schema
```powershell
npm install
Copy-Item .env.example .env
# Set DATABASE_URL and DIRECT_URL in .env, then:
npm run db:validate
npm run db:deploy
```

### 4. Run Pytest Suite
```powershell
pytest -v
```

### 5. Start the FastAPI Development Server
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Alternative ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## ?? API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System health and database connectivity status |
| `GET` | `/routes` | Paginated list of DGCA routes with traffic weights (`?limit=50&search=DEL`) |
| `GET` | `/routes/{route_id}` | Detailed weight and passenger statistics for a specific route |
| `GET` | `/index` | Compute matched-basket APIx (`?advance_purchase=7&target_date=YYYY-MM-DD`) |
| `GET` | `/index/history` | Historical daily price index time-series points |
| `GET` | `/analytics` | 7-day route price changes, overall index trend, rolling mean, anomalies |
| `GET` | `/fare-status` | Database summary: total observations, active routes, date range |
| `POST` | `/ingest/fare` | Ingest single scraped fare observation |
| `POST` | `/ingest/bulk` | Batch ingest multiple scraped fare observations |
| `POST` | `/ingest/compute-weights`| Recompute route weights from raw Excel files in `data/raw/` |

---

## ?? Sample Ingestion Payloads

### Single Ingestion (`POST /ingest/fare`)
```json
{
  "route_id": "DEL-BOM",
  "airline": "IndiGo",
  "travel_date": "2026-09-01",
  "observation_date": "2026-08-25",
  "advance_purchase_days": 7,
  "fare": 4850.0,
  "currency": "INR",
  "source": "makemytrip"
}
```

### Bulk Ingestion (`POST /ingest/bulk`)
```json
{
  "fares": [
    {
      "route_id": "DEL-BOM",
      "airline": "IndiGo",
      "travel_date": "2026-09-01",
      "observation_date": "2026-08-25",
      "advance_purchase_days": 7,
      "fare": 4850.0,
      "source": "makemytrip"
    },
    {
      "route_id": "BLR-DEL",
      "airline": "Air India",
      "travel_date": "2026-09-01",
      "observation_date": "2026-08-25",
      "advance_purchase_days": 7,
      "fare": 5200.0,
      "source": "easemytrip"
    }
  ]
}
```

---

## ?? DGCA Raw Excel File Parsing Instructions
Place your DGCA `.xlsx` files inside `data/raw/`:
1. **City-Pair Files** (e.g. `DOM CITYPAIR DATA, JAN 2026.xlsx`): Header at row 2, filters out subtotals/totals automatically.
2. **Airline Files** (e.g. `indigo26.xlsx`, `Air India26.xlsx`): Parses first section (*Scheduled Domestic Services*), reads 17 DGCA columns, stops at `MONTH == "TOTAL"`.
3. Recompute anytime via `POST /ingest/compute-weights`.

---

## Cloud PostgreSQL, Prisma and scraper ETL

Prisma manages the PostgreSQL schema and production migrations. FastAPI and
the ETL use SQLAlchemy against the same `DATABASE_URL`.

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Put the hosted PostgreSQL URL in .env, then:
npm run db:validate
npm run db:deploy
python -m pip install -r requirements.txt
python -m app.etl.scraper_pipeline --input-dir ..\scraper --dry-run
python -m app.etl.scraper_pipeline --input-dir ..\scraper
```

For Neon or Supabase, use the pooled runtime URL as `DATABASE_URL` and the
direct URL as `DIRECT_URL`. Never commit either credential. The ETL stores one
deduplicated snapshot per offer and observation date, enabling daily 30-day
backtesting while retaining raw and rejected records for audit.

The frontend reads `GET /api/dashboard/live` immediately on page load and then
refreshes every two hours. The API caches the generated dashboard snapshot for
the same two-hour window, coalesces simultaneous cache misses, and returns
browser cache headers so remounts and additional tabs do not repeat the work.
For a deployed backend, set `VITE_API_URL` in `frontend/.env` to its `/api`
URL before building the frontend. Airfare metrics never fall back to demo data.

## Deployed frontend/backend integration

- Frontend: `https://vayusetu-ten.vercel.app`
- Backend: `https://vayusetu.onrender.com`
- Production API base: `https://vayusetu.onrender.com/api`

Vite reads the deployed API base from `frontend/.env.production`. Render must
set `FRONTEND_ORIGINS=https://vayusetu-ten.vercel.app`; add any Vercel preview
or custom domains to that comma-separated value explicitly. Render should start
the API with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

The repository-root `render.yaml` records this deployment contract. Existing
manually configured Render services should use the same root directory, build
command, start command and environment variables in their dashboard settings.

## APIx backtesting

Run the internal 30-day stability and real-date holdout diagnostics:

```powershell
python -m app.services.backtesting --advance-purchase 7
```

The same report is exposed at `GET /api/backtest?advance_purchase=7`.
This report explicitly labels synthetic observations. It is a prototype
pipeline/index backtest, not a substitute for validation against an official
route-fare benchmark.

## Official MoSPI CPI comparison data

Import the supplied MoSPI dashboard workbook into the shared PostgreSQL
`cpi_reference` table:

```powershell
python -m app.services.cpi_import --file data/raw/mospi_cpi_dashboard_july_2026.xlsx
```

The dashboard compares monthly APIx with All-India General CPI (Combined),
rebasing both series to 100 at their first overlapping month. This workbook
does not contain the Transport & Communication sub-group, so that series is
reported as unavailable rather than estimated.
