-- =============================================================================
-- Recharge structure design output: pits, trenches, injection borewells, BOQ.
-- =============================================================================
USE rwh;

CREATE TABLE IF NOT EXISTS rwh_designs (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    building_id             BIGINT NOT NULL,
    roof_id                 BIGINT NULL,
    design_version          INT NOT NULL DEFAULT 1,
    annual_rainfall_mm      DECIMAL(8, 2) NULL,
    runoff_coefficient      DECIMAL(4, 3) NULL,
    catchment_area_sqm      DECIMAL(10, 2) NULL,
    annual_harvest_m3       DECIMAL(10, 2) NULL,
    annual_recharge_m3      DECIMAL(10, 2) NULL,
    groundwater_depth_m     DECIMAL(6, 2) NULL,
    hydrologic_soil_group   CHAR(1) NULL,
    structure_type          VARCHAR(30) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by              INT NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_rwh_designs_building (building_id),
    CONSTRAINT fk_rwh_designs_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    CONSTRAINT fk_rwh_designs_roof FOREIGN KEY (roof_id) REFERENCES roofs(id),
    CONSTRAINT chk_rwh_designs_structure CHECK (structure_type IN ('recharge_pit', 'recharge_trench', 'injection_borewell')),
    CONSTRAINT chk_rwh_designs_status CHECK (status IN ('draft', 'final', 'as_built'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recharge_pits (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_id       BIGINT NOT NULL,
    diameter_m      DECIMAL(5, 2) NOT NULL,
    depth_m         DECIMAL(5, 2) NOT NULL,
    volume_m3       DECIMAL(8, 3) NOT NULL,
    freeboard_m     DECIMAL(4, 2) NOT NULL DEFAULT 0.3,
    lat             DECIMAL(10, 7) NULL,
    lon             DECIMAL(10, 7) NULL,
    CONSTRAINT fk_recharge_pits_design FOREIGN KEY (design_id) REFERENCES rwh_designs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recharge_trenches (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_id       BIGINT NOT NULL,
    width_m         DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    depth_m         DECIMAL(5, 2) NOT NULL,
    total_length_m  DECIMAL(6, 2) NOT NULL,
    segment_count   INT NOT NULL,
    segment_length_m DECIMAL(5, 2) NOT NULL DEFAULT 12.0,
    volume_m3       DECIMAL(8, 3) NOT NULL,
    alignment_geojson JSON NULL,
    CONSTRAINT fk_recharge_trenches_design FOREIGN KEY (design_id) REFERENCES rwh_designs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS injection_borewells (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_id           BIGINT NOT NULL,
    recommended          BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_reason       VARCHAR(255) NOT NULL,
    conceptual_depth_m   DECIMAL(6, 2) NULL,
    casing_zone_note     TEXT NULL,
    gravel_pack_note     TEXT NULL,
    warning_text         TEXT NOT NULL,
    lat                  DECIMAL(10, 7) NULL,
    lon                  DECIMAL(10, 7) NULL,
    CONSTRAINT fk_injection_borewells_design FOREIGN KEY (design_id) REFERENCES rwh_designs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS filter_media_layers (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_id       BIGINT NOT NULL,
    layer_order     INT NOT NULL,
    material        VARCHAR(120) NOT NULL,
    thickness_fraction DECIMAL(4, 3) NOT NULL,
    particle_size_note VARCHAR(255) NULL,
    volume_m3       DECIMAL(8, 3) NULL,
    weight_kg       DECIMAL(10, 2) NULL,
    porosity        DECIMAL(4, 3) NULL,
    hydraulic_conductivity_mm_hr DECIMAL(8, 2) NULL,
    void_ratio      DECIMAL(4, 3) NULL,
    CONSTRAINT fk_filter_media_layers_design FOREIGN KEY (design_id) REFERENCES rwh_designs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS boq_items (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_id       BIGINT NOT NULL,
    item            VARCHAR(255) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    quantity        DECIMAL(12, 3) NOT NULL,
    unit_rate_inr   DECIMAL(12, 2) NULL,
    amount_inr      DECIMAL(14, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_rate_inr, 0)) STORED,
    CONSTRAINT fk_boq_items_design FOREIGN KEY (design_id) REFERENCES rwh_designs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reports (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    design_id       BIGINT NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    qr_code_path    VARCHAR(500) NULL,
    generated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_design FOREIGN KEY (design_id) REFERENCES rwh_designs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
