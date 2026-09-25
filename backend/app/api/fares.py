"""Read-only consumer view of persisted Google Flights observations."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, load_only

from app.database.db import get_db
from app.database.models import FareObservation as Fare, RouteWeight

router = APIRouter(prefix="/fares", tags=["Fare intelligence"])
WINDOWS = (60, 30, 15, 7, 1)
FIELDS = (
    "id", "route_id", "fare", "currency", "price_level", "lowest_price",
    "typical_price_low", "typical_price_high", "airline", "flight_number",
    "departure_time", "arrival_time", "duration_minutes", "stops", "cabin",
    "travel_date", "observation_date", "advance_purchase_days", "collected_at",
)


def eligible(db: Session, departure_date: date | None = None):
    # Never mix legacy/synthetic fares into Google-attributed intelligence.
    query = db.query(Fare).filter(
        Fare.source == "google_flights_serpapi",
        Fare.cleaning_status == "clean",
        Fare.availability_status == "available",
        Fare.is_synthetic.is_(False), Fare.is_outlier.is_(False),
        Fare.fare > 0, Fare.currency == "INR",
        Fare.trip_type == "one_way",
        func.lower(Fare.cabin) == "economy",
    )
    return query.filter(Fare.travel_date == departure_date) if departure_date else query


def serialize(row: Fare) -> dict:
    return {field: getattr(row, field) for field in FIELDS}


def latest_order():
    # Cheapest itinerary within the most recent collected search, not the
    # all-time minimum. Null timestamps fall back to observation date.
    return (Fare.observation_date.desc(), Fare.collected_at.desc().nullslast(), Fare.fare, Fare.id)


@router.get("/coverage", summary="Actual coverage of the stored consumer fare dataset")
def fare_coverage(db: Session = Depends(get_db)):
    observed_routes, observations, updated_at = eligible(db).with_entities(
        func.count(func.distinct(Fare.route_id)), func.count(Fare.id), func.max(Fare.collected_at),
    ).one()
    windows = eligible(db).filter(Fare.advance_purchase_days.in_(WINDOWS)).with_entities(
        Fare.advance_purchase_days,
    ).distinct().all()
    return {
        "registeredRoutes": db.query(func.count(RouteWeight.id)).scalar(),
        "observedRoutes": observed_routes, "observations": observations,
        "observedWindows": sorted((row[0] for row in windows), reverse=True),
        "updatedAt": updated_at,
    }


@router.get("/compare", summary="Latest observed economy fare per route for one departure date")
def compare_fares(departure_date: date, db: Session = Depends(get_db)):
    ranked = eligible(db, departure_date).with_entities(
        Fare.id.label("id"),
        func.row_number().over(partition_by=Fare.route_id, order_by=latest_order()).label("rank"),
    ).subquery()
    rows = (db.query(Fare).options(load_only(*(getattr(Fare, f) for f in FIELDS)))
            .join(ranked, ranked.c.id == Fare.id).filter(ranked.c.rank == 1)
            .order_by(Fare.route_id).all())
    return {"departureDate": departure_date, "fares": [serialize(row) for row in rows]}


@router.get("", summary="Fare insights for an exact route and departure date")
def fare_intelligence(
    departure_date: date,
    route_id: str = Query(..., min_length=1, max_length=50),
    db: Session = Depends(get_db),
):
    query = eligible(db, departure_date).filter(Fare.route_id == route_id.strip().upper())
    current = query.options(load_only(*(getattr(Fare, f) for f in FIELDS))).order_by(*latest_order()).first()
    flights = []
    if current:
        flights = query.options(load_only(*(getattr(Fare, f) for f in FIELDS))).filter(
            Fare.observation_date == current.observation_date,
            Fare.collected_at == current.collected_at,
        ).order_by(Fare.fare, Fare.id).all()
    # Daily route minima are descriptive observations for this exact departure
    # date. They do not assert a matched-flight causal lead-time effect.
    history = query.with_entities(Fare.observation_date, func.min(Fare.fare), func.count(Fare.id)).group_by(
        Fare.observation_date,
    ).order_by(Fare.observation_date).all()
    windows = query.filter(Fare.advance_purchase_days.in_(WINDOWS)).with_entities(
        Fare.advance_purchase_days, func.min(Fare.fare), func.count(Fare.id),
    ).group_by(Fare.advance_purchase_days).all()
    by_window = {days: {"days": days, "fare": fare, "count": count} for days, fare, count in windows}
    return {
        "routeId": route_id.strip().upper(), "departureDate": departure_date,
        "current": serialize(current) if current else None,
        "flights": [serialize(row) for row in flights],
        "history": [{"date": day, "fare": fare, "count": count} for day, fare, count in history],
        "leadTime": [by_window.get(days, {"days": days, "fare": None, "count": 0}) for days in WINDOWS],
    }
