-- SerpAPI Google Flights does not reliably provide a fare-family value.
ALTER TABLE "fare_observations"
    DROP COLUMN IF EXISTS "fare_family";
