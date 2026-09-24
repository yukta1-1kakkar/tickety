from datetime import date
from typing import List
from pydantic import BaseModel, Field, field_validator, model_validator

class FareIngestSchema(BaseModel):
    """
    Pydantic Schema for ingesting single airfare observation from scraper or aggregator.
    """
    route_id: str = Field(..., description="Route identifier in standard format (e.g. 'DEL-BOM')", examples=["DEL-BOM"])
    airline: str = Field(..., description="Operating Airline Name (e.g. 'IndiGo', 'Air India')", examples=["IndiGo"])
    travel_date: date = Field(..., description="Target Travel Date (YYYY-MM-DD)", examples=["2026-09-01"])
    observation_date: date = Field(..., description="Observation / Scraping Date (YYYY-MM-DD)", examples=["2026-08-25"])
    advance_purchase_days: int = Field(..., ge=0, description="Booking horizon in days", examples=[7])
    fare: float = Field(..., gt=0, description="Total fare in INR (must be > 0)", examples=[4850.0])
    currency: str = Field("INR", description="Three-letter ISO currency code", examples=["INR"])
    source: str = Field("scraper", description="Source portal or method (e.g., 'makemytrip', 'indigo', 'mock')", examples=["makemytrip"])

    @field_validator("fare")
    @classmethod
    def validate_fare(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Fare must be strictly positive (> 0)")
        return round(float(v), 2)

    @field_validator("route_id")
    @classmethod
    def standardize_route_id(cls, v: str) -> str:
        cleaned = v.strip().upper().replace(" ", "")
        if not cleaned:
            raise ValueError("route_id cannot be empty")
        return cleaned

    @model_validator(mode="after")
    def validate_dates(self) -> "FareIngestSchema":
        if self.travel_date < self.observation_date:
            raise ValueError(
                f"travel_date ({self.travel_date}) cannot be earlier than observation_date ({self.observation_date})"
            )
        return self


class BulkFareIngestSchema(BaseModel):
    """
    Pydantic Schema for batch ingestion of multiple fare observations.
    """
    fares: List[FareIngestSchema] = Field(..., description="List of airfare observation records")
