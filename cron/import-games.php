<?php

declare(strict_types=1);

require __DIR__ . '/../api/db.php';

// Xserver Cron examples:
// /usr/bin/php /home/your_account/your_domain/public_html/cron/import-games.php 2025-26 latest
// /usr/bin/php /home/your_account/your_domain/public_html/cron/import-games.php 2025-26 backfill
// /usr/bin/php /home/your_account/your_domain/public_html/cron/import-games.php 2025-26 month 05

const BASE_URL = 'https://www.bleague.jp/schedule/';

$season = $argv[1] ?? '2025-26';
$mode = $argv[2] ?? 'latest';
$specificMonth = $argv[3] ?? null;

[$seasonStartYear] = parse_season($season);
$months = match ($mode) {
    'backfill' => ['10', '11', '12', '01', '02', '03', '04', '05'],
    'month' => [sprintf('%02d', (int)$specificMonth)],
    default => [date('m')],
};

$pdo = db();
$pdo->beginTransaction();

try {
    $imported = 0;
    foreach ($months as $month) {
        foreach ([1 => ['2', '3'], 2 => ['7', '8']] as $tab => $events) {
            $days = fetch_days($seasonStartYear, $month, $tab);
            echo sprintf(
                "[%s] %s month=%s division=%s days=%d\n",
                date('c'),
                $season,
                $month,
                $tab === 1 ? 'B1' : 'B2',
                count($days)
            );
            foreach ($days as $day) {
                foreach ($events as $event) {
                    $games = fetch_games($seasonStartYear, $season, $month, $day, $tab, $event);
                    foreach ($games as $game) {
                        upsert_game($pdo, $game);
                        $imported++;
                    }
                }
            }
        }
    }

    rebuild_team_records($pdo, $season);
    $pdo->commit();
    echo sprintf("[%s] Imported %d game rows for %s (%s)\n", date('c'), $imported, $season, $mode);
} catch (Throwable $error) {
    $pdo->rollBack();
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}

function parse_season(string $season): array
{
    if (!preg_match('/^(\d{4})-(\d{2})$/', $season, $matches)) {
        throw new InvalidArgumentException('Season must be like 2025-26.');
    }

    return [(int)$matches[1], (int)('20' . $matches[2])];
}

function actual_game_date(int $seasonStartYear, string $month, string $day): string
{
    $year = (int)$month >= 10 ? $seasonStartYear : $seasonStartYear + 1;
    return sprintf('%04d-%02d-%02d', $year, (int)$month, (int)$day);
}

function fetch_days(int $seasonStartYear, string $month, int $tab): array
{
    $html = http_get(BASE_URL . '?' . http_build_query([
        'tab' => $tab,
        'year' => $seasonStartYear,
        'mon' => $month,
    ]));

    preg_match_all('/data-day="(\d{2})"/', $html, $matches);
    $days = array_values(array_unique($matches[1] ?? []));
    sort($days);

    return $days;
}

function fetch_games(int $seasonStartYear, string $season, string $month, string $day, int $tab, string $event): array
{
    $json = http_get(BASE_URL . '?' . http_build_query([
        'data_format' => 'json',
        'year' => $seasonStartYear,
        'mon' => $month,
        'day' => $day,
        'event' => $event,
        'club' => '',
        'tab' => $tab,
        'ha' => '',
        'fb' => '',
    ]));

    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        return [];
    }

    $games = [];
    foreach (($payload['topics'] ?? []) as $topic) {
        foreach (parse_topic_html((string)$topic, $seasonStartYear, $season, $month, $day, $tab, $event) as $game) {
            $games[] = $game;
        }
    }

    return $games;
}

function parse_topic_html(string $html, int $seasonStartYear, string $season, string $month, string $day, int $tab, string $event): array
{
    if (!str_contains($html, 'list-item')) {
        return [];
    }

    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="UTF-8"><ul>' . $html . '</ul>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    $xpath = new DOMXPath($dom);

    $games = [];
    foreach ($xpath->query('//li[contains(@class, "list-item")]') as $item) {
        $sourceGameId = trim($item->attributes?->getNamedItem('id')?->nodeValue ?? '');
        if ($sourceGameId === '') {
            continue;
        }

        $homeName = text($xpath, './/*[contains(@class, "team") and contains(@class, "home")]//*[contains(@class, "team-name")]', $item);
        $awayName = text($xpath, './/*[contains(@class, "team") and contains(@class, "away")]//*[contains(@class, "team-name")]', $item);
        if ($homeName === '' || $awayName === '') {
            continue;
        }

        if (should_skip_game($homeName, $awayName)) {
            continue;
        }

        $homeScore = nullable_int(text($xpath, './/*[contains(@class, "home-score")]//span', $item));
        $awayScore = nullable_int(text($xpath, './/*[contains(@class, "away-score")]//span', $item));
        $arenaParts = texts($xpath, './/*[contains(@class, "info-arena")]//span', $item);
        $statusText = strtoupper(text($xpath, './/*[contains(@class, "info-scorestate")]//span', $item));
        $status = $homeScore !== null && $awayScore !== null && str_contains($statusText, 'FINAL') ? 'FINAL' : 'SCHEDULED';

        $games[] = [
            'source_game_id' => $sourceGameId,
            'season' => $season,
            'game_date' => actual_game_date($seasonStartYear, $month, $day),
            'status' => $status,
            'division' => $tab === 1 ? 'B1' : 'B2',
            'home_team' => $homeName,
            'away_team' => $awayName,
            'home_score' => $homeScore,
            'away_score' => $awayScore,
            'venue' => $arenaParts[1] ?? null,
            'raw_payload' => [
                'round' => $arenaParts[0] ?? null,
                'time' => $arenaParts[2] ?? null,
                'event' => $event,
                'tab' => $tab,
            ],
        ];
    }

    return $games;
}

