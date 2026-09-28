"""Transparent historical diagnostics for the VAYUSETU APIx series."""

from __future__ import annotations

import argparse
import json
import math
from datetime import date
from statistics import mean, pstdev
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.database.models import FareObservation, RouteWeight
from app.config.routes import ALLOWED_ROUTE_IDS
from app.services.index_engine import get_index_history


def _round(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


def _max_drawdown(values: list[float]) -> float:
    peak = values[0]
    drawdown = 0.0
    for value in values:
        peak = max(peak, value)
        if peak:
            drawdown = min(drawdown, (value - peak) / peak * 100)
    return abs(drawdown)


def run_apix_backtest(
    db: Session,
    *,
    advance_purchase_days: int = 7,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    history_response = get_index_history(
        db,
        start_date=start_date,
        end_date=end_date,
        advance_purchase_days=advance_purchase_days,
    )
    history = history_response.history
    if len(history) < 2:
        return {
            "status": "insufficient_data",
            "advancePurchaseDays": advance_purchase_days,
            "days": len(history),
            "minimumRequiredDays": 30,
        }

    dates = [point.observation_date for point in history]
    values = [float(point.index) for point in history]
    changes = [
        (values[index] / values[index - 1] - 1) * 100
        for index in range(1, len(values)) if values[index - 1]
    ]
    provenance_rows = (
        db.query(
            FareObservation.observation_date,
            FareObservation.is_synthetic,
            func.count(FareObservation.id),
        )
        .filter(
            FareObservation.observation_date.in_(dates),
            FareObservation.route_id.in_(ALLOWED_ROUTE_IDS),
            FareObservation.advance_purchase_days == advance_purchase_days,
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .group_by(FareObservation.observation_date, FareObservation.is_synthetic)
        .all()
    )
    real_by_date: dict[date, int] = {}
    synthetic_by_date: dict[date, int] = {}
    for observation_date, is_synthetic, count in provenance_rows:
        target = synthetic_by_date if is_synthetic else real_by_date
        target[observation_date] = int(count)

    # Persistence diagnostic: use yesterday's index as today's forecast on
    # genuinely observed dates. This is not a DGCA external validation.
    holdout = []
    value_by_date = dict(zip(dates, values))
    for index, observation_date in enumerate(dates):
        if observation_date not in real_by_date or index == 0:
            continue
        predicted = values[index - 1]
        actual = value_by_date[observation_date]
        error = actual - predicted
        holdout.append({
            "date": observation_date.isoformat(),
            "predictedIndex": _round(predicted, 2),
            "actualIndex": _round(actual, 2),
            "error": _round(error, 2),
            "absolutePercentageError": _round(abs(error) / actual * 100 if actual else 0, 2),
            "realObservationCount": real_by_date[observation_date],
        })

    mae = mean(abs(row["error"]) for row in holdout) if holdout else None
    rmse = math.sqrt(mean(row["error"] ** 2 for row in holdout)) if holdout else None
    mape = mean(row["absolutePercentageError"] for row in holdout) if holdout else None
    average_coverage = mean(float(point.coverage_weight) for point in history)
    minimum_coverage = min(float(point.coverage_weight) for point in history)
    basket_weights = [float(row[0]) for row in (
        db.query(RouteWeight.weight)
        .filter(RouteWeight.weight > 0, RouteWeight.route_id.in_(ALLOWED_ROUTE_IDS))
        .order_by(RouteWeight.weight.desc())
        .all()
    )]
    basket_weight = sum(basket_weights)
    average_basket_coverage = average_coverage / basket_weight if basket_weight else 0.0
    minimum_basket_coverage = minimum_coverage / basket_weight if basket_weight else 0.0
    volatility = pstdev(changes) if len(changes) > 1 else 0.0
    max_daily_change = max(abs(value) for value in changes) if changes else 0.0

    checks = {
        "has30CalendarDays": (dates[-1] - dates[0]).days + 1 >= 30 and len(history) >= 30,
        "averageCoverageAtLeast80Pct": average_basket_coverage >= 0.80,
        "minimumCoverageAtLeast60Pct": minimum_basket_coverage >= 0.60,
        "dailyVolatilityBelow1_5Pct": volatility <= 1.5,
        "maximumDailyMovementBelow3Pct": max_daily_change <= 3.0,
        "realHoldoutAvailable": bool(holdout),
        "officialFareBenchmarkAvailable": False,
    }
    internal_pass = all(value for key, value in checks.items() if key not in {
        "officialFareBenchmarkAvailable", "realHoldoutAvailable"
    })
    return {
        "status": "prototype_backtest_complete",
        "validationLevel": "internal_synthetic_backtest",
        "disclaimer": "Synthetic observations test the pipeline and index behaviour; they do not satisfy external validation against 30 days of observed fares.",
        "advancePurchaseDays": advance_purchase_days,
        "period": {"start": dates[0].isoformat(), "end": dates[-1].isoformat(), "days": len(history)},
        "provenance": {
            "realDates": len(real_by_date),
            "syntheticDates": len(synthetic_by_date),
            "realObservations": sum(real_by_date.values()),
            "syntheticObservations": sum(synthetic_by_date.values()),
        },
        "metrics": {
            "startingIndex": _round(values[0], 2),
            "endingIndex": _round(values[-1], 2),
            "meanIndex": _round(mean(values), 2),
            "indexStdDev": _round(pstdev(values), 2),
            "dailyChangeVolatilityPct": _round(volatility, 2),
            "maximumAbsoluteDailyChangePct": _round(max_daily_change, 2),
            "maximumDrawdownPct": _round(_max_drawdown(values), 2),
            "averageCoverageWeight": _round(average_coverage, 4),
            "minimumCoverageWeight": _round(minimum_coverage, 4),
            "top24BasketWeight": _round(basket_weight, 4),
            "averageBasketCoveragePct": _round(average_basket_coverage * 100, 2),
            "minimumBasketCoveragePct": _round(minimum_basket_coverage * 100, 2),
            "holdoutMAE": _round(mae, 2) if mae is not None else None,
            "holdoutRMSE": _round(rmse, 2) if rmse is not None else None,
            "holdoutMAPEPct": _round(mape, 2) if mape is not None else None,
        },
        "checks": checks,
        "internalChecksPassed": internal_pass,
        "trajectoryAssessment": "credible_internal_range" if internal_pass else "requires_synthetic_model_refinement",
        "realDateHoldout": holdout,
        "externalBenchmark": {
            "status": "not_available",
            "reason": "The loaded DGCA workbooks contain traffic/operations data, not route-level monthly average fares.",
            "required": "Official route-level fare averages or NSO air-fare item index for the same period and basket.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the VAYUSETU APIx historical backtest")
    parser.add_argument("--advance-purchase", type=int, default=7)
    parser.add_argument("--start-date", type=date.fromisoformat)
    parser.add_argument("--end-date", type=date.fromisoformat)
    args = parser.parse_args()
    db = SessionLocal()
    try:
        print(json.dumps(run_apix_backtest(
            db,
            advance_purchase_days=args.advance_purchase,
            start_date=args.start_date,
            end_date=args.end_date,
        ), indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main()
