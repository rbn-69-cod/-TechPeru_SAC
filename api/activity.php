<?php
require_once __DIR__ . '/common.php';

requireAdmin();
allowMethods(['GET']);
$pdo = getDB();
$limit = integerField($_GET, 'limit', 50, 1, 200);

$stmt = $pdo->prepare("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?");
$stmt->execute([$limit]);
$logs = $stmt->fetchAll();

jsonResponse([
    'success' => true,
    'total' => count($logs),
    'logs' => $logs
]);
