<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

$limit = max(1, min(50, (int)($_GET['limit'] ?? 12)));
$season = $_GET['season'] ?? null;
$division = $_GET['division'] ?? null;
$division = in_array($division, ['B1', 'B2'], true) ? $division : null;

$sql = <<<SQL
SELECT
  g.source_game_id AS id,
  g.game_date AS date,
  ht.short_name AS home,
  at.short_name AS away,
  g.home_score AS homeScore,
  g.away_score AS awayScore,
  g.venue
FROM games g
JOIN teams ht ON ht.id = g.home_team_id
JOIN teams at ON at.id = g.away_team_id
WHERE g.status = 'FINAL'
  AND (:season IS NULL OR g.season = :season)
  AND (:division IS NULL OR (ht.division = :division AND at.division = :division))
ORDER BY g.game_date DESC, g.id DESC
LIMIT :limit
SQL;

$stmt = db()->prepare($sql);
$stmt->bindValue('limit', $limit, PDO::PARAM_INT);
$stmt->bindValue('season', $season);
$stmt->bindValue('division', $division);
$stmt->execute();

json_response([
    'season' => $season,
    'division' => $division,
    'games' => $stmt->fetchAll(),
]);
