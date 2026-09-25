"""Build the frontend dashboard exclusively from persisted observations."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from statistics import mean, pstdev

from sqlalchemy.orm import Session

from app.database.models import CPIReference, FareObservation, RouteWeight, ScrapeRun
from app.services.index_engine import get_index_history
from app.services.loader import normalize_cpi_month


AIRPORT_REFERENCE = {
    "DEL": ("New Delhi", "Delhi", 28.5562, 77.1000),
    "BOM": ("Mumbai", "Maharashtra", 19.0896, 72.8656),
    "BLR": ("Bengaluru", "Karnataka", 13.1986, 77.7066),
    "HYD": ("Hyderabad", "Telangana", 17.2403, 78.4294),
    "CCU": ("Kolkata", "West Bengal", 22.6547, 88.4467),
    "MAA": ("Chennai", "Tamil Nadu", 12.9941, 80.1709),
    "AMD": ("Ahmedabad", "Gujarat", 23.0772, 72.6347),
    "COK": ("Kochi", "Kerala", 10.1556, 76.3906),
    "GAU": ("Guwahati", "Assam", 26.1061, 91.5859),
    "PNQ": ("Pune", "Maharashtra", 18.5793, 73.9089),
    "GOI": ("Goa", "Goa", 15.3808, 73.8314),
    "GOX": ("Goa", "Goa", 15.7443, 73.8606),
    "LKO": ("Lucknow", "Uttar Pradesh", 26.7606, 80.8893),
    "SXR": ("Srinagar", "Jammu and Kashmir", 33.9871, 74.7743),
    "PAT": ("Patna", "Bihar", 25.5913, 85.0880),
}
METROS = {"DEL", "BOM", "BLR", "HYD", "CCU", "MAA"}
LEISURE = {"GOI", "GOX", "COK"}
MONITORED_AIRLINES = ("Akasa Air", "Air India Express", "SpiceJet")
MONITORED_OTAS = ("Yatra",)
CITY_TO_IATA = {
    "DELHI": "DEL", "NEW DELHI": "DEL", "MUMBAI": "BOM", "BENGALURU": "BLR", "BANGALORE": "BLR",
    "HYDERABAD": "HYD", "KOLKATA": "CCU", "CHENNAI": "MAA", "AHMEDABAD": "AMD", "KOCHI": "COK",
    "COCHIN": "COK", "GUWAHATI": "GAU", "PUNE": "PNQ", "GOA": "GOI", "LUCKNOW": "LKO",
}


def _city(code: str) -> str:
    return AIRPORT_REFERENCE.get(code, (code, "", 0.0, 0.0))[0]


def _route_airports(route_id: str, fallback_origin: str, fallback_destination: str) -> tuple[str, str]:
    """Resolve airport codes without loading each observation's raw JSON."""
    route_parts = route_id.upper().replace("→", "-").split("-")
    if len(route_parts) == 2 and all(len(part.strip()) == 3 for part in route_parts):
        return route_parts[0].strip(), route_parts[1].strip()
    return (
        CITY_TO_IATA.get(fallback_origin.upper(), fallback_origin.upper()),
        CITY_TO_IATA.get(fallback_destination.upper(), fallback_destination.upper()),
    )


