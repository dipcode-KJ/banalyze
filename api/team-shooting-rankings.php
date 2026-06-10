<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

$season = $_GET['season'] ?? '2025-26';
$division = $_GET['division'] ?? null;
$division = in_array($division, ['B1', 'B2'], true) ? $division : null;
$limit = isset($_GET['limit']) ? max(1, min(50, (int)$_GET['limit'])) : 10;

$pdo = db();
if (!table_exists($pdo, 'team_advanced_stats') || !column_exists($pdo, 'team_advanced_stats', 'three_point_attempts')) {
    json_response([
        'season' => $season,
        'division' => $division,
        'metric' => 'three_point_percentage',
        'limit' => $limit,
        'records' => [],
    ]);
    exit;
}

$hasThreePointMakes = column_exists($pdo, 'team_advanced_stats', 'three_point_makes');
$hasThreePointPercentage = column_exists($pdo, 'team_advanced_stats', 'three_point_percentage');
$threePointMakesSelect = $hasThreePointMakes ? 's.three_point_makes' : 'NULL';
$threePointPercentageSelect = $hasThreePointPercentage
    ? 's.three_point_percentage'
    : ($hasThreePointMakes ? 'ROUND((s.three_point_makes / NULLIF(s.three_point_attempts, 0)) * 100, 2)' : 'NULL');
$whereThreePointPercentage = $hasThreePointPercentage ? 's.three_point_percentage IS NOT NULL' : 'FALSE';
$whereThreePointMakes = $hasThreePointMakes ? '(s.three_point_makes IS NOT NULL AND s.three_point_attempts IS NOT NULL AND s.three_point_attempts > 0)' : 'FALSE';
$orderThreePointMakes = $hasThreePointMakes ? 's.three_point_makes DESC,' : '';

$sql = <<<SQL
SELECT
  t.source_team_id AS teamId,
  t.name,
  t.short_name AS shortName,
  t.division,
  t.conference,
  {$threePointMakesSelect} AS threePointMakes,
  s.three_point_attempts AS threePointAttempts,
  {$threePointPercentageSelect} AS threePointPercentage,
  s.source,
  DATE_FORMAT(s.updated_at, '%Y-%m-%dT%H:%i:%s+09:00') AS updatedAt
FROM team_advanced_stats s
JOIN teams t ON t.id = s.team_id
WHERE s.season = :season
  AND (:division IS NULL OR t.division = :division)
  AND ({$whereThreePointPercentage} OR {$whereThreePointMakes})
ORDER BY threePointPercentage DESC, {$orderThreePointMakes} s.three_point_attempts DESC, t.short_name ASC
LIMIT {$limit}
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['season' => $season, 'division' => $division]);
$records = $stmt->fetchAll();

foreach ($records as $index => &$record) {
    $record['rank'] = $index + 1;
    $record['threePointMakes'] = nullable_float($record['threePointMakes']);
    $record['threePointAttempts'] = nullable_float($record['threePointAttempts']);
    $record['threePointPercentage'] = nullable_float($record['threePointPercentage']);
}
unset($record);

json_response([
    'season' => $season,
    'division' => $division,
    'metric' => 'three_point_percentage',
    'limit' => $limit,
    'records' => $records,
]);

function nullable_float(mixed $value): ?float
{
    return $value === null ? null : round((float)$value, 1);
}

function table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(<<<SQL
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = :table_name
SQL);
    $stmt->execute(['table_name' => $table]);

    return (int)$stmt->fetchColumn() > 0;
}

function column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(<<<SQL
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = :table_name
  AND COLUMN_NAME = :column_name
SQL);
    $stmt->execute(['table_name' => $table, 'column_name' => $column]);

    return (int)$stmt->fetchColumn() > 0;
}
