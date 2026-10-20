<?php
function recordMeasurement(PDO $pdo, array $input, array $user): array
{
    return atomic($pdo, function () use ($pdo, $input, $user): array {
        $kpiId = identifier($input, 'kpi_id');
        $kpi = findRecord($pdo, 'kpis', $kpiId);
        if (!canRecordMeasurement($user, $kpi)) {
            throw new HttpException('Solo puedes registrar indicadores asignados a tu nombre.', 403);
        }
        $period = identifier($input, 'period');
        findRecord($pdo, 'evaluation_periods', $period);
        $date = dateField($input, 'date', date('Y-m-d'));
        if (!array_key_exists('value', $input)) {
            throw new HttpException('El valor es obligatorio.', 422);
        }
        $value = numberField($input, 'value', 0, $kpi['direction'] === 'menor' ? 0 : -1000000000);
        $notes = textField($input, 'notes', '', 5000);
        $pct = compliance((float)$kpi['target'], $value, $kpi['direction']);
        $pdo->prepare('INSERT INTO measurements (kpi_id, period, date, value, compliance_pct, notes, registered_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$kpiId, $period, $date, $value, $pct, $notes, $user['name']]);
        $id = $pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT id, value, compliance_pct FROM measurements WHERE kpi_id = ? ORDER BY date DESC, id DESC LIMIT 1');
        $stmt->execute([$kpiId]);
        $latest = $stmt->fetch();
        // Backdated entries must not undo a later catalog recalculation or current result.
        if ((string)$latest['id'] === (string)$id) {
            $pdo->prepare('UPDATE kpis SET current_real = ?, compliance_pct = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                ->execute([$value, $pct, complianceStatus($pct), $kpiId]);
        }
        logActivity($pdo, 'MEASUREMENT_RECORDED', 'KPI', $kpiId, "Período $period: $value ($pct%)", $user['id'], $user['name']);
        return ['measurement_id' => $id, 'compliance_pct' => $pct, 'status' => complianceStatus($pct)];
    });
}
