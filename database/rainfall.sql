-- =============================================================================
-- Rainfall telemetry (CGWB resource_id 21b02519-f3d3-409d-a091-94332d848a8e)
-- =============================================================================
USE rwh;

CREATE TABLE IF NOT EXISTS rainfall_stations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    station_code    VARCHAR(120) NOT NULL,
    station_name    VARCHAR(255) NULL,
    state           VARCHAR(120) NULL,
    district        VARCHAR(120) NULL,
    taluk           VARCHAR(120) NULL,
    agency          VARCHAR(120) NULL,
    latitude        DECIMAL(10, 7) NULL,
    longitude       DECIMAL(10, 7) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rainfall_stations_code (station_code),
    KEY idx_rainfall_stations_district (state, district),
    KEY idx_rainfall_stations_lat_lon (latitude, longitude)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rainfall_readings (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    station_id      INT NOT NULL,
    external_id     VARCHAR(120) NULL,
    recorded_at     DATETIME NOT NULL,
    rainfall_mm     DECIMAL(8, 2) NULL,
    data_value      VARCHAR(255) NULL,
    source_payload  JSON NULL,
    synced_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sync_run_id     BIGINT NULL,
    UNIQUE KEY uq_rainfall_readings_station_time (station_id, recorded_at),
    KEY idx_rainfall_readings_recorded_at (recorded_at DESC),
    CONSTRAINT fk_rainfall_readings_station FOREIGN KEY (station_id) REFERENCES rainfall_stations(id) ON DELETE CASCADE,
    CONSTRAINT fk_rainfall_readings_sync_run FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
) ENGINE=InnoDB;

-- Daily rollup, refreshed by a scheduled event (see scheduler.sql); backs the
-- "annual rainfall" figure the RWH design engine consumes without scanning
-- raw sub-hourly readings each time.
CREATE TABLE IF NOT EXISTS rainfall_daily (
    station_id      INT NOT NULL,
    day             DATE NOT NULL,
    total_mm        DECIMAL(8, 2) NOT NULL,
    reading_count   INT NOT NULL,
    PRIMARY KEY (station_id, day),
    CONSTRAINT fk_rainfall_daily_station FOREIGN KEY (station_id) REFERENCES rainfall_stations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
