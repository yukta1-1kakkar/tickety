"""Small extension adapter over the existing consumer fare query and route basket."""
from datetime import date
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.fares import route_intelligence
from app.config.routes import configured_routes
from app.database.db import get_db
from app.services.event_context import event_context

router = APIRouter(prefix="/tickety", tags=["Fare intelligence"])


def positive(value):
    return value if value is not None and math.isfinite(value) and value > 0 else None


@router.get("/insights", summary="Stored one-way economy insights for a detected airport pair")
def extension_insights(
    origin: str = Query(..., pattern=r"^[A-Za-z]{3}$"),
    destination: str = Query(..., pattern=r"^[A-Za-z]{3}$"),
    departureDate: date = Query(...),
    currentFare: float | None = Query(None, gt=0, le=10000000, allow_inf_nan=False),
    db: Session = Depends(get_db),
):
    origin, destination = origin.upper(), destination.upper()
    if origin == destination:
        raise HTTPException(422, "Origin and destination must be different")
    route = next((r for r in configured_routes()
                  if origin in r["originAirport"].split(",")
                  and destination in r["destinationAirport"].split(",")), None)
    if not route:
        raise HTTPException(404, "This direction is not in the supported route basket")
    data = route_intelligence(db, departureDate, route["routeId"], (route["displayId"],))
    stored = data["current"] or {}
    low, high = positive(stored.get("typical_price_low")), positive(stored.get("typical_price_high"))
    typical = {"low": low, "high": high} if low and high and low <= high else None
    fare = currentFare if currentFare is not None else positive(stored.get("fare"))
    # A search-level Google label does not classify an arbitrary selected ticket.
    level = None
    basis = None
    difference = None
    if currentFare is not None and typical:
        level = "LOW" if fare < low else "HIGH" if fare > high else "TYPICAL"
        basis = "observed_typical_range"
        difference = round(fare - (low if fare < low else high if fare > high else fare), 2)
    elif currentFare is None and str(stored.get("price_level", "")).upper() in {"LOW", "TYPICAL", "HIGH"}:
        level, basis = stored["price_level"].upper(), "google_flights_stored_search"
    return {
        "route": {"origin": origin, "destination": destination, "routeId": route["routeId"],
                  "scope": "city_pair"},
        "departureDate": departureDate, "currency": "INR", "hasData": bool(stored),
        "currentFare": fare, "fareSource": "provided" if currentFare is not None else "stored",
        "storedFare": positive(stored.get("fare")), "priceLevel": level, "classificationBasis": basis,
        "typicalPriceRange": typical, "differenceFromRange": difference,
        "lowestPrice": min((p["fare"] for p in data["history"] if positive(p["fare"])), default=None),
        "leadTime": data["leadTime"], "collectedAt": stored.get("collected_at"),
        "observationDate": stored.get("observation_date"),
        "source": "Google Flights via SerpAPI", "tripType": "one_way", "cabin": "economy",
        "eventContext": event_context(db, departureDate, (route["routeId"], route["displayId"])),
    }
