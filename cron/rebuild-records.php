<?php

declare(strict_types=1);

require __DIR__ . '/../api/db.php';

$season = $argv[1] ?? '2025-26';
$pdo = db();
$pdo->beginTransaction();

try {
    rebuild_team_records($pdo, $season);
    $pdo->commit();
    echo sprintf("[%s] Rebuilt team records for %s\n", date('c'), $season);
} catch (Throwable $error) {
    $pdo->rollBack();
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}

function rebuild_team_records(PDO $pdo, string $season): void
{
    $pdo->prepare('DELETE FROM team_daily_records WHERE season = :season')->execute(['season' => $season]);
    $teams = $pdo->query('SELECT id FROM teams');
    $recordDate = date('Y-m-d');

    foreach ($teams->fetchAll() as $team) {
        $teamId = (int)$team['id'];
        $games = $pdo->prepare(<<<SQL
SELECT *
FROM games
WHERE season = :season
  AND status = 'FINAL'
  AND (home_team_id = :team_id OR away_team_id = :team_id)
SQL);
        $games->execute(['season' => $season, 'team_id' => $teamId]);

        $record = [
            'wins' => 0,
            'losses' => 0,
            'points_for' => 0,
            'points_against' => 0,
            'home_wins' => 0,
            'home_losses' => 0,
            'away_wins' => 0,
            'away_losses' => 0,
        ];

        foreach ($games->fetchAll() as $game) {
            $isHome = (int)$game['home_team_id'] === $teamId;
            $pointsFor = $isHome ? (int)$game['home_score'] : (int)$game['away_score'];
            $pointsAgainst = $isHome ? (int)$game['away_score'] : (int)$game['home_score'];
            $won = $pointsFor > $pointsAgainst;

            $record['points_for'] += $pointsFor;
            $record['points_against'] += $pointsAgainst;
            $record[$won ? 'wins' : 'losses']++;
            $record[$isHome ? ($won ? 'home_wins' : 'home_losses') : ($won ? 'away_wins' : 'away_losses')]++;
        }

        if (($record['wins'] + $record['losses']) === 0) {
            continue;
        }

        $stmt = $pdo->prepare(<<<SQL
INSERT INTO team_daily_records (
  team_id, season, record_date, wins, losses, points_for, points_against,
  home_wins, home_losses, away_wins, away_losses
) VALUES (
  :team_id, :season, :record_date, :wins, :losses, :points_for, :points_against,
  :home_wins, :home_losses, :away_wins, :away_losses
)
SQL);
        $stmt->execute(array_merge([
            'team_id' => $teamId,
            'season' => $season,
            'record_date' => $recordDate,
        ], $record));
    }
}
