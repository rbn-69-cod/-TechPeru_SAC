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

function correctMeasurement(PDO $pdo, array $input, array $user): array
{
    return atomic($pdo, function () use ($pdo, $input, $user): array {
        if (!in_array($user['role'], ['Administrador', 'Gerente', 'Directivo'], true)) {
            throw new HttpException('Solo Administradores o Gerentes pueden corregir mediciones registradas.', 403);
        }
        $id = isset($input['measurement_id'])
            ? integerField($input, 'measurement_id', 0, 1, PHP_INT_MAX)
            : integerField($input, 'id', 0, 1, PHP_INT_MAX);
        $reason = requiredText($input, 'reason', 500);
        if (strlen($reason) < 5) {
            throw new HttpException('El motivo de la corrección debe contener al menos 5 caracteres.', 422);
        }

        $stmt = $pdo->prepare('SELECT * FROM measurements WHERE id = ?');
        $stmt->execute([$id]);
        $orig = $stmt->fetch();
        if (!$orig) {
            throw new HttpException('La medición que deseas corregir no existe.', 404);
        }

        $kpi = findRecord($pdo, 'kpis', $orig['kpi_id']);
        if (!array_key_exists('value', $input)) {
            throw new HttpException('El nuevo valor es obligatorio.', 422);
        }
        $newValue = numberField($input, 'value', 0, $kpi['direction'] === 'menor' ? 0 : -1000000000);
        $newNotes = textField($input, 'notes', $orig['notes'] ?? '', 5000);
        $newPct = compliance((float)$kpi['target'], $newValue, $kpi['direction']);

        // Preservar valor original en previous_value si es la primera corrección
        $stmt = $pdo->prepare('UPDATE measurements SET value = ?, compliance_pct = ?, notes = ?, previous_value = COALESCE(previous_value, ?), corrected_at = CURRENT_TIMESTAMP, correction_reason = ?, corrected_by = ? WHERE id = ?');
        $stmt->execute([$newValue, $newPct, $newNotes, $orig['value'], $reason, $user['name'], $id]);

        // Si es la medición más reciente del KPI, sincronizar catálogo
        $latestStmt = $pdo->prepare('SELECT id, value, compliance_pct FROM measurements WHERE kpi_id = ? ORDER BY date DESC, id DESC LIMIT 1');
        $latestStmt->execute([$kpi['id']]);
        $latest = $latestStmt->fetch();
        if ((string)$latest['id'] === (string)$id) {
            $pdo->prepare('UPDATE kpis SET current_real = ?, compliance_pct = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                ->execute([$newValue, $newPct, complianceStatus($newPct), $kpi['id']]);
        }

        logActivity($pdo, 'MEASUREMENT_CORRECTED', 'KPI', $kpi['id'], "Medición #{$id} ({$orig['period']}) corregida de {$orig['value']} a {$newValue}. Motivo: {$reason}", $user['id'], $user['name']);

        return [
            'measurement_id' => $id,
            'kpi_id' => $kpi['id'],
            'previous_value' => (float)$orig['value'],
            'new_value' => $newValue,
            'compliance_pct' => $newPct,
            'status' => complianceStatus($newPct)
        ];
    });
}
