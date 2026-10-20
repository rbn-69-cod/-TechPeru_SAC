<?php
function findRecord(PDO $pdo, string $table, string $id): array {
    // Table names are supplied exclusively by server code.
    $stmt = $pdo->prepare("SELECT * FROM $table WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: jsonError('Registro no encontrado.', 404);
}

function saveRecord(PDO $pdo, string $table, string $id, array $fields, bool $create): void {
    if ($create) {
        $fields = ['id' => $id] + $fields;
        $sql = 'INSERT INTO ' . $table . ' (' . implode(', ', array_keys($fields)) . ') VALUES (' . implode(', ', array_fill(0, count($fields), '?')) . ')';
        $pdo->prepare($sql)->execute(array_values($fields));
    } else {
        $sql = 'UPDATE ' . $table . ' SET ' . implode(', ', array_map(fn($key) => "$key = ?", array_keys($fields))) . ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        $pdo->prepare($sql)->execute([...array_values($fields), $id]);
    }
}

function logActivity(PDO $pdo, string $action, string $entityType, ?string $entityId, string $details, ?string $userId = null, ?string $userName = null): void {
    if (!$userName && isset($_SESSION['user'])) {
        $userName = $_SESSION['user']['name'];
        $userId = $_SESSION['user']['id'];
    }
    $stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $userName ?: 'Sistema', $action, $entityType, $entityId, $details]);
}


function deleteCatalogRecord(PDO $pdo, string $table, string $id): void
{
    if (!in_array($table, ['objectives', 'kpis', 'initiatives'], true)) {
        throw new InvalidArgumentException('Unsupported catalog');
    }
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
}
