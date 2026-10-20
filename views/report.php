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
