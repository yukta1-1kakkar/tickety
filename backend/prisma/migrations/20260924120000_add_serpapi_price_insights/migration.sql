ALTER TABLE "fare_observations"
    ADD COLUMN "price_level" VARCHAR(20),
    ADD COLUMN "lowest_price" DOUBLE PRECISION,
    ADD COLUMN "typical_price_low" DOUBLE PRECISION,
    ADD COLUMN "typical_price_high" DOUBLE PRECISION,
    ADD COLUMN "is_synthetic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "fare_observations_is_synthetic_idx"
    ON "fare_observations"("is_synthetic");
