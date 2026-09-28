from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database.db import get_db
from app.database.models import RouteWeight
from app.config.routes import ALLOWED_ROUTE_IDS
from app.schemas.response import RouteSchema, RouteListResponse

router = APIRouter(prefix="/routes", tags=["Routes"])

@router.get("", response_model=RouteListResponse, summary="List All Domestic City-Pair Routes")
def list_routes(
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    search: Optional[str] = Query(None, description="Filter by city name or route ID"),
    db: Session = Depends(get_db)
):
    """
    Retrieve list of domestic air routes with DGCA passenger traffic weights.
    """
    query = db.query(RouteWeight).filter(RouteWeight.route_id.in_(ALLOWED_ROUTE_IDS))
    if search:
        s = f"%{search.strip().upper()}%"
        query = query.filter(
            or_(
                RouteWeight.route_id.ilike(s),
                RouteWeight.origin.ilike(s),
                RouteWeight.destination.ilike(s),
            )
        )
        
    total = query.count()
    routes = query.order_by(RouteWeight.weight.desc()).offset(offset).limit(limit).all()
    
    return RouteListResponse(
        total=total,
        routes=[RouteSchema.model_validate(r) for r in routes]
    )

@router.get("/{route_id}", response_model=RouteSchema, summary="Get Single Route Details")
def get_route(route_id: str, db: Session = Depends(get_db)):
    """
    Retrieve single route weight record by its identifier (e.g. 'DEL-BOM').
    """
    r_id = route_id.strip().upper()
    route = db.query(RouteWeight).filter(
        RouteWeight.route_id == r_id, RouteWeight.route_id.in_(ALLOWED_ROUTE_IDS)
    ).first()
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route '{r_id}' not found in database."
        )
    return RouteSchema.model_validate(route)