function should_skip_game(string $homeName, string $awayName): bool
{
    $name = strtoupper($homeName . ' ' . $awayName);
    return (bool)preg_match('/ALL-STARS|RISING STARS|SELECTED|UNITED|B\.LEAGUE U18|U18|B\.BLACK|B\.WHITE/', $name);
}

function upsert_game(PDO $pdo, array $game): void
{
    $homeTeamId = upsert_team($pdo, $game['home_team'], $game['division']);
    $awayTeamId = upsert_team($pdo, $game['away_team'], $game['division']);

    $stmt = $pdo->prepare(<<<SQL
INSERT INTO games (
  source_game_id, season, game_date, status, home_team_id, away_team_id,
  home_score, away_score, venue, raw_payload
) VALUES (
  :source_game_id, :season, :game_date, :status, :home_team_id, :away_team_id,
  :home_score, :away_score, :venue, :raw_payload
)
ON DUPLICATE KEY UPDATE
  season = VALUES(season),
  game_date = VALUES(game_date),
  status = VALUES(status),
  home_team_id = VALUES(home_team_id),
  away_team_id = VALUES(away_team_id),
  home_score = VALUES(home_score),
  away_score = VALUES(away_score),
  venue = VALUES(venue),
  raw_payload = VALUES(raw_payload)
SQL);

    $stmt->execute([
        'source_game_id' => $game['source_game_id'],
        'season' => $game['season'],
        'game_date' => $game['game_date'],
        'status' => $game['status'],
        'home_team_id' => $homeTeamId,
        'away_team_id' => $awayTeamId,
        'home_score' => $game['home_score'],
        'away_score' => $game['away_score'],
        'venue' => $game['venue'],
        'raw_payload' => json_encode($game['raw_payload'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function upsert_team(PDO $pdo, string $name, string $division): int
{
    $sourceTeamId = strtolower($division) . '-' . substr(md5($name), 0, 12);
    $stmt = $pdo->prepare(<<<SQL
INSERT INTO teams (source_team_id, name, short_name, division)
VALUES (:source_team_id, :name, :short_name, :division)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  short_name = VALUES(short_name),
  division = VALUES(division)
SQL);
    $stmt->execute([
        'source_team_id' => $sourceTeamId,
        'name' => $name,
        'short_name' => $name,
        'division' => $division,
    ]);

    $id = $pdo->prepare('SELECT id FROM teams WHERE source_team_id = :source_team_id');
    $id->execute(['source_team_id' => $sourceTeamId]);

    return (int)$id->fetchColumn();
}

function rebuild_team_records(PDO $pdo, string $season): void
{
    $pdo->prepare('DELETE FROM team_daily_records WHERE season = :season')->execute(['season' => $season]);
    $teams = $pdo->prepare('SELECT id FROM teams');
    $teams->execute();
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

function http_get(string $url): string
{
    $lastError = null;

    for ($attempt = 1; $attempt <= 4; $attempt++) {
        $context = stream_context_create([
            'http' => [
                'header' => "User-Agent: NINES-DATA-ANALYZE/0.1\r\n",
                'timeout' => 20,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);

        if ($body !== false) {
            return $body;
        }

        $lastError = error_get_last()['message'] ?? 'unknown error';
        if ($attempt < 4) {
            echo sprintf("[%s] Retry %d/3 fetch failed: %s\n", date('c'), $attempt, $url);
            sleep($attempt * 2);
        }
    }

    throw new RuntimeException('Failed to fetch: ' . $url . ' (' . $lastError . ')');
}

function text(DOMXPath $xpath, string $query, DOMNode $context): string
{
    $nodes = $xpath->query($query, $context);
    return trim($nodes && $nodes->length ? $nodes->item(0)->textContent : '');
}

function texts(DOMXPath $xpath, string $query, DOMNode $context): array
{
    $values = [];
    foreach ($xpath->query($query, $context) ?: [] as $node) {
        $values[] = trim($node->textContent);
    }

    return array_values(array_filter($values, fn($value) => $value !== ''));
}

function nullable_int(string $value): ?int
{
    $value = trim($value);
    return $value === '' || !is_numeric($value) ? null : (int)$value;
}
