-- =============================================================================
-- Minimal seed data so the dashboard has something to render on first boot,
-- before the first hourly sync has run.
-- =============================================================================
USE rwh;

INSERT INTO districts (state, district) VALUES
    ('Tamil Nadu', 'Chennai'),
    ('Tamil Nadu', 'Coimbatore'),
    ('Tamil Nadu', 'Madurai'),
    ('Tamil Nadu', 'Tiruchirappalli'),
    ('Tamil Nadu', 'Salem')
ON DUPLICATE KEY UPDATE state = VALUES(state);

INSERT INTO soil_zones (soil_type, hydrologic_group, permeability_mm_hr) VALUES
    ('Sandy loam', 'A', 25.0),
    ('Loam', 'B', 12.0),
    ('Clay loam', 'C', 4.0),
    ('Clay', 'D', 1.0)
ON DUPLICATE KEY UPDATE hydrologic_group = VALUES(hydrologic_group);
