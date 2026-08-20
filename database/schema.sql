-- =============================================================================
-- RWH-DSS core schema (MySQL 8.0+): districts, sync bookkeeping.
--
-- MySQL has no PostGIS, so spatial data is stored as plain DECIMAL lat/lon
-- columns (nearest-station lookups use a Haversine formula in SQL — see
-- views.sql / backend/app/services/live_data_service.py) and polygons are
-- stored as GeoJSON in JSON columns rather than a native geometry type.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS rwh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rwh;

-- ---------------------------------------------------------------------------
-- Administrative boundaries (district/taluk/village) — used to join
-- telemetry to a place and to drive the GIS layer picker. Boundary polygons
-- are stored as GeoJSON; nothing here needs spatial indexing at this scale.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS districts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    state       VARCHAR(120) NOT NULL,
    district    VARCHAR(120) NOT NULL,
    boundary_geojson JSON NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_districts_state_district (state, district)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS taluks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    district_id INT NOT NULL,
    taluk       VARCHAR(120) NOT NULL,
    boundary_geojson JSON NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_taluks_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS villages (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    taluk_id    INT NULL,
    village     VARCHAR(120) NOT NULL,
    boundary_geojson JSON NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_villages_taluk FOREIGN KEY (taluk_id) REFERENCES taluks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Synchronization bookkeeping for the hourly CGWB pullers. One row per sync
-- run; drives the "Recent Synchronization" dashboard panel, pagination
-- offsets, and failed-request retry.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    source          VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'running',
    started_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at     DATETIME NULL,
    records_fetched INT NOT NULL DEFAULT 0,
    records_upserted INT NOT NULL DEFAULT 0,
    records_failed  INT NOT NULL DEFAULT 0,
    last_offset     INT NOT NULL DEFAULT 0,
    error_message   TEXT NULL,
    retry_count     INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_sync_runs_source CHECK (source IN ('groundwater', 'rainfall')),
    CONSTRAINT chk_sync_runs_status CHECK (status IN ('running', 'success', 'partial', 'failed')),
    KEY idx_sync_runs_source_started (source, started_at DESC)
) ENGINE=InnoDB;

-- Per-record failure log so a bad row doesn't silently vanish and can be
-- retried without re-pulling the whole page.
CREATE TABLE IF NOT EXISTS sync_failures (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    sync_run_id BIGINT NOT NULL,
    source      VARCHAR(20) NOT NULL,
    raw_record  JSON NOT NULL,
    error       TEXT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved    BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_sync_failures_run FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
