-- =============================================================================
-- Optional DB-side scheduling via MySQL's EVENT scheduler, for housekeeping
-- (the daily rainfall rollup) that should run even if the FastAPI process is
-- briefly down. The primary hourly CGWB pull itself is driven by the Python
-- scheduler (backend/app/scheduler/jobs.py) because it needs HTTP access,
-- retry/backoff logic, and WebSocket fan-out that plain SQL can't do.
--
-- Requires the event scheduler to be enabled: SET GLOBAL event_scheduler = ON;
-- (persist it in my.ini as `event_scheduler=ON` so it survives a restart).
-- =============================================================================
USE rwh;

DROP EVENT IF EXISTS ev_rebuild_rainfall_daily;

CREATE EVENT ev_rebuild_rainfall_daily
ON SCHEDULE EVERY 1 DAY STARTS (CURRENT_DATE + INTERVAL 1 DAY + INTERVAL 10 MINUTE)
DO
    CALL rebuild_rainfall_daily(CURDATE() - INTERVAL 1 DAY);
