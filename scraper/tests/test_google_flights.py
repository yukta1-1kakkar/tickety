import json
from datetime import date, datetime, timezone

import pytest

from scraper.domestic_routes import DEFAULT_ROUTE_CSV, DomesticRoute, load_domestic_routes
from scraper.google_flights import DEFAULT_LEAD_TIMES, _lead_times, scrape_routes
from scraper.google_flights_parser import normalize_response
from scraper.serpapi_client import SerpAPIClient, SerpAPIQuotaError


ROUTE = DomesticRoute(
    route_id="DELHI-MUMBAI", origin_city="DELHI", destination_city="MUMBAI",
    origin_airport="DEL", destination_airport="BOM", total_passengers=1, weight=1,
)


def response_payload():
    return {
        "search_metadata": {"id": "search-123", "status": "Success", "google_flights_url": "https://example.test"},
        "best_flights": [{
            "flights": [{
                "departure_airport": {"id": "DEL", "time": "2026-10-01 08:10"},
                "arrival_airport": {"id": "BOM", "time": "2026-10-01 10:25"},
                "duration": 135, "airline": "IndiGo", "flight_number": "6E 2056",
                "travel_class": "Economy",
            }],
            "total_duration": 135, "price": 5120, "type": "One way",
        }],
        "other_flights": [],
        "price_insights": {
            "lowest_price": 4850.4,
            "price_level": "low",
            "typical_price_range": [5600.2, 6299.7],
        },
    }


def test_complete_csv_basket_is_domestic_and_resolved():
    routes, rejected = load_domestic_routes(DEFAULT_ROUTE_CSV)

    assert len(routes) == 765
    assert rejected == []
    assert len({route.route_id for route in routes}) == 765


def test_parser_produces_flat_serpapi_schema():
    records = normalize_response(
        response_payload(), ROUTE, "2026-10-01", 7,
        datetime(2026, 9, 24, 3, 0, tzinfo=timezone.utc),
    )

    assert records[0]["route_id"] == "DEL_BOM"
    assert records[0]["total_fare"] == 5120
    assert records[0]["price_level"] == "Low"
    assert records[0]["lowest_price"] == 4850
    assert records[0]["typical_price_low"] == 5600
    assert records[0]["typical_price_high"] == 6300
    assert records[0]["flight_number"] == "6E2056"
    assert records[0]["departure_time"] == "08:10"
    assert records[0]["stops"] == 0
    removed = {
        "base_fare", "taxes", "user_development_fee", "convenience_fee",
        "mandatory_fees", "seats_available", "sold_out",
    }
    assert removed.isdisjoint(records[0])


def test_batch_keeps_running_after_one_search_failure(tmp_path):
    class FakeClient:
        calls = 0

        def search_flights(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("temporary route failure")
            return response_payload()

    summary = scrape_routes([ROUTE], (1, 7), FakeClient(), tmp_path, today=date(2026, 9, 23))

    assert summary["searches_succeeded"] == 1
    assert summary["failures"] == 1
    failed = json.loads(summary["failure_path"].read_text(encoding="utf-8"))
    assert failed["failures"][0]["lead_time_days"] == 1


def test_quota_errors_are_identified_from_json_payload():
    with pytest.raises(SerpAPIQuotaError):
        SerpAPIClient._raise_api_error({"error": "Your account has run out of searches per month."})


def test_parser_handles_missing_price_insights_and_no_flights():
    records = normalize_response(
        {"search_metadata": {"id": "empty", "status": "Success"}},
        ROUTE, "2026-10-01", 7,
    )

    assert records == []


def test_parser_uses_null_for_omitted_price_insights():
    payload = response_payload()
    payload.pop("price_insights")
    record = normalize_response(payload, ROUTE, "2026-10-01", 7)[0]

    assert record["price_level"] is None
    assert record["lowest_price"] is None
    assert record["typical_price_low"] is None
    assert record["typical_price_high"] is None


def test_required_default_lead_times():
    assert DEFAULT_LEAD_TIMES == (1, 7, 15, 30, 60)


def test_unsupported_lead_time_is_rejected():
    with pytest.raises(Exception, match="unsupported lead time"):
        _lead_times("3")
