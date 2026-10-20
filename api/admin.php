<?php
require_once __DIR__ . '/common.php';

requireAdmin();
$pdo = getDB();
allowMethods(($_GET['action'] ?? '') === 'reset' ? ['POST'] : ['GET']);
$action = $_GET['action'] ?? 'users';

if ($action === 'users') {
    $users = $pdo->query("SELECT id, name, email, role, area, created_at FROM users ORDER BY id ASC")->fetchAll();
    jsonResponse(['success' => true, 'users' => $users]);
}

if ($action === 'periods') {
    $periods = $pdo->query("SELECT * FROM evaluation_periods ORDER BY id ASC")->fetchAll();
    jsonResponse(['success' => true, 'periods' => $periods]);
}

if ($action === 'activity') {
    $limit = integerField($_GET, 'limit', 30, 1, 200);
    $stmt = $pdo->prepare("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?");
    $stmt->execute([$limit]);
    jsonResponse(['success' => true, 'logs' => $stmt->fetchAll()]);
}

if ($action === 'reset') {
    if (!$config['demo']) jsonError('La restauración está deshabilitada fuera del modo demo.', 403);
    seedDatabase($pdo);
    jsonResponse([
        'success' => true,
        'message' => 'Base de datos SQLite restaurada con los 12 objetivos, 36 KPIs y responsables oficiales del Excel TechPeru SAC 2025.'
    ]);
}

jsonError("Acción no válida");
