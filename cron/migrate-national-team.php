<?php

declare(strict_types=1);

require __DIR__ . '/../api/db.php';

$pdo = db();
$schema = file_get_contents(__DIR__ . '/../database/schema.sql');
if ($schema === false) {
    throw new RuntimeException('Could not read database/schema.sql');
}

foreach (['national_team_games', 'national_team_box_scores', 'national_team_player_stats'] as $table) {
    if (preg_match('/CREATE TABLE ' . preg_quote($table, '/') . ' \(.*?\) ENGINE=InnoDB[^;]*;/s', $schema, $match) !== 1) {
        throw new RuntimeException("Schema for {$table} was not found");
    }

    $statement = preg_replace('/^CREATE TABLE /', 'CREATE TABLE IF NOT EXISTS ', $match[0]);
    $pdo->exec($statement);
    echo "Ensured {$table}\n";
}
