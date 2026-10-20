<?php
function getCurrentUser(): ?array {
    if (!isset($_SESSION['user']['id'])) return null;
    $config = require dirname(__DIR__) . '/config/app.php';
    if (time() - ($_SESSION['last_seen'] ?? 0) > $config['session_ttl']) { unset($_SESSION['user']); return null; }
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
function csrfToken(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function requireCsrf(): void {
    if (!hash_equals(csrfToken(), $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) jsonError('Token de seguridad inválido. Recarga la página.', 403);
}

function canRecordMeasurement(array $user, array $kpi): bool
{
    return in_array($user['role'], ['Administrador', 'Gerente', 'Responsable de indicadores'], true)
        || $user['name'] === $kpi['responsible'];
}
