<?php
/**
 * Servicio de Punto de Venta (POS), Despacho FEFO, Emisión de Comprobantes y Anulaciones
 * Botica TechPeru SAC
 */

require_once dirname(__DIR__) . '/repositories/records.php';
require_once dirname(__DIR__) . '/database/transaction.php';

function getActiveShift(PDO $pdo, ?string $userId = null): ?array
{
    if ($userId) {
        $stmt = $pdo->prepare("SELECT * FROM caja_turnos WHERE usuario_id = ? AND estado = 'ABIERTO' ORDER BY id DESC LIMIT 1");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if ($row) return $row;
    }
    // Si no hay específico del usuario, obtener el turno abierto general de la tienda
    $stmt = $pdo->query("SELECT * FROM caja_turnos WHERE estado = 'ABIERTO' ORDER BY id DESC LIMIT 1");
    return $stmt->fetch() ?: null;
}

function processSale(PDO $pdo, array $saleData, string $userId): array
{
    $turno = getActiveShift($pdo, $userId);
    if (!$turno) {
        throw new RuntimeException('No hay un turno de caja abierto. Debe aperturar caja antes de realizar ventas.');
    }
    $turnoId = (int)$turno['id'];

    $items = $saleData['items'] ?? [];
    if (empty($items)) {
        throw new InvalidArgumentException('El carrito de venta está vacío.');
    }

    $clienteId = !empty($saleData['cliente_id']) ? (int)$saleData['cliente_id'] : 1; // 1 = Clientes Varios
    $metodoPago = strtoupper(trim($saleData['metodo_pago'] ?? 'EFECTIVO'));
    if (!in_array($metodoPago, ['EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'MIXTO'], true)) {
        $metodoPago = 'EFECTIVO';
    }

    $tipoComprobante = strtoupper(trim($saleData['tipo_comprobante'] ?? 'BOLETA'));
    if (!in_array($tipoComprobante, ['BOLETA', 'FACTURA', 'NOTA_VENTA'], true)) {
        $tipoComprobante = 'BOLETA';
    }

    $descuentoGlobal = max(0, (float)($saleData['descuento'] ?? 0));
    $montoRecibido = max(0, (float)($saleData['monto_recibido'] ?? 0));

    return atomic($pdo, function () use ($pdo, $items, $turnoId, $clienteId, $userId, $metodoPago, $tipoComprobante, $descuentoGlobal, $montoRecibido): array {
        $cliente = $pdo->query("SELECT * FROM clientes WHERE id = $clienteId")->fetch();
        if (!$cliente) {
            $cliente = ['tipo_documento' => 'VARIOS', 'numero_documento' => '00000000', 'nombre_razon_social' => 'CLIENTES VARIOS'];
        }

        if ($tipoComprobante === 'FACTURA' && $cliente['tipo_documento'] !== 'RUC') {
            throw new InvalidArgumentException('Para emitir Factura se requiere un cliente con RUC válido.');
        }

        // 1. Validar y preparar deducciones FEFO
        $detalleParaInsertar = [];
        $totalVentaBruto = 0.0;

        foreach ($items as $item) {
            $item = (array)$item;
            $prodId = (int)($item['producto_id'] ?? 0);
            $qtyReq = (int)($item['cantidad'] ?? 0);
            if ($prodId <= 0 || $qtyReq <= 0) {
                throw new InvalidArgumentException('Cada ítem debe tener producto válido y cantidad mayor a cero.');
            }

            $prod = $pdo->query("SELECT * FROM productos WHERE id = $prodId AND estado = 'Activo'")->fetch();
            if (!$prod) {
                throw new RuntimeException("El producto con ID $prodId no existe o no está activo.");
            }

            $precioUnit = (float)($item['precio_unitario'] ?? $prod['precio_venta']);

            // Buscar lotes FEFO disponibles (First Expired, First Out)
            $stmtLotes = $pdo->prepare("SELECT * FROM lotes 
                                        WHERE producto_id = ? AND cantidad_actual > 0 AND estado != 'VENCIDO' AND fecha_vencimiento >= date('now')
                                        ORDER BY fecha_vencimiento ASC, id ASC");
            $stmtLotes->execute([$prodId]);
            $lotesDisp = $stmtLotes->fetchAll();

            $totalStockLotes = array_sum(array_column($lotesDisp, 'cantidad_actual'));
            if ($totalStockLotes < $qtyReq) {
                throw new RuntimeException("Stock insuficiente para '{$prod['nombre_comercial']}'. Disponible en lotes vigentes: $totalStockLotes, Solicitado: $qtyReq.");
            }

            // Distribuir cantidad solicitada según FEFO
            $restante = $qtyReq;
            foreach ($lotesDisp as $lote) {
                if ($restante <= 0) break;
                $qtyTomar = min($restante, (int)$lote['cantidad_actual']);

                $subItem = round($qtyTomar * $precioUnit, 2);
                $subNeto = round($subItem / 1.18, 2);
                $igvItem = round($subItem - $subNeto, 2);

                $detalleParaInsertar[] = [
                    'producto_id' => $prodId,
                    'producto_nombre' => $prod['nombre_comercial'],
                    'lote_id' => (int)$lote['id'],
                    'numero_lote' => $lote['numero_lote'],
                    'cantidad' => $qtyTomar,
                    'precio_unitario' => $precioUnit,
                    'subtotal' => $subNeto,
                    'igv' => $igvItem,
                    'total' => $subItem
                ];

                $totalVentaBruto += $subItem;
                $restante -= $qtyTomar;
            }
        }

        $totalFinal = max(0, $totalVentaBruto - $descuentoGlobal);
        $subtotalNeto = round($totalFinal / 1.18, 2);
        $igvTotal = round($totalFinal - $subtotalNeto, 2);

        $vuelto = 0.0;
        if ($metodoPago === 'EFECTIVO' && $montoRecibido > 0) {
            if ($montoRecibido < $totalFinal) {
                throw new InvalidArgumentException("El monto recibido (S/ " . number_format($montoRecibido, 2) . ") es menor que el total (S/ " . number_format($totalFinal, 2) . ").");
            }
            $vuelto = round($montoRecibido - $totalFinal, 2);
        } else {
            $montoRecibido = $totalFinal;
        }

        // 2. Generar Código Único de Venta
        $nextVentaId = ((int)$pdo->query("SELECT MAX(id) FROM ventas")->fetchColumn()) + 1;
        $codigoVenta = 'VTA-' . date('Y') . '-' . str_pad((string)$nextVentaId, 5, '0', STR_PAD_LEFT);

        // 3. Insertar Venta
        $stmtVenta = $pdo->prepare("INSERT INTO ventas 
            (codigo_venta, turno_id, cliente_id, usuario_id, subtotal, igv, descuento, total, metodo_pago, monto_recibido, vuelto, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA')");
        $stmtVenta->execute([$codigoVenta, $turnoId, $clienteId, $userId, $subtotalNeto, $igvTotal, $descuentoGlobal, $totalFinal, $metodoPago, $montoRecibido, $vuelto]);
        $ventaId = (int)$pdo->lastInsertId();

        // 4. Insertar Detalle y Deducir Stock FEFO
        $stmtDet = $pdo->prepare("INSERT INTO detalle_ventas (venta_id, producto_id, lote_id, cantidad, precio_unitario, subtotal, igv, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmtDeductLote = $pdo->prepare("UPDATE lotes SET cantidad_actual = cantidad_actual - ?, estado = CASE WHEN cantidad_actual - ? <= 0 THEN 'AGOTADO' ELSE estado END WHERE id = ?");
        $stmtDeductProd = $pdo->prepare("UPDATE productos SET stock_actual = stock_actual - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmtMov = $pdo->prepare("INSERT INTO movimientos_inventario (producto_id, lote_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id) VALUES (?, ?, 'VENTA', ?, ?, ?, ?, 'VENTA', ?, ?)");

        foreach ($detalleParaInsertar as $det) {
            $stmtDet->execute([$ventaId, $det['producto_id'], $det['lote_id'], $det['cantidad'], $det['precio_unitario'], $det['subtotal'], $det['igv'], $det['total']]);

            // Deducir Lote
            $stmtDeductLote->execute([$det['cantidad'], $det['cantidad'], $det['lote_id']]);

            // Deducir Producto
            $pBefore = $pdo->query("SELECT stock_actual FROM productos WHERE id = {$det['producto_id']}")->fetch();
            $stockAnt = (int)$pBefore['stock_actual'];
            $stmtDeductProd->execute([$det['cantidad'], $det['producto_id']]);
            $stockNuevo = max(0, $stockAnt - $det['cantidad']);

            // Kardex
            $stmtMov->execute([
                $det['producto_id'], $det['lote_id'], $det['cantidad'], $stockAnt, $stockNuevo,
                "Venta POS $codigoVenta - Lote: {$det['numero_lote']}", $ventaId, $userId
            ]);
        }

        // 5. Emisión del Comprobante Fiscal / Interno
        $serie = match ($tipoComprobante) {
            'FACTURA' => 'F001',
            'NOTA_VENTA' => 'NV01',
            default => 'B001'
        };

        $lastNum = (int)$pdo->query("SELECT COALESCE(MAX(numero), 0) FROM comprobantes WHERE serie = '$serie'")->fetchColumn();
        $numero = $lastNum + 1;
        $numeroCompleto = $serie . '-' . str_pad((string)$numero, 8, '0', STR_PAD_LEFT);

        $stmtComp = $pdo->prepare("INSERT INTO comprobantes 
            (venta_id, tipo, serie, numero, numero_completo, emisor_ruc, emisor_nombre, cliente_tipo_doc, cliente_doc, cliente_nombre, subtotal, igv, total, tipo_comprobante_fiscal, estado_sunat)
            VALUES (?, ?, ?, ?, ?, '20601234567', 'BOTICA TECHPERU S.A.C.', ?, ?, ?, ?, ?, ?, 'INTERNO', 'EMITIDO_LOCAL')");
        $stmtComp->execute([
            $ventaId, $tipoComprobante, $serie, $numero, $numeroCompleto,
            $cliente['tipo_documento'], $cliente['numero_documento'], $cliente['nombre_razon_social'],
            $subtotalNeto, $igvTotal, $totalFinal
        ]);
        $comprobanteId = (int)$pdo->lastInsertId();

        // 6. Actualizar acumulados del Turno de Caja
        if ($metodoPago === 'EFECTIVO') {
            $pdo->exec("UPDATE caja_turnos SET total_ventas_efectivo = total_ventas_efectivo + $totalFinal WHERE id = $turnoId");
        } elseif ($metodoPago === 'TARJETA') {
            $pdo->exec("UPDATE caja_turnos SET total_ventas_tarjeta = total_ventas_tarjeta + $totalFinal WHERE id = $turnoId");
        } else {
            $pdo->exec("UPDATE caja_turnos SET total_ventas_digital = total_ventas_digital + $totalFinal WHERE id = $turnoId");
        }

        // 7. Auditoría
        logActivity($pdo, 'VENTA_POS', 'ventas', (string)$ventaId, "Venta completada $codigoVenta | $numeroCompleto por S/ " . number_format($totalFinal, 2) . " [$metodoPago]");

        return [
            'venta_id' => $ventaId,
            'codigo_venta' => $codigoVenta,
            'comprobante_id' => $comprobanteId,
            'comprobante_numero' => $numeroCompleto,
            'tipo_comprobante' => $tipoComprobante,
            'cliente' => $cliente['nombre_razon_social'],
            'total' => $totalFinal,
            'subtotal' => $subtotalNeto,
            'igv' => $igvTotal,
            'metodo_pago' => $metodoPago,
            'monto_recibido' => $montoRecibido,
            'vuelto' => $vuelto,
            'items_count' => count($detalleParaInsertar)
        ];
    });
}

function voidSale(PDO $pdo, int $ventaId, string $motivo, string $userId): array
{
    if (trim($motivo) === '') {
        throw new InvalidArgumentException('El motivo de anulación es obligatorio.');
    }

    return atomic($pdo, function () use ($pdo, $ventaId, $motivo, $userId): array {
        $venta = $pdo->query("SELECT * FROM ventas WHERE id = $ventaId")->fetch();
        if (!$venta) {
            throw new RuntimeException("La venta con ID $ventaId no existe.");
        }
        if ($venta['estado'] === 'ANULADA') {
            throw new RuntimeException("La venta ya se encuentra anulada.");
        }

        $detalles = $pdo->query("SELECT * FROM detalle_ventas WHERE venta_id = $ventaId")->fetchAll();

        // 1. Restaurar stock en Lotes y Productos
        $stmtRestoreLote = $pdo->prepare("UPDATE lotes SET cantidad_actual = cantidad_actual + ?, estado = CASE WHEN estado = 'AGOTADO' THEN 'DISPONIBLE' ELSE estado END WHERE id = ?");
        $stmtRestoreProd = $pdo->prepare("UPDATE productos SET stock_actual = stock_actual + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmtMov = $pdo->prepare("INSERT INTO movimientos_inventario (producto_id, lote_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id) VALUES (?, ?, 'ANULACION_VENTA', ?, ?, ?, ?, 'VENTA', ?, ?)");

        foreach ($detalles as $det) {
            $stmtRestoreLote->execute([$det['cantidad'], $det['lote_id']]);

            $pBefore = $pdo->query("SELECT stock_actual FROM productos WHERE id = {$det['producto_id']}")->fetch();
            $stockAnt = (int)$pBefore['stock_actual'];
            $stmtRestoreProd->execute([$det['cantidad'], $det['producto_id']]);
            $stockNuevo = $stockAnt + (int)$det['cantidad'];

            $stmtMov->execute([
                $det['producto_id'], $det['lote_id'], $det['cantidad'], $stockAnt, $stockNuevo,
                "Restitución por Anulación de Venta {$venta['codigo_venta']}. Motivo: $motivo",
                $ventaId, $userId
            ]);
        }

        // 2. Marcar Venta como Anulada
        $stmtUpdateVenta = $pdo->prepare("UPDATE ventas SET estado = 'ANULADA', motivo_anulacion = ?, anulado_por = ?, anulado_at = datetime('now') WHERE id = ?");
        $stmtUpdateVenta->execute([$motivo, $userId, $ventaId]);

        // 3. Ajustar Caja si el turno aún está abierto
        $turnoId = (int)$venta['turno_id'];
        $montoTotal = (float)$venta['total'];
        $metodo = $venta['metodo_pago'];

        if ($metodo === 'EFECTIVO') {
            $pdo->exec("UPDATE caja_turnos SET total_ventas_efectivo = MAX(0, total_ventas_efectivo - $montoTotal) WHERE id = $turnoId");
        } elseif ($metodo === 'TARJETA') {
            $pdo->exec("UPDATE caja_turnos SET total_ventas_tarjeta = MAX(0, total_ventas_tarjeta - $montoTotal) WHERE id = $turnoId");
        } else {
            $pdo->exec("UPDATE caja_turnos SET total_ventas_digital = MAX(0, total_ventas_digital - $montoTotal) WHERE id = $turnoId");
        }

        logActivity($pdo, 'ANULAR_VENTA', 'ventas', (string)$ventaId, "Venta {$venta['codigo_venta']} ANULADA. Motivo: $motivo");

        return [
            'venta_id' => $ventaId,
            'codigo_venta' => $venta['codigo_venta'],
            'estado' => 'ANULADA',
            'monto_revertido' => $montoTotal
        ];
    });
}

function getSaleDetails(PDO $pdo, int $ventaId): ?array
{
    $stmt = $pdo->prepare("SELECT v.*, c.numero_completo AS comprobante_numero, c.tipo AS comprobante_tipo,
                                  cli.nombre_razon_social AS cliente_nombre, cli.numero_documento AS cliente_doc, cli.tipo_documento AS cliente_tipo_doc,
                                  u.name AS usuario_nombre
                           FROM ventas v
                           LEFT JOIN comprobantes c ON c.venta_id = v.id
                           LEFT JOIN clientes cli ON v.cliente_id = cli.id
                           LEFT JOIN users u ON v.usuario_id = u.id
                           WHERE v.id = ?");
    $stmt->execute([$ventaId]);
    $sale = $stmt->fetch();
    if (!$sale) return null;

    $stmtDet = $pdo->prepare("SELECT d.*, p.codigo AS producto_codigo, p.nombre_comercial, p.principio_activo, p.presentacion, l.numero_lote, l.fecha_vencimiento
                              FROM detalle_ventas d
                              JOIN productos p ON d.producto_id = p.id
                              JOIN lotes l ON d.lote_id = l.id
                              WHERE d.venta_id = ?");
    $stmtDet->execute([$ventaId]);
    $sale['items'] = $stmtDet->fetchAll();
    return $sale;
}

function getRecentSales(PDO $pdo, array $filters = []): array
{
    $sql = "SELECT v.*, c.numero_completo AS comprobante_numero, c.tipo AS comprobante_tipo,
                   cli.nombre_razon_social AS cliente_nombre, u.name AS usuario_nombre
            FROM ventas v
            LEFT JOIN comprobantes c ON c.venta_id = v.id
            LEFT JOIN clientes cli ON v.cliente_id = cli.id
            LEFT JOIN users u ON v.usuario_id = u.id
            WHERE 1=1";
    $params = [];

    if (!empty($filters['estado'])) {
        $sql .= " AND v.estado = ?";
        $params[] = $filters['estado'];
    }

    if (!empty($filters['desde'])) {
        $sql .= " AND date(v.created_at) >= ?";
        $params[] = $filters['desde'];
    }

    if (!empty($filters['hasta'])) {
        $sql .= " AND date(v.created_at) <= ?";
        $params[] = $filters['hasta'];
    }

    if (!empty($filters['search'])) {
        $s = '%' . trim($filters['search']) . '%';
        $sql .= " AND (v.codigo_venta LIKE ? OR c.numero_completo LIKE ? OR cli.nombre_razon_social LIKE ?)";
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
    }

    $sql .= " ORDER BY v.id DESC LIMIT " . (!empty($filters['limit']) ? (int)$filters['limit'] : 100);

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}
