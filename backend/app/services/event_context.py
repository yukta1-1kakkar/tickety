"""Calendar context and observed fares, not a demand or price forecast."""
import json
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from sqlalchemy import func
from app.api.fares import eligible, latest_order
from app.database.models import FareObservation as Fare


@lru_cache(maxsize=1)
def calendar():
    return json.loads((Path(__file__).resolve().parents[3] / 'config' / 'holidays.json').read_text(encoding='utf-8'))


def event_context(db, departure, aliases):
    data = calendar()
    candidates = [(date.fromisoformat(day), event) for day, event in data['events'].items()
                  if -3 <= (date.fromisoformat(day) - departure).days <= 45]
    source_url = data.get('sourceUrls', {}).get(str(departure.year), data.get('sourceUrl'))
    base = {'coverageAvailable': departure.year in data['coverageYears'], 'sourceUrl': source_url, 'event': None, 'days': []}
    if not candidates:
        return base
    event_day, event = min(candidates, key=lambda pair: abs((pair[0] - departure).days))
    start, end = event_day - timedelta(days=3), event_day + timedelta(days=3)
    ranked = eligible(db).filter(Fare.route_id.in_(aliases), Fare.travel_date.between(start, end)).with_entities(
        Fare.id.label('id'), func.row_number().over(partition_by=Fare.travel_date, order_by=latest_order()).label('rank'),
    ).subquery()
    rows = db.query(Fare.travel_date, Fare.fare, Fare.price_level, Fare.collected_at).join(ranked, ranked.c.id == Fare.id).filter(ranked.c.rank == 1).all()
    observed = {row.travel_date: row for row in rows}
    days = []
    for offset in range(-3, 4):
        day = event_day + timedelta(days=offset)
        row = observed.get(day)
        days.append({'date': day, 'offset': offset, 'phase': 'before' if offset < 0 else 'after' if offset > 0 else 'event',
                     'fare': row.fare if row else None, 'collectedAt': row.collected_at if row else None,
                     'priceLevel': row.price_level.upper() if row and row.price_level and row.price_level.upper() in {'LOW','TYPICAL','HIGH'} else None})
    return {**base, 'event': {'name': event['name'], 'date': event_day, 'travelOffset': (departure-event_day).days}, 'days': days}
