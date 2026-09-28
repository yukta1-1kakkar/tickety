"""Stable duplicate identity used by historical imports and future scrapes."""

from __future__ import annotations

import hashlib
import json


def natural_fingerprint(record: dict) -> str:
    def serialized(value):
        return value.isoformat() if hasattr(value, "isoformat") else value

    identity = {
        "source": record.get("source"),
        "seller": record.get("seller_name"),
        "route": record.get("route_id"),
        "airline": record.get("airline"),
        "airline_code": record.get("airline_code"),
        "flight_number": record.get("flight_number"),
        "travel_date": serialized(record.get("travel_date")),
        "departure_time": serialized(record.get("departure_time")),
        "advance_days": record.get("advance_purchase_days"),
        "observation_date": serialized(record.get("observation_date")),
    }
    encoded = json.dumps(identity, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(encoded).hexdigest()
