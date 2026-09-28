"""One-time, idempotent import from the read-only old database into the new DB."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import MetaData, Table, func, inspect, select
from sqlalchemy.dialects.postgresql import insert as pg_insert


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database.db import engine as new_engine  # noqa: E402
from app.database.historical_db import create_historical_engine  # noqa: E402
from app.services.record_identity import natural_fingerprint  # noqa: E402


FARE_TABLE = "fare_observations"
ROUTE_TABLE = "route_weights"
REQUIRED_FARE_COLUMNS = {
    "route_id", "airline", "travel_date", "observation_date",
    "advance_purchase_days", "fare", "source",
}
IGNORED_LEGACY_FARE_COLUMNS = {
    "base_fare", "convenience_fee", "fare_family", "mandatory_fees",
    "seats_available", "sold_out", "taxes", "user_development_fee",
}


def _tables(engine):
    names = set(inspect(engine).get_table_names())
    missing_tables = {FARE_TABLE, ROUTE_TABLE} - names
    if missing_tables:
        raise RuntimeError(f"missing required table(s): {', '.join(sorted(missing_tables))}")
    metadata = MetaData()
    return (
        Table(FARE_TABLE, metadata, autoload_with=engine),
        Table(ROUTE_TABLE, metadata, autoload_with=engine),
    )


def _insert_ignore(connection, table, rows: list[dict], conflict_column: str) -> int:
    if not rows:
        return 0
    if connection.dialect.name != "postgresql":
        raise RuntimeError("Historical import requires the new DATABASE_URL to be PostgreSQL")
    statement = pg_insert(table).on_conflict_do_nothing(
        index_elements=[conflict_column]
    )
    # Pass rows as executemany parameters and cap generated VALUES pages. This
    # avoids enormous SQL statements when raw_payload contains large JSON.
    result = connection.execution_options(
        insertmanyvalues_page_size=100, preserve_rowcount=True,
    ).execute(statement, rows)
    return result.rowcount


def _canonical_record(row: dict, target_columns: set[str]) -> dict:
    values = {key: value for key, value in row.items() if key in target_columns}
    values.pop("id", None)
    # Old scrape-run UUIDs are not meaningful without copying audit runs and
    # would violate the new database foreign key.
    values["scrape_run_id"] = None
    values["record_fingerprint"] = natural_fingerprint(values)
    return values


def import_history(batch_size: int = 1000, dry_run: bool = False) -> dict:
    old_engine = create_historical_engine()
    try:
        old_fares, old_routes = _tables(old_engine)
        new_fares, new_routes = _tables(new_engine)
        missing = REQUIRED_FARE_COLUMNS - set(old_fares.c.keys())
        if missing:
            raise RuntimeError(
                "old fare_observations schema is incompatible; missing columns: "
                + ", ".join(sorted(missing))
            )
        source_only_columns = set(old_fares.c.keys()) - set(new_fares.c.keys())
        unexpected_source_columns = source_only_columns - IGNORED_LEGACY_FARE_COLUMNS
        if unexpected_source_columns:
            raise RuntimeError(
                "old fare_observations has unexpected fields that the new schema cannot preserve: "
                + ", ".join(sorted(unexpected_source_columns))
                + ". Add an explicit target mapping/schema change before importing."
            )
        required_target_columns = {"record_fingerprint", "scrape_run_id"}
        missing_target = required_target_columns - set(new_fares.c.keys())
        if missing_target:
            raise RuntimeError(
                "new fare_observations schema is missing importer columns: "
                + ", ".join(sorted(missing_target))
            )

        summary = {
            "oldDatabaseMode": "read-only", "batchSize": batch_size,
            "sourceRecords": 0, "routesInserted": 0,
            "recordsInserted": 0, "duplicatesSkipped": 0,
            "ignoredLegacyColumns": sorted(source_only_columns),
            "dryRun": dry_run,
        }
        if dry_run:
            with old_engine.connect() as old, new_engine.connect() as new:
                summary["sourceRecords"] = sum(
                    1 for _ in old.execution_options(stream_results=True).execute(select(old_fares.c.id))
                )
                target_stats = new.execute(select(
                    func.count(new_fares.c.id),
                    func.count(func.distinct(new_fares.c.route_id)),
                    func.min(new_fares.c.observation_date),
                    func.max(new_fares.c.observation_date),
                )).one()
                summary["targetRecords"] = target_stats[0]
                summary["targetRoutes"] = target_stats[1]
                summary["targetFirstObservation"] = target_stats[2]
                summary["targetLastObservation"] = target_stats[3]
            return summary

        old_route_columns = set(old_routes.c.keys())
        new_route_columns = set(new_routes.c.keys())
        common_route_columns = (old_route_columns & new_route_columns) - {"id"}
        if "route_id" not in common_route_columns:
            raise RuntimeError("route_weights.route_id is required in both databases")

        with old_engine.connect() as old:
            route_rows = [
                {key: row._mapping[key] for key in common_route_columns}
                for row in old.execute(select(old_routes))
            ]
            with new_engine.begin() as new:
                summary["routesInserted"] = _insert_ignore(new, new_routes, route_rows, "route_id")

            # Account for data written before the canonical hash was introduced.
            with new_engine.connect() as new:
                existing_natural_keys = {
                    natural_fingerprint(dict(row._mapping))
                    for row in new.execution_options(stream_results=True).execute(select(
                        new_fares.c.source, new_fares.c.seller_name,
                        new_fares.c.route_id, new_fares.c.airline,
                        new_fares.c.airline_code, new_fares.c.flight_number,
                        new_fares.c.travel_date, new_fares.c.departure_time,
                        new_fares.c.advance_purchase_days, new_fares.c.observation_date,
                    ))
                }
            target_columns = set(new_fares.c.keys())
            batch: list[dict] = []
            old_rows = old.execution_options(stream_results=True).execute(select(old_fares))
            for source_row in old_rows:
                summary["sourceRecords"] += 1
                record = _canonical_record(dict(source_row._mapping), target_columns)
                fingerprint = record["record_fingerprint"]
                if fingerprint in existing_natural_keys:
                    summary["duplicatesSkipped"] += 1
                    continue
                existing_natural_keys.add(fingerprint)
                batch.append(record)
                if len(batch) >= batch_size:
                    with new_engine.begin() as new:
                        inserted = _insert_ignore(new, new_fares, batch, "record_fingerprint")
                    summary["recordsInserted"] += inserted
                    summary["duplicatesSkipped"] += len(batch) - inserted
                    batch.clear()
            if batch:
                with new_engine.begin() as new:
                    inserted = _insert_ignore(new, new_fares, batch, "record_fingerprint")
                summary["recordsInserted"] += inserted
                summary["duplicatesSkipped"] += len(batch) - inserted
        return summary
    finally:
        old_engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.batch_size < 1 or args.batch_size > 10000:
        parser.error("--batch-size must be between 1 and 10000")
    print(json.dumps(import_history(args.batch_size, args.dry_run), indent=2, default=str))


if __name__ == "__main__":
    main()
