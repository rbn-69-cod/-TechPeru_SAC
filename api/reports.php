<?php
require_once __DIR__ . '/common.php';

allowMethods(['GET']);
$pdo = getDB();
$action = $_GET['action'] ?? 'summary';

if ($action === 'export_csv') {
    $kpis = $pdo->query("
        SELECT p.name as perspective, o.id as obj_id, o.name as obj_name, k.id as kpi_id, k.name as kpi_name,
               k.responsible, k.responsible_area, k.frequency, k.baseline, k.calculation_formula,
               k.unit, k.target, k.current_real, k.compliance_pct, k.status, k.action_recommended
        FROM kpis k
        JOIN objectives o ON k.objective_id = o.id
        JOIN perspectives p ON k.perspective_id = p.id
        ORDER BY p.order_num ASC, k.num ASC
    ")->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=Balanced_Scorecard_TechPeru_2025_Oficial.csv');

    $out = fopen('php://output', 'w');
    // UTF-8 BOM para apertura perfecta en Microsoft Excel
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));

    fputcsv($out, ['BALANCED SCORECARD OFICIAL — TechPeru SAC 2025 (Base de Datos PHP & SQLite)'], ';', '"', "\\");
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
    ], ';', '"', "\\");

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
        ], ';', '"', "\\");
    }

    fclose($out);
    exit;
}

if ($action === 'print_html') {
    $kpis = $pdo->query("
        SELECT p.name as perspective, p.color as perspective_color, o.id as obj_id, o.name as obj_name,
               k.id as kpi_id, k.name as kpi_name, k.responsible, k.responsible_area,
               k.unit, k.target, k.current_real, k.compliance_pct, k.status, k.action_recommended
        FROM kpis k
        JOIN objectives o ON k.objective_id = o.id
        JOIN perspectives p ON k.perspective_id = p.id
        ORDER BY p.order_num ASC, k.num ASC
    ")->fetchAll();

    $avg = round(array_sum(array_column($kpis, 'compliance_pct')) / max(1, count($kpis)), 1);
    ?>
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Informe Ejecutivo Balanced Scorecard 2025 — TechPeru SAC</title>
      <style>
        body { font-family: Segoe UI, Arial, sans-serif; margin: 30px; font-size: 11px; color: #1e293b; }
        .header { border-bottom: 2px solid #1f3864; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        h1 { margin: 0; color: #1f3864; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #1f3864; color: #fff; padding: 7px; font-size: 10px; border: 1px solid #cbd5e1; text-align: left; }
        td { padding: 6px 7px; border: 1px solid #cbd5e1; font-size: 10px; }
        .badge { font-weight: bold; padding: 2px 5px; border-radius: 3px; font-size: 9px; }
        .badge-logrado { background: #dcfce7; color: #166534; }
        .badge-riesgo { background: #fef9c3; color: #854d0e; }
        .badge-critico { background: #fee2e2; color: #991b1b; }
        .signatures { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
        .sign-line { width: 200px; border-top: 1px solid #000; padding-top: 5px; font-size: 11px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:15px">
        <button onclick="window.print()" style="padding:8px 16px;background:#1f3864;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold">🖨️ Imprimir este Informe</button>
      </div>
      <div class="header">
        <div>
          <h1>TechPeru SAC — Cuadro de Mando Integral (Balanced Scorecard 2025)</h1>
          <p style="margin:4px 0 0;color:#64748b">Reporte Oficial de Cumplimiento Estratégico · Generado el <?= date('d/m/Y H:i') ?></p>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:bold;color:#1f3864">Cumplimiento Global: <?= $avg ?>%</div>
          <small><?= count($kpis) ?> Indicadores Evaluados</small>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Perspectiva</th>
            <th>Objetivo</th>
            <th>KPI</th>
            <th>Responsable</th>
            <th>Área</th>
            <th>Meta</th>
            <th>Real</th>
            <th>% Cumpl.</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($kpis as $k):
            $sKey = $k['compliance_pct'] >= 90 ? 'logrado' : ($k['compliance_pct'] >= 75 ? 'riesgo' : 'critico');
          ?>
            <tr>
              <td><strong><?= htmlspecialchars($k['perspective']) ?></strong></td>
              <td><?= htmlspecialchars($k['obj_id']) ?>: <?= htmlspecialchars($k['obj_name']) ?></td>
              <td><strong><?= htmlspecialchars($k['kpi_name']) ?></strong></td>
              <td><?= htmlspecialchars($k['responsible']) ?></td>
              <td><?= htmlspecialchars($k['responsible_area']) ?></td>
              <td style="text-align:right"><?= number_format($k['target'], 1) ?> <?= htmlspecialchars($k['unit']) ?></td>
              <td style="text-align:right"><strong><?= number_format($k['current_real'], 1) ?></strong></td>
              <td style="text-align:right"><strong><?= number_format($k['compliance_pct'], 1) ?>%</strong></td>
              <td><span class="badge badge-<?= $sKey ?>"><?= htmlspecialchars($k['status']) ?></span></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      <div class="signatures">
        <div class="sign-line">Gerencia General<br>TechPeru SAC</div>
        <div class="sign-line">Gerencia de Finanzas & Control<br>TechPeru SAC</div>
        <div class="sign-line">Responsable de Estrategia<br>TechPeru SAC</div>
      </div>
    </body>
    </html>
    <?php
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
