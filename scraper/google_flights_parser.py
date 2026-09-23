"""Normalize SerpAPI Google Flights results into the scraper-only schema."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

try:
    from .domestic_routes import DomesticRoute
except ImportError:  # direct execution through google_flights.py
    from domestic_routes import DomesticRoute


SOURCE = "google_flights_serpapi"


def _time_only(value: Any) -> str | None:
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d %H:%M").strftime("%H:%M")
    except ValueError:
        return None


def _unique(values: list[str | None]) -> str | None:
    result = list(dict.fromkeys(value.strip() for value in values if value and value.strip()))
    return " / ".join(result) or None


def _price_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError, OverflowError):
        return None


def _price_insights(payload: dict) -> dict[str, int | str | None]:
    insights = payload.get("price_insights")
    if not isinstance(insights, dict):
        insights = {}
    price_range = insights.get("typical_price_range")
    if not isinstance(price_range, (list, tuple)):
        price_range = []
    level = insights.get("price_level")
    return {
        "price_level": str(level).strip().title() if level else None,
        "lowest_price": _price_int(insights.get("lowest_price")),
        "typical_price_low": _price_int(price_range[0]) if len(price_range) > 0 else None,
        "typical_price_high": _price_int(price_range[1]) if len(price_range) > 1 else None,
    }


def normalize_response(
    payload: dict,
    route: DomesticRoute,
    departure_date: str,
    lead_time_days: int,
    scraped_at: datetime | None = None,
) -> list[dict]:
    """Return one flat processed record for every priced itinerary."""
    scraped_at = scraped_at or datetime.now(timezone.utc)
    timestamp = scraped_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    insights = _price_insights(payload)
    records: list[dict] = []

    itineraries = [*payload.get("best_flights", []), *payload.get("other_flights", [])]
    for itinerary in itineraries:
        segments = itinerary.get("flights") or []
        total_fare = _price_int(itinerary.get("price"))
        if not segments or total_fare is None:
            continue
        first, last = segments[0], segments[-1]
        departure = first.get("departure_airport") or {}
        arrival = last.get("arrival_airport") or {}
        origin_airport = departure.get("id") or route.origin_airport.split(",", 1)[0]
        destination_airport = arrival.get("id") or route.destination_airport.split(",", 1)[0]
        flight_numbers = _unique([
            str(segment.get("flight_number")).replace(" ", "")
            if segment.get("flight_number") else None
            for segment in segments
        ])
        records.append({
            "route_id": f"{origin_airport}_{destination_airport}",
            "origin_city": route.origin_city.title(),
            "origin_airport": origin_airport,
            "destination_city": route.destination_city.title(),
            "destination_airport": destination_airport,
            "departure_date": departure_date,
            "lead_time_days": lead_time_days,
            "scrape_timestamp": timestamp,
            "airline": _unique([segment.get("airline") for segment in segments]),
            "flight_number": flight_numbers,
            "departure_time": _time_only(departure.get("time")),
            "arrival_time": _time_only(arrival.get("time")),
            "duration_minutes": int(itinerary["total_duration"])
            if itinerary.get("total_duration") is not None else None,
            "stops": max(0, len(segments) - 1),
            "cabin_class": _unique([segment.get("travel_class") for segment in segments]),
            "total_fare": total_fare,
            "currency": "INR",
            **insights,
            "price_source": SOURCE,
        })
    return records

