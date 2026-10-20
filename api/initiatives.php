<?php
require_once __DIR__ . '/common.php';

allowMethods(['GET', 'POST', 'PUT', 'DELETE']);
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $pdo->prepare("
            SELECT i.*, o.name as objective_name, o.full_name as objective_full_name, k.name as kpi_name
            FROM initiatives i
            JOIN objectives o ON i.objective_id = o.id
            LEFT JOIN kpis k ON i.kpi_id = k.id
            WHERE i.id = ?
        ");
        $stmt->execute([$id]);
        $init = $stmt->fetch();
        if (!$init) jsonError("Iniciativa no encontrada", 404);
        jsonResponse(['success' => true, 'initiative' => $init]);
    }

    $objId = $_GET['objective_id'] ?? null;
    $status = $_GET['status'] ?? null;

    $sql = "
        SELECT i.*, o.name as objective_name, o.full_name as objective_full_name, o.perspective_id, k.name as kpi_name
        FROM initiatives i
        JOIN objectives o ON i.objective_id = o.id
        LEFT JOIN kpis k ON i.kpi_id = k.id
        WHERE 1=1
    ";
    $params = [];
    if ($objId) {
        $sql .= " AND i.objective_id = ?";
        $params[] = $objId;
    }
    if ($status) {
        $sql .= " AND i.status = ?";
        $params[] = $status;
    }
    $sql .= " ORDER BY i.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $initiatives = $stmt->fetchAll();

    jsonResponse(['success' => true, 'initiatives' => $initiatives]);
}

require_once dirname(__DIR__) . '/services/catalog.php';
requireManager();
$input = $method === 'DELETE' ? $_GET : getJsonInput();
$result = mutateCatalog($pdo, 'initiatives', $method, $input);
jsonResponse($result, $method === 'POST' ? 201 : 200);
