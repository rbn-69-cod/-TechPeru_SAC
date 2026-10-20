<?php
/** Shared write service; read endpoints retain their existing response contracts. */
function mutateCatalog(PDO $pdo, string $table): never {
    allowMethods(['GET', 'POST', 'PUT', 'DELETE']);
    requireManager();
    $method = $_SERVER['REQUEST_METHOD'];
    $input = $method === 'DELETE' ? $_GET : getJsonInput();
    if ($method === 'POST' && $table === 'initiatives' && empty($input['id'])) $input['id'] = 'INI-' . bin2hex(random_bytes(6));
    $id = identifier($input);
    $existing = $method === 'POST' ? [] : findRecord($pdo, $table, $id);
    $data = array_replace($existing, $input);
    if ($method === 'DELETE') {
        atomic($pdo, function () use ($pdo, $table, $id) {
            if ($table === 'objectives') {
                $pdo->prepare('DELETE FROM measurements WHERE kpi_id IN (SELECT id FROM kpis WHERE objective_id = ?)')->execute([$id]);
                $pdo->prepare('UPDATE initiatives SET kpi_id = NULL WHERE kpi_id IN (SELECT id FROM kpis WHERE objective_id = ?)')->execute([$id]);
                $pdo->prepare('DELETE FROM initiatives WHERE objective_id = ?')->execute([$id]);
                $pdo->prepare('DELETE FROM kpis WHERE objective_id = ?')->execute([$id]);
            } elseif ($table === 'kpis') {
                $pdo->prepare('DELETE FROM measurements WHERE kpi_id = ?')->execute([$id]);
                $pdo->prepare('UPDATE initiatives SET kpi_id = NULL WHERE kpi_id = ?')->execute([$id]);
            }
            $pdo->prepare("DELETE FROM $table WHERE id = ?")->execute([$id]);
            logActivity($pdo, 'DELETE', $table, $id, 'Registro eliminado con sus dependencias.');
        });
        jsonResponse(['success' => true, 'message' => 'Registro eliminado.']);
    }
    $fields = ['name' => requiredText($data, 'name')];
    if ($table === 'objectives') {
        $perspective = identifier($data, 'perspective_id');
        findRecord($pdo, 'perspectives', $perspective);
        $fields += ['perspective_id' => $perspective, 'full_name' => "$id: {$fields['name']}",
            'description' => textField($data, 'description', '', 5000), 'leader' => textField($data, 'leader', 'Dirección General'),
            'priority' => enumField($data, 'priority', ['Alta', 'Media', 'Baja'], 'Alta'),
            'weight' => numberField($data, 'weight', 100, 1, 100),
            'status' => enumField($data, 'status', ['Activo', 'Inactivo'], 'Activo')];
    } else {
        $objId = identifier($data, 'objective_id');
        $obj = findRecord($pdo, 'objectives', $objId);
        $fields['objective_id'] = $objId;
        if ($table === 'kpis') {
            $direction = enumField($data, 'direction', ['mayor', 'menor'], 'mayor');
            $target = numberField($data, 'target', 0, $direction === 'mayor' ? 0.000001 : 0);
            $real = numberField($data, 'current_real', 0, $direction === 'menor' ? 0 : -1000000000);
            $pct = compliance($target, $real, $direction);
            $fields += ['perspective_id' => $obj['perspective_id'], 'unit' => requiredText($data, 'unit', 30),
                'target' => $target, 'current_real' => $real, 'direction' => $direction,
                'compliance_pct' => $pct, 'status' => complianceStatus($pct),
                'responsible' => requiredText($data, 'responsible'), 'responsible_area' => requiredText($data, 'responsible_area'),
                'frequency' => enumField($data, 'frequency', ['Mensual', 'Trimestral', 'Semestral', 'Anual'], 'Trimestral'),
                'baseline' => numberField($data, 'baseline'), 'calculation_formula' => textField($data, 'calculation_formula', '', 2000),
                'action_recommended' => textField($data, 'action_recommended', '', 5000)];
        } else {
            $kpiId = textField($data, 'kpi_id') ?: null;
            if ($kpiId && findRecord($pdo, 'kpis', $kpiId)['objective_id'] !== $objId) jsonError('El KPI debe pertenecer al objetivo seleccionado.', 422);
            $start = dateField($data, 'start_date', date('Y-m-d'));
            $end = dateField($data, 'end_date', date('Y-12-31'));
            if ($end < $start) jsonError('La fecha final debe ser igual o posterior al inicio.', 422);
            $fields += ['kpi_id' => $kpiId, 'leader' => requiredText($data, 'leader'), 'budget' => numberField($data, 'budget', 0, 0),
                'progress_pct' => numberField($data, 'progress_pct', 0, 0, 100), 'start_date' => $start, 'end_date' => $end,
                'status' => enumField($data, 'status', ['En ejecución', 'Finalizada', 'Retrasada'], 'En ejecución')];
        }
    }
    atomic($pdo, function () use ($pdo, $table, $id, $fields, $method) {
        if ($table === 'kpis' && $method === 'POST') $fields['num'] = (int)$pdo->query('SELECT COALESCE(MAX(num), 0) + 1 FROM kpis')->fetchColumn();
        if ($table === 'kpis' && $method === 'PUT') {
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM initiatives WHERE kpi_id = ? AND objective_id <> ?');
            $stmt->execute([$id, $fields['objective_id']]);
            if ($stmt->fetchColumn()) { $pdo->rollBack(); jsonError('Reasigna primero las iniciativas vinculadas a este KPI.', 409); }
        }
        saveRecord($pdo, $table, $id, $fields, $method === 'POST');
        if ($table === 'objectives') $pdo->prepare('UPDATE kpis SET perspective_id = ? WHERE objective_id = ?')->execute([$fields['perspective_id'], $id]);
        logActivity($pdo, $method === 'POST' ? 'CREATE' : 'UPDATE', $table, $id, $fields['name']);
    });
    jsonResponse(['success' => true, 'message' => 'Registro guardado.', 'id' => $id] + array_intersect_key($fields, array_flip(['compliance_pct', 'status'])), $method === 'POST' ? 201 : 200);
}
