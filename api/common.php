<?php
require_once dirname(__DIR__) . '/database/db.php';
require_once dirname(__DIR__) . '/services/validation.php';
require_once dirname(__DIR__) . '/services/scorecard.php';
$config = require dirname(__DIR__) . '/config/app.php';
date_default_timezone_set('America/Lima');
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e): void {
    error_log((string)$e);
    $conflict = $e instanceof PDOException && ($e->getCode() === '23000' || str_contains($e->getMessage(), 'constraint'));
    jsonError($conflict ? 'El código ya existe o hay registros relacionados que impiden esta operación.' : 'No se pudo completar la operación. Inténtalo nuevamente.', $conflict ? 409 : 500);
});
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params(['httponly' => true, 'secure' => $config['secure_cookie'] || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'), 'samesite' => 'Lax', 'path' => '/']);
    session_start();
}
function jsonResponse(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function jsonError(string $message, int $status = 400): never {
    jsonResponse(['success' => false, 'error' => $message], $status);
}
function getJsonInput(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536) jsonError('Solicitud demasiado grande.', 413);
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if (strlen($raw) > 65536) jsonError('Solicitud demasiado grande.', 413);
    try { $input = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { jsonError('Se requiere un objeto JSON válido.', 400); }
    if (!$input instanceof stdClass) jsonError('Se requiere un objeto JSON.', 400);
    return (array)$input;
}
function getCurrentUser(): ?array {
    if (!isset($_SESSION['user']['id'])) return null;
    if (time() - ($_SESSION['last_seen'] ?? 0) > 1800) { unset($_SESSION['user']); return null; }
    $stmt = getDB()->prepare('SELECT id, name, email, role, area FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user']['id']]);
    $user = $stmt->fetch() ?: null;
    $_SESSION['last_seen'] = time();
    $_SESSION['user'] = $user;
    return $user;
}
function requireAuth(): array {
    return getCurrentUser() ?? jsonError('Inicia sesión para continuar.', 401);
}
function requireManager(): void {
    if (!in_array(requireAuth()['role'], ['Administrador', 'Gerente'], true)) jsonError('No tienes permiso para modificar la configuración estratégica.', 403);
}
function requireAdmin(): void {
    if (requireAuth()['role'] !== 'Administrador') jsonError('Solo el administrador puede realizar esta operación.', 403);
}
function allowMethods(array $methods): void {
    if (!in_array($_SERVER['REQUEST_METHOD'], $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        jsonError('Método no permitido.', 405);
    }
}
function csrfToken(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function requireCsrf(): void {
    if (!hash_equals(csrfToken(), $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) jsonError('Token de seguridad inválido. Recarga la página.', 403);
}
// All public entry points pass through the same authentication and CSRF checks.
if (basename($_SERVER['SCRIPT_NAME']) !== 'auth.php') {
    requireAuth();
    if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) requireCsrf();
}
