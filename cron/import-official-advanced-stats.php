<?php

declare(strict_types=1);

require __DIR__ . '/../api/db.php';

// Imports team advanced averages from B.LEAGUE club_detail pages.
// Usage:
// php cron/import-official-advanced-stats.php 2022-23

const CLUB_URL = 'https://www.bleague.jp/club/';
const CLUB_DETAIL_URL = 'https://www.bleague.jp/club_detail/';
const HISTORICAL_TEAM_IDS = [695, 715, 722];

$season = $argv[1] ?? '2025-26';
$pdo = db();
$pdo->beginTransaction();

try {
    $teamIds = fetch_team_ids();
    $imported = 0;
    $matched = 0;

    foreach ($teamIds as $officialTeamId) {
        $html = http_get(CLUB_DETAIL_URL . '?' . http_build_query(['TeamID' => $officialTeamId, 'tab' => 2]));
        $clubName = extract_club_name($html);
        if ($clubName === '') {
            continue;
        }

        foreach (extract_average_rows($html, $season) as $row) {
            $teamId = find_team_id($pdo, $clubName, $row['division']);
            if ($teamId === null) {
                continue;
            }

            upsert_advanced_stats($pdo, $teamId, $season, $row, $officialTeamId);
            $imported++;
            $matched++;
        }
    }

    $pdo->commit();
    echo sprintf("[%s] Imported %d official advanced stat rows for %s from %d club pages\n", date('c'), $imported, $season, count($teamIds));
    if ($matched === 0) {
        fwrite(STDERR, "No matching teams were found. Check official team names and local teams table.\n");
    }
} catch (Throwable $error) {
    $pdo->rollBack();
    throw $error;
}

function fetch_team_ids(): array
{
    $ids = HISTORICAL_TEAM_IDS;
    foreach ([CLUB_URL, CLUB_URL . '?tab=2'] as $url) {
        $html = http_get($url);
        preg_match_all('/club_detail\/\?TeamID=(\d+)/', $html, $matches);
        foreach ($matches[1] ?? [] as $id) {
            $ids[] = (int)$id;
        }
    }

    $ids = array_values(array_unique($ids));
    sort($ids);

    return $ids;
}

function extract_club_name(string $html): string
{
    if (preg_match('/<h1 class="clubDetail-kv-name">.*?<span[^>]*>.*?<\/span>\s*([^<\r\n]+)/s', $html, $matches)) {
        return normalize_text($matches[1]);
    }

    if (preg_match('/<title>(.*?)\s*\|/s', $html, $matches)) {
        return normalize_text($matches[1]);
    }

    return '';
}

function extract_average_rows(string $html, string $season): array
{
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="UTF-8">' . $html);
    libxml_clear_errors();
    $xpath = new DOMXPath($dom);

    $rows = [];
    foreach ($xpath->query('//table[contains(@class, "score-tab-table")]//tbody/tr') as $tr) {
        $cells = [];
        foreach ($xpath->query('./td', $tr) as $td) {
            $cells[] = normalize_text($td->textContent ?? '');
        }

        if (
            count($cells) < 29 ||
            $cells[0] !== $season ||
            !in_array($cells[1], ['B1', 'B2'], true) ||
            !str_contains($cells[28], ':')
        ) {
            continue;
        }

        $ppg = numeric($cells[4]);
        $oppg = numeric($cells[5]);
        $fga = numeric($cells[7]);
        $threePm = numeric($cells[12]);
        $threePa = numeric($cells[13]);
        $threePPercentage = numeric($cells[14]);
        $fta = numeric($cells[16]);
        $orb = numeric($cells[18]);
        $totalRebounds = numeric($cells[20]);
        $assists = numeric($cells[21]);
        $turnovers = numeric($cells[22]);
        $pace = $fga !== null && $fta !== null && $turnovers !== null && $orb !== null
            ? $fga + 0.44 * $fta + $turnovers - $orb
            : null;

        $rows[] = [
            'division' => $cells[1],
            'assists' => $assists,
            'turnovers' => $turnovers,
            'total_rebounds' => $totalRebounds,
            'three_point_makes' => $threePm,
            'three_point_attempts' => $threePa,
            'three_point_percentage' => $threePPercentage,
            'pace' => $pace,
            'offensive_rating' => $pace && $ppg !== null ? ($ppg / $pace) * 100 : null,
            'defensive_rating' => $pace && $oppg !== null ? ($oppg / $pace) * 100 : null,
        ];
    }

    return $rows;
}

function find_team_id(PDO $pdo, string $teamName, string $division): ?int
{
    $localName = official_to_local_team_name($teamName);
    $stmt = $pdo->prepare(<<<SQL
SELECT id
FROM teams
WHERE division = :division
  AND (name = :name OR short_name = :name)
LIMIT 1
SQL);
    $stmt->execute(['division' => $division, 'name' => $localName]);
    $id = $stmt->fetchColumn();

    return $id === false ? null : (int)$id;
}

