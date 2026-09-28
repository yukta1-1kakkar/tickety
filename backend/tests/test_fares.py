from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.db import Base, get_db
from app.database.models import FareObservation, RouteWeight
from app.main import app


@pytest.fixture
def fares_client():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        db.add(RouteWeight(route_id="DEL-BOM", origin="Delhi", destination="Mumbai", weight=1))
        db.commit()
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app) as client:
            yield client, db
        app.dependency_overrides.clear()
    engine.dispose()


def add_fare(db, fare=5000, days=7, **changes):
    travel = date(2026, 10, 15)
    observed = travel - timedelta(days=days)
    values = dict(route_id="DEL-BOM", airline="Test airline", flight_number="TEST101",
                  travel_date=travel, observation_date=observed, advance_purchase_days=days,
                  fare=fare, source="google_flights_serpapi", cleaning_status="clean",
                  collected_at=datetime(observed.year, observed.month, observed.day, 10, tzinfo=timezone.utc))
    values.update(changes)
    row = FareObservation(**values)
    db.add(row)
    db.commit()
    return row


def test_latest_search_not_historical_minimum_and_no_invented_insights(fares_client):
    client, db = fares_client
    add_fare(db, 1000, days=60)
    add_fare(db, 7000, days=7)
    newest = add_fare(db, 6500, days=7, price_level="High", lowest_price=4500,
                      typical_price_low=5000, typical_price_high=6000, stops=0)
    payload = client.get("/api/fares", params={"route_id": "DEL-BOM", "departure_date": "2026-10-15"}).json()
    assert payload["current"]["id"] == newest.id
    assert payload["current"]["fare"] == 6500
    assert payload["current"]["price_level"] == "High"
    assert payload["current"]["stops"] == 0
    assert payload["current"]["departure_time"] is None
    assert "raw_payload" not in payload["current"]
    assert [point["days"] for point in payload["leadTime"]] == [60, 30, 15, 7, 1]
    assert payload["leadTime"][1] == {"days": 30, "fare": None, "count": 0}
    assert payload["history"][1]["fare"] == 6500


@pytest.mark.parametrize("changes", [
    {"is_synthetic": True}, {"is_outlier": True}, {"source": "legacy"},
    {"cleaning_status": "rejected"}, {"availability_status": "no_flights"},
    {"currency": "USD"}, {"cabin": "business"}, {"trip_type": "round_trip"},
    {"travel_date": date(2026, 10, 16)},
])
def test_comparison_and_search_exclude_incomparable_quotes(fares_client, changes):
    client, db = fares_client
    add_fare(db, **changes)
    params = {"departure_date": "2026-10-15", "route_id": "DEL-BOM"}
    assert client.get("/api/fares", params=params).json()["current"] is None
    assert client.get("/api/fares/compare", params=params).json()["fares"] == []


def test_exact_route_date_validation_and_null_insights(fares_client):
    client, db = fares_client
    add_fare(db)
    params = {"departure_date": "2026-10-15", "route_id": "BOM-DEL"}
    assert client.get("/api/fares", params=params).json()["current"] is None
    assert client.get("/api/fares", params={**params, "departure_date": "invalid"}).status_code == 422
    row = client.get("/api/fares/compare", params=params).json()["fares"][0]
    assert row["price_level"] is None
    assert row["lowest_price"] is None
    assert row["typical_price_low"] is None


def test_newer_collection_wins_over_cheaper_stale_quote(fares_client):
    client, db = fares_client
    add_fare(db, 2000)
    add_fare(db, 8000, collected_at=datetime(2026, 10, 8, 11, tzinfo=timezone.utc))
    params = {"departure_date": "2026-10-15", "route_id": "DEL-BOM"}
    assert client.get("/api/fares", params=params).json()["current"]["fare"] == 8000
    assert client.get("/api/fares/compare", params=params).json()["fares"][0]["fare"] == 8000


def test_flight_comparison_keeps_only_the_latest_search(fares_client):
    client, db = fares_client
    add_fare(db, 1000, days=60)
    add_fare(db, 2000)
    timestamp = datetime(2026, 10, 8, 11, tzinfo=timezone.utc)
    first = add_fare(db, 6500, collected_at=timestamp)
    second = add_fare(db, 8000, collected_at=timestamp, airline="Second airline")
    params = {"departure_date": "2026-10-15", "route_id": "DEL-BOM"}
    payload = client.get("/api/fares", params=params).json()
    assert [row["id"] for row in payload["flights"]] == [first.id, second.id]
    assert all("raw_payload" not in row for row in payload["flights"])


def test_coverage_excludes_routes_outside_configured_basket(fares_client):
    client, db = fares_client
    db.add(RouteWeight(route_id="BOM-DEL", origin="Mumbai", destination="Delhi", weight=0))
    db.commit()
    empty = client.get("/api/fares/coverage").json()
    assert empty == {"registeredRoutes": 1, "observedRoutes": 0, "observations": 0, "observedWindows": [], "updatedAt": None}
    add_fare(db, days=60)
    add_fare(db, days=7)
    add_fare(db, days=1, is_synthetic=True)
    covered = client.get("/api/fares/coverage").json()
    assert covered["registeredRoutes"] == 1
    assert covered["observedRoutes"] == 1
    assert covered["observations"] == 2
    assert covered["observedWindows"] == [60, 7]
    assert covered["updatedAt"].startswith("2026-10-08")


def test_trends_render_all_windows_without_route_or_date_selection(fares_client):
    client, db = fares_client
    add_fare(db, fare=4200, days=60, source="legacy-airline")
    add_fare(db, fare=4800, days=30)
    add_fare(db, fare=5400, days=15)
    add_fare(db, fare=6100, days=7)
    add_fare(db, fare=9000, days=1, is_synthetic=True)

    payload = client.get("/api/fares/trends").json()

    assert [point["days"] for point in payload["points"]] == [60, 30, 15, 7, 1]
    assert [point["fare"] for point in payload["points"]] == [4200, 4800, 5400, 6100, None]
    assert payload["points"][0]["routes"] == 1
    assert payload["points"][0]["observations"] == 1
    assert [point["index"] for point in payload["points"]] == [100, 114.29, 128.57, 145.24, None]
    assert payload["routeId"] is None
    assert payload["baselineWindow"] == 60
    assert payload["method"] == "Lead-time fare index; longest observed window equals 100"

    route_payload = client.get("/api/fares/trends", params={"route_id": "DEL-BOM"}).json()
    assert route_payload["routeId"] == "DEL-BOM"
    assert route_payload["points"] == payload["points"]
    assert client.get("/api/fares/trends", params={"route_id": "BOM-DEL"}).status_code == 404


def test_trends_heatmap_returns_route_cells_relative_to_t60(fares_client):
    client, db = fares_client
    add_fare(db, fare=5000, days=60)
    add_fare(db, fare=4000, days=30)
    add_fare(db, fare=6250, days=1)

    payload = client.get("/api/fares/trends/heatmap").json()

    assert payload["windows"] == [1, 7, 15, 30, 60]
    assert len(payload["routes"]) == 24
    route = next(row for row in payload["routes"] if row["displayId"] == "DEL-BOM")
    assert [cell["days"] for cell in route["cells"]] == [1, 7, 15, 30, 60]
    assert route["cells"][0]["fare"] == 6250
    assert route["cells"][0]["changePercent"] == 25
    assert route["cells"][3]["changePercent"] == -20
    assert route["cells"][4]["changePercent"] == 0
    assert route["cells"][1] == {"days": 7, "fare": None, "observations": 0, "changePercent": None}
