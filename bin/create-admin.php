<?php
if (PHP_SAPI !== 'cli') exit;
require_once dirname(__DIR__) . '/database/db.php';
$email = getenv('ADMIN_EMAIL');
$password = getenv('ADMIN_PASSWORD');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password ?: '') < 12) {
    fwrite(STDERR, "Define ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres).\n"); exit(1);
}
$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO users (id, name, email, role, area, password) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute(['u-' . bin2hex(random_bytes(8)), 'Administrador', strtolower($email), 'Administrador', 'Dirección General', password_hash($password, PASSWORD_DEFAULT)]);
echo "Administrador creado.\n";
