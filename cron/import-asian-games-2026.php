<?php

declare(strict_types=1);

$root = getenv('NINES_ROOT') ?: dirname(__DIR__);
require rtrim($root, '/') . '/api/db.php';

$pdo = db();
$eventUrl = 'https://www.aichi-nagoya2026.org/ja/news-2054/';

// The Asian Games results are published before a machine-readable box score is
// consistently available. Store the official game results first; later imports
// can safely enrich the same rows with team and player statistics.
$games = [
    [
        'source_game_id' => 'aichi-nagoya-2026-men-04',
        'game_date' => '2026-09-10',
        'tipoff_time' => '19:00:00',
        'home_team' => '日本',
        'away_team' => 'インドネシア',
        'home_score' => 98,
        'away_score' => 53,
        'japan_side' => 'home',
    ],
    [
        'source_game_id' => 'aichi-nagoya-2026-men-08',
        'game_date' => '2026-09-11',
        'tipoff_time' => '19:00:00',
        'home_team' => 'サウジアラビア',
        'away_team' => '日本',
        'home_score' => 80,
        'away_score' => 86,
        'japan_side' => 'away',
    ],
    [
        'source_game_id' => 'aichi-nagoya-2026-men-16',
        'game_date' => '2026-09-13',
        'tipoff_time' => '19:00:00',
        'home_team' => '日本',
        'away_team' => '韓国',
        'home_score' => 83,
        'away_score' => 100,
        'japan_side' => 'home',
    ],
    [
        'source_game_id' => 'aichi-nagoya-2026-men-20',
        'game_date' => '2026-09-16',
        'tipoff_time' => '19:20:00',
        'home_team' => 'チャイニーズ・タイペイ',
        'away_team' => '日本',
        'home_score' => 78,
        'away_score' => 85,
        'japan_side' => 'away',
    ],
    [
        'source_game_id' => 'aichi-nagoya-2026-men-23',
        'game_date' => '2026-09-18',
        'tipoff_time' => null,
        'home_team' => '日本',
        'away_team' => '中国',
        'home_score' => 97,
        'away_score' => 77,
        'japan_side' => 'home',
    ],
    [
        'source_game_id' => 'aichi-nagoya-2026-men-26',
        'game_date' => '2026-09-20',
        'tipoff_time' => '19:40:00',
        'home_team' => '韓国',
        'away_team' => '日本',
        'home_score' => 67,
        'away_score' => 57,
        'japan_side' => 'away',
    ],
];

$gameSql = <<<SQL
INSERT INTO national_team_games (
  source_game_id, source_provider, source_url, competition, game_date, tipoff_time,
  status, venue, home_team, away_team, home_score, away_score, japan_side, period_scores
) VALUES (
  :source_game_id, 'JBA', :source_url, :competition, :game_date, :tipoff_time,
  '試合終了', :venue, :home_team, :away_team, :home_score, :away_score, :japan_side, NULL
)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id), source_url = VALUES(source_url), competition = VALUES(competition), game_date = VALUES(game_date),
  tipoff_time = VALUES(tipoff_time), status = VALUES(status), venue = VALUES(venue),
  home_team = VALUES(home_team), away_team = VALUES(away_team), home_score = VALUES(home_score),
  away_score = VALUES(away_score), japan_side = VALUES(japan_side)
SQL;
$gameStmt = $pdo->prepare($gameSql);
$boxStmt = $pdo->prepare(<<<SQL
INSERT INTO national_team_box_scores (game_id, team_name, is_japan, points)
VALUES (:game_id, :team_name, :is_japan, :points)
ON DUPLICATE KEY UPDATE points = VALUES(points), is_japan = VALUES(is_japan)
SQL);

foreach ($games as $game) {
    $pdo->beginTransaction();
    try {
        $gameStmt->execute([
            'source_game_id' => $game['source_game_id'],
            'source_url' => $eventUrl,
            'competition' => '第20回アジア競技大会（2026／愛知・名古屋）',
            'game_date' => $game['game_date'],
            'tipoff_time' => $game['tipoff_time'],
            'venue' => '愛知国際アリーナ',
            'home_team' => $game['home_team'],
            'away_team' => $game['away_team'],
            'home_score' => $game['home_score'],
            'away_score' => $game['away_score'],
            'japan_side' => $game['japan_side'],
        ]);
        $gameId = (int)$pdo->lastInsertId();
        $boxStmt->execute([
            'game_id' => $gameId,
            'team_name' => $game['home_team'],
            'is_japan' => $game['japan_side'] === 'home' ? 1 : 0,
            'points' => $game['home_score'],
        ]);
        $boxStmt->execute([
            'game_id' => $gameId,
            'team_name' => $game['away_team'],
            'is_japan' => $game['japan_side'] === 'away' ? 1 : 0,
            'points' => $game['away_score'],
        ]);
        $pdo->commit();
        echo sprintf("Imported %s %s %d-%d %s\n", $game['game_date'], $game['home_team'], $game['home_score'], $game['away_score'], $game['away_team']);
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

echo "Asian Games 2026 import complete\n";
