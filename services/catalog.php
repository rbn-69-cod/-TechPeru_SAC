<?php
require_once dirname(__DIR__) . '/validators/catalog.php';

/** Read, validate, mutate and audit in one transaction; HTTP remains in api/. */
function mutateCatalog(PDO $pdo, string $table, string $method, array $input): array
{
    return atomic($pdo, function () use ($pdo, $table, $method, $input): array {
        if ($method === 'POST' && $table === 'initiatives' && !isset($input['id'])) {
            $input['id'] = 'INI-' . bin2hex(random_bytes(6));
        }
        $id = identifier($input);
        $existing = $method === 'POST' ? [] : findRecord($pdo, $table, $id);
        if ($method === 'DELETE') {
            deleteCatalogRecord($pdo, $table, $id);
            logActivity($pdo, 'DELETE', $table, $id, 'Registro eliminado con sus dependencias.');
            return ['success' => true, 'message' => 'Registro eliminado.'];
        }

        foreach (['description', 'leader', 'calculation_formula', 'action_recommended'] as $nullableText) {
            if (array_key_exists($nullableText, $existing) && $existing[$nullableText] === null) $existing[$nullableText] = '';
        }
        $fields = catalogFields($pdo, $table, $id, array_replace($existing, $input));
        if ($table === 'kpis' && $method === 'POST') {
            $fields['num'] = (int)$pdo->query('SELECT COALESCE(MAX(num), 0) + 1 FROM kpis')->fetchColumn();
        }
        if ($table === 'kpis' && $method === 'PUT') {
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM initiatives WHERE kpi_id = ? AND objective_id <> ?');
            $stmt->execute([$id, $fields['objective_id']]);
            if ($stmt->fetchColumn()) {
                throw new HttpException('Reasigna primero las iniciativas vinculadas a este KPI.', 409);
            }
        }
        saveRecord($pdo, $table, $id, $fields, $method === 'POST');
        logActivity($pdo, $method === 'POST' ? 'CREATE' : 'UPDATE', $table, $id, $fields['name']);
        return ['success' => true, 'message' => 'Registro guardado.', 'id' => $id]
            + array_intersect_key($fields, array_flip(['compliance_pct', 'status']));
    });
}
