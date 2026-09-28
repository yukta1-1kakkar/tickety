-- Connecting itineraries can contain combined SerpAPI cabin labels such as
-- "Premium Economy / Business Class".
ALTER TABLE "fare_observations"
    ALTER COLUMN "cabin" TYPE VARCHAR(80);
