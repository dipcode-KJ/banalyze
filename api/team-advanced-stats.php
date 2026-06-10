<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

$season = $_GET['season'] ?? '2025-26';
$division = $_GET['division'] ?? null;
$division = in_array($division, ['B1', 'B2'], true) ? $division : null;

$pdo = db();
if (!table_exists($pdo, 'team_advanced_stats')) {
    json_response([
        'season' => $season,
        'division' => $division,
        'records' => [],
    ]);
    exit;
}

$hasThreePointMakes = column_exists($pdo, 'team_advanced_stats', 'three_point_makes');
$hasThreePointPercentage = column_exists($pdo, 'team_advanced_stats', 'three_point_percentage');
$hasTotalRebounds = column_exists($pdo, 'team_advanced_stats', 'total_rebounds');
$threePointMakesSelect = $hasThreePointMakes ? 's.three_point_makes' : 'NULL';
$threePointPercentageSelect = $hasThreePointPercentage
    ? 's.three_point_percentage'
    : ($hasThreePointMakes ? 'ROUND((s.three_point_makes / NULLIF(s.three_point_attempts, 0)) * 100, 2)' : 'NULL');
$totalReboundsSelect = $hasTotalRebounds ? 's.total_rebounds' : 'NULL';

$sql = <<<SQL
SELECT
  t.source_team_id AS teamId,
  s.season,
  s.assists,
  s.turnovers,
  {$totalReboundsSelect} AS totalRebounds,
  {$threePointMakesSelect} AS threePointMakes,
  s.three_point_attempts AS threePointAttempts,
  {$threePointPercentageSelect} AS threePointPercentage,
  s.pace,
  s.offensive_rating AS offensiveRating,
  s.defensive_rating AS defensiveRating,
  s.source,
  DATE_FORMAT(s.updated_at, '%Y-%m-%dT%H:%i:%s+09:00') AS updatedAt
FROM team_advanced_stats s
JOIN teams t ON t.id = s.team_id
WHERE s.season = :season
  AND (:division IS NULL OR t.division = :division)
ORDER BY t.division ASC, t.short_name ASC
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['season' => $season, 'division' => $division]);
$records = $stmt->fetchAll();

foreach ($records as &$record) {
    $record['assists'] = nullable_float($record['assists']);
    $record['turnovers'] = nullable_float($record['turnovers']);
    $record['totalRebounds'] = nullable_float($record['totalRebounds']);
    $record['threePointMakes'] = nullable_float($record['threePointMakes']);
    $record['threePointAttempts'] = nullable_float($record['threePointAttempts']);
    $record['threePointPercentage'] = nullable_float($record['threePointPercentage']);
    $record['pace'] = nullable_float($record['pace']);
    $record['offensiveRating'] = nullable_float($record['offensiveRating']);
    $record['defensiveRating'] = nullable_float($record['defensiveRating']);
}
unset($record);

json_response([
    'season' => $season,
    'division' => $division,
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
