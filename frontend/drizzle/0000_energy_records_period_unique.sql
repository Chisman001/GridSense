DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM energy_records
    GROUP BY business_id, year, month
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce unique energy-record periods while duplicate business/year/month rows exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "energy_records_business_year_month_unique"
  ON "energy_records" ("business_id", "year", "month");
