<?php
function compliance(float $target, float $value, string $direction): float {
    if ($direction === 'menor') return $value <= 0 ? 100.0 : round($target / $value * 100, 1);
    return round($value / $target * 100, 1);
}
function complianceStatus(float $pct): string {
    return $pct >= 90 ? '✅ LOGRADO' : ($pct >= 75 ? '⚠️ EN RIESGO' : '❌ CRÍTICO');
}
function atomic(PDO $pdo, callable $work): mixed {
    $pdo->beginTransaction();
    try { $result = $work(); $pdo->commit(); return $result; }
    catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
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
