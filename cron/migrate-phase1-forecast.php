<?php

declare(strict_types=1);

require dirname(__DIR__) . '/api/db.php';

$sql = file_get_contents(dirname(__DIR__) . '/database/phase1-forecast.sql');
if ($sql === false) {
    throw new RuntimeException('Migration SQL not found.');
}

db()->exec($sql);
echo "Phase 1 forecast tables are ready.\n";
