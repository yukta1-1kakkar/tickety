"""Small resilient HTTP client for the SerpAPI Google Flights engine."""

from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class SerpAPIError(RuntimeError):
    pass


class SerpAPIQuotaError(SerpAPIError):
    pass


@dataclass
class SerpAPIClient:
    api_key: str
    base_url: str = "https://serpapi.com/search"
    timeout_seconds: float = 45.0
    max_retries: int = 3
    backoff_seconds: float = 1.0
    request_delay_seconds: float = 1.0
    opener: Callable[..., Any] = urlopen
    sleeper: Callable[[float], None] = time.sleep

    def __post_init__(self) -> None:
        if not self.api_key.strip():
            raise ValueError("SERPAPI_API_KEY is required")
        if self.max_retries < 0:
            raise ValueError("max_retries cannot be negative")

    def search_flights(self, *, departure_id: str, arrival_id: str, outbound_date: str) -> dict:
        params = {
            "engine": "google_flights",
            "departure_id": departure_id,
            "arrival_id": arrival_id,
            "outbound_date": outbound_date,
            "type": 2,
            "travel_class": 1,
            "adults": 1,
            "currency": "INR",
            "gl": "in",
            "hl": "en",
            "show_hidden": "true",
            "output": "json",
            "api_key": self.api_key,
        }
        endpoint = self.base_url.split("?", 1)[0].rstrip("/")
        url = f"{endpoint}?{urlencode(params)}"
        for attempt in range(self.max_retries + 1):
            if self.request_delay_seconds:
                self.sleeper(self.request_delay_seconds)
            try:
                request = Request(url, headers={"Accept": "application/json", "User-Agent": "VayuSetu/1.0"})
                with self.opener(request, timeout=self.timeout_seconds) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                self._raise_api_error(payload)
                return payload
            except HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                if exc.code in {402, 403, 429} and self._looks_like_quota(body):
                    raise SerpAPIQuotaError(f"SerpAPI quota/authorization error ({exc.code}): {body[:300]}") from exc
                if exc.code not in {408, 429, 500, 502, 503, 504} or attempt == self.max_retries:
                    raise SerpAPIError(f"SerpAPI HTTP {exc.code}: {body[:300]}") from exc
            except (TimeoutError, URLError, json.JSONDecodeError) as exc:
                if attempt == self.max_retries:
                    raise SerpAPIError(f"SerpAPI request failed after {attempt + 1} attempts: {exc}") from exc
            self.sleeper(self.backoff_seconds * (2 ** attempt) + random.uniform(0, 0.25))
        raise AssertionError("unreachable")

    @staticmethod
    def _looks_like_quota(message: str) -> bool:
        lowered = message.lower()
        return any(term in lowered for term in (
            "quota", "searches per month", "run out of searches", "credits", "account limit",
        ))

    @classmethod
    def _raise_api_error(cls, payload: dict) -> None:
        message = payload.get("error")
        status = str(payload.get("search_metadata", {}).get("status", ""))
        if message or status.lower() == "error":
            detail = str(message or "SerpAPI search status is Error")
            if cls._looks_like_quota(detail):
                raise SerpAPIQuotaError(detail)
            raise SerpAPIError(detail)