function official_to_local_team_name(string $teamName): string
{
    $aliases = [
        'レバンガ北海道' => '北海道',
        '仙台89ERS' => '仙台',
        '秋田ノーザンハピネッツ' => '秋田',
        '茨城ロボッツ' => '茨城',
        '宇都宮ブレックス' => '宇都宮',
        '群馬クレインサンダーズ' => '群馬',
        '越谷アルファーズ' => '越谷',
        'アルティーリ千葉' => 'A千葉',
        '千葉ジェッツ' => '千葉J',
        'アルバルク東京' => 'A東京',
        'サンロッカーズ渋谷' => 'SR渋谷',
        '川崎ブレイブサンダース' => '川崎',
        '横浜ビー・コルセアーズ' => '横浜BC',
        '新潟アルビレックスBB' => '新潟',
        '富山グラウジーズ' => '富山',
        '信州ブレイブウォリアーズ' => '信州',
        '三遠ネオフェニックス' => '三遠',
        'シーホース三河' => '三河',
        'ファイティングイーグルス名古屋' => 'FE名古屋',
        '名古屋ダイヤモンドドルフィンズ' => '名古屋D',
        '滋賀レイクス' => '滋賀',
        '京都ハンナリーズ' => '京都',
        '大阪エヴェッサ' => '大阪',
        '島根スサノオマジック' => '島根',
        '広島ドラゴンフライズ' => '広島',
        '佐賀バルーナーズ' => '佐賀',
        '長崎ヴェルカ' => '長崎',
        '琉球ゴールデンキングス' => '琉球',
        '青森ワッツ' => '青森',
        '岩手ビッグブルズ' => '岩手',
        '山形ワイヴァンズ' => '山形',
        '福島ファイヤーボンズ' => '福島',
        'アースフレンズ東京Z' => '東京Z',
        '横浜エクセレンス' => '横浜EX',
        '神戸ストークス' => '神戸',
        'バンビシャス奈良' => '奈良',
        '香川ファイブアローズ' => '香川',
        '愛媛オレンジバイキングス' => '愛媛',
        '熊本ヴォルターズ' => '熊本',
        '鹿児島レブナイズ' => '鹿児島',
        'ライジングゼファー福岡' => '福岡',
        'ベルテックス静岡' => '静岡',
        '福井ブローウィンズ' => '福井',
    ];

    return $aliases[$teamName] ?? $teamName;
}

function upsert_advanced_stats(PDO $pdo, int $teamId, string $season, array $row, int $officialTeamId): void
{
    $stmt = $pdo->prepare(<<<SQL
INSERT INTO team_advanced_stats (
  team_id, season, assists, turnovers, total_rebounds, three_point_makes, three_point_attempts, three_point_percentage,
  pace, offensive_rating, defensive_rating, source
) VALUES (
  :team_id, :season, :assists, :turnovers, :total_rebounds, :three_point_makes, :three_point_attempts, :three_point_percentage,
  :pace, :offensive_rating, :defensive_rating, :source
)
ON DUPLICATE KEY UPDATE
  assists = VALUES(assists),
  turnovers = VALUES(turnovers),
  total_rebounds = VALUES(total_rebounds),
  three_point_makes = VALUES(three_point_makes),
  three_point_attempts = VALUES(three_point_attempts),
  three_point_percentage = VALUES(three_point_percentage),
  pace = VALUES(pace),
  offensive_rating = VALUES(offensive_rating),
  defensive_rating = VALUES(defensive_rating),
  source = VALUES(source)
SQL);

    $stmt->execute([
        'team_id' => $teamId,
        'season' => $season,
        'assists' => decimal_or_null($row['assists']),
        'turnovers' => decimal_or_null($row['turnovers']),
        'total_rebounds' => decimal_or_null($row['total_rebounds']),
        'three_point_makes' => decimal_or_null($row['three_point_makes']),
        'three_point_attempts' => decimal_or_null($row['three_point_attempts']),
        'three_point_percentage' => decimal_or_null($row['three_point_percentage']),
        'pace' => decimal_or_null($row['pace']),
        'offensive_rating' => decimal_or_null($row['offensive_rating']),
        'defensive_rating' => decimal_or_null($row['defensive_rating']),
        'source' => CLUB_DETAIL_URL . '?' . http_build_query(['TeamID' => $officialTeamId, 'tab' => 2]),
    ]);
}

function decimal_or_null(?float $value): ?string
{
    return $value === null ? null : number_format($value, 2, '.', '');
}

function numeric(string $value): ?float
{
    $value = str_replace(['%', ',', '本'], '', $value);
    $value = trim($value);
    return is_numeric($value) ? (float)$value : null;
}

function normalize_text(string $text): string
{
    return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
}

function http_get(string $url): string
{
    $context = stream_context_create([
        'http' => [
            'header' => "User-Agent: NINES-DATA-ANALYZE/0.1\r\n",
            'timeout' => 20,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        throw new RuntimeException("Failed to fetch {$url}");
    }

    return $body;
}
