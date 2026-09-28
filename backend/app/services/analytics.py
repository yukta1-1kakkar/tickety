import math
from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import FareObservation, RouteWeight
from app.config.routes import ALLOWED_ROUTE_IDS
from app.schemas.response import (
    RouteChangeSchema,
    AnomalySchema,
    AnalyticsResponse,
    FareStatusResponse,
)
from app.services.index_engine import calculate_index

def get_route_change(db: Session, route_id: str, days: int = 7) -> Optional[RouteChangeSchema]:
    """
    Calculate the percentage fare change for a given route over the last N days.
    """
    latest_date = (
        db.query(func.max(FareObservation.observation_date))
        .filter(
            FareObservation.route_id == route_id,
            FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .scalar()
    )
    if not latest_date:
        return None
        
    past_date = latest_date - timedelta(days=days)
    
    curr_avg = (
        db.query(func.avg(FareObservation.fare))
        .filter(
            FareObservation.route_id == route_id,
            FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
            FareObservation.observation_date == latest_date,
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .scalar()
    )
    
    # Try finding exact past date or nearest previous observation
    past_avg = (
        db.query(func.avg(FareObservation.fare))
        .filter(
            FareObservation.route_id == route_id,
            FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
            FareObservation.observation_date <= past_date,
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .order_by(FareObservation.observation_date.desc())
        .scalar()
    )
    
    if curr_avg is None or past_avg is None or past_avg == 0:
        return None
        
    pct_change = round(((curr_avg - past_avg) / past_avg) * 100, 2)
    return RouteChangeSchema(
        route_id=route_id,
        current_avg_fare=round(float(curr_avg), 2),
        past_avg_fare=round(float(past_avg), 2),
        pct_change=pct_change
    )

def get_overall_change(db: Session, days: int = 7) -> Optional[float]:
    """
    Calculate overall percentage change in the Weighted Price Index over the last N days.
    """
    latest_date = db.query(func.max(FareObservation.observation_date)).filter(
        FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
        FareObservation.cleaning_status == "clean",
        FareObservation.fare.is_not(None),
    ).scalar()
    if not latest_date:
        return None
        
    past_date = latest_date - timedelta(days=days)
    earliest_past_date = (
        db.query(func.max(FareObservation.observation_date))
        .filter(
            FareObservation.observation_date <= past_date,
            FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .scalar()
    )
    
    if not earliest_past_date:
        return None
        
    curr_resp = calculate_index(db, target_date=latest_date)
    past_resp = calculate_index(db, target_date=earliest_past_date)
    
    if past_resp.index > 0:
        return round(((curr_resp.index - past_resp.index) / past_resp.index) * 100, 2)
    return None

def get_rolling_mean(db: Session, route_id: Optional[str] = None, window: int = 7) -> Optional[float]:
    """
    Compute the rolling N-day average fare for a route or network-wide.
    """
    latest_date = db.query(func.max(FareObservation.observation_date)).filter(
        FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
        FareObservation.cleaning_status == "clean",
        FareObservation.fare.is_not(None),
    ).scalar()
    if not latest_date:
        return None
        
    start_date = latest_date - timedelta(days=window)
    query = db.query(func.avg(FareObservation.fare)).filter(
        FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
        FareObservation.observation_date >= start_date,
        FareObservation.cleaning_status == "clean",
        FareObservation.fare.is_not(None),
    )
    
    if route_id:
        query = query.filter(FareObservation.route_id == route_id)
        
    res = query.scalar()
    return round(float(res), 2) if res is not None else None

def detect_anomalies(
    db: Session,
    route_id: Optional[str] = None,
    threshold: float = 2.0
) -> List[AnomalySchema]:
    """
    Detect pricing anomalies using statistical Z-Score (|Z| > threshold).
    Z = (Fare - Mean) / StdDev
    """
    query = db.query(FareObservation).filter(
        FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
        FareObservation.fare.is_not(None),
    )
    if route_id:
        query = query.filter(FareObservation.route_id == route_id)
        
    observations = query.all()
    if len(observations) < 3:
        return []
        
    fares = [o.fare for o in observations]
    mean_val = sum(fares) / len(fares)
    variance = sum((f - mean_val) ** 2 for f in fares) / len(fares)
    std_dev = math.sqrt(variance)
    
    if std_dev == 0:
        return []
        
    anomalies: List[AnomalySchema] = []
    for o in observations:
        z_score = (o.fare - mean_val) / std_dev
        if abs(z_score) >= threshold:
            anomalies.append(
                AnomalySchema(
                    observation_id=o.id,
                    route_id=o.route_id,
                    airline=o.airline,
                    observation_date=o.observation_date,
                    travel_date=o.travel_date,
                    advance_purchase_days=o.advance_purchase_days,
                    fare=round(o.fare, 2),
                    mean_fare=round(mean_val, 2),
                    std_fare=round(std_dev, 2),
                    z_score=round(z_score, 2),
                    is_anomaly=True,
                )
            )
            
    return anomalies

def get_fare_status(db: Session) -> FareStatusResponse:
    """
    Get overall database health and fare observation statistics.
    """
    basket = FareObservation.route_id.in_(ALLOWED_ROUTE_IDS)
    total_obs = db.query(func.count(FareObservation.id)).filter(basket).scalar() or 0
    unique_routes = db.query(func.count(func.distinct(FareObservation.route_id))).filter(basket).scalar() or 0
    unique_airlines = db.query(func.count(func.distinct(FareObservation.airline))).filter(basket).scalar() or 0
    last_updated = db.query(func.max(FareObservation.created_at)).filter(basket).scalar()
    earliest_date = db.query(func.min(FareObservation.observation_date)).filter(basket).scalar()
    latest_date = db.query(func.max(FareObservation.observation_date)).filter(basket).scalar()
    
    return FareStatusResponse(
        has_data=total_obs > 0,
        last_updated=last_updated,
        total_observations=int(total_obs),
        unique_routes_with_fares=int(unique_routes),
        unique_airlines=int(unique_airlines),
        earliest_observation_date=earliest_date,
        latest_observation_date=latest_date,
    )

def get_analytics_summary(db: Session, route_id: Optional[str] = None) -> AnalyticsResponse:
    """
    Compile full analytics response containing route changes, overall index change,
    rolling mean, and anomalies.
    """
    route_changes = []
    if route_id:
        change = get_route_change(db, route_id, days=7)
        if change:
            route_changes.append(change)
    else:
        # Get top routes
        top_routes = db.query(RouteWeight.route_id).filter(
            RouteWeight.route_id.in_(ALLOWED_ROUTE_IDS)
        ).order_by(RouteWeight.weight.desc()).all()
        for (r_id,) in top_routes:
            chg = get_route_change(db, r_id, days=7)
            if chg:
                route_changes.append(chg)
                
    overall_change = get_overall_change(db, days=7)
    rolling_mean = get_rolling_mean(db, route_id=route_id, window=7)
    anomalies = detect_anomalies(db, route_id=route_id, threshold=2.0)
    
    return AnalyticsResponse(
        route_changes_7d=route_changes,
        overall_change_7d_pct=overall_change,
        rolling_mean_7d=rolling_mean,
        anomalies=anomalies,
    )
