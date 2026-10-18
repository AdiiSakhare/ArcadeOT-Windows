-- Proposed cloud sink DDL; no database is provisioned by this package.
BEGIN;
CREATE TABLE IF NOT EXISTS arcadeot_measurements (
 event_id text PRIMARY KEY,
 site_id text NOT NULL,
 plc_id text NOT NULL,
 sensor_id text NOT NULL,
 config_revision text NOT NULL,
 observed_at_utc timestamptz NOT NULL,
 source_at_utc timestamptz,
 quality text NOT NULL,
 raw_value jsonb,
 value jsonb,
 unit text NOT NULL DEFAULT '',
 error text,
 raw_hex text NOT NULL DEFAULT '',
 payload jsonb NOT NULL,
 ingested_at_utc timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_measurement_site_time ON arcadeot_measurements(site_id,observed_at_utc DESC);
CREATE INDEX IF NOT EXISTS ix_measurement_sensor_time ON arcadeot_measurements(site_id,plc_id,sensor_id,observed_at_utc DESC);
COMMIT;
-- Ingestion implementation must bind parameters, authorize site_id from bearer identity,
-- validate payload, detect EventId/content conflicts and ACK only after commit.
-- RLS/user provisioning is deployment-specific and is not supplied by this table DDL.