def _distance(origin: str, destination: str) -> int:
    a, b = AIRPORT_REFERENCE.get(origin), AIRPORT_REFERENCE.get(destination)
    if not a or not b:
        return 0
    lat1, lon1, lat2, lon2 = map(math.radians, (a[2], a[3], b[2], b[3]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return round(6371 * 2 * math.asin(math.sqrt(h)))


def _sector(origin: str, destination: str) -> str:
    if origin in LEISURE or destination in LEISURE:
        return "Leisure"
    metro_count = int(origin in METROS) + int(destination in METROS)
    return "Metro-Metro" if metro_count == 2 else "Metro-Tier2" if metro_count == 1 else "Tier2-Tier2"


def _round(value: float | None, digits: int = 1) -> float:
    return round(float(value or 0), digits)


def build_live_dashboard(db: Session) -> dict:
    weights = db.query(RouteWeight).order_by(RouteWeight.weight.desc()).limit(24).all()
    weight_by_route = {row.route_id: row for row in weights}
    route_ids = set(weight_by_route)
    # Project only fields used below. Loading full ORM entities also loads the
    # raw_payload JSON and keeps every entity in SQLAlchemy's identity map,
    # which caused memory growth as the historical repository expanded.
    observations = (
        db.query(
            FareObservation.id,
            FareObservation.observation_id,
            FareObservation.route_id,
            FareObservation.airline,
            FareObservation.flight_number,
            FareObservation.observation_date,
            FareObservation.advance_purchase_days,
            FareObservation.fare,
            FareObservation.source,
            FareObservation.collected_at,
            FareObservation.created_at,
        )
        .filter(
            FareObservation.route_id.in_(route_ids),
            FareObservation.cleaning_status == "clean",
            FareObservation.fare.is_not(None),
        )
        .order_by(FareObservation.observation_date, FareObservation.collected_at)
        .all()
    ) if route_ids else []

    by_route: dict[str, list[FareObservation]] = defaultdict(list)
    by_date: dict[date, list[FareObservation]] = defaultdict(list)
    for row in observations:
        by_route[row.route_id].append(row)
        by_date[row.observation_date].append(row)

    flight_routes = []
    route_weights = []
    for route_id, rows in by_route.items():
        weight = weight_by_route[route_id]
        daily: dict[date, list[float]] = defaultdict(list)
        daily_cohort: dict[date, dict[tuple[str, str], list[float]]] = defaultdict(lambda: defaultdict(list))
        airlines = Counter()
        for row in rows:
            daily[row.observation_date].append(float(row.fare))
            daily_cohort[row.observation_date][(row.airline, row.source)].append(float(row.fare))
            airlines[row.airline] += 1
        stable_cohorts = set.intersection(*(set(values) for values in daily_cohort.values())) if daily_cohort else set()
        history = []
        for day in sorted(daily):
            fares = ([mean(daily_cohort[day][cohort]) for cohort in stable_cohorts] if stable_cohorts else daily[day])
            avg = mean(fares)
            sigma = pstdev(fares) if len(fares) > 1 else 0
            history.append({
                "date": day.strftime("%d/%m/%y"), "fare": round(avg),
                "upperBand": round(avg + 2 * sigma), "lowerBand": round(max(0, avg - 2 * sigma)),
                "volume": len(daily[day]),
            })
        current, baseline = history[-1]["fare"], history[0]["fare"]
        all_fares = [float(row.fare) for row in rows]
        change = ((current - baseline) / baseline * 100) if baseline else 0
        volatility = min(100, round((pstdev(all_fares) / mean(all_fares) * 100) if len(all_fares) > 1 and mean(all_fares) else 0))
        carriers = [name for name, _ in airlines.most_common(3)]
        sources = sorted({row.source for row in rows if row.source})
        origin, destination = _route_airports(route_id, weight.origin, weight.destination)
        anomaly = abs(change) >= 20
        flight_routes.append({
            "id": route_id, "origin": origin, "destination": destination,
            "originCity": _city(origin), "destCity": _city(destination),
            "currentFare": current, "referenceFare": baseline, "baselineFare": baseline,
            "changePercent": _round(change), "deviationPercent": _round(change),
            "isAnomaly": anomaly,
            "anomalySeverity": "critical" if abs(change) >= 35 else "high" if anomaly else None,
            "anomalyReason": "Latest daily mean differs materially from the earliest available persisted baseline." if anomaly else None,
            "historicalAvg": round(mean(all_fares)), "minFare": round(min(all_fares)), "maxFare": round(max(all_fares)),
            "observationsCount": len(rows), "volatilityIndex": volatility,
            "dominantCarrier": " / ".join(carriers), "primaryAirline": carriers[0] if carriers else "Unknown",
            "sources": sources,
            "sectorType": _sector(origin, destination), "distanceKm": _distance(origin, destination),
            "weeklyFrequency": 0, "historicalData": history,
        })
        status = "anomaly" if anomaly else "elevated" if abs(change) >= 10 else "normal"
        route_weights.append({
            "routeId": route_id, "origin": origin, "destination": destination,
            "originCity": _city(origin), "destCity": _city(destination), "weight": _round(weight.weight * 100, 2),
            "contribution": _round(weight.weight * change, 2),
            "paxPerMonth": f"{round(weight.total_passengers / 1000)}K",
            "carrierShare": ", ".join(f"{name} {round(count / len(rows) * 100)}%" for name, count in airlines.most_common(3)),
            "status": status,
        })

    flight_routes.sort(key=lambda item: weight_by_route[item["id"]].weight, reverse=True)
    route_weights.sort(key=lambda item: item["weight"], reverse=True)

    index_timeline = []
    index_history = get_index_history(db, advance_purchase_days=7)
    for history_point in index_history.history:
        previous = index_timeline[-1]["indexValue"] if index_timeline else history_point.index
        index_timeline.append({
            "date": history_point.observation_date.strftime("%d/%m/%y"),
            "indexValue": history_point.index,
            "baseline": 100,
            "monthlyChange": _round(((history_point.index - previous) / previous * 100) if previous else 0),
            "observations": history_point.observation_count,
        })

    lead_time: dict[str, list[dict]] = {}
    for route_key in ["ALL", *by_route.keys()]:
        relevant = observations if route_key == "ALL" else by_route[route_key]
        grouped: dict[int, list[float]] = defaultdict(list)
        cohorts: dict[tuple[str, str], dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
        for row in relevant:
            grouped[row.advance_purchase_days].append(float(row.fare))
            cohorts[(row.route_id, row.airline)][row.advance_purchase_days].append(float(row.fare))

        # Prefer the SerpAPI T+60 window while retaining historical T+45 baskets.
        # This removes route-mix/airline-mix bias (Simpson's paradox) from the
        # national curve while preserving the direction present in real data.
        anchor_days = 60 if 60 in grouped or 45 not in grouped else 45
        required_windows = {1, 7, 15, 30, anchor_days}
        comparable = {key: windows for key, windows in cohorts.items() if required_windows.issubset(windows)}
        if comparable:
            base_values = []
            base_weights = []
            for (cohort_route, _), windows in comparable.items():
                base_values.append(mean(windows[anchor_days]))
                base_weights.append(weight_by_route[cohort_route].weight if route_key == "ALL" else 1.0)
            base_weight_sum = sum(base_weights)
            comparable_anchor = sum(value * weight for value, weight in zip(base_values, base_weights)) / base_weight_sum
        else:
            comparable_anchor = 0
        points = []
        for days in (anchor_days, 30, 15, 7, 1):
            fares = grouped.get(days, [])
            if not fares:
                continue
            ratios = []
            ratio_weights = []
            for (cohort_route, _), windows in comparable.items():
                if not windows.get(days):
                    continue
                cohort_base = mean(windows[anchor_days])
                ratios.append(mean(windows[days]) / cohort_base)
                ratio_weights.append(weight_by_route[cohort_route].weight if route_key == "ALL" else 1.0)
            if ratios:
                weight_sum = sum(ratio_weights)
                multiplier = sum(value * weight for value, weight in zip(ratios, ratio_weights)) / weight_sum
                avg = comparable_anchor * multiplier
                volatility = min(100, round(pstdev(ratios) / multiplier * 100)) if len(ratios) > 1 and multiplier else 0
            else:
                reference_days = max(grouped)
                anchor_fare = mean(grouped[reference_days])
                avg = mean(fares)
                multiplier = avg / anchor_fare if anchor_fare else 0
                volatility = min(100, round((pstdev(fares) / avg * 100) if len(fares) > 1 and avg else 0))
            points.append({
                "window": f"T+{days}", "daysAdvance": f"{days} days before departure", "avgFare": round(avg),
                "multiplier": _round(multiplier, 2), "markupPercent": _round((multiplier - 1) * 100),
                "seatInventoryShare": _round(len(fares) / len(relevant) * 100),
                "volatility": volatility,
                "bookingUrgency": "Critical Dynamic" if days == 1 else "Surge" if days == 7 else "Elevated" if days == 15 else "Normal",
            })
        lead_time[route_key] = points

    sector_groups: dict[str, list[dict]] = defaultdict(list)
    for route in flight_routes:
        sector_groups[route["sectorType"]].append(route)
    sector_labels = {
        "Metro-Metro": "Primary Trunk Corridors", "Metro-Tier2": "Arterial & State Capital Pairs",
        "Tier2-Tier2": "Regional Point-to-Point", "Leisure": "Tourist & Seasonal Corridors",
    }
    sector_heatmap = []
    for sector, routes in sector_groups.items():
        current = mean(r["currentFare"] for r in routes)
        baseline = mean(r["referenceFare"] for r in routes)
        change = ((current - baseline) / baseline * 100) if baseline else 0
        sector_heatmap.append({
            "sector": sector, "label": sector_labels[sector], "routePairs": len(routes), "avgFare": round(current),
            "baselineFare": round(baseline), "indexScore": _round(current / baseline * 100 if baseline else 0),
            "changePercent": _round(change), "volatility": round(mean(r["volatilityIndex"] for r in routes)),
            "status": "High Yield Stress" if change >= 15 else "Moderate Surge" if change >= 5 else "Discounted" if change < -5 else "Equilibrium",
            "keyRoutes": [r["id"] for r in routes],
        })

    airport_rows = {}
    for code in {r["origin"] for r in flight_routes} | {r["destination"] for r in flight_routes}:
        ref = AIRPORT_REFERENCE.get(code, (code, "", 0.0, 0.0))
        related = [r for r in flight_routes if code in {r["origin"], r["destination"]}]
        airport_rows[code] = {
            "code": code, "name": ref[0], "city": ref[0], "state": ref[1], "lat": ref[2], "lng": ref[3],
            "activeRoutesCount": len(related), "avgFare": round(mean(r["currentFare"] for r in related)) if related else 0,
            "indexMovement": _round(mean(r["changePercent"] for r in related)) if related else 0,
            "tier": 1 if code in METROS else 2, "dailyFlights": sum(r["observationsCount"] for r in related),
        }

    latest_rows = sorted(observations, key=lambda row: row.collected_at or row.created_at, reverse=True)[:10]
    route_lookup = {r["id"]: r for r in flight_routes}
    telemetry = []
    for row in latest_rows:
        route_data = route_lookup.get(row.route_id, {})
        origin = route_data.get("origin", row.route_id.split("-", 1)[0])
        destination = route_data.get("destination", row.route_id.split("-", 1)[-1])
        change = route_data.get("changePercent", 0)
        telemetry.append({
            "id": str(row.observation_id or row.id),
            "timestamp": (row.collected_at or row.created_at).strftime("%H:%M:%S"),
            "route": f"{origin} → {destination}", "origin": origin, "dest": destination,
            "carrier": " ".join(filter(None, [row.airline, row.flight_number])), "observedFare": round(float(row.fare)),
            "changeType": "spike" if change >= 20 else "up" if change > 2 else "down" if change < -2 else "stable",
            "deviation": change,
        })

    total_all = db.query(FareObservation).count()
    clean_count = db.query(FareObservation).filter(FareObservation.cleaning_status == "clean").count()
    priced_count = db.query(FareObservation).filter(FareObservation.fare.is_not(None)).count()
    latest_at = max(((row.collected_at or row.created_at) for row in observations), default=None)
    freshness = 0
    if latest_at:
        if latest_at.tzinfo is None:
            latest_at = latest_at.replace(tzinfo=timezone.utc)
        freshness = max(0, round(100 - min(100, (datetime.now(timezone.utc) - latest_at).total_seconds() / 864)))
    coverage = round(len(by_route) / len(weights) * 100) if weights else 0
    completeness = round(priced_count / total_all * 100) if total_all else 0
    consistency = round(clean_count / total_all * 100) if total_all else 0
    quality = {
        "overallConfidence": round(mean([coverage, completeness, freshness, consistency])), "coverage": coverage,
        "completeness": completeness, "freshness": freshness, "consistency": consistency,
        "totalDailyScrapes": len(by_date[max(by_date)]) if by_date else 0,
        "verifiedCarriers": len(MONITORED_AIRLINES), "activeMonitoringNodes": len(by_route),
        "lastSyncTimestamp": latest_at.isoformat() if latest_at else "No observations",
    }

    source_counts = Counter(row.source for row in observations)
    recent_runs = db.query(ScrapeRun).order_by(ScrapeRun.started_at.desc()).limit(100).all()
    run_durations: dict[str, list[float]] = defaultdict(list)
    for run in recent_runs:
        if run.started_at and run.completed_at:
            run_durations[run.source].append(max(0.0, (run.completed_at - run.started_at).total_seconds()))
    sources = [{
        "id": f"src-{name.lower().replace(' ', '-')}", "name": name, "type": "carrier" if name != "Yatra" else "ota",
        "throughput": f"{count} persisted quotes", "status": "active",
        "latency": f"{mean(run_durations[name]):.1f}s avg" if run_durations[name] else "Not recorded",
        "description": "Persisted scraper observations that passed ETL validation.", "recordsPerDay": count,
    } for name, count in source_counts.items()]

    latest_index = index_timeline[-1]["indexValue"] if index_timeline else 0
    previous_index = index_timeline[-2]["indexValue"] if len(index_timeline) > 1 else latest_index
    avg_fare = round(mean(float(row.fare) for row in observations)) if observations else 0
    anomalies = [r for r in flight_routes if r["isAnomaly"]]
    metrics = [
        {"id": "kpai-index", "title": "National Airfare Index (APIx)", "value": latest_index, "trend": f"{_round(latest_index - previous_index):+}% latest", "trendType": "neutral", "iconType": "plane", "subtitle": "Earliest persisted day = 100", "tooltip": "Fixed-base expenditure-weighted index using DGCA traffic and clean matched fare relatives."},
        {"id": "kpai-routes", "title": "Routes with Live Data", "value": len(by_route), "trend": f"{coverage}% basket coverage", "trendType": "positive", "iconType": "route", "subtitle": f"of {len(weights)} weighted city pairs", "tooltip": "Routes with at least one clean PostgreSQL observation."},
        {"id": "kpai-airlines", "title": "Airlines Monitored", "value": len(MONITORED_AIRLINES), "trend": f"{len(MONITORED_OTAS)} OTA monitored", "trendType": "neutral", "iconType": "airline", "subtitle": f"Airlines: {', '.join(MONITORED_AIRLINES)} • OTA: {', '.join(MONITORED_OTAS)}", "tooltip": "Configured direct airline and online travel aggregator sources. OTA-listed carrier names are not counted as separately monitored airline scrapers."},
        {"id": "kpai-records", "title": "Latest Daily Fare Records", "value": quality["totalDailyScrapes"], "trend": "Database count", "trendType": "positive", "iconType": "database", "subtitle": quality["lastSyncTimestamp"], "tooltip": "Clean quotes on the latest observation date."},
        {"id": "kpai-avg-fare", "title": "Observed Average Fare", "value": f"₹{avg_fare:,}", "trend": "All clean observations", "trendType": "neutral", "iconType": "trend", "subtitle": "INR total fare", "tooltip": "Mean total fare across clean persisted observations."},
        {"id": "kpai-anomalies", "title": "Active Anomalies", "value": len(anomalies), "trend": "20% baseline threshold", "trendType": "alert", "iconType": "alert", "subtitle": ", ".join(r["id"] for r in anomalies) or "None", "tooltip": "Routes whose latest mean differs from their earliest persisted mean by at least 20%."},
    ]

    cpi_rows = {normalize_cpi_month(row.month): row for row in db.query(CPIReference).all()}
    apix_monthly: dict[str, list[float]] = defaultdict(list)
    for point in index_timeline:
        period = datetime.strptime(point["date"], "%d/%m/%y").strftime("%Y-%m")
        apix_monthly[period].append(float(point["indexValue"]))
    apix_monthly_mean = {period: mean(values) for period, values in apix_monthly.items()}
    overlapping_periods = sorted(set(cpi_rows) & set(apix_monthly_mean))
    comparison_base = overlapping_periods[0] if overlapping_periods else None
    cpi_base = float(cpi_rows[comparison_base].combined_index) if comparison_base else None
    apix_base = apix_monthly_mean.get(comparison_base) if comparison_base else None
    transport_base = (
        float(cpi_rows[comparison_base].transport_index)
        if comparison_base and cpi_rows[comparison_base].transport_index is not None else None
    )
    cpi_series = []
    for period in sorted(set(cpi_rows) | set(apix_monthly_mean)):
        cpi = cpi_rows.get(period)
        raw_apix = apix_monthly_mean.get(period)
        raw_general = float(cpi.combined_index) if cpi else None
        raw_transport = float(cpi.transport_index) if cpi and cpi.transport_index is not None else None
        rebased_apix = raw_apix / apix_base * 100 if raw_apix is not None and apix_base else None
        rebased_general = raw_general / cpi_base * 100 if raw_general is not None and cpi_base else None
        rebased_transport = raw_transport / transport_base * 100 if raw_transport is not None and transport_base else None
        cpi_series.append({
            "month": datetime.strptime(period, "%Y-%m").strftime("%b %Y"),
            "period": period,
            "airfareIndex": _round(rebased_apix, 2) if rebased_apix is not None else None,
            "airfareIndexRaw": _round(raw_apix, 2) if raw_apix is not None else None,
            "cpiGeneral": _round(rebased_general, 2) if rebased_general is not None else None,
            "cpiGeneralRaw": _round(raw_general, 2) if raw_general is not None else None,
            "cpiTransport": _round(rebased_transport, 2) if rebased_transport is not None else None,
            "cpiTransportRaw": _round(raw_transport, 2) if raw_transport is not None else None,
            "divergence": _round(rebased_apix - rebased_general, 2)
            if rebased_apix is not None and rebased_general is not None else None,
        })

    return {
        "hasData": bool(observations), "generatedAt": datetime.now(timezone.utc).isoformat(),
        "kpaiMetrics": metrics, "routeWeights": route_weights, "airports": airport_rows,
        "flightRoutes": flight_routes, "indexTimeline": index_timeline, "cpiDataSeries": cpi_series,
        "cpiComparisonMeta": {
            "source": "MoSPI CPI Dashboard Data, updated July 2026 (12 August 2026 release)",
            "officialSeries": "All-India General CPI (Combined)",
            "comparisonBaseMonth": comparison_base,
            "transportSeriesAvailable": any(row.transport_index is not None for row in cpi_rows.values()),
            "note": "APIx and General CPI are independently rebased to 100 at the first overlapping month. General CPI is a macro benchmark, not an airfare validation target.",
        },
        "sectorHeatmapData": sector_heatmap, "leadTimeByRoute": lead_time,
        "priceTrendSeries": [], "liveTelemetryFeed": telemetry, "dataQuality": quality, "dataSources": sources,
    }
