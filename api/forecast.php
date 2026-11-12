<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/forecast-engine.php';

$user = require_auth();
$season = (string)($_GET['season'] ?? '2026-27');
$division = (string)($_GET['division'] ?? 'B.PREMIER');
$allowedDivisions = ['B1', 'B2', 'B.PREMIER', 'B.ONE', 'B.NEXT'];
if (!in_array($division, $allowedDivisions, true)) {
    http_response_code(400);
    json_response(['error' => 'invalid_division']);
    exit;
}

$pdo = db();
$stmt = $pdo->prepare(<<<SQL
SELECT g.id, g.season, g.game_date, g.status, g.home_team_id, g.away_team_id,
       g.home_score, g.away_score,
       ht.short_name AS home_team, at.short_name AS away_team, ht.division
FROM games g
JOIN teams ht ON ht.id = g.home_team_id
JOIN teams at ON at.id = g.away_team_id
WHERE g.season = :season
  AND ht.division = :division
  AND at.division = :division
  AND (g.game_date >= CURDATE() OR g.home_score IS NULL OR g.away_score IS NULL)
ORDER BY g.game_date ASC, g.id ASC
LIMIT 20
SQL);
$stmt->execute(['season' => $season, 'division' => $division]);

$save = $pdo->prepare(<<<SQL
INSERT INTO predictions (
  user_id, game_id, model_version, predicted_at, data_cutoff_date,
  home_elo, away_elo, home_advantage, home_win_probability,
  predicted_home_score, predicted_away_score, predicted_margin, input_snapshot,
  actual_home_score, actual_away_score
) VALUES (
  :user_id, :game_id, :model_version, UTC_TIMESTAMP(), :data_cutoff_date,
  :home_elo, :away_elo, :home_advantage, :home_win_probability,
  :predicted_home_score, :predicted_away_score, :predicted_margin, :input_snapshot,
  :actual_home_score, :actual_away_score
)
ON DUPLICATE KEY UPDATE
  predicted_at = VALUES(predicted_at), data_cutoff_date = VALUES(data_cutoff_date),
  home_elo = VALUES(home_elo), away_elo = VALUES(away_elo),
  home_advantage = VALUES(home_advantage), home_win_probability = VALUES(home_win_probability),
  predicted_home_score = VALUES(predicted_home_score), predicted_away_score = VALUES(predicted_away_score),
  predicted_margin = VALUES(predicted_margin), input_snapshot = VALUES(input_snapshot),
  actual_home_score = VALUES(actual_home_score), actual_away_score = VALUES(actual_away_score)
SQL);

$results = [];
foreach ($stmt->fetchAll() as $game) {
    $forecast = build_forecast($pdo, $game);
    $save->execute([
        'user_id' => (int)$user['id'],
        'game_id' => (int)$game['id'],
        'model_version' => $forecast['modelVersion'],
        'data_cutoff_date' => $forecast['dataCutoffDate'],
        'home_elo' => $forecast['homeElo'],
        'away_elo' => $forecast['awayElo'],
        'home_advantage' => $forecast['homeAdvantage'],
        'home_win_probability' => $forecast['homeWinProbability'],
        'predicted_home_score' => $forecast['predictedHomeScore'],
        'predicted_away_score' => $forecast['predictedAwayScore'],
        'predicted_margin' => $forecast['predictedMargin'],
        'input_snapshot' => json_encode($forecast['inputSnapshot'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'actual_home_score' => $game['home_score'] === null ? null : (int)$game['home_score'],
        'actual_away_score' => $game['away_score'] === null ? null : (int)$game['away_score'],
    ]);
    $results[] = [
        'id' => (int)$game['id'],
        'date' => $game['game_date'],
        'status' => $game['status'],
        'homeTeam' => $game['home_team'],
        'awayTeam' => $game['away_team'],
        'homeScore' => $game['home_score'] === null ? null : (int)$game['home_score'],
        'awayScore' => $game['away_score'] === null ? null : (int)$game['away_score'],
        'forecast' => $forecast,
    ];
}

json_response([
    'season' => $season,
    'division' => $division,
    'user' => ['displayName' => $user['display_name'], 'role' => $user['role']],
    'modelVersion' => FORECAST_MODEL_VERSION,
    'predictions' => $results,
]);
