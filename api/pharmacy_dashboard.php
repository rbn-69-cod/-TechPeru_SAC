<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/medizano_client.php';
require_once dirname(__DIR__) . '/services/inventory.php';

$pdo = getDB();

// 1. Resumen de Ventas de Hoy
$today = date('Y-m-d');
$salesToday = $pdo->prepare("SELECT COUNT(*) AS total_tickets, COALESCE(SUM(total), 0) AS monto_total, COALESCE(SUM(subtotal), 0) AS subtotal_total, COALESCE(SUM(igv), 0) AS igv_total
                             FROM ventas 
                             WHERE date(created_at) = ? AND estado = 'COMPLETADA'");
$salesToday->execute([$today]);
$metricsToday = $salesToday->fetch();

// 2. Resumen de Inventario
$invSummary = getInventorySummary($pdo);

// 3. Turno de Caja Activo
$shiftStmt = $pdo->query("SELECT t.*, u.name AS usuario_nombre,
                                (t.total_ventas_efectivo + t.total_ventas_tarjeta + t.total_ventas_digital) AS total_recaudado
                         FROM caja_turnos t
                         JOIN users u ON t.usuario_id = u.id
                         WHERE t.estado = 'ABIERTO'
                         ORDER BY t.id DESC LIMIT 1");
$activeShift = $shiftStmt->fetch();

// 4. Ventas de los últimos 7 días
$stmtTrends = $pdo->query("SELECT date(created_at) AS fecha, COUNT(*) AS tickets, COALESCE(SUM(total), 0) AS total
                          FROM ventas
                          WHERE estado = 'COMPLETADA' AND date(created_at) >= date('now', '-6 days')
                          GROUP BY date(created_at)
                          ORDER BY date(created_at) ASC");
$trends = $stmtTrends->fetchAll();

// 5. Top Productos más vendidos
$stmtTop = $pdo->query("SELECT p.id, p.codigo, p.nombre_comercial, p.presentacion,
                               SUM(d.cantidad) AS unidades_vendidas, SUM(d.total) AS total_recaudado
                        FROM detalle_ventas d
                        JOIN productos p ON d.producto_id = p.id
                        JOIN ventas v ON d.venta_id = v.id
                        WHERE v.estado = 'COMPLETADA'
                        GROUP BY p.id
                        ORDER BY unidades_vendidas DESC LIMIT 5");
$topProducts = $stmtTop->fetchAll();

// 6. Ventas por Método de Pago
$stmtPayments = $pdo->query("SELECT metodo_pago, COUNT(*) AS tickets, COALESCE(SUM(total), 0) AS total
                            FROM ventas
                            WHERE estado = 'COMPLETADA'
                            GROUP BY metodo_pago");
$payments = $stmtPayments->fetchAll();

// 7. Últimas ventas
$stmtRecent = $pdo->query("SELECT v.*, c.numero_completo AS comprobante_numero, c.tipo AS comprobante_tipo,
                                  cli.nombre_razon_social AS cliente_nombre, u.name AS usuario_nombre
                          FROM ventas v
                          LEFT JOIN comprobantes c ON c.venta_id = v.id
                          LEFT JOIN clientes cli ON v.cliente_id = cli.id
                          LEFT JOIN users u ON v.usuario_id = u.id
                          ORDER BY v.id DESC LIMIT 8");
$recentSales = $stmtRecent->fetchAll();

// 8. Estado de la Integración con MediZano Gateway
$client = new MediZanoClient();
$medizanoHealth = $client->checkHealth();

jsonResponse([
    'success' => true,
    'dashboard' => [
        'ventas_hoy' => [
            'tickets' => (int)$metricsToday['total_tickets'],
            'total' => round((float)$metricsToday['monto_total'], 2),
            'subtotal' => round((float)$metricsToday['subtotal_total'], 2),
            'igv' => round((float)$metricsToday['igv_total'], 2)
        ],
        'inventario' => $invSummary,
        'caja_activa' => $activeShift ? [
            'id' => (int)$activeShift['id'],
            'cajero' => $activeShift['usuario_nombre'],
            'apertura' => round((float)$activeShift['monto_apertura'], 2),
            'recaudado' => round((float)$activeShift['total_recaudado'], 2),
            'fecha_apertura' => $activeShift['fecha_apertura']
        ] : null,
        'tendencias_7d' => $trends,
        'top_productos' => $topProducts,
        'metodos_pago' => $payments,
        'ultimas_ventas' => $recentSales,
        'medizano_integration' => $medizanoHealth
    ]
]);

