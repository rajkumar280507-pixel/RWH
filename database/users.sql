-- =============================================================================
-- User accounts for the multi-role public application: civil engineers,
-- municipal water department employees, builders/contractors, consultants,
-- researchers, and general office staff. Run after schema.sql.
-- =============================================================================
USE rwh;

CREATE TABLE IF NOT EXISTS users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NULL,
    organization    VARCHAR(200) NULL,
    role            VARCHAR(30) NOT NULL DEFAULT 'office_staff',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   DATETIME NULL,
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT chk_users_role CHECK (
        role IN ('civil_engineer', 'municipal_employee', 'builder', 'consultant', 'researcher', 'office_staff', 'admin')
    )
) ENGINE=InnoDB;

-- rwh_designs.created_by already exists (INT NULL) but was never wired to a
-- real users table before this — no ALTER TABLE needed. It's a plain INT
-- (not a FOREIGN KEY) matching the original schema, so ownership checks are
-- enforced in the application layer, not the database.
