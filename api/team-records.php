<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

$season = $_GET['season'] ?? '2025-26';
$division = $_GET['division'] ?? null;
$division = in_array($division, ['B1', 'B2'], true) ? $division : null;

$sql = <<<SQL
SELECT
  t.source_team_id AS id,
  t.name,
  t.short_name AS shortName,
  t.division,
  t.conference,
  r.wins,
  r.losses,
  r.points_for AS pointsFor,
  r.points_against AS pointsAgainst,
  r.home_wins AS homeWins,
  r.home_losses AS homeLosses,
  r.away_wins AS awayWins,
  r.away_losses AS awayLosses,
  ROUND(r.wins / NULLIF(r.wins + r.losses, 0), 4) AS winRate
FROM team_daily_records r
JOIN teams t ON t.id = r.team_id
WHERE r.season = :season
  AND (:division IS NULL OR t.division = :division)
  AND (r.wins + r.losses) > 0
  AND r.record_date = (
    SELECT MAX(record_date)
    FROM team_daily_records
    WHERE season = :season
  )
ORDER BY winRate DESC, wins DESC
SQL;

$stmt = db()->prepare($sql);
$stmt->execute(['season' => $season, 'division' => $division]);
$records = $stmt->fetchAll();

$formStmt = db()->prepare(<<<SQL
SELECT
  g.home_team_id,
  g.away_team_id,
  g.home_score,
  g.away_score
FROM games g
JOIN teams t ON t.id = :team_id
WHERE g.season = :season
  AND g.status = 'FINAL'
  AND (g.home_team_id = :team_id OR g.away_team_id = :team_id)
ORDER BY g.game_date DESC, g.id DESC
LIMIT 5
SQL);

$teamIdStmt = db()->prepare('SELECT id FROM teams WHERE source_team_id = :source_team_id');

foreach ($records as &$record) {
    $teamIdStmt->execute(['source_team_id' => $record['id']]);
    $teamId = (int)$teamIdStmt->fetchColumn();
    $formStmt->execute(['season' => $season, 'team_id' => $teamId]);

    $lastFive = [];
    foreach ($formStmt->fetchAll() as $game) {
        $isHome = (int)$game['home_team_id'] === $teamId;
        $pointsFor = $isHome ? (int)$game['home_score'] : (int)$game['away_score'];
        $pointsAgainst = $isHome ? (int)$game['away_score'] : (int)$game['home_score'];
        $lastFive[] = $pointsFor > $pointsAgainst ? 'W' : 'L';
    }

    $record['wins'] = (int)$record['wins'];
    $record['losses'] = (int)$record['losses'];
    $record['pointsFor'] = (int)$record['pointsFor'];
    $record['pointsAgainst'] = (int)$record['pointsAgainst'];
    $record['homeWins'] = (int)$record['homeWins'];
    $record['homeLosses'] = (int)$record['homeLosses'];
    $record['awayWins'] = (int)$record['awayWins'];
    $record['awayLosses'] = (int)$record['awayLosses'];
    $record['winRate'] = (float)$record['winRate'];
    $record['lastFive'] = $lastFive;
}
unset($record);

json_response([
    'season' => $season,
    'division' => $division,
    'records' => $records,
]);
