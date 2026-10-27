<?php
require_once __DIR__ . '/common.php';
allowMethods(['GET', 'POST']);
$pdo = getDB();
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = integerField($_GET, 'limit', 100, 1, 500);
    $offset = integerField($_GET, 'offset', 0, 0, 1000000);
    $where = isset($_GET['kpi_id']) ? ' WHERE m.kpi_id = ?' : '';
    $params = isset($_GET['kpi_id']) ? [identifier($_GET, 'kpi_id')] : [];
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM measurements m' . $where);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();
    $stmt = $pdo->prepare('SELECT m.*, k.name AS kpi_name, k.unit AS kpi_unit, k.target AS kpi_target, k.responsible, k.responsible_area FROM measurements m JOIN kpis k ON m.kpi_id = k.id' . $where . " ORDER BY m.date DESC, m.id DESC LIMIT $limit OFFSET $offset");
    $stmt->execute($params);
    jsonResponse(['success' => true, 'measurements' => $stmt->fetchAll(), 'total' => $total, 'limit' => $limit, 'offset' => $offset]);
}
require_once dirname(__DIR__) . '/services/measurements.php';
$action = $_GET['action'] ?? 'record';

if ($action === 'correct') {
    requireCsrf();
    $result = correctMeasurement($pdo, getJsonInput(), requireAuth());
    jsonResponse(['success' => true, 'message' => 'Medición corregida exitosamente y registrada en auditoría.'] + $result, 200);
}

$result = recordMeasurement($pdo, getJsonInput(), requireAuth());
jsonResponse(['success' => true, 'message' => 'Medición registrada.'] + $result, 201);
