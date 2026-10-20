<?php
require_once __DIR__ . '/common.php';

allowMethods(['GET', 'POST', 'PUT', 'DELETE']);
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $pdo->prepare("
            SELECT k.*, o.name as objective_name, o.full_name as objective_full_name, p.name as perspective_name
            FROM kpis k
            JOIN objectives o ON k.objective_id = o.id
            JOIN perspectives p ON k.perspective_id = p.id
            WHERE k.id = ?
        ");
        $stmt->execute([$id]);
        $kpi = $stmt->fetch();
        if (!$kpi) jsonError("KPI no encontrado", 404);

        $mStmt = $pdo->prepare("SELECT * FROM measurements WHERE kpi_id = ? ORDER BY date DESC, id DESC");
        $mStmt->execute([$id]);
        $kpi['measurements'] = $mStmt->fetchAll();

        jsonResponse(['success' => true, 'kpi' => $kpi]);
    }

    $persp = $_GET['perspective'] ?? null;
    $objId = $_GET['objective_id'] ?? null;
    $status = $_GET['status'] ?? null;
    $search = $_GET['q'] ?? null;
    $responsible = $_GET['responsible'] ?? null;
    $area = $_GET['area'] ?? null;

    $sql = "
        SELECT k.*, o.name as objective_name, o.full_name as objective_full_name, p.name as perspective_name, p.color as perspective_color
        FROM kpis k
        JOIN objectives o ON k.objective_id = o.id
        JOIN perspectives p ON k.perspective_id = p.id
        WHERE 1=1
    ";
    $params = [];

    if ($persp) {
        $sql .= " AND k.perspective_id = ?";
        $params[] = $persp;
    }
    if ($objId) {
        $sql .= " AND k.objective_id = ?";
        $params[] = $objId;
    }
    if ($responsible) {
        $sql .= " AND k.responsible = ?";
        $params[] = $responsible;
    }
    if ($area) {
        $sql .= " AND k.responsible_area = ?";
        $params[] = $area;
    }
    if ($search) {
        $sql .= " AND (k.name LIKE ? OR k.id LIKE ? OR k.responsible LIKE ? OR k.action_recommended LIKE ?)";
        $term = "%$search%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    $sql .= " ORDER BY p.order_num ASC, k.num ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $kpis = $stmt->fetchAll();

    if ($status) {
        $kpis = array_values(array_filter($kpis, function($k) use ($status) {
            $pct = (float)$k['compliance_pct'];
            if ($status === 'good') return $pct >= 90.0;
            if ($status === 'warn') return $pct >= 75.0 && $pct < 90.0;
            if ($status === 'bad') return $pct < 75.0;
            return true;
        }));
    }

    // Obtener lista de responsables para filtros
    $responsibles = $pdo->query("SELECT DISTINCT responsible, responsible_area FROM kpis ORDER BY responsible ASC")->fetchAll();

    jsonResponse([
        'success' => true,
        'kpis' => $kpis,
        'responsibles' => $responsibles
    ]);
}

require_once dirname(__DIR__) . '/services/catalog.php';
requireManager();
$input = $method === 'DELETE' ? $_GET : getJsonInput();
$result = mutateCatalog($pdo, 'kpis', $method, $input);
jsonResponse($result, $method === 'POST' ? 201 : 200);
