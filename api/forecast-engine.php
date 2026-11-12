<?php

declare(strict_types=1);

const FORECAST_MODEL_VERSION = 'elo-margin-v1';

function build_forecast(PDO $pdo, array $game): array
{
    $season = (string)$game['season'];
    $division = (string)$game['division'];
    $cutoffDate = (string)$game['game_date'];
    $homeId = (int)$game['home_team_id'];
    $awayId = (int)$game['away_team_id'];

    $teamsStmt = $pdo->prepare('SELECT id, short_name FROM teams WHERE division = :division');
    $teamsStmt->execute(['division' => $division]);
    $teamNames = [];
    $ratings = [];
    $averages = [];
    foreach ($teamsStmt->fetchAll() as $team) {
        $id = (int)$team['id'];
        $teamNames[$id] = (string)$team['short_name'];
        $ratings[$id] = 1500.0;
        $averages[$id] = ['for' => 75.0, 'against' => 75.0, 'margin' => 0.0, 'games' => 0];
    }

    $historyStmt = $pdo->prepare(<<<SQL
SELECT g.id, g.game_date, g.home_team_id, g.away_team_id, g.home_score, g.away_score
FROM games g
JOIN teams ht ON ht.id = g.home_team_id
JOIN teams at ON at.id = g.away_team_id
WHERE g.season = :season
  AND g.status = 'FINAL'
  AND g.home_score IS NOT NULL
  AND g.away_score IS NOT NULL
  AND g.game_date < :cutoff_date
  AND ht.division = :division
  AND at.division = :division
ORDER BY g.game_date ASC, g.id ASC
SQL);
$historyStmt->execute([
    'season' => $season,
    'cutoff_date' => $cutoffDate,
    'division' => $division,
]);

    $historyCount = 0;
    $homeMargins = [];
    foreach ($historyStmt->fetchAll() as $past) {
        $historyCount++;
        $pastHome = (int)$past['home_team_id'];
        $pastAway = (int)$past['away_team_id'];
        $homeScore = (int)$past['home_score'];
        $awayScore = (int)$past['away_score'];
        $margin = $homeScore - $awayScore;
        $expectedHome = elo_expected($ratings[$pastHome] + 65.0, $ratings[$pastAway]);
        $actualHome = $homeScore > $awayScore ? 1.0 : ($homeScore === $awayScore ? 0.5 : 0.0);
        $marginFactor = max(1.0, log(abs($margin) + 1.0) * 2.2);
        $change = 20.0 * $marginFactor * ($actualHome - $expectedHome);
        $ratings[$pastHome] += $change;
        $ratings[$pastAway] -= $change;

        add_team_average($averages, $pastHome, $homeScore, $awayScore);
        add_team_average($averages, $pastAway, $awayScore, $homeScore);
        $homeMargins[] = $margin;
    }

    $homeAdvantage = $homeMargins === [] ? 4.0 : clamp(array_sum($homeMargins) / count($homeMargins), 2.0, 12.0);
    $homeElo = $ratings[$homeId] ?? 1500.0;
    $awayElo = $ratings[$awayId] ?? 1500.0;
    $probability = elo_expected($homeElo + 65.0, $awayElo);
    $homeAverage = $averages[$homeId] ?? ['for' => 75.0, 'against' => 75.0, 'margin' => 0.0, 'games' => 0];
    $awayAverage = $averages[$awayId] ?? ['for' => 75.0, 'against' => 75.0, 'margin' => 0.0, 'games' => 0];
    $marginFromElo = ($homeElo - $awayElo) / 25.0;
    $marginFromForm = (($homeAverage['margin'] ?? 0.0) - ($awayAverage['margin'] ?? 0.0)) * 0.25;
    $predictedMargin = clamp($marginFromElo * 0.75 + $marginFromForm + $homeAdvantage, -35.0, 35.0);
    // Estimate each team's points from its scoring average and the opponent's
    // points allowed average. The previous implementation divided the average
    // score by two and then clamped both sides to 50, producing 50-50 for every
    // fixture even when Elo and form produced a meaningful margin.
    $expectedHomeScore = (($homeAverage['for'] ?? 75.0) + ($awayAverage['against'] ?? 75.0)) / 2.0;
    $expectedAwayScore = (($awayAverage['for'] ?? 75.0) + ($homeAverage['against'] ?? 75.0)) / 2.0;
    $predictedHomeScore = clamp($expectedHomeScore + $predictedMargin / 2.0, 60.0, 125.0);
    $predictedAwayScore = clamp($expectedAwayScore - $predictedMargin / 2.0, 60.0, 125.0);

    return [
        'modelVersion' => FORECAST_MODEL_VERSION,
        'dataCutoffDate' => $cutoffDate,
        'homeElo' => round($homeElo, 2),
        'awayElo' => round($awayElo, 2),
        'homeAdvantage' => round($homeAdvantage, 2),
        'homeWinProbability' => round($probability, 5),
        'predictedHomeScore' => round($predictedHomeScore, 1),
        'predictedAwayScore' => round($predictedAwayScore, 1),
        'predictedMargin' => round($predictedMargin, 1),
        'inputSnapshot' => [
            'season' => $season,
            'division' => $division,
            'historyGames' => $historyCount,
            'homeTeam' => $teamNames[$homeId] ?? null,
            'awayTeam' => $teamNames[$awayId] ?? null,
            'method' => 'Elo with 65 rating-point home adjustment, historical home margin, and pre-cutoff point margin form',
        ],
    ];
}

function elo_expected(float $home, float $away): float
{
    return 1.0 / (1.0 + (10 ** (($away - $home) / 400.0)));
}

function add_team_average(array &$averages, int $teamId, int $pointsFor, int $pointsAgainst): void
{
    if (!isset($averages[$teamId])) {
        $averages[$teamId] = ['for' => 75.0, 'against' => 75.0, 'margin' => 0.0, 'games' => 0];
    }
    $count = (int)$averages[$teamId]['games'];
    $averages[$teamId]['for'] = (($averages[$teamId]['for'] * $count) + $pointsFor) / ($count + 1);
    $averages[$teamId]['against'] = (($averages[$teamId]['against'] * $count) + $pointsAgainst) / ($count + 1);
    $averages[$teamId]['margin'] = $averages[$teamId]['for'] - $averages[$teamId]['against'];
    $averages[$teamId]['games'] = $count + 1;
}

function clamp(float $value, float $minimum, float $maximum): float
{
    return min($maximum, max($minimum, $value));
}
