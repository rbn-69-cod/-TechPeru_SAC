<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/inventory.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'sales_summary';

function sanitizeCsvField(string $val): string
{
    // Mitigación de inyección de fórmulas CSV (OWASP)
    if (preg_match('/^[=\+\-@\t\r]/', $val)) {
        $val = "'" . $val;
    }
    return '"' . str_replace('"', '""', $val) . '"';
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'sales_summary') {
        $desde = $_GET['desde'] ?? date('Y-m-01');
        $hasta = $_GET['hasta'] ?? date('Y-m-d');

        $stmt = $pdo->prepare("SELECT date(created_at) AS fecha, COUNT(*) AS total_ventas,
                                      SUM(subtotal) AS subtotal, SUM(igv) AS igv, SUM(total) AS total,
                                      SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END) AS total_efectivo,
                                      SUM(CASE WHEN metodo_pago = 'TARJETA' THEN total ELSE 0 END) AS total_tarjeta,
                                      SUM(CASE WHEN metodo_pago IN ('YAPE', 'PLIN') THEN total ELSE 0 END) AS total_digital
                               FROM ventas
                               WHERE estado = 'COMPLETADA' AND date(created_at) >= ? AND date(created_at) <= ?
                               GROUP BY date(created_at)
                               ORDER BY date(created_at) DESC");
        $stmt->execute([$desde, $hasta]);
        $rows = $stmt->fetchAll();

        $totales = [
            'tickets' => array_sum(array_column($rows, 'total_ventas')),
            'subtotal' => array_sum(array_column($rows, 'subtotal')),
            'igv' => array_sum(array_column($rows, 'igv')),
            'total' => array_sum(array_column($rows, 'total')),
            'efectivo' => array_sum(array_column($rows, 'total_efectivo')),
            'tarjeta' => array_sum(array_column($rows, 'total_tarjeta')),
            'digital' => array_sum(array_column($rows, 'total_digital'))
        ];

        jsonResponse(['success' => true, 'report' => $rows, 'totales' => $totales, 'desde' => $desde, 'hasta' => $hasta]);
    }

    if ($action === 'ranking') {
        $desde = $_GET['desde'] ?? date('Y-m-01');
        $hasta = $_GET['hasta'] ?? date('Y-m-d');

        $stmt = $pdo->prepare("SELECT p.codigo, p.nombre_comercial, p.principio_activo, p.presentacion,
                                      l.nombre AS laboratorio_nombre, c.nombre AS categoria_nombre,
                                      SUM(d.cantidad) AS total_unidades,
                                      SUM(d.total) AS total_recaudado,
                                      ROUND(AVG(d.precio_unitario), 2) AS precio_promedio
                               FROM detalle_ventas d
                               JOIN productos p ON d.producto_id = p.id
                               JOIN ventas v ON d.venta_id = v.id
                               LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                               LEFT JOIN categorias_producto c ON p.categoria_id = c.id
                               WHERE v.estado = 'COMPLETADA' AND date(v.created_at) >= ? AND date(v.created_at) <= ?
                               GROUP BY p.id
                               ORDER BY total_unidades DESC LIMIT 50");
        $stmt->execute([$desde, $hasta]);
        jsonResponse(['success' => true, 'ranking' => $stmt->fetchAll()]);
    }

    if ($action === 'expiring') {
        $dias = max(15, min(365, (int)($_GET['dias'] ?? 90)));
        $lotes = getLotes($pdo, ['dias_alerta' => $dias, 'solo_con_stock' => true]);
        jsonResponse(['success' => true, 'lotes_por_vencer' => $lotes, 'total' => count($lotes)]);
    }

    if ($action === 'export_csv') {
        $type = $_GET['type'] ?? 'ventas';
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="reporte_botica_' . $type . '_' . date('Ymd_His') . '.csv"');

        // BOM UTF-8 para Excel en Windows
        echo "\xEF\xBB\xBF";

        if ($type === 'ventas') {
            echo "Codigo Venta,Comprobante,Fecha,Cliente,Tipo Doc,Num Doc,Metodo Pago,Subtotal,IGV,Total,Estado\n";
            $stmt = $pdo->query("SELECT v.codigo_venta, c.numero_completo, v.created_at, cli.nombre_razon_social, cli.tipo_documento, cli.numero_documento, v.metodo_pago, v.subtotal, v.igv, v.total, v.estado
                                FROM ventas v
                                LEFT JOIN comprobantes c ON c.venta_id = v.id
                                LEFT JOIN clientes cli ON v.cliente_id = cli.id
                                ORDER BY v.id DESC");
            while ($r = $stmt->fetch()) {
                echo implode(',', [
                    sanitizeCsvField($r['codigo_venta'] ?? ''),
                    sanitizeCsvField($r['numero_completo'] ?? ''),
                    sanitizeCsvField($r['created_at'] ?? ''),
                    sanitizeCsvField($r['nombre_razon_social'] ?? 'VARIOS'),
                    sanitizeCsvField($r['tipo_documento'] ?? ''),
                    sanitizeCsvField($r['numero_documento'] ?? ''),
                    sanitizeCsvField($r['metodo_pago'] ?? ''),
                    number_format((float)$r['subtotal'], 2, '.', ''),
                    number_format((float)$r['igv'], 2, '.', ''),
                    number_format((float)$r['total'], 2, '.', ''),
                    sanitizeCsvField($r['estado'] ?? '')
                ]) . "\n";
            }
            exit;
        }

        if ($type === 'inventario') {
            echo "Codigo,Nombre Comercial,Principio Activo,Presentacion,Laboratorio,Categoria,Stock Actual,Stock Minimo,Precio Compra,Precio Venta,Receta Medica\n";
            $stmt = $pdo->query("SELECT p.*, l.nombre AS lab_nombre, c.nombre AS cat_nombre
                                FROM productos p
                                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                                LEFT JOIN categorias_producto c ON p.categoria_id = c.id
                                ORDER BY p.nombre_comercial ASC");
            while ($r = $stmt->fetch()) {
                echo implode(',', [
                    sanitizeCsvField($r['codigo'] ?? ''),
                    sanitizeCsvField($r['nombre_comercial'] ?? ''),
                    sanitizeCsvField($r['principio_activo'] ?? ''),
                    sanitizeCsvField($r['presentacion'] ?? ''),
                    sanitizeCsvField($r['lab_nombre'] ?? ''),
                    sanitizeCsvField($r['cat_nombre'] ?? ''),
                    $r['stock_actual'],
                    $r['stock_minimo'],
                    number_format((float)$r['precio_compra'], 2, '.', ''),
                    number_format((float)$r['precio_venta'], 2, '.', ''),
                    $r['receta_medica'] ? 'SI' : 'NO'
                ]) . "\n";
            }
            exit;
        }

        if ($type === 'vencimientos') {
            echo "Codigo,Producto,Lote,Fecha Vencimiento,Dias Restantes,Stock Lote,Costo Lote,Total Valor Riesgo,Estado\n";
            $lotes = getLotes($pdo, ['solo_con_stock' => true]);
            foreach ($lotes as $l) {
                $totalRiesgo = (int)$l['cantidad_actual'] * (float)$l['precio_compra_lote'];
                echo implode(',', [
                    sanitizeCsvField($l['producto_codigo'] ?? ''),
                    sanitizeCsvField($l['nombre_comercial'] ?? ''),
                    sanitizeCsvField($l['numero_lote'] ?? ''),
                    sanitizeCsvField($l['fecha_vencimiento'] ?? ''),
                    $l['dias_para_vencer'],
                    $l['cantidad_actual'],
                    number_format((float)$l['precio_compra_lote'], 2, '.', ''),
                    number_format($totalRiesgo, 2, '.', ''),
                    sanitizeCsvField($l['estado'] ?? '')
                ]) . "\n";
            }
            exit;
        }
    }

    jsonError('Acción no soportada.', 400);
}

