<?php

declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        http_response_code(500);
        throw new RuntimeException('Missing api/config.php. Copy config.example.php and set database credentials.');
    }

    $config = require $configPath;
    $db = $config['db'];
    $port = $db['port'] ?? null;
    $socket = $db['socket'] ?? null;
    $dsn = $socket
        ? sprintf('mysql:unix_socket=%s;dbname=%s;charset=%s', $socket, $db['name'], $db['charset'])
        : sprintf(
            'mysql:host=%s%s;dbname=%s;charset=%s',
            $db['host'],
            $port ? ';port=' . (int)$port : '',
            $db['name'],
            $db['charset']
        );

    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function json_response(array $payload): void
{
    ini_set('serialize_precision', '-1');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
