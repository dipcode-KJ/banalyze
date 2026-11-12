<?php

declare(strict_types=1);

require dirname(__DIR__) . '/api/db.php';

[$script, $email, $displayName, $password, $role] = array_pad($argv, 5, null);
$role = $role ?: 'member';

if (!$email || !$displayName || !$password || !in_array($role, ['admin', 'member'], true)) {
    fwrite(STDERR, "Usage: php cron/create-user.php email display-name password [admin|member]\n");
    exit(1);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) {
    throw new InvalidArgumentException('Use a valid email and a password of at least 12 characters.');
}

$stmt = db()->prepare(<<<SQL
INSERT INTO users (email, display_name, password_hash, role)
VALUES (:email, :display_name, :password_hash, :role)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  is_active = 1
SQL);
$stmt->execute([
    'email' => strtolower($email),
    'display_name' => $displayName,
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    'role' => $role,
]);

echo "User issued: {$email} ({$role})\n";
