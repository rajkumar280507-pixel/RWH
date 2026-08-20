-- =============================================================================
-- ML prediction storage + SHAP explanations.
-- =============================================================================
USE rwh;

CREATE TABLE IF NOT EXISTS ml_models (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(60) NOT NULL,
    target           VARCHAR(60) NOT NULL,
    version         VARCHAR(30) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    metrics         JSON NULL,
    trained_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE KEY uq_ml_models_name_target_version (name, target, version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS predictions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_id        INT NOT NULL,
    target           VARCHAR(60) NOT NULL,
    building_id     BIGINT NULL,
    station_id      INT NULL,
    input_features  JSON NOT NULL,
    predicted_value DECIMAL(12, 4) NOT NULL,
    confidence      DECIMAL(4, 3) NULL,
    predicted_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_predictions_target_time (target, predicted_at DESC),
    KEY idx_predictions_building (building_id),
    CONSTRAINT fk_predictions_model FOREIGN KEY (model_id) REFERENCES ml_models(id),
    CONSTRAINT fk_predictions_building FOREIGN KEY (building_id) REFERENCES buildings(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shap_explanations (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    prediction_id   BIGINT NOT NULL,
    feature_name    VARCHAR(120) NOT NULL,
    shap_value      DECIMAL(12, 6) NOT NULL,
    feature_value   DECIMAL(12, 4) NULL,
    feature_rank    INT NOT NULL,
    KEY idx_shap_prediction (prediction_id, feature_rank),
    CONSTRAINT fk_shap_prediction FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
