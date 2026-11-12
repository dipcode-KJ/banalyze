<?php

declare(strict_types=1);

$root = getenv('NINES_ROOT') ?: dirname(__DIR__);
require rtrim($root, '/') . '/api/db.php';

// Official Aichi-Nagoya 2026 results: Japan 57-67 Republic of Korea.
$players = [
    ['3', 'KUROKAWA Kotetsu', '19:21', 5, 0, 6, 2, 8, 1, 1, 1, 4, 5, 3, 3, 2, 0, 1],
    ['5', 'HARPER JR John', '20:26', 6, 2, 4, 0, 2, 0, 0, 0, 2, 2, 0, 2, 0, 0, 2],
    ['13', 'KANECHIKA Ren', '29:55', 13, 3, 7, 2, 5, 0, 0, 1, 5, 5, 1, 1, 1, 0, 3],
    ['14', 'KANO Toyoshige', '7:17', 2, 0, 0, 1, 3, 0, 0, 0, 0, 1, 0, 0, 1, 2, 1],
    ['20', 'YAMAZAKI Ibu', '20:03', 3, 0, 2, 1, 3, 1, 2, 3, 3, 6, 0, 0, 0, 1, 3],
    ['25', 'KAWASHIMA Yuto', '7:41', 1, 0, 2, 0, 2, 1, 2, 0, 0, 0, 1, 0, 0, 0, 1],
    ['28', 'TSUYA Kazuma', '6:09', 4, 1, 2, 0, 0, 1, 3, 1, 0, 1, 0, 1, 0, 0, 0],
    ['31', 'OGAWA Atsuya', '24:06', 12, 2, 4, 3, 7, 0, 2, 1, 4, 5, 5, 2, 0, 0, 2],
    ['32', 'SCHAFER Avi', '10:07', 4, 0, 0, 2, 4, 0, 0, 2, 2, 4, 0, 0, 0, 0, 1],
    ['45', 'YAMAUCHI Jaheru', '12:10', 2, 0, 0, 1, 2, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
    ['53', 'KIRK Alex', '23:44', 5, 0, 1, 2, 8, 1, 2, 4, 4, 8, 0, 3, 0, 0, 2],
    ['64', 'TAKASHIMA Shinji', '18:19', 0, 0, 1, 0, 1, 0, 2, 0, 4, 4, 1, 2, 1, 0, 2],
];

$pdo = db();
$find = $pdo->prepare('SELECT id FROM national_team_games WHERE source_game_id = :source_game_id');
$find->execute(['source_game_id' => 'aichi-nagoya-2026-men-26']);
$gameId = (int)$find->fetchColumn();
if ($gameId === 0) {
    throw new RuntimeException('Asian Games final game was not found');
}

$pdo->beginTransaction();
try {
    $pdo->prepare('DELETE FROM national_team_player_stats WHERE game_id = :game_id AND is_japan = 1')
        ->execute(['game_id' => $gameId]);
    $stmt = $pdo->prepare(<<<SQL
INSERT INTO national_team_player_stats (
  game_id, team_name, is_japan, player_number, player_name, starter, points,
  three_point_makes, three_point_attempts, two_point_makes, two_point_attempts,
  free_throw_makes, free_throw_attempts, fouls, offensive_rebounds, defensive_rebounds,
  total_rebounds, turnovers, assists, steals, blocks, minutes_seconds, did_not_play
) VALUES (
  :game_id, '日本', 1, :player_number, :player_name, 0, :points,
  :three_point_makes, :three_point_attempts, :two_point_makes, :two_point_attempts,
  :free_throw_makes, :free_throw_attempts, :fouls, :offensive_rebounds, :defensive_rebounds,
  :total_rebounds, :turnovers, :assists, :steals, :blocks, :minutes_seconds, 0
)
SQL);

    foreach ($players as $player) {
        [$number, $name, $minutes, $points, $threeMakes, $threeAttempts, $twoMakes, $twoAttempts,
            $freeMakes, $freeAttempts, $offensiveRebounds, $defensiveRebounds, $totalRebounds,
            $turnovers, $assists, $steals, $blocks, $fouls] = $player;
        [$minutesPart, $secondsPart] = array_map('intval', explode(':', $minutes));
        $stmt->execute([
            'game_id' => $gameId, 'player_number' => $number, 'player_name' => $name,
            'points' => $points, 'three_point_makes' => $threeMakes, 'three_point_attempts' => $threeAttempts,
            'two_point_makes' => $twoMakes, 'two_point_attempts' => $twoAttempts,
            'free_throw_makes' => $freeMakes, 'free_throw_attempts' => $freeAttempts,
            'fouls' => $fouls, 'offensive_rebounds' => $offensiveRebounds,
            'defensive_rebounds' => $defensiveRebounds, 'total_rebounds' => $totalRebounds,
            'turnovers' => $turnovers, 'assists' => $assists, 'steals' => $steals,
            'blocks' => $blocks, 'minutes_seconds' => $minutesPart * 60 + $secondsPart,
        ]);
    }
    $pdo->commit();
    echo sprintf("Imported %d Japan player rows for game %d\n", count($players), $gameId);
} catch (Throwable $error) {
    $pdo->rollBack();
    throw $error;
}
