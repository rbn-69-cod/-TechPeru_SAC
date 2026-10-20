<?php
require_once __DIR__ . '/common.php';

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

    // Agregar estadísticas de KPIs a cada objetivo
    $allKpis = $pdo->query("SELECT id, objective_id, compliance_pct, status FROM kpis")->fetchAll();
    foreach ($objs as &$o) {
        $oKpis = array_filter($allKpis, fn($k) => $k['objective_id'] === $o['id']);
        $count = count($oKpis);
        $sum = array_reduce($oKpis, fn($a, $b) => $a + (float)$b['compliance_pct'], 0);
        $avg = $count > 0 ? round($sum / $count, 1) : 0;
        $o['kpi_count'] = $count;
        $o['avg_pct'] = $avg;
        $o['status_key'] = $avg >= 90.0 ? 'good' : ($avg >= 75.0 ? 'warn' : 'bad');
    }

    jsonResponse(['success' => true, 'objectives' => $objs]);
}

require_once dirname(__DIR__) . '/services/catalog.php';
mutateCatalog($pdo, 'objectives');
