<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$action = $_GET['action'] ?? 'me';

if ($action === 'me') {
    $user = auth_user();
    json_response(['authenticated' => $user !== null, 'user' => $user]);
    exit;
}

if ($action === 'logout') {
    revoke_session();
    json_response(['authenticated' => false]);
    exit;
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = request_json();
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');
    $stmt = db()->prepare('SELECT id, email, display_name, role, password_hash FROM users WHERE email = :email AND is_active = 1 LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        json_response(['error' => 'invalid_credentials']);
        exit;
    }

    issue_session((int)$user['id']);
    unset($user['password_hash']);
    json_response(['authenticated' => true, 'user' => $user]);
    exit;
}

http_response_code(405);
json_response(['error' => 'method_not_allowed']);
