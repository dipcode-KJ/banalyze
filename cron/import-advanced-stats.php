<?php

declare(strict_types=1);

require __DIR__ . '/../api/db.php';

// CSV columns:
// season,team,assists,turnovers,total_rebounds,three_point_makes,three_point_attempts,three_point_percentage,pace,offensive_rating,defensive_rating,source

$csvPath = $argv[1] ?? null;
if ($csvPath === null || !is_file($csvPath)) {
    fwrite(STDERR, "Usage: php cron/import-advanced-stats.php /path/to/advanced-stats.csv\n");
    exit(1);
}

$handle = fopen($csvPath, 'rb');
if ($handle === false) {
    fwrite(STDERR, "Cannot open CSV: {$csvPath}\n");
    exit(1);
}

$headers = fgetcsv($handle);
if ($headers === false) {
    fwrite(STDERR, "CSV is empty: {$csvPath}\n");
    exit(1);
}

$headers = array_map(static fn ($header) => trim((string)$header), $headers);
$pdo = db();
$pdo->beginTransaction();

try {
    $imported = 0;
    while (($row = fgetcsv($handle)) !== false) {
        $record = array_combine($headers, $row);
        if (!is_array($record)) {
            continue;
        }

        $season = trim((string)($record['season'] ?? ''));
        $teamName = trim((string)($record['team'] ?? ''));
        if ($season === '' || $teamName === '') {
            continue;
        }

        $teamId = find_team_id($pdo, $teamName);
        if ($teamId === null) {
            fwrite(STDERR, "Skip unknown team: {$teamName}\n");
            continue;
        }

        upsert_advanced_stats($pdo, $teamId, $season, $record);
        $imported++;
    }

    $pdo->commit();
    echo sprintf("[%s] Imported %d advanced stat rows\n", date('c'), $imported);
} catch (Throwable $error) {
    $pdo->rollBack();
    throw $error;
} finally {
    fclose($handle);
}

function find_team_id(PDO $pdo, string $teamName): ?int
{
    $stmt = $pdo->prepare('SELECT id FROM teams WHERE name = :name OR short_name = :name OR source_team_id = :name LIMIT 1');
    $stmt->execute(['name' => $teamName]);
    $id = $stmt->fetchColumn();

    return $id === false ? null : (int)$id;
}

function upsert_advanced_stats(PDO $pdo, int $teamId, string $season, array $record): void
{
    $stmt = $pdo->prepare(<<<SQL
INSERT INTO team_advanced_stats (
  team_id, season, assists, turnovers, total_rebounds, three_point_makes, three_point_attempts, three_point_percentage,
  pace, offensive_rating, defensive_rating, source
) VALUES (
  :team_id, :season, :assists, :turnovers, :total_rebounds, :three_point_makes, :three_point_attempts, :three_point_percentage,
  :pace, :offensive_rating, :defensive_rating, :source
)
ON DUPLICATE KEY UPDATE
  assists = VALUES(assists),
  turnovers = VALUES(turnovers),
  total_rebounds = VALUES(total_rebounds),
  three_point_makes = VALUES(three_point_makes),
  three_point_attempts = VALUES(three_point_attempts),
  three_point_percentage = VALUES(three_point_percentage),
  pace = VALUES(pace),
  offensive_rating = VALUES(offensive_rating),
  defensive_rating = VALUES(defensive_rating),
  source = VALUES(source)
SQL);

    $stmt->execute([
        'team_id' => $teamId,
        'season' => $season,
        'assists' => nullable_decimal($record['assists'] ?? null),
        'turnovers' => nullable_decimal($record['turnovers'] ?? null),
        'total_rebounds' => nullable_decimal($record['total_rebounds'] ?? null),
        'three_point_makes' => nullable_decimal($record['three_point_makes'] ?? null),
        'three_point_attempts' => nullable_decimal($record['three_point_attempts'] ?? null),
        'three_point_percentage' => nullable_decimal($record['three_point_percentage'] ?? null),
        'pace' => nullable_decimal($record['pace'] ?? null),
        'offensive_rating' => nullable_decimal($record['offensive_rating'] ?? null),
        'defensive_rating' => nullable_decimal($record['defensive_rating'] ?? null),
        'source' => blank_to_null($record['source'] ?? null),
    ]);
}

function nullable_decimal(mixed $value): ?string
{
    $value = blank_to_null($value);
    return $value === null ? null : (string)(float)$value;
}

function blank_to_null(mixed $value): ?string
{
    $value = trim((string)$value);
    return $value === '' ? null : $value;
}
