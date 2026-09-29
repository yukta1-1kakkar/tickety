"""Read-only consumer view of persisted Google Flights observations."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, load_only

from app.database.db import get_db
from app.database.models import FareObservation as Fare, RouteWeight
from app.config.routes import ALLOWED_ROUTE_IDS, configured_routes, is_configured_route

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
        Fare.route_id.in_(ALLOWED_ROUTE_IDS),
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
        "registeredRoutes": db.query(func.count(RouteWeight.id)).filter(
            RouteWeight.route_id.in_(ALLOWED_ROUTE_IDS)
        ).scalar(),
        "observedRoutes": observed_routes, "observations": observations,
        "observedWindows": sorted((row[0] for row in windows), reverse=True),
        "updatedAt": updated_at,
    }


@router.get("/trends", summary="Basket-wide fare curve across booking windows")
def fare_trends(
    route_id: str | None = Query(None, min_length=1, max_length=50),
    db: Session = Depends(get_db),
):
    """Return one directly comparable point for each configured lead-time window.

    Fares are first averaged within each route/window so heavily scraped routes
    do not dominate. Those route averages are then combined using the stored
    passenger weights, renormalized over routes observed in that window.
    Historical and current sources are included, but rejected, synthetic,
    unavailable, non-economy, and outlier observations are excluded.
    """
    selected_route = route_id.strip().upper() if route_id else None
    if selected_route and not is_configured_route(selected_route):
        raise HTTPException(status_code=404, detail=f"Route '{selected_route}' is not in the configured basket")
    query = db.query(
        Fare.route_id,
        Fare.advance_purchase_days,
        func.avg(Fare.fare).label("average_fare"),
        func.count(Fare.id).label("observations"),
        func.min(Fare.observation_date).label("first_observation"),
        func.max(Fare.observation_date).label("last_observation"),
    ).filter(
        Fare.route_id.in_(ALLOWED_ROUTE_IDS),
        Fare.advance_purchase_days.in_(WINDOWS),
        Fare.cleaning_status == "clean",
        Fare.availability_status == "available",
        Fare.is_synthetic.is_(False), Fare.is_outlier.is_(False),
        Fare.fare > 0, Fare.currency == "INR",
        Fare.trip_type == "one_way",
        func.lower(Fare.cabin) == "economy",
    )
    if selected_route:
        query = query.filter(Fare.route_id == selected_route)
    route_windows = query.group_by(Fare.route_id, Fare.advance_purchase_days).all()
    weights = {
        route_id: float(weight or 0)
        for route_id, weight in db.query(RouteWeight.route_id, RouteWeight.weight).filter(
            RouteWeight.route_id.in_(ALLOWED_ROUTE_IDS)
        ).all()
    }
    points = []
    for days in WINDOWS:
        rows = [row for row in route_windows if row.advance_purchase_days == days]
        positive_weight = sum(weights.get(row.route_id, 0) for row in rows)
        if rows:
            if positive_weight > 0:
                fare = sum(float(row.average_fare) * weights.get(row.route_id, 0) for row in rows) / positive_weight
            else:
                fare = sum(float(row.average_fare) for row in rows) / len(rows)
        else:
            fare = None
        points.append({
            "days": days,
            "fare": round(fare, 2) if fare is not None else None,
            "routes": len(rows),
            "observations": sum(int(row.observations) for row in rows),
            "firstObservation": min((row.first_observation for row in rows), default=None),
            "lastObservation": max((row.last_observation for row in rows), default=None),
        })
    baseline_point = next((point for point in points if point["fare"]), None)
    baseline = baseline_point["fare"] if baseline_point else None
    for point in points:
        point["index"] = round(point["fare"] / baseline * 100, 2) if point["fare"] is not None and baseline else None
        point["changePercent"] = round(point["index"] - 100, 2) if point["index"] is not None else None
    return {
        "points": points,
        "routeId": selected_route,
        "baselineWindow": baseline_point["days"] if baseline_point else None,
        "method": "Lead-time fare index; longest observed window equals 100",
    }


@router.get("/trends/heatmap", summary="Route fare movement across booking windows")
def fare_trends_heatmap(db: Session = Depends(get_db)):
    """Return the 24-route basket as a T+1 to T+60 fare heatmap.

    Each cell is the observed mean fare for that route and ticket window. The
    percentage movement is measured against that route's T+60 fare; missing
    windows stay missing and are never estimated.
    """
    route_windows = db.query(
        Fare.route_id,
        Fare.advance_purchase_days,
        func.avg(Fare.fare).label("average_fare"),
        func.count(Fare.id).label("observations"),
    ).filter(
        Fare.route_id.in_(ALLOWED_ROUTE_IDS),
        Fare.advance_purchase_days.in_(WINDOWS),
        Fare.cleaning_status == "clean",
        Fare.availability_status == "available",
        Fare.is_synthetic.is_(False), Fare.is_outlier.is_(False),
        Fare.fare > 0, Fare.currency == "INR",
        Fare.trip_type == "one_way",
        func.lower(Fare.cabin) == "economy",
    ).group_by(Fare.route_id, Fare.advance_purchase_days).all()

    grouped = {(row.route_id, row.advance_purchase_days): row for row in route_windows}
    heatmap_routes = []
    for route in configured_routes():
        aliases = (route["routeId"], route["displayId"])
        cells_by_day = {}
        for days in WINDOWS:
            alias_rows = [grouped[(alias, days)] for alias in aliases if (alias, days) in grouped]
            observations = sum(int(row.observations) for row in alias_rows)
            fare = (
                sum(float(row.average_fare) * int(row.observations) for row in alias_rows) / observations
                if observations else None
            )
            cells_by_day[days] = {
                "days": days,
                "fare": round(fare, 2) if fare is not None else None,
                "observations": observations,
            }
        baseline = cells_by_day[60]["fare"]
        cells = []
        for days in reversed(WINDOWS):
            cell = cells_by_day[days]
            cell["changePercent"] = (
                round((cell["fare"] / baseline - 1) * 100, 2)
                if cell["fare"] is not None and baseline else None
            )
            cells.append(cell)
        heatmap_routes.append({
            "routeId": route["routeId"],
            "displayId": route["displayId"],
            "weight": route["weight"],
            "cells": cells,
        })
    return {"windows": list(reversed(WINDOWS)), "routes": heatmap_routes, "baselineWindow": 60}


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


@router.get("/latest", summary="Latest stored fare for every configured route")
def latest_route_fares(db: Session = Depends(get_db)):
    """Return at most one recent clean fare per configured route.

    This powers the route catalogue without tying the page to one departure
    date. Both canonical city IDs and retained airport-code aliases are folded
    into the same configured route.
    """
    ranked = db.query(
        Fare.id.label("id"),
        func.row_number().over(partition_by=Fare.route_id, order_by=latest_order()).label("rank"),
    ).filter(
        Fare.route_id.in_(ALLOWED_ROUTE_IDS),
        Fare.cleaning_status == "clean",
        Fare.availability_status == "available",
        Fare.is_synthetic.is_(False), Fare.is_outlier.is_(False),
        Fare.fare > 0, Fare.currency == "INR",
        Fare.trip_type == "one_way",
        func.lower(Fare.cabin) == "economy",
    ).subquery()
    rows = (db.query(Fare).options(load_only(*(getattr(Fare, f) for f in FIELDS)))
            .join(ranked, ranked.c.id == Fare.id).filter(ranked.c.rank == 1).all())
    by_id = {row.route_id: row for row in rows}
    fares = []
    for route in configured_routes():
        candidates = [by_id[alias] for alias in (route["routeId"], route["displayId"]) if alias in by_id]
        if not candidates:
            continue
        latest = max(candidates, key=lambda row: (
            row.observation_date.isoformat(), row.collected_at.isoformat() if row.collected_at else "",
        ))
        payload = serialize(latest)
        payload["route_id"] = route["routeId"]
        fares.append(payload)
    return {"fares": fares}


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
