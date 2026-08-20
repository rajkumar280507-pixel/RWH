-- =============================================================================
-- Stored procedures for manual/scheduled data maintenance.
--
-- The app itself (backend/app/services/sync_service.py) does its UPSERTs via
-- SQLAlchemy, not by calling these — they exist for ad-hoc admin use and the
-- scheduled daily rollup (see scheduler.sql).
-- =============================================================================
USE rwh;

DROP PROCEDURE IF EXISTS rebuild_rainfall_daily;

DELIMITER $$

CREATE PROCEDURE rebuild_rainfall_daily(IN p_day DATE)
BEGIN
    DELETE FROM rainfall_daily WHERE day = p_day;

    INSERT INTO rainfall_daily (station_id, day, total_mm, reading_count)
    SELECT
        station_id,
        p_day,
        COALESCE(SUM(rainfall_mm), 0),
        COUNT(*)
    FROM rainfall_readings
    WHERE DATE(recorded_at) = p_day
    GROUP BY station_id;
END$$

DELIMITER ;

-- Manual-use UPSERT helpers matching the app's ON DUPLICATE KEY UPDATE
-- semantics on (station_id, recorded_at), for admin scripts that want a
-- single callable rather than hand-writing the INSERT.

DROP PROCEDURE IF EXISTS upsert_gw_reading;

DELIMITER $$

CREATE PROCEDURE upsert_gw_reading(
    IN p_station_id INT,
    IN p_external_id VARCHAR(120),
    IN p_recorded_at DATETIME,
    IN p_water_level_m DECIMAL(8, 3),
    IN p_data_value VARCHAR(255),
    IN p_source_payload JSON,
    IN p_sync_run_id BIGINT
)
BEGIN
    INSERT INTO gw_readings (
        station_id, external_id, recorded_at, water_level_m,
        data_value, source_payload, sync_run_id
    ) VALUES (
        p_station_id, p_external_id, p_recorded_at, p_water_level_m,
        p_data_value, p_source_payload, p_sync_run_id
    )
    ON DUPLICATE KEY UPDATE
        water_level_m  = VALUES(water_level_m),
        data_value     = VALUES(data_value),
        source_payload = VALUES(source_payload),
        sync_run_id    = VALUES(sync_run_id),
        synced_at      = CURRENT_TIMESTAMP;
END$$

DELIMITER ;

DROP PROCEDURE IF EXISTS upsert_rainfall_reading;

DELIMITER $$

CREATE PROCEDURE upsert_rainfall_reading(
    IN p_station_id INT,
    IN p_external_id VARCHAR(120),
    IN p_recorded_at DATETIME,
    IN p_rainfall_mm DECIMAL(8, 2),
    IN p_data_value VARCHAR(255),
    IN p_source_payload JSON,
    IN p_sync_run_id BIGINT
)
BEGIN
    INSERT INTO rainfall_readings (
        station_id, external_id, recorded_at, rainfall_mm,
        data_value, source_payload, sync_run_id
    ) VALUES (
        p_station_id, p_external_id, p_recorded_at, p_rainfall_mm,
        p_data_value, p_source_payload, p_sync_run_id
    )
    ON DUPLICATE KEY UPDATE
        rainfall_mm    = VALUES(rainfall_mm),
        data_value     = VALUES(data_value),
        source_payload = VALUES(source_payload),
        sync_run_id    = VALUES(sync_run_id),
        synced_at      = CURRENT_TIMESTAMP;
END$$

DELIMITER ;
