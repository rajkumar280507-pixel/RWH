-- =============================================================================
-- Additional indexes beyond the ones declared inline in each table file.
-- Run after all table files.
-- =============================================================================
USE rwh;

-- Fast "latest reading per station" lookups.
CREATE INDEX idx_gw_readings_station_latest ON gw_readings (station_id, recorded_at DESC);
CREATE INDEX idx_rainfall_readings_station_latest ON rainfall_readings (station_id, recorded_at DESC);

-- Full-text search on station/building names for the search bar.
ALTER TABLE gw_stations ADD FULLTEXT INDEX ftx_gw_stations_name (station_name);
ALTER TABLE rainfall_stations ADD FULLTEXT INDEX ftx_rainfall_stations_name (station_name);
ALTER TABLE buildings ADD FULLTEXT INDEX ftx_buildings_name (name);

-- Sync failure triage.
CREATE INDEX idx_sync_failures_unresolved ON sync_failures (source, resolved);
