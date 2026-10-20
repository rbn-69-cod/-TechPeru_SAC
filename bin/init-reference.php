<?php
if (PHP_SAPI !== 'cli') exit;
require_once dirname(__DIR__) . '/database/db.php';
$pdo = getDB();
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO perspectives (id, code, name, title, color, soft_color, icon, order_num, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 25)');
    foreach ([
        ['financiera', 'FIN', 'Financiera', 'PERSPECTIVA FINANCIERA', '#1f3864', '#edf4ff', '💰', 1],
        ['clientes', 'CLI', 'Clientes', 'PERSPECTIVA DE CLIENTES', '#1e4d2b', '#eaf8f1', '👥', 2],
        ['procesos', 'PROC', 'Procesos internos', 'PERSPECTIVA DE PROCESOS INTERNOS', '#9a4b08', '#fff5e6', '🔧', 3],
        ['aprendizaje', 'APR', 'Aprendizaje y crecimiento', 'PERSPECTIVA DE APRENDIZAJE Y CRECIMIENTO', '#4a2373', '#f2edff', '📚', 4]
    ] as $row) $stmt->execute($row);
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO evaluation_periods (id, name, year, status, start_date, end_date) VALUES (?, ?, 2025, ?, ?, ?)');
    foreach ([['Q1','Primer trimestre','2025-01-01','2025-03-31'], ['Q2','Segundo trimestre','2025-04-01','2025-06-30'], ['Q3','Tercer trimestre','2025-07-01','2025-09-30'], ['Q4','Cuarto trimestre','2025-10-01','2025-12-31'], ['Acum','Acumulado anual','2025-01-01','2025-12-31']] as [$key,$name,$start,$end]) $stmt->execute(['2025-'.$key, '2025 - '.$name, 'Activo', $start, $end]);
    $pdo->commit();
    echo "Perspectivas y períodos de referencia 2025 preparados sin sobrescribir registros.\n";
} catch (Throwable $e) { $pdo->rollBack(); throw $e; }
