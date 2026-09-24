from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer,
    String, Text,
)
from sqlalchemy.orm import relationship

from app.database.db import Base


def utc_now():
    return datetime.now(timezone.utc)


class RouteWeight(Base):
    """DGCA passenger-traffic weight for a domestic city pair."""

    __tablename__ = "route_weights"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    route_id = Column(String(50), unique=True, index=True, nullable=False)
    origin = Column(String(50), index=True, nullable=False)
    destination = Column(String(50), index=True, nullable=False)
    total_passengers = Column(Float, nullable=False, default=0.0)
    weight = Column(Float, nullable=False, default=0.0)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    fare_observations = relationship(
        "FareObservation", back_populates="route", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<RouteWeight(route_id='{self.route_id}', weight={self.weight:.6f}, passengers={self.total_passengers})>"


class ScrapeRun(Base):
    """Audit record for one ETL import of a scraper output file."""

    __tablename__ = "scrape_runs"
    id = Column(String(36), primary_key=True)
    source = Column(String(80), nullable=False, index=True)
    source_file = Column(String(255), nullable=False)
    file_checksum = Column(String(64), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="running")
    input_count = Column(Integer, nullable=False, default=0)
    clean_count = Column(Integer, nullable=False, default=0)
    unavailable_count = Column(Integer, nullable=False, default=0)
    outlier_count = Column(Integer, nullable=False, default=0)
    rejected_count = Column(Integer, nullable=False, default=0)
    inserted_count = Column(Integer, nullable=False, default=0)
    updated_count = Column(Integer, nullable=False, default=0)
    fare_observations = relationship("FareObservation", back_populates="scrape_run")
    rejected_observations = relationship("RejectedObservation", back_populates="scrape_run")


class FareObservation(Base):
    """Cleaned or unavailable airfare quote retained as a daily snapshot."""

    __tablename__ = "fare_observations"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    observation_id = Column(String(80), nullable=True, index=True)
    record_fingerprint = Column(String(64), nullable=True, unique=True, index=True)
    scrape_run_id = Column(String(36), ForeignKey("scrape_runs.id"), nullable=True, index=True)
    route_id = Column(String(50), ForeignKey("route_weights.route_id"), index=True, nullable=False)
    airline = Column(String(80), index=True, nullable=False)
    airline_code = Column(String(10), nullable=True, index=True)
    flight_number = Column(String(80), nullable=True, index=True)
    travel_date = Column(Date, nullable=False, index=True)
    observation_date = Column(Date, nullable=False, index=True)
    advance_purchase_days = Column(Integer, nullable=False, index=True)
    collected_at = Column(DateTime(timezone=True), nullable=True, index=True)
    departure_time = Column(DateTime(timezone=True), nullable=True)
    arrival_time = Column(DateTime(timezone=True), nullable=True)
    trip_type = Column(String(20), nullable=False, default="one_way")
    cabin = Column(String(30), nullable=False, default="economy")
    stops = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    fare = Column(Float, nullable=True)
    price_level = Column(String(20), nullable=True)
    lowest_price = Column(Float, nullable=True)
    typical_price_low = Column(Float, nullable=True)
    typical_price_high = Column(Float, nullable=True)
    currency = Column(String(10), default="INR", nullable=False)
    source = Column(String(80), default="scraper", nullable=False)
    source_type = Column(String(80), nullable=True)
    seller_name = Column(String(100), nullable=True)
    source_url = Column(Text, nullable=True)
    availability_status = Column(String(40), nullable=False, default="available", index=True)
    no_flights = Column(Boolean, nullable=True)
    scrape_outcome = Column(String(80), nullable=True)
    data_quality_score = Column(Float, nullable=True)
    cleaning_status = Column(String(30), nullable=False, default="clean", index=True)
    is_outlier = Column(Boolean, nullable=False, default=False, index=True)
    is_synthetic = Column(Boolean, nullable=False, default=False, index=True)
    rejection_reason = Column(Text, nullable=True)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    route = relationship("RouteWeight", back_populates="fare_observations")
    scrape_run = relationship("ScrapeRun", back_populates="fare_observations")

    __table_args__ = (
        Index("idx_route_obs_adv", "route_id", "observation_date", "advance_purchase_days"),
        Index("idx_route_airline_dates", "route_id", "airline", "travel_date", "observation_date", "advance_purchase_days"),
        Index("idx_clean_index_input", "observation_date", "advance_purchase_days", "cleaning_status"),
    )

    def __repr__(self):
        return f"<FareObservation(route='{self.route_id}', airline='{self.airline}', fare={self.fare}, obs_date='{self.observation_date}')>"


class RejectedObservation(Base):
    """Raw quote rejected by ETL, retained for audit and debugging."""

    __tablename__ = "rejected_observations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scrape_run_id = Column(String(36), ForeignKey("scrape_runs.id"), nullable=False, index=True)
    source = Column(String(80), nullable=True)
    route_id = Column(String(50), nullable=True)
    reason = Column(Text, nullable=False)
    raw_payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    scrape_run = relationship("ScrapeRun", back_populates="rejected_observations")


class CPIReference(Base):
    __tablename__ = "cpi_reference"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    month = Column(String(20), unique=True, index=True, nullable=False)
    combined_index = Column(Float, nullable=False)
    transport_index = Column(Float, nullable=True)
    inflation_pct = Column(Float, nullable=True)

    def __repr__(self):
        return f"<CPIReference(month='{self.month}', combined_index={self.combined_index})>"
