<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

$limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
$playerMode = (string)($_GET['players'] ?? 'all');
$pdo = db();

try {
    if (!table_exists($pdo, 'national_team_games')) {
        json_response(empty_payload());
        exit;
    }

    $games = fetch_games($pdo, $limit);
    $playerGameIds = $playerMode === 'latest' && isset($games[0]) ? [$games[0]['id']] : array_column($games, 'id');
    $players = fetch_players($pdo, $playerGameIds);
    $playerLeaders = fetch_player_leaders($pdo);

    json_response([
        'source' => 'db',
        'updatedAt' => $games[0]['updatedAt'] ?? null,
        'summary' => build_summary($games),
        'games' => $games,
        'players' => $players,
        'playerLeaders' => $playerLeaders,
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    json_response(['error' => 'National team data could not be loaded.']);
}

function fetch_games(PDO $pdo, int $limit): array
{
    $stmt = $pdo->prepare(<<<SQL
SELECT
  g.*,
  j.points AS japan_points,
  j.three_point_makes AS japan_3pm,
  j.three_point_attempts AS japan_3pa,
  j.two_point_makes AS japan_2pm,
  j.two_point_attempts AS japan_2pa,
  j.free_throw_makes AS japan_ftm,
  j.free_throw_attempts AS japan_fta,
  j.total_rebounds AS japan_rebounds,
  j.offensive_rebounds AS japan_offensive_rebounds,
  j.assists AS japan_assists,
  j.turnovers AS japan_turnovers,
  j.steals AS japan_steals,
  j.blocks AS japan_blocks,
  o.team_name AS opponent_team,
  o.points AS opponent_points,
  o.three_point_makes AS opponent_3pm,
  o.three_point_attempts AS opponent_3pa,
  o.two_point_makes AS opponent_2pm,
  o.two_point_attempts AS opponent_2pa,
  o.free_throw_makes AS opponent_ftm,
  o.free_throw_attempts AS opponent_fta,
  o.total_rebounds AS opponent_rebounds,
  o.offensive_rebounds AS opponent_offensive_rebounds,
  o.assists AS opponent_assists,
  o.turnovers AS opponent_turnovers,
  o.steals AS opponent_steals,
  o.blocks AS opponent_blocks
FROM national_team_games g
INNER JOIN national_team_box_scores j ON j.game_id = g.id AND j.is_japan = 1
INNER JOIN national_team_box_scores o ON o.game_id = g.id AND o.is_japan = 0
ORDER BY g.game_date DESC, g.tipoff_time DESC, g.id DESC
LIMIT :limit
SQL);
    $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    return array_map('map_game', $stmt->fetchAll());
}

function map_game(array $row): array
{
    $japanScore = (int)$row['japan_points'];
    $opponentScore = (int)$row['opponent_points'];
    $periods = json_decode((string)($row['period_scores'] ?? '[]'), true) ?: [];

    return [
        'id' => (int)$row['id'],
        'date' => $row['game_date'],
        'tipoffTime' => $row['tipoff_time'] ? substr((string)$row['tipoff_time'], 0, 5) : null,
        'competition' => $row['competition'],
        'status' => $row['status'],
        'venue' => $row['venue'],
        'opponent' => clean_team_name((string)$row['opponent_team']),
        'japanScore' => $japanScore,
        'opponentScore' => $opponentScore,
        'result' => $japanScore === $opponentScore ? 'D' : ($japanScore > $opponentScore ? 'W' : 'L'),
        'japanSide' => $row['japan_side'],
        'periods' => array_map(static function (array $period) use ($row): array {
            $japanHome = $row['japan_side'] === 'home';
            return [
                'label' => $period['label'] ?? '',
                'japan' => (int)($japanHome ? ($period['home'] ?? 0) : ($period['away'] ?? 0)),
                'opponent' => (int)($japanHome ? ($period['away'] ?? 0) : ($period['home'] ?? 0)),
            ];
        }, $periods),
        'japanStats' => team_stats($row, 'japan'),
        'opponentStats' => team_stats($row, 'opponent'),
        'sourceUrl' => $row['source_url'],
        'sourceProvider' => $row['source_provider'],
        'updatedAt' => $row['updated_at'],
    ];
}

function team_stats(array $row, string $prefix): array
{
    return [
        'points' => (int)$row[$prefix . '_points'],
        'threePointMakes' => (int)$row[$prefix . '_3pm'],
        'threePointAttempts' => (int)$row[$prefix . '_3pa'],
        'twoPointMakes' => (int)$row[$prefix . '_2pm'],
        'twoPointAttempts' => (int)$row[$prefix . '_2pa'],
        'freeThrowMakes' => (int)$row[$prefix . '_ftm'],
        'freeThrowAttempts' => (int)$row[$prefix . '_fta'],
        'rebounds' => (int)$row[$prefix . '_rebounds'],
        'offensiveRebounds' => (int)$row[$prefix . '_offensive_rebounds'],
        'assists' => (int)$row[$prefix . '_assists'],
        'turnovers' => (int)$row[$prefix . '_turnovers'],
        'steals' => (int)$row[$prefix . '_steals'],
        'blocks' => (int)$row[$prefix . '_blocks'],
    ];
}

function fetch_players(PDO $pdo, array $gameIds): array
{
    if ($gameIds === []) {
        return [];
    }
    $placeholders = implode(', ', array_fill(0, count($gameIds), '?'));
    $stmt = $pdo->prepare(<<<SQL
SELECT game_id, team_name, is_japan, player_number, player_name, starter, points, three_point_makes,
       three_point_attempts, two_point_makes, two_point_attempts, free_throw_makes,
       free_throw_attempts, total_rebounds, offensive_rebounds, assists, turnovers, steals,
       blocks, minutes_seconds, did_not_play
FROM national_team_player_stats
WHERE game_id IN ({$placeholders})
ORDER BY game_id DESC, is_japan DESC, starter DESC, points DESC, player_number + 0
SQL);
    $stmt->execute(array_map('intval', $gameIds));

    return array_map(static fn(array $row): array => [
        'gameId' => (int)$row['game_id'],
        'team' => clean_team_name((string)$row['team_name']),
        'isJapan' => (bool)$row['is_japan'],
        'number' => $row['player_number'],
        'name' => $row['player_name'],
        'starter' => (bool)$row['starter'],
        'points' => (int)$row['points'],
        'threePointMakes' => (int)$row['three_point_makes'],
        'threePointAttempts' => (int)$row['three_point_attempts'],
        'twoPointMakes' => (int)$row['two_point_makes'],
        'twoPointAttempts' => (int)$row['two_point_attempts'],
        'freeThrowMakes' => (int)$row['free_throw_makes'],
        'freeThrowAttempts' => (int)$row['free_throw_attempts'],
        'rebounds' => (int)$row['total_rebounds'],
        'offensiveRebounds' => (int)$row['offensive_rebounds'],
        'assists' => (int)$row['assists'],
        'turnovers' => (int)$row['turnovers'],
        'steals' => (int)$row['steals'],
        'blocks' => (int)$row['blocks'],
        'minutes' => format_minutes($row['minutes_seconds']),
        'didNotPlay' => (bool)$row['did_not_play'],
    ], $stmt->fetchAll());
}

function fetch_player_leaders(PDO $pdo): array
{
    $stmt = $pdo->query(<<<SQL
SELECT player_name, COUNT(DISTINCT game_id) AS games, SUM(points) AS points,
       SUM(total_rebounds) AS rebounds, SUM(assists) AS assists, SUM(steals) AS steals,
       SUM(turnovers) AS turnovers, SUM(three_point_makes) AS three_point_makes,
       SUM(three_point_attempts) AS three_point_attempts, SUM(minutes_seconds) AS minutes_seconds
FROM national_team_player_stats
WHERE is_japan = 1 AND did_not_play = 0
GROUP BY player_name
ORDER BY points DESC, assists DESC
SQL);

    return array_map(static function (array $row): array {
        $games = max(1, (int)$row['games']);
        return [
            'name' => $row['player_name'],
            'games' => (int)$row['games'],
            'points' => (int)$row['points'],
            'pointsPerGame' => round((int)$row['points'] / $games, 1),
            'reboundsPerGame' => round((int)$row['rebounds'] / $games, 1),
            'assistsPerGame' => round((int)$row['assists'] / $games, 1),
            'steals' => (int)$row['steals'],
            'turnovers' => (int)$row['turnovers'],
            'threePointMakes' => (int)$row['three_point_makes'],
            'threePointAttempts' => (int)$row['three_point_attempts'],
            'minutes' => format_minutes($row['minutes_seconds']),
        ];
    }, $stmt->fetchAll());
}

function build_summary(array $games): array
{
    $count = count($games);
    if ($count === 0) {
        return ['games' => 0, 'wins' => 0, 'losses' => 0, 'averagePoints' => 0, 'averageAllowed' => 0, 'threePointPercentage' => 0, 'averageAssists' => 0, 'averageRebounds' => 0, 'averageTurnovers' => 0];
    }

    $wins = count(array_filter($games, static fn(array $game): bool => $game['result'] === 'W'));
    $losses = count(array_filter($games, static fn(array $game): bool => $game['result'] === 'L'));
    $sum = static fn(string $key): int => array_sum(array_map(static fn(array $game): int => (int)$game['japanStats'][$key], $games));
    $points = array_sum(array_column($games, 'japanScore'));
    $allowed = array_sum(array_column($games, 'opponentScore'));
    $threePa = $sum('threePointAttempts');

    return [
        'games' => $count,
        'wins' => $wins,
        'losses' => $losses,
        'averagePoints' => round($points / $count, 1),
        'averageAllowed' => round($allowed / $count, 1),
        'threePointPercentage' => $threePa > 0 ? round(($sum('threePointMakes') / $threePa) * 100, 1) : 0,
        'averageAssists' => round($sum('assists') / $count, 1),
        'averageRebounds' => round($sum('rebounds') / $count, 1),
        'averageTurnovers' => round($sum('turnovers') / $count, 1),
    ];
}

function table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SHOW TABLES LIKE :table');
    $stmt->execute(['table' => $table]);
    return $stmt->fetchColumn() !== false;
}

function clean_team_name(string $name): string
{
    return trim(str_replace(['男子', '代表'], '', $name));
}

function format_minutes(mixed $seconds): ?string
{
    if ($seconds === null) {
        return null;
    }
    $seconds = (int)$seconds;
    return sprintf('%02d:%02d', intdiv($seconds, 60), $seconds % 60);
}

function empty_payload(): array
{
    return [
        'source' => 'empty', 'updatedAt' => null,
        'summary' => build_summary([]), 'games' => [], 'players' => [], 'playerLeaders' => [],
    ];
}
