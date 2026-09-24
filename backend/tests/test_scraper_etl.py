import json
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.db import Base
from app.database.models import FareObservation, RejectedObservation, RouteWeight, ScrapeRun
from app.etl.scraper_pipeline import load_scraper_file, transform_records


def sample_record(number, fare, **changes):
    record = {
        "observation_id": f"obs-{number}",
        "collection_timestamp": "2026-08-28T10:00:00+05:30",
        "route_id": "DELHI-MUMBAI",
        "origin": "DEL",
        "destination": "BOM",
        "travel_date": "2026-09-04",
        "advance_purchase_days": 7,
        "airline_name": "Example Air",
        "airline_code": "EX",
        "flight_number": f"EX{number}",
        "departure_time": f"2026-09-04T0{number}:00:00+05:30",
        "total_fare": fare,
        "availability_status": "available",
        "source": "Test Source",
    }
    record.update(changes)
    return record


def serpapi_record():
    return {
        "route_id": "DEL_BOM",
        "origin_city": "Delhi",
        "origin_airport": "DEL",
        "destination_city": "Mumbai",
        "destination_airport": "BOM",
        "departure_date": "2026-10-15",
        "lead_time_days": 60,
        "scrape_timestamp": "2026-08-16T09:30:12Z",
        "airline": "IndiGo",
        "flight_number": "6E2056",
        "departure_time": "23:10",
        "arrival_time": "01:25",
        "duration_minutes": 135,
        "stops": 0,
        "cabin_class": "Economy",
        "total_fare": 5120,
        "currency": "INR",
        "price_level": "Low",
        "lowest_price": 4850,
        "typical_price_low": 5600,
        "typical_price_high": 6300,
        "price_source": "google_flights_serpapi",
    }


def test_transform_preserves_unavailable_and_quarantines_outlier():
    raw = [
        sample_record(1, 5000),
        sample_record(2, 5100),
        sample_record(3, 5200),
        sample_record(4, 20000),
        sample_record(5, None, no_flights=True, availability_status="no_flights"),
    ]
    records, rejected = transform_records(raw, "Test Source")

    assert rejected == []
    assert sum(row["cleaning_status"] == "outlier" for row in records) == 1
    assert next(row for row in records if row["flight_number"] == "EX5")["cleaning_status"] == "unavailable"


def test_transform_deduplicates_same_daily_offer():
    first = sample_record(1, 5000)
    updated = sample_record(1, 5050)
    records, rejected = transform_records([first, updated], "Test Source")

    assert rejected == []
    assert len(records) == 1
    assert records[0]["fare"] == 5050


def test_transform_maps_serpapi_schema_and_price_insights():
    records, rejected = transform_records([serpapi_record()], "Google Flights via SerpAPI")

    assert rejected == []
    assert records[0]["route_id"] == "DELHI-MUMBAI"
    assert records[0]["advance_purchase_days"] == 60
    assert records[0]["fare"] == 5120
    assert records[0]["price_level"] == "Low"
    assert records[0]["lowest_price"] == 4850
    assert records[0]["typical_price_low"] == 5600
    assert records[0]["typical_price_high"] == 6300
    assert records[0]["departure_time"].hour == 23
    assert records[0]["arrival_time"].date() == date(2026, 10, 16)
    assert records[0]["source"] == "google_flights_serpapi"


def test_load_file_persists_serpapi_price_insights(tmp_path):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(RouteWeight(
        route_id="DELHI-MUMBAI", origin="DELHI", destination="MUMBAI",
        total_passengers=100, weight=1.0,
    ))
    db.commit()
    output = tmp_path / "google_flights_routes.json"
    output.write_text(json.dumps({
        "platform": "Google Flights via SerpAPI",
        "routes": [serpapi_record()],
    }), encoding="utf-8")

    summary = load_scraper_file(output, db=db)
    observation = db.query(FareObservation).one()

    assert summary["inserted"] == 1
    assert observation.route_id == "DELHI-MUMBAI"
    assert observation.advance_purchase_days == 60
    assert observation.price_level == "Low"
    assert observation.lowest_price == 4850
    assert observation.typical_price_low == 5600
    assert observation.typical_price_high == 6300


def test_load_file_inserts_then_updates_daily_snapshots(tmp_path):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(RouteWeight(
        route_id="DELHI-MUMBAI", origin="DELHI", destination="MUMBAI",
        total_passengers=100, weight=1.0,
    ))
    db.commit()
    output = tmp_path / "google_flights_routes.json"
    output.write_text(json.dumps({"platform": "Test Source", "routes": [sample_record(1, 5000)]}), encoding="utf-8")

    first = load_scraper_file(output, db=db)
    second = load_scraper_file(output, db=db)

    assert first["inserted"] == 1
    assert second["updated"] == 1
    assert db.query(FareObservation).count() == 1
    assert db.query(ScrapeRun).count() == 2
    assert db.query(RejectedObservation).count() == 0
    assert db.query(FareObservation).one().observation_date == date(2026, 8, 28)
