-- =============================================================================
-- Buildings, rooftops and site context for the RWH design module.
-- Footprints are stored as GeoJSON (JSON column) plus a plain lat/lon
-- centroid column for fast nearest-station distance queries.
-- =============================================================================
USE rwh;

CREATE TABLE IF NOT EXISTS buildings (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id       INT NULL,
    name                VARCHAR(255) NULL,
    building_type       VARCHAR(60) NULL,
    occupancy           INT NULL,
    population          INT NULL,
    address             VARCHAR(500) NULL,
    district_id         INT NULL,
    footprint_geojson   JSON NOT NULL,
    centroid_lat        DECIMAL(10, 7) NULL,
    centroid_lon        DECIMAL(10, 7) NULL,
    open_area_sqm       DECIMAL(10, 2) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_buildings_centroid (centroid_lat, centroid_lon),
    CONSTRAINT fk_buildings_district FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roofs (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    building_id     BIGINT NOT NULL,
    roof_type       VARCHAR(60) NULL,
    roof_material   VARCHAR(60) NULL,
    slope_percent   DECIMAL(5, 2) NULL,
    footprint_geojson JSON NOT NULL,
    area_sqm        DECIMAL(10, 2) NOT NULL,
    runoff_coefficient DECIMAL(4, 3) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_roofs_building (building_id),
    CONSTRAINT fk_roofs_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Soil / hydrologic soil group context. In this milestone soil type is
-- selected by the operator (see backend/app/gis/runoff.py); this table is a
-- reference lookup + future home for soil survey polygons.
CREATE TABLE IF NOT EXISTS soil_zones (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    soil_type           VARCHAR(60) NOT NULL,
    hydrologic_group    CHAR(1) NOT NULL,
    permeability_mm_hr  DECIMAL(8, 3) NULL,
    boundary_geojson    JSON NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_soil_zones_type (soil_type),
    CONSTRAINT chk_soil_zones_hsg CHECK (hydrologic_group IN ('A', 'B', 'C', 'D'))
) ENGINE=InnoDB;

-- DEM / slope / land-use raster metadata (raster tiles themselves live on
-- disk / object storage; this table indexes their footprints for the map).
CREATE TABLE IF NOT EXISTS raster_layers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    layer_type      VARCHAR(20) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    resolution_m    DECIMAL(6, 2) NULL,
    footprint_geojson JSON NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_raster_layers_type CHECK (layer_type IN ('dem', 'slope', 'aspect', 'hillshade', 'landuse'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS watersheds (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NULL,
    boundary_geojson JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rivers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NULL,
    line_geojson JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roads (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NULL,
    road_class  VARCHAR(60) NULL,
    line_geojson JSON NOT NULL
) ENGINE=InnoDB;
