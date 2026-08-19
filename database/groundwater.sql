-- =============================================================================
-- Groundwater telemetry (CGWB resource_id 6857c02f-c77e-4576-b349-3e45aacc1c21)
-- =============================================================================
USE rwh;

CREATE TABLE IF NOT EXISTS gw_stations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    station_code    VARCHAR(120) NOT NULL,
    station_name    VARCHAR(255) NULL,
    state           VARCHAR(120) NULL,
    district        VARCHAR(120) NULL,
    taluk           VARCHAR(120) NULL,
    block           VARCHAR(120) NULL,
    agency          VARCHAR(120) NULL,
    well_type       VARCHAR(60) NULL,
    latitude        DECIMAL(10, 7) NULL,
    longitude       DECIMAL(10, 7) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_gw_stations_code (station_code),
    KEY idx_gw_stations_district (state, district),
    KEY idx_gw_stations_lat_lon (latitude, longitude)
) ENGINE=InnoDB;

-- One reading per station per timestamp. UPSERT target is (station_id, recorded_at).
CREATE TABLE IF NOT EXISTS gw_readings (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    station_id      INT NOT NULL,
    external_id     VARCHAR(120) NULL,
    recorded_at     DATETIME NOT NULL,
    water_level_m   DECIMAL(8, 3) NULL,
    data_value      VARCHAR(255) NULL,
    source_payload  JSON NULL,
    synced_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sync_run_id     BIGINT NULL,
    UNIQUE KEY uq_gw_readings_station_time (station_id, recorded_at),
    KEY idx_gw_readings_recorded_at (recorded_at DESC),
    CONSTRAINT fk_gw_readings_station FOREIGN KEY (station_id) REFERENCES gw_stations(id) ON DELETE CASCADE,
    CONSTRAINT fk_gw_readings_sync_run FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
) ENGINE=InnoDB;
