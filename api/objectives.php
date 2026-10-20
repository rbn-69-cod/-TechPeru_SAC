<?php
require_once __DIR__ . '/common.php';

allowMethods(['GET', 'POST', 'PUT', 'DELETE']);
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $pdo->prepare("
            SELECT o.*, p.name as perspective_name, p.color as perspective_color, p.icon as perspective_icon
            FROM objectives o
            JOIN perspectives p ON o.perspective_id = p.id
            WHERE o.id = ?
        ");
        $stmt->execute([$id]);
        $obj = $stmt->fetch();
        if (!$obj) jsonError("Objetivo no encontrado", 404);

        $kpisStmt = $pdo->prepare("SELECT * FROM kpis WHERE objective_id = ? ORDER BY num ASC");
        $kpisStmt->execute([$id]);
        $obj['kpis'] = $kpisStmt->fetchAll();

        jsonResponse(['success' => true, 'objective' => $obj]);
    }

    $persp = $_GET['perspective'] ?? null;
    $sql = "
        SELECT o.*, p.name as perspective_name, p.color as perspective_color, p.icon as perspective_icon
        FROM objectives o
        JOIN perspectives p ON o.perspective_id = p.id
    ";
    $params = [];
    if ($persp) {
        $sql .= " WHERE o.perspective_id = ?";
        $params[] = $persp;
    }
    $sql .= " ORDER BY p.order_num ASC, o.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $objs = $stmt->fetchAll();

    $stats = [];
    foreach ($pdo->query('SELECT objective_id, COUNT(*) AS total, ROUND(AVG(compliance_pct), 1) AS average FROM kpis GROUP BY objective_id') as $row) {
        $stats[$row['objective_id']] = $row;
    }
    foreach ($objs as &$objective) {
        $objective['kpi_count'] = (int)($stats[$objective['id']]['total'] ?? 0);
        $objective['avg_pct'] = (float)($stats[$objective['id']]['average'] ?? 0);
        $objective['status_key'] = complianceKey($objective['avg_pct']);
    }
    unset($objective);

    jsonResponse(['success' => true, 'objectives' => $objs]);
}

require_once dirname(__DIR__) . '/services/catalog.php';
requireManager();
$input = $method === 'DELETE' ? $_GET : getJsonInput();
$result = mutateCatalog($pdo, 'objectives', $method, $input);
jsonResponse($result, $method === 'POST' ? 201 : 200);
