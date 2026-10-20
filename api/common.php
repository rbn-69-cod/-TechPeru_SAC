<?php
require_once dirname(__DIR__) . '/helpers/http.php';
require_once dirname(__DIR__) . '/middleware/auth.php';
require_once dirname(__DIR__) . '/database/db.php';
require_once dirname(__DIR__) . '/validators/input.php';
require_once dirname(__DIR__) . '/repositories/records.php';
require_once dirname(__DIR__) . '/services/scorecard.php';
$config = require dirname(__DIR__) . '/config/app.php';
date_default_timezone_set('America/Lima');
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $error): void {
    if ($error instanceof HttpException) {
        jsonResponse(['success' => false, 'error' => $error->getMessage()], $error->status);
    }
    error_log((string)$error);
    $sqliteCode = $error instanceof PDOException ? (int)($error->errorInfo[1] ?? 0) : 0;
    if (in_array($sqliteCode, [5, 6], true)) {
        header('Retry-After: 1');
        jsonResponse(['success' => false, 'error' => 'La base de datos está ocupada. Reintenta en un momento.'], 503);
    }
    $conflict = $error instanceof PDOException && ($error->getCode() === '23000' || $sqliteCode === 19);
    jsonResponse(['success' => false, 'error' => $conflict
        ? 'El código ya existe o hay registros relacionados que impiden esta operación.'
        : 'No se pudo completar la operación. Inténtalo nuevamente.'], $conflict ? 409 : 500);
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
// All public entry points pass through the same authentication and CSRF checks.
if (basename($_SERVER['SCRIPT_NAME']) !== 'auth.php') {
    requireAuth();
    if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) requireCsrf();
}

// PHP query arrays must never reach SQL parameters or string comparisons.
foreach ($_GET as $value) {
    if (!is_string($value) || strlen($value) > 5000) {
        jsonError('Parámetro de consulta inválido.', 422);
    }
}
