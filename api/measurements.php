<?php
require_once __DIR__ . '/common.php';
allowMethods(['GET', 'POST']);
$pdo = getDB();
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = (int)numberField($_GET, 'limit', 100, 1, 500);
    $offset = (int)numberField($_GET, 'offset', 0, 0, 1000000);
    $where = isset($_GET['kpi_id']) ? ' WHERE m.kpi_id = ?' : '';
    $params = isset($_GET['kpi_id']) ? [identifier($_GET, 'kpi_id')] : [];
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM measurements m' . $where);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();
    $stmt = $pdo->prepare('SELECT m.*, k.name AS kpi_name, k.unit AS kpi_unit, k.target AS kpi_target, k.responsible, k.responsible_area FROM measurements m JOIN kpis k ON m.kpi_id = k.id' . $where . " ORDER BY m.date DESC, m.id DESC LIMIT $limit OFFSET $offset");
    $stmt->execute($params);
    jsonResponse(['success' => true, 'measurements' => $stmt->fetchAll(), 'total' => $total, 'limit' => $limit, 'offset' => $offset]);
}
$input = getJsonInput();
$kpiId = identifier($input, 'kpi_id');
$kpi = findRecord($pdo, 'kpis', $kpiId);
$user = requireAuth();
if (!in_array($user['role'], ['Administrador', 'Gerente', 'Responsable de indicadores'], true) && $user['name'] !== $kpi['responsible']) jsonError('Solo puedes registrar indicadores asignados a tu nombre.', 403);
$period = identifier($input, 'period');
findRecord($pdo, 'evaluation_periods', $period);
$date = dateField($input, 'date', date('Y-m-d'));
if (!array_key_exists('value', $input)) jsonError('El valor es obligatorio.', 422);
$value = numberField($input, 'value', 0, $kpi['direction'] === 'menor' ? 0 : -1000000000);
$notes = textField($input, 'notes', '', 5000);
$result = atomic($pdo, function () use ($pdo, $kpiId, $period, $date, $value, $notes, $user) {
    $kpi = findRecord($pdo, 'kpis', $kpiId);
    $pct = compliance((float)$kpi['target'], $value, $kpi['direction']);
    $pdo->prepare('INSERT INTO measurements (kpi_id, period, date, value, compliance_pct, notes, registered_by) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$kpiId, $period, $date, $value, $pct, $notes, $user['name']]);
    $id = $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT value, compliance_pct FROM measurements WHERE kpi_id = ? ORDER BY date DESC, id DESC LIMIT 1');
    $stmt->execute([$kpiId]);
    $latest = $stmt->fetch();
    $pdo->prepare('UPDATE kpis SET current_real = ?, compliance_pct = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$latest['value'], $latest['compliance_pct'], complianceStatus($latest['compliance_pct']), $kpiId]);
    logActivity($pdo, 'MEASUREMENT_RECORDED', 'KPI', $kpiId, "Período $period: $value ($pct%)");
    return ['measurement_id' => $id, 'compliance_pct' => $pct, 'status' => complianceStatus($pct)];
});
jsonResponse(['success' => true, 'message' => 'Medición registrada.'] + $result, 201);
