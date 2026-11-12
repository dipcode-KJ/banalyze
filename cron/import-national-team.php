<?php

declare(strict_types=1);

require __DIR__ . '/../api/db.php';

const USER_AGENT = 'NINES-Analyze/1.0 (+https://analyze.kjnine.com/)';

$mode = $argv[1] ?? 'latest';
if (!in_array($mode, ['latest', 'backfill', 'parse'], true)) {
    fwrite(STDERR, "Usage: php cron/import-national-team.php [latest|backfill|parse URL [competition]]\n");
    exit(1);
}

if ($mode === 'parse') {
    $url = $argv[2] ?? '';
    if ($url === '') {
        throw new InvalidArgumentException('A box-score URL is required in parse mode');
    }
    $game = parse_box_score(http_get($url), $url, $argv[3] ?? 'JBA TEST');
    echo json_encode($game, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    exit($game === null ? 1 : 0);
}

$sources = require __DIR__ . '/national-team-sources.php';
if ($mode === 'latest') {
    $sources = array_values(array_filter($sources, static fn(array $source): bool => ($source['current'] ?? false) === true));
}

$pdo = db();
$discovered = [];
$failed = [];
$imported = 0;

foreach ($sources as $source) {
    try {
        foreach (discover_box_scores($source['schedule_url']) as $url) {
            $discovered[$url] = $source['competition'];
        }
    } catch (Throwable $error) {
        $failed[] = $source['schedule_url'] . ': ' . $error->getMessage();
    }
}

foreach ($discovered as $url => $competition) {
    try {
        $game = parse_box_score(http_get($url), $url, $competition);
        if ($game === null) {
            continue;
        }

        persist_game($pdo, $game);
        $imported++;
        echo sprintf("Imported %s %s vs %s (%d-%d)\n", $game['game_date'], $game['home_team'], $game['away_team'], $game['home_score'], $game['away_score']);
    } catch (Throwable $error) {
        $failed[] = $url . ': ' . $error->getMessage();
    }
}

echo sprintf("[%s] mode=%s discovered=%d imported=%d failed=%d\n", date('c'), $mode, count($discovered), $imported, count($failed));
foreach ($failed as $message) {
    fwrite(STDERR, "WARN {$message}\n");
}

if ($imported === 0 && count($discovered) > 0) {
    exit(1);
}

function discover_box_scores(string $scheduleUrl): array
{
    $html = http_get($scheduleUrl);
    $dom = load_dom($html);
    $xpath = new DOMXPath($dom);
    $urls = [];

    foreach ($xpath->query('//a[contains(@href, "boxscore") and contains(@href, "schedulekey")]') as $link) {
        $href = html_entity_decode((string)$link->getAttribute('href'), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $urls[] = resolve_url($scheduleUrl, $href);
    }

    return array_values(array_unique($urls));
}

function parse_box_score(string $html, string $sourceUrl, string $competition): ?array
{
    $dom = load_dom($html);
    $xpath = new DOMXPath($dom);
    $status = text_of($xpath, '(//p[contains(@class, "status")])[1]');
    if ($status === '' || !str_contains($status, '終了')) {
        return null;
    }

    $dateText = value_after_label($xpath, '試合期日');
    if (preg_match('/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/u', $dateText, $dateMatch) !== 1) {
        throw new RuntimeException('Game date not found');
    }
    $gameDate = sprintf('%04d-%02d-%02d', (int)$dateMatch[1], (int)$dateMatch[2], (int)$dateMatch[3]);

    $timeText = value_after_label($xpath, '開始時間');
    $tipoffTime = preg_match('/(\d{1,2}:\d{2})/u', $timeText, $timeMatch) === 1 ? $timeMatch[1] . ':00' : null;
    $venue = value_after_label($xpath, '開催場所');

    $homeTeam = text_of($xpath, '(//table[contains(@class, "score__box")]//td[contains(@class, "team__l")]//strong)[1]');
    $awayTeam = text_of($xpath, '(//table[contains(@class, "score__box")]//td[contains(@class, "team__r")]//strong)[1]');
    $scoreNodes = $xpath->query('(//table[contains(@class, "score__box")])[1]//td[contains(@class, "score_total")]');
    if ($homeTeam === '' || $awayTeam === '' || $scoreNodes->length < 2) {
        throw new RuntimeException('Teams or final score not found');
    }
    $homeScore = integer_text($scoreNodes->item(0)?->textContent ?? '');
    $awayScore = integer_text($scoreNodes->item(1)?->textContent ?? '');

    $periodScores = [];
    foreach ($xpath->query('(//table[contains(@class, "score__box")])[1]//tr') as $row) {
        $home = text_of_node($xpath, './/td[contains(@class, "score_period__l")]', $row);
        $label = text_of_node($xpath, './/td[contains(@class, "period")]', $row);
        $away = text_of_node($xpath, './/td[contains(@class, "score_period__r")]', $row);
        if ($home !== '' && $label !== '' && $away !== '') {
            $periodScores[] = ['label' => $label, 'home' => (int)$home, 'away' => (int)$away];
        }
    }

    $teams = [];
    foreach ($xpath->query('//div[contains(@class, "detail")]//h4[contains(@class, "ttl")]') as $heading) {
        $teamName = normalize_text($heading->textContent ?? '');
        $table = $xpath->query('following-sibling::div[contains(@class, "inner")][1]//table[contains(@class, "detail-tbl")]', $heading)->item(0);
        if ($teamName === '' || !$table instanceof DOMElement) {
            continue;
        }

        $players = [];
        foreach ($xpath->query('.//tr[td]', $table) as $row) {
            if ($xpath->query('ancestor::tbody[contains(@class, "tb_total")]', $row)->length > 0) {
                continue;
            }
            $cells = row_cells($xpath, $row, 'td');
            if (count($cells) !== 19 || $cells[0] === '' || $cells[2] === '' || !preg_match('/^\d+$/', $cells[0])) {
                continue;
            }
            $players[] = player_from_cells($cells);
        }

        $totalRow = $xpath->query('.//tbody[contains(@class, "tb_total")]//tr[th[contains(normalize-space(.), "合計")]]', $table)->item(0);
        if (!$totalRow instanceof DOMElement) {
            throw new RuntimeException("Totals not found for {$teamName}");
        }
        $totals = totals_from_cells(row_cells($xpath, $totalRow, 'td'));
        $teams[] = ['name' => $teamName, 'totals' => $totals, 'players' => $players];
    }

    if (count($teams) !== 2) {
        throw new RuntimeException('Two team stat tables were not found');
    }

    parse_str((string)parse_url($sourceUrl, PHP_URL_QUERY), $query);
    $scheduleKey = (string)($query['schedulekey'] ?? hash('sha256', $sourceUrl));
    $sourceHost = (string)parse_url($sourceUrl, PHP_URL_HOST);
    $japanSide = is_japan($homeTeam) ? 'home' : (is_japan($awayTeam) ? 'away' : '');
    if ($japanSide === '') {
        return null;
    }

    return [
        'source_game_id' => substr($sourceHost . ':' . $scheduleKey, 0, 96),
        'source_url' => $sourceUrl,
        'competition' => $competition,
        'game_date' => $gameDate,
        'tipoff_time' => $tipoffTime,
        'status' => $status,
        'venue' => $venue,
        'home_team' => $homeTeam,
        'away_team' => $awayTeam,
        'home_score' => $homeScore,
        'away_score' => $awayScore,
        'japan_side' => $japanSide,
        'period_scores' => $periodScores,
        'teams' => $teams,
    ];
}

function persist_game(PDO $pdo, array $game): void
{
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(<<<SQL
INSERT INTO national_team_games (
  source_game_id, source_provider, source_url, competition, game_date, tipoff_time, status, venue,
  home_team, away_team, home_score, away_score, japan_side, period_scores
) VALUES (
  :source_game_id, 'JBA', :source_url, :competition, :game_date, :tipoff_time, :status, :venue,
  :home_team, :away_team, :home_score, :away_score, :japan_side, :period_scores
)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id), source_url = VALUES(source_url), competition = VALUES(competition),
  game_date = VALUES(game_date), tipoff_time = VALUES(tipoff_time), status = VALUES(status), venue = VALUES(venue),
  home_team = VALUES(home_team), away_team = VALUES(away_team), home_score = VALUES(home_score),
  away_score = VALUES(away_score), japan_side = VALUES(japan_side), period_scores = VALUES(period_scores)
SQL);
        $params = $game;
        unset($params['teams']);
        $params['period_scores'] = json_encode($params['period_scores'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $stmt->execute($params);
        $gameId = (int)$pdo->lastInsertId();

        foreach ($game['teams'] as $team) {
            upsert_team_totals($pdo, $gameId, $team['name'], $team['totals']);
            $pdo->prepare('DELETE FROM national_team_player_stats WHERE game_id = :game_id AND team_name = :team_name')
                ->execute(['game_id' => $gameId, 'team_name' => $team['name']]);
            foreach ($team['players'] as $player) {
                insert_player($pdo, $gameId, $team['name'], $player);
            }
        }

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function upsert_team_totals(PDO $pdo, int $gameId, string $teamName, array $totals): void
{
    $stmt = $pdo->prepare(<<<SQL
INSERT INTO national_team_box_scores (
  game_id, team_name, is_japan, points, three_point_makes, three_point_attempts, two_point_makes,
  two_point_attempts, free_throw_makes, free_throw_attempts, fouls, offensive_rebounds,
  defensive_rebounds, total_rebounds, turnovers, assists, steals, blocks
) VALUES (
  :game_id, :team_name, :is_japan, :points, :three_point_makes, :three_point_attempts, :two_point_makes,
  :two_point_attempts, :free_throw_makes, :free_throw_attempts, :fouls, :offensive_rebounds,
  :defensive_rebounds, :total_rebounds, :turnovers, :assists, :steals, :blocks
)
ON DUPLICATE KEY UPDATE
  is_japan = VALUES(is_japan), points = VALUES(points), three_point_makes = VALUES(three_point_makes),
  three_point_attempts = VALUES(three_point_attempts), two_point_makes = VALUES(two_point_makes),
  two_point_attempts = VALUES(two_point_attempts), free_throw_makes = VALUES(free_throw_makes),
  free_throw_attempts = VALUES(free_throw_attempts), fouls = VALUES(fouls),
  offensive_rebounds = VALUES(offensive_rebounds), defensive_rebounds = VALUES(defensive_rebounds),
  total_rebounds = VALUES(total_rebounds), turnovers = VALUES(turnovers), assists = VALUES(assists),
  steals = VALUES(steals), blocks = VALUES(blocks)
SQL);
    $stmt->execute(array_merge(['game_id' => $gameId, 'team_name' => $teamName, 'is_japan' => is_japan($teamName) ? 1 : 0], $totals));
}

function insert_player(PDO $pdo, int $gameId, string $teamName, array $player): void
{
    $columns = array_keys($player);
    $stmt = $pdo->prepare(sprintf(
        'INSERT INTO national_team_player_stats (game_id, team_name, is_japan, %s) VALUES (:game_id, :team_name, :is_japan, %s)',
        implode(', ', $columns),
        implode(', ', array_map(static fn(string $column): string => ':' . $column, $columns))
    ));
    $stmt->execute(array_merge(['game_id' => $gameId, 'team_name' => $teamName, 'is_japan' => is_japan($teamName) ? 1 : 0], $player));
}

function player_from_cells(array $cells): array
{
    $minutes = $cells[18];
    return [
        'player_number' => $cells[0], 'player_name' => $cells[2], 'starter' => trim($cells[1]) === '*' ? 1 : 0,
        'points' => (int)$cells[3], 'three_point_makes' => (int)$cells[4], 'three_point_attempts' => (int)$cells[5],
        'two_point_makes' => (int)$cells[6], 'two_point_attempts' => (int)$cells[7],
        'free_throw_makes' => (int)$cells[8], 'free_throw_attempts' => (int)$cells[9], 'fouls' => (int)$cells[10],
        'offensive_rebounds' => (int)$cells[11], 'defensive_rebounds' => (int)$cells[12], 'total_rebounds' => (int)$cells[13],
        'turnovers' => (int)$cells[14], 'assists' => (int)$cells[15], 'steals' => (int)$cells[16], 'blocks' => (int)$cells[17],
        'minutes_seconds' => minutes_to_seconds($minutes), 'did_not_play' => strtoupper($minutes) === 'DNP' ? 1 : 0,
    ];
}

function totals_from_cells(array $cells): array
{
    if (count($cells) < 16) {
        throw new RuntimeException('Unexpected totals row');
    }
    return [
        'points' => (int)$cells[0], 'three_point_makes' => (int)$cells[1], 'three_point_attempts' => (int)$cells[2],
        'two_point_makes' => (int)$cells[3], 'two_point_attempts' => (int)$cells[4],
        'free_throw_makes' => (int)$cells[5], 'free_throw_attempts' => (int)$cells[6], 'fouls' => (int)$cells[7],
        'offensive_rebounds' => (int)$cells[8], 'defensive_rebounds' => (int)$cells[9], 'total_rebounds' => (int)$cells[10],
        'turnovers' => (int)$cells[11], 'assists' => (int)$cells[12], 'steals' => (int)$cells[13], 'blocks' => (int)$cells[14],
    ];
}

function row_cells(DOMXPath $xpath, DOMNode $row, string $tag): array
{
    $cells = [];
    foreach ($xpath->query('./' . $tag, $row) as $cell) {
        $cells[] = normalize_text($cell->textContent ?? '');
    }
    return $cells;
}

function value_after_label(DOMXPath $xpath, string $label): string
{
    $node = $xpath->query('//dt[contains(normalize-space(.), "' . $label . '")]/following-sibling::dd[1]')->item(0);
    return normalize_text($node?->textContent ?? '');
}

function text_of(DOMXPath $xpath, string $query): string
{
    return normalize_text($xpath->query($query)->item(0)?->textContent ?? '');
}

function text_of_node(DOMXPath $xpath, string $query, DOMNode $context): string
{
    return normalize_text($xpath->query($query, $context)->item(0)?->textContent ?? '');
}

function load_dom(string $html): DOMDocument
{
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="UTF-8">' . $html);
    libxml_clear_errors();
    return $dom;
}

function resolve_url(string $base, string $href): string
{
    if (preg_match('#^https?://#i', $href)) {
        return $href;
    }
    $scheme = (string)parse_url($base, PHP_URL_SCHEME);
    $host = (string)parse_url($base, PHP_URL_HOST);
    if (str_starts_with($href, '/')) {
        return $scheme . '://' . $host . $href;
    }
    $path = rtrim(dirname((string)parse_url($base, PHP_URL_PATH)), '/');
    return $scheme . '://' . $host . $path . '/' . ltrim($href, '/');
}

function http_get(string $url): string
{
    $context = stream_context_create(['http' => [
        'method' => 'GET', 'timeout' => 25, 'ignore_errors' => true,
        'header' => "User-Agent: " . USER_AGENT . "\r\nAccept: text/html,application/xhtml+xml\r\n",
    ]]);
    $html = @file_get_contents($url, false, $context);
    if ($html === false || strlen($html) < 500) {
        throw new RuntimeException('Official page request failed');
    }
    return $html;
}

function normalize_text(string $text): string
{
    return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
}

function integer_text(string $text): int
{
    return (int)preg_replace('/[^0-9-]/', '', normalize_text($text));
}

function minutes_to_seconds(string $value): ?int
{
    if (preg_match('/^(\d+):(\d{2})$/', $value, $matches) !== 1) {
        return null;
    }
    return ((int)$matches[1] * 60) + (int)$matches[2];
}

function is_japan(string $teamName): bool
{
    return str_contains($teamName, '日本代表') || $teamName === '日本';
}
