<?php

declare(strict_types=1);

$root = getenv('NINES_ROOT') ?: dirname(__DIR__);
require rtrim($root, '/') . '/api/db.php';

$games = [
    'aichi-nagoya-2026-men-04' => [
        'japan_side' => 'home',
        'periods' => [29, 9, 26, 12, 20, 14, 23, 18],
        'teams' => [
            '日本' => [98, 34, 72, 16, 32, 18, 40, 12, 15, 21, 17, 33, 50, 11, 26, 9, 6],
            'インドネシア' => [53, 17, 59, 10, 32, 7, 27, 12, 19, 16, 10, 21, 31, 15, 11, 4, 3],
        ],
    ],
    'aichi-nagoya-2026-men-08' => [
        'japan_side' => 'away',
        'periods' => [15, 25, 20, 26, 20, 17, 25, 18],
        'teams' => [
            'サウジアラビア' => [80, 25, 59, 13, 31, 12, 28, 18, 24, 23, 9, 26, 35, 17, 6, 2, 23],
            '日本' => [86, 30, 65, 20, 34, 10, 31, 16, 22, 24, 10, 27, 37, 15, 23, 12, 5],
        ],
    ],
    'aichi-nagoya-2026-men-16' => [
        'japan_side' => 'home',
        'periods' => [17, 19, 25, 21, 24, 31, 17, 29],
        'teams' => [
            '日本' => [83, 27, 66, 17, 39, 10, 27, 19, 21, 26, 15, 23, 38, 13, 18, 3, 6],
            '韓国' => [100, 34, 67, 25, 44, 9, 23, 23, 28, 22, 12, 25, 37, 9, 22, 9, 4],
        ],
    ],
    'aichi-nagoya-2026-men-20' => [
        'japan_side' => 'away',
        'periods' => [9, 16, 23, 28, 17, 24, 29, 17],
        'teams' => [
            'チャイニーズ・タイペイ' => [78, 26, 65, 16, 34, 10, 31, 16, 25, 19, 7, 25, 32, 9, 17, 8, 3],
            '日本' => [85, 32, 69, 24, 43, 8, 26, 13, 19, 17, 11, 36, 47, 12, 22, 5, 3],
        ],
    ],
    'aichi-nagoya-2026-men-23' => [
        'japan_side' => 'home',
        'periods' => [28, 15, 21, 15, 34, 22, 14, 25],
        'teams' => [
            '日本' => [97, 40, 82, 28, 52, 12, 30, 5, 9, 16, 18, 29, 47, 3, 27, 6, 3],
            '中国' => [77, 28, 74, 21, 49, 7, 25, 14, 15, 11, 14, 27, 41, 7, 15, 2, 3],
        ],
    ],
    'aichi-nagoya-2026-men-26' => [
        'japan_side' => 'away',
        'periods' => [16, 12, 12, 16, 19, 27, 10, 12],
        'teams' => [
            '日本' => [57, 22, 73, 14, 44, 8, 29, 5, 14, 19, 21, 33, 54, 13, 15, 5, 3],
            '韓国' => [67, 24, 62, 14, 36, 10, 26, 9, 15, 17, 9, 34, 43, 9, 19, 5, 6],
        ],
    ],
];

$pdo = db();
$find = $pdo->prepare('SELECT id FROM national_team_games WHERE source_game_id = :source_game_id');
$updateGame = $pdo->prepare('UPDATE national_team_games SET period_scores = :period_scores WHERE id = :id');
$updateTeam = $pdo->prepare(<<<SQL
UPDATE national_team_box_scores SET
  points = :points, three_point_makes = :three_point_makes, three_point_attempts = :three_point_attempts,
  two_point_makes = :two_point_makes, two_point_attempts = :two_point_attempts,
  free_throw_makes = :free_throw_makes, free_throw_attempts = :free_throw_attempts,
  fouls = :fouls, offensive_rebounds = :offensive_rebounds, defensive_rebounds = :defensive_rebounds,
  total_rebounds = :total_rebounds, turnovers = :turnovers, assists = :assists,
  steals = :steals, blocks = :blocks
WHERE game_id = :game_id AND team_name = :team_name
SQL);

foreach ($games as $sourceGameId => $game) {
    $find->execute(['source_game_id' => $sourceGameId]);
    $gameId = (int)$find->fetchColumn();
    if ($gameId === 0) {
        throw new RuntimeException("Game not found: {$sourceGameId}");
    }

    $periods = [];
    for ($index = 0; $index < 4; $index++) {
        $periods[] = [
            'label' => ($index + 1) . 'Q',
            'home' => $game['japan_side'] === 'home'
                ? $game['periods'][$index * 2]
                : $game['periods'][$index * 2 + 1],
            'away' => $game['japan_side'] === 'home'
                ? $game['periods'][$index * 2 + 1]
                : $game['periods'][$index * 2],
        ];
    }
    $updateGame->execute([
        'id' => $gameId,
        'period_scores' => json_encode($periods, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    foreach ($game['teams'] as $teamName => $values) {
        [$points, $fieldGoalMakes, $fieldGoalAttempts, $twoPointMakes, $twoPointAttempts,
            $threePointMakes, $threePointAttempts, $freeThrowMakes, $freeThrowAttempts,
            $fouls, $offensiveRebounds, $defensiveRebounds, $totalRebounds, $turnovers,
            $assists, $steals, $blocks] = $values;
        $updateTeam->execute([
            'points' => $points,
            'three_point_makes' => $threePointMakes,
            'three_point_attempts' => $threePointAttempts,
            'two_point_makes' => $twoPointMakes,
            'two_point_attempts' => $twoPointAttempts,
            'free_throw_makes' => $freeThrowMakes,
            'free_throw_attempts' => $freeThrowAttempts,
            'fouls' => $fouls,
            'offensive_rebounds' => $offensiveRebounds,
            'defensive_rebounds' => $defensiveRebounds,
            'total_rebounds' => $totalRebounds,
            'turnovers' => $turnovers,
            'assists' => $assists,
            'steals' => $steals,
            'blocks' => $blocks,
            'game_id' => $gameId,
            'team_name' => $teamName,
        ]);
    }
    echo "Enriched {$sourceGameId}\n";
}
