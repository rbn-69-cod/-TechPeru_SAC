<?php
require_once __DIR__ . '/common.php';

allowMethods(['GET']);
$pdo = getDB();
$action = $_GET['action'] ?? 'summary';

if ($action === 'export_csv') {
    $persp = $_GET['perspective'] ?? null;
    $resp = $_GET['responsible'] ?? null;
    $status = $_GET['status'] ?? null;

    $sql = "
        SELECT p.name as perspective, o.id as obj_id, o.name as obj_name, k.id as kpi_id, k.name as kpi_name,
               k.responsible, k.responsible_area, k.frequency, k.baseline, k.calculation_formula,
               k.unit, k.target, k.current_real, k.compliance_pct, k.status, k.action_recommended
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
    if ($resp) {
        $sql .= " AND k.responsible = ?";
        $params[] = $resp;
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

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=Balanced_Scorecard_TechPeru_2025_Oficial.csv');

    $out = fopen('php://output', 'w');
    // UTF-8 BOM para apertura perfecta en Microsoft Excel
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));

    fputcsv($out, ['BALANCED SCORECARD OFICIAL — TechPeru SAC 2025 (Base de Datos PHP & SQLite)'], ';', '"', '');
    fputcsv($out, [
        'Perspectiva',
        'Objetivo Estratégico',
        'Código KPI',
        'Indicador (KPI)',
        'Responsable',
        'Área / Gerencia',
        'Frecuencia',
        'Línea Base',
        'Unidad',
        'Meta Anual',
        'Real Actual',
        '% Cumplimiento',
        'Estado',
        'Fórmula de Cálculo',
        'Análisis / Acción Recomendada'
    ], ';', '"', '');

    foreach ($kpis as $k) {
        foreach ($k as &$cell) {
            if (is_string($cell) && preg_match('/^[\s]*[=+@\-]/u', $cell)) $cell = "'" . $cell;
        }
        unset($cell);
        fputcsv($out, [
            $k['perspective'],
            "{$k['obj_id']}: {$k['obj_name']}",
            $k['kpi_id'],
            $k['kpi_name'],
            $k['responsible'],
            $k['responsible_area'],
            $k['frequency'],
            $k['baseline'],
            $k['unit'],
            $k['target'],
            $k['current_real'],
            "{$k['compliance_pct']}%",
            $k['status'],
            $k['calculation_formula'],
            $k['action_recommended']
        ], ';', '"', '');
    }

    fclose($out);
    exit;
}

if ($action === 'print_html') {
    $persp = $_GET['perspective'] ?? null;
    $resp = $_GET['responsible'] ?? null;
    $status = $_GET['status'] ?? null;

    $sql = "
        SELECT p.name as perspective, p.color as perspective_color, o.id as obj_id, o.name as obj_name,
               k.id as kpi_id, k.name as kpi_name, k.responsible, k.responsible_area,
               k.unit, k.target, k.current_real, k.compliance_pct, k.status, k.action_recommended
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
    if ($resp) {
        $sql .= " AND k.responsible = ?";
        $params[] = $resp;
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

    $avg = count($kpis) > 0 ? round(array_sum(array_column($kpis, 'compliance_pct')) / count($kpis), 1) : 0;
    header('Content-Type: text/html; charset=utf-8');
    require dirname(__DIR__) . '/views/report.php';
    exit;
}

if ($action === 'summary') {
    $perspectives = $pdo->query("
        SELECT p.id, p.name, p.title, p.color,
               COUNT(k.id) as kpi_count,
               ROUND(AVG(k.compliance_pct), 1) as avg_compliance
        FROM perspectives p
        LEFT JOIN kpis k ON p.id = k.perspective_id
        GROUP BY p.id
        ORDER BY p.order_num ASC
    ")->fetchAll();

    $critical = $pdo->query("
        SELECT k.*, o.name as objective_name, p.name as perspective_name
        FROM kpis k
        JOIN objectives o ON k.objective_id = o.id
        JOIN perspectives p ON k.perspective_id = p.id
        WHERE k.compliance_pct < 75.0
        ORDER BY k.compliance_pct ASC
    ")->fetchAll();

    $initiatives = $pdo->query("
        SELECT status, COUNT(*) as count, ROUND(AVG(progress_pct), 1) as avg_progress, SUM(budget) as total_budget
        FROM initiatives
        GROUP BY status
    ")->fetchAll();

    $responsiblePerformance = $pdo->query("
        SELECT responsible, responsible_area, COUNT(id) as total_kpis, ROUND(AVG(compliance_pct), 1) as avg_compliance
        FROM kpis
        GROUP BY responsible, responsible_area
        ORDER BY avg_compliance ASC
    ")->fetchAll();

    jsonResponse([
        'success' => true,
        'perspectives' => $perspectives,
        'critical_kpis' => $critical,
        'initiatives_summary' => $initiatives,
        'responsible_ranking' => $responsiblePerformance
    ]);
}

jsonError("Acción de reporte no válida");
