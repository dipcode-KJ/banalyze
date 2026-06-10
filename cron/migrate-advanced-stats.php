<?php

declare(strict_types=1);

require __DIR__ . '/../api/db.php';

$sql = <<<SQL
CREATE TABLE IF NOT EXISTS team_advanced_stats (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id INT UNSIGNED NOT NULL,
  season VARCHAR(16) NOT NULL,
  assists DECIMAL(8,2) NULL,
  turnovers DECIMAL(8,2) NULL,
  total_rebounds DECIMAL(8,2) NULL,
  three_point_makes DECIMAL(8,2) NULL,
  three_point_attempts DECIMAL(8,2) NULL,
  three_point_percentage DECIMAL(5,2) NULL,
  pace DECIMAL(8,2) NULL,
  offensive_rating DECIMAL(8,2) NULL,
  defensive_rating DECIMAL(8,2) NULL,
  source VARCHAR(160) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_team_advanced (team_id, season),
  INDEX idx_team_advanced_season (season),
  CONSTRAINT fk_advanced_team FOREIGN KEY (team_id) REFERENCES teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL;

db()->exec($sql);

ensure_column('team_advanced_stats', 'total_rebounds', 'ALTER TABLE team_advanced_stats ADD COLUMN total_rebounds DECIMAL(8,2) NULL AFTER turnovers');
ensure_column('team_advanced_stats', 'three_point_makes', 'ALTER TABLE team_advanced_stats ADD COLUMN three_point_makes DECIMAL(8,2) NULL AFTER turnovers');
ensure_column('team_advanced_stats', 'three_point_percentage', 'ALTER TABLE team_advanced_stats ADD COLUMN three_point_percentage DECIMAL(5,2) NULL AFTER three_point_attempts');

echo sprintf("[%s] team_advanced_stats is ready\n", date('c'));

function ensure_column(string $table, string $column, string $alterSql): void
{
    $stmt = db()->prepare(<<<SQL
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = :table_name
  AND COLUMN_NAME = :column_name
SQL);
    $stmt->execute(['table_name' => $table, 'column_name' => $column]);

    if ((int)$stmt->fetchColumn() === 0) {
        db()->exec($alterSql);
    }
}
