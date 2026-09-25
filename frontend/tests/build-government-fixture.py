"""Produce a test-only dashboard payload using the real aggregation service."""
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.database.db import Base
from app.database.models import FareObservation, RouteWeight, CPIReference
from app.services.live_dashboard import build_live_dashboard

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
with Session(engine) as db:
    for route_id, dest in [("DEL-BOM", "BOM"), ("DEL-BLR", "BLR")]:
        db.add(RouteWeight(route_id=route_id, origin="DEL", destination=dest, weight=.5, total_passengers=100))
        for day in [date(2026, 9, 1), date(2026, 9, 2)]:
            for window in [60, 30, 15, 7, 1]:
                db.add(FareObservation(
                    route_id=route_id, airline="Fixture Airways", flight_number="TEST101",
                    observation_date=day, travel_date=day + timedelta(days=window),
                    advance_purchase_days=window, fare=5000 + (60 - window) * 20 + day.day * 10,
                    source="google_flights_serpapi", cleaning_status="clean",
                    collected_at=datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc),
                ))
    db.add(CPIReference(month="2026-09", combined_index=100, transport_index=100))
    db.commit()
    payload = build_live_dashboard(db)
target = Path(__file__).resolve().parents[1] / "test-results" / "government-fixture.json"
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(payload), encoding="utf-8")
