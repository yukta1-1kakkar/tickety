"""CSV-driven domestic fare collection through SerpAPI Google Flights."""

from __future__ import annotations

import argparse
import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv

if __package__:
    from .domestic_routes import DEFAULT_ROUTE_CSV, DomesticRoute, load_domestic_routes
    from .google_flights_parser import normalize_response
    from .persistence import persist_scraper_output
    from .serpapi_client import SerpAPIClient, SerpAPIQuotaError
else:
    from domestic_routes import DEFAULT_ROUTE_CSV, DomesticRoute, load_domestic_routes
    from google_flights_parser import normalize_response
    from persistence import persist_scraper_output
    from serpapi_client import SerpAPIClient, SerpAPIQuotaError


DEFAULT_LEAD_TIMES = (1, 7, 15, 30, 60)
SCRAPER_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRAPER_DIR.parent
DEFAULT_DATA_DIR = PROJECT_DIR / "backend" / "data"
LOG = logging.getLogger("vayusetu.google_flights")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} must be numeric") from exc


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc


def _safe_run_id(now: datetime | None = None) -> str:
    return (now or datetime.now(timezone.utc)).strftime("%Y%m%dT%H%M%S%fZ")


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise FileExistsError(f"Refusing to overwrite scrape artifact: {path}")
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def store_result(
    data_dir: Path, route: DomesticRoute, departure_date: str, run_id: str,
    raw_payload: dict, normalized_payload: list[dict],
) -> tuple[Path, Path]:
    raw_path = data_dir / "raw" / "google_flights" / route.route_id / departure_date / f"{run_id}.json"
    clean_path = data_dir / "processed" / "google_flights" / route.route_id / departure_date / f"{run_id}.json"
    _write_json(raw_path, raw_payload)
    _write_json(clean_path, normalized_payload)
    return raw_path, clean_path


def scrape_routes(
    routes: Iterable[DomesticRoute], lead_times: Iterable[int], client: SerpAPIClient,
    data_dir: Path = DEFAULT_DATA_DIR, *, today: date | None = None,
) -> dict:
    search_date = today or datetime.now(timezone.utc).date()
    run_id = _safe_run_id()
    records: list[dict] = []
    failures: list[dict] = []
    success_count = 0
    quota_exhausted = False
    route_list = list(routes)
    windows = tuple(dict.fromkeys(lead_times))

    for route_index, route in enumerate(route_list, start=1):
        for lead_time in windows:
            departure_date = (search_date + timedelta(days=lead_time)).isoformat()
            LOG.info("[%s/%s] %s T+%s (%s)", route_index, len(route_list), route.route_id, lead_time, departure_date)
            try:
                raw = client.search_flights(
                    departure_id=route.origin_airport,
                    arrival_id=route.destination_airport,
                    outbound_date=departure_date,
                )
                normalized = normalize_response(raw, route, departure_date, lead_time)
                store_result(data_dir, route, departure_date, run_id, raw, normalized)
                records.extend(normalized)
                success_count += 1
            except SerpAPIQuotaError as exc:
                failures.append({
                    "route_id": route.route_id, "departure_date": departure_date,
                    "lead_time_days": lead_time, "error": str(exc), "error_type": "quota",
                })
                quota_exhausted = True
                LOG.error("Quota exhausted at %s T+%s: %s", route.route_id, lead_time, exc)
                break
            except Exception as exc:  # isolate one failed search from the basket
                failures.append({
                    "route_id": route.route_id, "departure_date": departure_date,
                    "lead_time_days": lead_time, "error": str(exc),
                    "error_type": type(exc).__name__,
                })
                LOG.exception("Search failed for %s T+%s", route.route_id, lead_time)
        if quota_exhausted:
            break

    run_dir = data_dir / "processed" / "google_flights" / "runs" / run_id
    output_path = run_dir / "google_flights_routes.json"
    failure_path = run_dir / "failed_routes.json"
    payload = {
        "platform": "Google Flights via SerpAPI",
        "source": "google_flights_serpapi",
        "run_id": run_id,
        "search_date": search_date.isoformat(),
        "lead_times": list(windows),
        "routes": records,
    }
    _write_json(output_path, payload)
    _write_json(failure_path, {"run_id": run_id, "failures": failures})
    return {
        "run_id": run_id, "route_count": len(route_list),
        "searches_succeeded": success_count, "records": len(records),
        "failures": len(failures), "quota_exhausted": quota_exhausted,
        "output_path": output_path, "failure_path": failure_path,
    }


def _lead_times(value: str) -> tuple[int, ...]:
    try:
        result = tuple(int(item.strip()) for item in value.split(",") if item.strip())
    except ValueError as exc:
        raise argparse.ArgumentTypeError("lead times must be comma-separated integers") from exc
    if not result:
        raise argparse.ArgumentTypeError("at least one lead time is required")
    unsupported = sorted(set(result) - set(DEFAULT_LEAD_TIMES))
    if unsupported:
        allowed = ", ".join(str(item) for item in DEFAULT_LEAD_TIMES)
        raise argparse.ArgumentTypeError(
            f"unsupported lead time(s): {', '.join(map(str, unsupported))}; allowed windows: {allowed}"
        )
    return result


def main() -> None:
    load_dotenv(SCRAPER_DIR / ".env")
    load_dotenv(PROJECT_DIR / "backend" / ".env")
    parser = argparse.ArgumentParser(description="Scrape the complete domestic route basket via SerpAPI")
    parser.add_argument("--routes", type=Path, default=DEFAULT_ROUTE_CSV, help="route_weights CSV")
    parser.add_argument("--lead-times", type=_lead_times, default=DEFAULT_LEAD_TIMES)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--max-routes", type=int, help="limit routes for a controlled smoke test")
    parser.add_argument("--dry-run", action="store_true", help="validate routes/config without API calls")
    parser.add_argument("--no-etl", action="store_true", help="save JSON without loading it into the database")
    args = parser.parse_args()
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")

    routes, rejected = load_domestic_routes(args.routes)
    if rejected:
        LOG.warning("Rejected %s route rows; details will be shown in dry-run output", len(rejected))
    if args.max_routes is not None:
        routes = routes[:max(0, args.max_routes)]
    expected_searches = len(routes) * len(args.lead_times)
    if args.dry_run:
        print(json.dumps({
            "route_file": str(args.routes.resolve()), "valid_routes": len(routes),
            "rejected_routes": rejected, "lead_times": list(args.lead_times),
            "expected_api_searches": expected_searches,
        }, indent=2))
        return

    api_key = os.getenv("SERPAPI_API_KEY", "").strip()
    client = SerpAPIClient(
        api_key=api_key,
        base_url=os.getenv("SERPAPI_BASE_URL", "https://serpapi.com/search"),
        timeout_seconds=_env_float("SERPAPI_TIMEOUT_SECONDS", 45),
        max_retries=_env_int("SERPAPI_MAX_RETRIES", 3),
        backoff_seconds=_env_float("SERPAPI_BACKOFF_SECONDS", 1),
        request_delay_seconds=_env_float("SERPAPI_REQUEST_DELAY_SECONDS", 1),
    )
    summary = scrape_routes(routes, args.lead_times, client, args.data_dir)
    if not args.no_etl and summary["records"]:
        persist_scraper_output(summary["output_path"])
    print(json.dumps({key: str(value) if isinstance(value, Path) else value for key, value in summary.items()}, indent=2))
    if summary["quota_exhausted"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
