<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

const SESSION_COOKIE = 'nines_session';
const SESSION_DAYS = 30;

function request_json(): array
{
    $payload = json_decode((string)file_get_contents('php://input'), true);
    return is_array($payload) ? $payload : [];
}

function auth_user(): ?array
{
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
        return null;
    }

    $stmt = db()->prepare(<<<SQL
SELECT u.id, u.email, u.display_name, u.role
FROM auth_sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = :token_hash
  AND s.expires_at > UTC_TIMESTAMP()
  AND u.is_active = 1
SQL);
    $stmt->execute(['token_hash' => hash('sha256', $token)]);
    $user = $stmt->fetch();

    return $user ?: null;
}

function require_auth(): array
{
    $user = auth_user();
    if ($user === null) {
        http_response_code(401);
        json_response(['error' => 'authentication_required']);
        exit;
    }

    return $user;
}

function require_admin(): array
{
    $user = require_auth();
    if ($user['role'] !== 'admin') {
        http_response_code(403);
        json_response(['error' => 'admin_required']);
        exit;
    }

    return $user;
}

function issue_session(int $userId): void
{
    $token = bin2hex(random_bytes(32));
    $expiresAt = gmdate('Y-m-d H:i:s', time() + SESSION_DAYS * 86400);
    $stmt = db()->prepare('INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)');
    $stmt->execute([
        'user_id' => $userId,
        'token_hash' => hash('sha256', $token),
        'expires_at' => $expiresAt,
    ]);

    setcookie(SESSION_COOKIE, $token, [
        'expires' => time() + SESSION_DAYS * 86400,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function revoke_session(): void
{
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    if (is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token)) {
        $stmt = db()->prepare('DELETE FROM auth_sessions WHERE token_hash = :token_hash');
        $stmt->execute(['token_hash' => hash('sha256', $token)]);
    }

    setcookie(SESSION_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
