-- =============================================================================
-- Views backing the dashboard stat cards and map layers.
--
-- "Latest reading per station" deliberately uses a per-station MAX() subquery
-- rather than ROW_NUMBER() OVER (PARTITION BY ...). The window-function form
-- has to read and sort EVERY row in the readings table on every query — with
-- 600k+ synced CGWB readings that took ~3 s and made the dashboard cards time
-- out. The correlated MAX() lets MySQL seek the (station_id, recorded_at)
-- index once per station instead (hundreds of seeks, not a full scan).
-- =============================================================================
USE rwh;

-- water_level_m is exposed as a POSITIVE depth below ground everywhere.
-- The raw NWDP column mixes sign conventions (mostly negative depths, some
-- positive), and also carries reduced levels above MSL and sentinel values
-- that are not depths at all. Those are nulled out here rather than shown as
-- a bogus depth; raw_water_level_m keeps the untouched feed value for audit.
CREATE OR REPLACE VIEW v_gw_latest AS
SELECT
    s.id            AS station_id,
    s.station_code,
    s.station_name,
    s.state,
    s.district,
    s.taluk,
    s.latitude,
    s.longitude,
    CASE
        WHEN ABS(r.water_level_m) > 0 AND ABS(r.water_level_m) <= 100
        THEN ABS(r.water_level_m)
        ELSE NULL
    END             AS water_level_m,
    r.water_level_m AS raw_water_level_m,
    r.recorded_at
FROM gw_stations s
JOIN gw_readings r
  ON r.station_id = s.id
 AND r.recorded_at = (
        SELECT MAX(r2.recorded_at)
        FROM gw_readings r2
        WHERE r2.station_id = s.id
    );

CREATE OR REPLACE VIEW v_rainfall_latest AS
SELECT
    s.id            AS station_id,
    s.station_code,
    s.station_name,
    s.state,
    s.district,
    s.taluk,
    s.latitude,
    s.longitude,
    -- Rainfall is a depth and can never be negative; clamp any bad sign.
    ABS(r.rainfall_mm) AS rainfall_mm,
    r.recorded_at
FROM rainfall_stations s
JOIN rainfall_readings r
  ON r.station_id = s.id
 AND r.recorded_at = (
        SELECT MAX(r2.recorded_at)
        FROM rainfall_readings r2
        WHERE r2.station_id = s.id
    );

-- District-level rollup for the dashboard summary cards.
CREATE OR REPLACE VIEW v_district_summary AS
SELECT
    d.id                        AS district_id,
    d.state,
    d.district,
    AVG(g.water_level_m)        AS avg_groundwater_level_m,
    COUNT(DISTINCT g.station_id) AS gw_station_count,
    AVG(rf.rainfall_mm)         AS avg_rainfall_mm,
    COUNT(DISTINCT rf.station_id) AS rainfall_station_count
FROM districts d
LEFT JOIN v_gw_latest g ON g.district = d.district AND g.state = d.state
LEFT JOIN v_rainfall_latest rf ON rf.district = d.district AND rf.state = d.state
GROUP BY d.id, d.state, d.district;

-- Rolling 7-day sync health, used by the "Recent Synchronization" panel.
CREATE OR REPLACE VIEW v_sync_health AS
SELECT
    source, status, started_at, finished_at,
    records_fetched, records_upserted, records_failed,
    TIMESTAMPDIFF(SECOND, started_at, COALESCE(finished_at, NOW())) AS duration_seconds
FROM sync_runs
WHERE started_at > (NOW() - INTERVAL 7 DAY)
ORDER BY started_at DESC;
