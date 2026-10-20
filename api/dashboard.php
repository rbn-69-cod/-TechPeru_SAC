<?php
require_once __DIR__ . '/common.php';

allowMethods(['GET']);
$pdo = getDB();

$filterResp = $_GET['responsible'] ?? null;
$filterArea = $_GET['area'] ?? null;

// 1. Obtener todas las perspectivas ordenadas
$perspectives = $pdo->query("SELECT * FROM perspectives ORDER BY order_num ASC")->fetchAll();

// 2. Obtener todos los KPIs
$sqlKpis = "
    SELECT k.*, o.name as objective_name, o.full_name as objective_full_name, p.name as perspective_name, p.icon as perspective_icon
    FROM kpis k
    JOIN objectives o ON k.objective_id = o.id
    JOIN perspectives p ON k.perspective_id = p.id
    WHERE 1=1
";
$paramsKpis = [];

if ($filterResp) {
    $sqlKpis .= " AND k.responsible = ?";
    $paramsKpis[] = $filterResp;
}
if ($filterArea) {
    $sqlKpis .= " AND k.responsible_area = ?";
    $paramsKpis[] = $filterArea;
}

$sqlKpis .= " ORDER BY p.order_num ASC, k.num ASC";
$stmtKpis = $pdo->prepare($sqlKpis);
$stmtKpis->execute($paramsKpis);
$kpis = $stmtKpis->fetchAll();

// 3. Cálculos globales
$totalKpis = count($kpis);
$sumPct = 0;
$logrado = 0;
$riesgo = 0;
$critico = 0;

foreach ($kpis as $k) {
    $pct = (float)$k['compliance_pct'];
    $sumPct += $pct;
    if ($pct >= 90.0) {
        $logrado++;
    } elseif ($pct >= 75.0) {
        $riesgo++;
    } else {
        $critico++;
    }
}

$avgPct = $totalKpis > 0 ? round($sumPct / $totalKpis, 1) : 0;
$globalStatusText = $avgPct >= 90.0 ? "LOGRADO" : ($avgPct >= 75.0 ? "EN RIESGO" : "CRÍTICO");
$globalStatusKey = $avgPct >= 90.0 ? "good" : ($avgPct >= 75.0 ? "warn" : "bad");

// 4. Agrupación por perspectiva
$perspectiveData = [];
foreach ($perspectives as $p) {
    $pKpis = array_filter($kpis, fn($k) => $k['perspective_id'] === $p['id']);
    $pSum = array_reduce($pKpis, fn($acc, $k) => $acc + (float)$k['compliance_pct'], 0);
    $pCount = count($pKpis);
    $pAvg = $pCount > 0 ? round($pSum / $pCount, 1) : 0;

    $perspectiveData[] = [
        'id' => $p['id'],
        'code' => $p['code'],
        'name' => $p['name'],
        'title' => $p['title'],
        'color' => $p['color'],
        'soft_color' => $p['soft_color'],
        'icon' => $p['icon'],
        'count' => $pCount,
        'avg_pct' => $pAvg,
        'kpis' => array_values($pKpis)
    ];
}

// 5. KPIs críticos
$criticalKpis = array_values(array_filter($kpis, fn($k) => (float)$k['compliance_pct'] < 75.0));

// 6. Resumen de objetivos
$objectives = $pdo->query("
    SELECT o.*, p.name as perspective_name, p.color as perspective_color
    FROM objectives o
    JOIN perspectives p ON o.perspective_id = p.id
    ORDER BY p.order_num ASC, o.id ASC
")->fetchAll();

$objData = [];
foreach ($objectives as $obj) {
    $oKpis = array_filter($kpis, fn($k) => $k['objective_id'] === $obj['id']);
    $oSum = array_reduce($oKpis, fn($acc, $k) => $acc + (float)$k['compliance_pct'], 0);
    $oCount = count($oKpis);
    $oAvg = $oCount > 0 ? round($oSum / $oCount, 1) : 0;

    $obj['kpi_count'] = $oCount;
    $obj['avg_pct'] = $oAvg;
    $obj['status_key'] = $oAvg >= 90.0 ? 'good' : ($oAvg >= 75.0 ? 'warn' : 'bad');
    $objData[] = $obj;
}

// 7. Tendencia mensual histórica
$trendSql = 'SELECT m.period, m.date, ROUND(AVG(m.compliance_pct), 1) as avg_pct FROM measurements m JOIN kpis k ON m.kpi_id = k.id WHERE 1=1';
$trendParams = [];
if ($filterResp) { $trendSql .= ' AND k.responsible = ?'; $trendParams[] = $filterResp; }
if ($filterArea) { $trendSql .= ' AND k.responsible_area = ?'; $trendParams[] = $filterArea; }
$stmt = $pdo->prepare($trendSql . ' GROUP BY m.period, m.date ORDER BY m.date ASC');
$stmt->execute($trendParams);
$trend = $stmt->fetchAll();

// 8. Lista de responsables y áreas únicas para filtros
$responsibles = $pdo->query("SELECT DISTINCT responsible, responsible_area FROM kpis ORDER BY responsible ASC")->fetchAll();
$areas = $pdo->query("SELECT DISTINCT responsible_area FROM kpis ORDER BY responsible_area ASC")->fetchAll();

jsonResponse([
    'success' => true,
    'global' => [
        'avg_pct' => $avgPct,
        'status_text' => $globalStatusText,
        'status_key' => $globalStatusKey,
        'logrado' => $logrado,
        'riesgo' => $riesgo,
        'critico' => $critico,
        'total' => $totalKpis
    ],
    'perspectives' => $perspectiveData,
    'critical_kpis' => $criticalKpis,
    'objectives' => $objData,
    'trend' => $trend,
    'responsibles' => $responsibles,
    'areas' => array_column($areas, 'responsible_area'),
    'all_kpis' => $kpis
]);
