from datetime import datetime, date
from typing import List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models import RouteWeight, FareObservation
from app.schemas.ingest import FareIngestSchema

def ingest_fare(db: Session, fare_data: FareIngestSchema) -> FareObservation:
    """
    Ingest or update a single airfare observation.
    - Validates route against RouteWeight network.
    - Performs upsert (updates fare if identical route/airline/travel_date/obs_date exists).
    """
    route_id = fare_data.route_id.strip().upper()
    
    # Check if route exists in RouteWeight
    route = db.query(RouteWeight).filter(RouteWeight.route_id == route_id).first()
    if not route:
        # Check if database has any weights at all
        total_routes = db.query(RouteWeight).count()
        if total_routes > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Route '{route_id}' does not exist in the configured DGCA route network."
            )
        else:
            # If no routes yet imported, create a stub route with 0 weight
            parts = route_id.split("-")
            origin = parts[0] if len(parts) > 0 else "UNKNOWN"
            destination = parts[1] if len(parts) > 1 else "UNKNOWN"
            route = RouteWeight(
                route_id=route_id,
                origin=origin,
                destination=destination,
                total_passengers=0.0,
                weight=0.0
            )
            db.add(route)
            db.commit()
            db.refresh(route)

    # Check for duplicate observation
    existing_obs = (
        db.query(FareObservation)
        .filter(
            FareObservation.route_id == route_id,
            FareObservation.airline == fare_data.airline,
            FareObservation.travel_date == fare_data.travel_date,
            FareObservation.observation_date == fare_data.observation_date,
            FareObservation.advance_purchase_days == fare_data.advance_purchase_days,
        )
        .first()
    )

    if existing_obs:
        # Update existing record
        existing_obs.fare = fare_data.fare
        existing_obs.currency = fare_data.currency
        existing_obs.source = fare_data.source
        existing_obs.created_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_obs)
        return existing_obs
    else:
        # Create new record
        new_obs = FareObservation(
            route_id=route_id,
            airline=fare_data.airline,
            travel_date=fare_data.travel_date,
            observation_date=fare_data.observation_date,
            advance_purchase_days=fare_data.advance_purchase_days,
            fare=fare_data.fare,
            currency=fare_data.currency,
            source=fare_data.source,
        )
        db.add(new_obs)
        db.commit()
        db.refresh(new_obs)
        return new_obs

def ingest_bulk_fares(db: Session, fare_list: List[FareIngestSchema]) -> Dict[str, Any]:
    """
    Batch ingestion for high-throughput scraper pipelines.
    """
    inserted_count = 0
    updated_count = 0
    errors = []

    for item in fare_list:
        try:
            route_id = item.route_id.strip().upper()
            route = db.query(RouteWeight).filter(RouteWeight.route_id == route_id).first()
            if not route:
                parts = route_id.split("-")
                origin = parts[0] if len(parts) > 0 else "UNKNOWN"
                destination = parts[1] if len(parts) > 1 else "UNKNOWN"
                route = RouteWeight(
                    route_id=route_id,
                    origin=origin,
                    destination=destination,
                    total_passengers=0.0,
                    weight=0.0
                )
                db.add(route)
                db.flush()

            existing = (
                db.query(FareObservation)
                .filter(
                    FareObservation.route_id == route_id,
                    FareObservation.airline == item.airline,
                    FareObservation.travel_date == item.travel_date,
                    FareObservation.observation_date == item.observation_date,
                    FareObservation.advance_purchase_days == item.advance_purchase_days,
                )
                .first()
            )
            
            if existing:
                existing.fare = item.fare
                existing.currency = item.currency
                existing.source = item.source
                updated_count += 1
            else:
                new_obs = FareObservation(
                    route_id=route_id,
                    airline=item.airline,
                    travel_date=item.travel_date,
                    observation_date=item.observation_date,
                    advance_purchase_days=item.advance_purchase_days,
                    fare=item.fare,
                    currency=item.currency,
                    source=item.source,
                )
                db.add(new_obs)
                inserted_count += 1
        except Exception as e:
            errors.append({"item": item.dict(), "error": str(e)})

    db.commit()
    return {
        "status": "success",
        "total_submitted": len(fare_list),
        "inserted": inserted_count,
        "updated": updated_count,
        "errors_count": len(errors),
        "errors": errors if errors else None
    }
