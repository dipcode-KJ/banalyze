<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

try {
    $pdo = db();
    $teamCount = (int)$pdo->query('SELECT COUNT(*) FROM teams')->fetchColumn();
    $gameCount = (int)$pdo->query('SELECT COUNT(*) FROM games')->fetchColumn();
    $recordCount = (int)$pdo->query('SELECT COUNT(*) FROM team_daily_records')->fetchColumn();
    $latestGameDate = $pdo->query('SELECT MAX(game_date) FROM games')->fetchColumn() ?: null;

    json_response([
        'ok' => true,
        'database' => 'connected',
        'counts' => [
            'teams' => $teamCount,
            'games' => $gameCount,
            'records' => $recordCount,
        ],
        'latestGameDate' => $latestGameDate,
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    json_response([
        'ok' => false,
        'database' => 'error',
        'message' => 'Database health check failed.',
    ]);
}
