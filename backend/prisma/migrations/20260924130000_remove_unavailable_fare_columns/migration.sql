-- SerpAPI Google Flights does not provide fare breakups or seat inventory.
-- Remove these legacy columns from the persisted observation schema.
ALTER TABLE "fare_observations"
    DROP COLUMN IF EXISTS "base_fare",
    DROP COLUMN IF EXISTS "taxes",
    DROP COLUMN IF EXISTS "user_development_fee",
    DROP COLUMN IF EXISTS "convenience_fee",
    DROP COLUMN IF EXISTS "mandatory_fees",
    DROP COLUMN IF EXISTS "seats_available",
    DROP COLUMN IF EXISTS "sold_out";
