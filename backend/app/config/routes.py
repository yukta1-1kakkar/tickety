"""Canonical 24-route basket shared by APIs, analytics, and the scraper."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


ROUTES_FILE = Path(__file__).resolve().parents[3] / "config" / "routes.json"


@lru_cache(maxsize=1)
def configured_routes() -> tuple[dict, ...]:
    payload = json.loads(ROUTES_FILE.read_text(encoding="utf-8"))
    routes = tuple(payload.get("routes", ()))
    if len(routes) != 24:
        raise RuntimeError(f"{ROUTES_FILE} must define exactly 24 routes")
    if len({row["routeId"] for row in routes}) != len(routes):
        raise RuntimeError(f"{ROUTES_FILE} contains duplicate route IDs")
    return routes


ROUTE_IDS = tuple(row["routeId"] for row in configured_routes())
DISPLAY_ROUTE_IDS = tuple(row["displayId"] for row in configured_routes())
# Airport-code IDs are retained as aliases for legacy test/local databases.
ALLOWED_ROUTE_IDS = frozenset((*ROUTE_IDS, *DISPLAY_ROUTE_IDS))


def is_configured_route(route_id: str) -> bool:
    return route_id.strip().upper() in ALLOWED_ROUTE_IDS
