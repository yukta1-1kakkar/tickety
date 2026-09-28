"""Fixed-base expenditure-weighted airfare price index calculations."""

from __future__ import annotations

from datetime import date
from math import exp, log
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import FareObservation, RouteWeight
from app.config.routes import ALLOWED_ROUTE_IDS
from app.schemas.response import IndexComponentSchema, IndexHistoryPoint, IndexHistoryResponse, IndexResponse


def _available_dates(db: Session, advance_purchase_days: int) -> list[date]:
    return [row[0] for row in (
        db.query(FareObservation.observation_date)
        .filter(
            FareObservation.advance_purchase_days == advance_purchase_days,
            FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .distinct()
        .order_by(FareObservation.observation_date)
        .all()
    )]


def _route_cohort_averages(
    db: Session,
    observation_date: date,
    advance_purchase_days: int,
) -> dict[str, dict[tuple[str, str], tuple[float, int]]]:
    rows = (
        db.query(
            FareObservation.route_id,
            FareObservation.airline,
            FareObservation.source,
            func.avg(FareObservation.fare).label("avg_fare"),
            func.count(FareObservation.id).label("obs_count"),
        )
        .filter(
            FareObservation.observation_date == observation_date,
            FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
            FareObservation.advance_purchase_days == advance_purchase_days,
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .group_by(FareObservation.route_id, FareObservation.airline, FareObservation.source)
        .all()
    )
    result: dict[str, dict[tuple[str, str], tuple[float, int]]] = {}
    for row in rows:
        result.setdefault(row.route_id, {})[(row.airline, row.source)] = (
            float(row.avg_fare), int(row.obs_count)
        )
    return result


def _price_relative_index(
    db: Session,
    base_date: date,
    target_date: date,
    advance_purchase_days: int,
) -> tuple[float, float, list[IndexComponentSchema]]:
    """
    APIx_t = 100 * sum(W_r0 * R_rt).

    This is a fixed-base modified Laspeyres design. DGCA passenger shares act
    as base quantities and are converted to base-period expenditure weights:

        W_r0 = (q_r0 * p_r0) / sum(q_k0 * p_k0)

    Within a route, matched ``(airline, source)`` price relatives are combined
    with a geometric mean. At the upper level, route relatives are combined
    arithmetically using their base expenditure weights. If a route is missing
    in either period, weights are renormalized only across matched routes and
    ``coverage_weight`` reports the represented original DGCA traffic share.
    """
    basket = (
        db.query(RouteWeight)
        .filter(RouteWeight.weight > 0, RouteWeight.route_id.in_(ALLOWED_ROUTE_IDS))
        .order_by(RouteWeight.weight.desc())
        .all()
    )
    route_map = {row.route_id: row for row in basket}
    base_prices = _route_cohort_averages(db, base_date, advance_purchase_days)
    target_prices = _route_cohort_averages(db, target_date, advance_purchase_days)
    base_route_prices: dict[str, float] = {}
    for route_id in set(route_map) & set(base_prices):
        valid_prices = [price for price, _ in base_prices[route_id].values() if price > 0]
        if valid_prices:
            base_route_prices[route_id] = exp(
                sum(log(price) for price in valid_prices) / len(valid_prices)
            )

    route_relatives: dict[str, tuple[float, float, int]] = {}
    for route_id in sorted(set(base_route_prices) & set(target_prices)):
        matched_cohorts = set(base_prices[route_id]) & set(target_prices[route_id])
        valid_cohorts = [
            cohort for cohort in matched_cohorts
            if base_prices[route_id][cohort][0] > 0 and target_prices[route_id][cohort][0] > 0
        ]
        if not valid_cohorts:
            continue
        relatives = [
            target_prices[route_id][cohort][0] / base_prices[route_id][cohort][0]
            for cohort in valid_cohorts
        ]
        price_relative = exp(sum(log(relative) for relative in relatives) / len(relatives))
        target_fare = exp(
            sum(log(target_prices[route_id][cohort][0]) for cohort in valid_cohorts)
            / len(valid_cohorts)
        )
        observation_count = sum(target_prices[route_id][cohort][1] for cohort in valid_cohorts)
        route_relatives[route_id] = (price_relative, target_fare, observation_count)

    matched_routes = sorted(route_relatives)
    coverage_weight = sum(float(route_map[route_id].weight) for route_id in matched_routes)
    expenditure_mass = sum(
        float(route_map[route_id].weight) * base_route_prices[route_id]
        for route_id in matched_routes
    )
    if not matched_routes or coverage_weight <= 0 or expenditure_mass <= 0:
        return 0.0, 0.0, []

    components = []
    apix = 0.0
    for route_id in matched_routes:
        route = route_map[route_id]
        price_relative, target_fare, observation_count = route_relatives[route_id]
        expenditure_weight = (
            float(route.weight) * base_route_prices[route_id] / expenditure_mass
        )
        contribution = expenditure_weight * price_relative * 100
        apix += contribution
        components.append(IndexComponentSchema(
            route_id=route_id,
            origin=route.origin,
            destination=route.destination,
            weight=round(expenditure_weight, 6),
            avg_fare=round(target_fare, 2),
            weighted_fare=round(contribution, 4),
            observation_count=observation_count,
        ))
    return round(apix, 2), round(coverage_weight, 6), components


def calculate_index(
    db: Session,
    base_date: Optional[date] = None,
    target_date: Optional[date] = None,
    advance_purchase_days: int = 7,
) -> IndexResponse:
    dates = _available_dates(db, advance_purchase_days)
    resolved_target = target_date or (dates[-1] if dates else date.today())
    resolved_base = base_date or (dates[0] if dates else None)

    index_value = 0.0
    coverage_weight = 0.0
    components: list[IndexComponentSchema] = []
    base_index = None
    pct_change = None
    if resolved_base:
        index_value, coverage_weight, components = _price_relative_index(
            db, resolved_base, resolved_target, advance_purchase_days
        )
        if components:
            base_index = 100.0
            pct_change = round(index_value - 100.0, 2)

    return IndexResponse(
        index=index_value,
        base_index=base_index,
        pct_change=pct_change,
        target_date=resolved_target,
        base_date=resolved_base,
        advance_purchase_days=advance_purchase_days,
        coverage_weight=coverage_weight,
        components_count=len(components),
        components=components,
    )


def get_index_history(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    advance_purchase_days: int = 7,
) -> IndexHistoryResponse:
    all_dates = _available_dates(db, advance_purchase_days)
    if not all_dates:
        return IndexHistoryResponse(advance_purchase_days=advance_purchase_days, count=0, history=[])
    base_date = all_dates[0]
    dates = [day for day in all_dates if (start_date is None or day >= start_date) and (end_date is None or day <= end_date)]
    history = []
    for day in dates:
        index_value, coverage_weight, components = _price_relative_index(
            db, base_date, day, advance_purchase_days,
        )
        if components:
            observation_count = sum(component.observation_count for component in components)
            history.append(IndexHistoryPoint(
                observation_date=day,
                index=index_value,
                coverage_weight=coverage_weight,
                observation_count=observation_count,
            ))
    return IndexHistoryResponse(
        advance_purchase_days=advance_purchase_days,
        count=len(history),
        history=history,
    )
