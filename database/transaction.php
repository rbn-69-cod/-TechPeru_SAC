<?php
function atomic(PDO $pdo, callable $work): mixed {
    $pdo->beginTransaction();
    try { $result = $work(); $pdo->commit(); return $result; }
    catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
