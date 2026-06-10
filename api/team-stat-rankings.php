<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

$season = $_GET['season'] ?? '2025-26';
$division = $_GET['division'] ?? null;
$division = in_array($division, ['B1', 'B2'], true) ? $division : null;
$limit = isset($_GET['limit']) ? max(1, min(50, (int)$_GET['limit'])) : 10;
$metric = $_GET['metric'] ?? 'three_point_percentage';

$metrics = [
    'three_point_percentage' => [
        'column' => 'three_point_percentage',
        'fallback' => 'ROUND((s.three_point_makes / NULLIF(s.three_point_attempts, 0)) * 100, 2)',
        'requires' => ['three_point_makes', 'three_point_attempts'],
        'direction' => 'DESC',
    ],
    'assists' => ['column' => 'assists', 'direction' => 'DESC'],
    'total_rebounds' => ['column' => 'total_rebounds', 'direction' => 'DESC'],
    'offensive_rating' => ['column' => 'offensive_rating', 'direction' => 'DESC'],
    'defensive_rating' => ['column' => 'defensive_rating', 'direction' => 'ASC'],
];

if (!array_key_exists($metric, $metrics)) {
    http_response_code(400);
    json_response(['error' => 'Unsupported metric']);
    exit;
}

$pdo = db();
if (!table_exists($pdo, 'team_advanced_stats')) {
    empty_response($season, $division, $metric, $limit);
}

$definition = $metrics[$metric];
$column = $definition['column'];
$hasColumn = column_exists($pdo, 'team_advanced_stats', $column);
$canUseFallback = false;
foreach (($definition['requires'] ?? []) as $requiredColumn) {
    $canUseFallback = column_exists($pdo, 'team_advanced_stats', $requiredColumn);
    if (!$canUseFallback) {
        break;
    }
}

if (!$hasColumn && !$canUseFallback) {
    empty_response($season, $division, $metric, $limit);
}

$valueExpression = $hasColumn ? "s.{$column}" : $definition['fallback'];
$whereExpression = $hasColumn ? "s.{$column} IS NOT NULL" : "{$valueExpression} IS NOT NULL";
$direction = $definition['direction'];
$threePointMakesSelect = column_exists($pdo, 'team_advanced_stats', 'three_point_makes') ? 's.three_point_makes' : 'NULL';
$threePointAttemptsSelect = column_exists($pdo, 'team_advanced_stats', 'three_point_attempts') ? 's.three_point_attempts' : 'NULL';
$threePointPercentageSelect = column_exists($pdo, 'team_advanced_stats', 'three_point_percentage')
    ? 's.three_point_percentage'
    : ($threePointMakesSelect !== 'NULL' && $threePointAttemptsSelect !== 'NULL'
        ? 'ROUND((s.three_point_makes / NULLIF(s.three_point_attempts, 0)) * 100, 2)'
        : 'NULL');
$totalReboundsSelect = column_exists($pdo, 'team_advanced_stats', 'total_rebounds') ? 's.total_rebounds' : 'NULL';

$sql = <<<SQL
SELECT
  t.source_team_id AS teamId,
  t.name,
  t.short_name AS shortName,
  t.division,
  t.conference,
  :metric AS metric,
  {$valueExpression} AS value,
  s.assists,
  {$totalReboundsSelect} AS totalRebounds,
  {$threePointMakesSelect} AS threePointMakes,
  {$threePointAttemptsSelect} AS threePointAttempts,
  {$threePointPercentageSelect} AS threePointPercentage,
  s.offensive_rating AS offensiveRating,
  s.defensive_rating AS defensiveRating,
  s.source,
  DATE_FORMAT(s.updated_at, '%Y-%m-%dT%H:%i:%s+09:00') AS updatedAt
FROM team_advanced_stats s
JOIN teams t ON t.id = s.team_id
WHERE s.season = :season
  AND (:division IS NULL OR t.division = :division)
  AND {$whereExpression}
ORDER BY value {$direction}, t.short_name ASC
LIMIT {$limit}
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['season' => $season, 'division' => $division, 'metric' => $metric]);
$records = $stmt->fetchAll();

foreach ($records as $index => &$record) {
    $record['rank'] = $index + 1;
    $record['value'] = nullable_float($record['value']);
    $record['assists'] = nullable_float($record['assists']);
    $record['totalRebounds'] = nullable_float($record['totalRebounds']);
    $record['threePointMakes'] = nullable_float($record['threePointMakes']);
    $record['threePointAttempts'] = nullable_float($record['threePointAttempts']);
    $record['threePointPercentage'] = nullable_float($record['threePointPercentage']);
    $record['offensiveRating'] = nullable_float($record['offensiveRating']);
    $record['defensiveRating'] = nullable_float($record['defensiveRating']);
}
unset($record);

json_response([
    'season' => $season,
    'division' => $division,
    'metric' => $metric,
    'limit' => $limit,
    'records' => $records,
]);

function empty_response(string $season, ?string $division, string $metric, int $limit): void
{
    json_response([
        'season' => $season,
        'division' => $division,
        'metric' => $metric,
        'limit' => $limit,
        'records' => [],
    ]);
    exit;
}

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
