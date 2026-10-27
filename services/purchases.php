<?php
/**
 * Servicio de Gestión de Compras a Proveedores y Recepción de Mercadería
 * Botica TechPeru SAC
 */

require_once dirname(__DIR__) . '/repositories/records.php';
require_once dirname(__DIR__) . '/database/transaction.php';

function getPurchases(PDO $pdo, array $filters = []): array
{
    $sql = "SELECT c.*, p.razon_social AS proveedor_nombre, p.ruc AS proveedor_ruc, u.name AS usuario_nombre
            FROM compras c
            JOIN proveedores p ON c.proveedor_id = p.id
            LEFT JOIN users u ON c.usuario_id = u.id
            WHERE 1=1";
    $params = [];

    if (!empty($filters['proveedor_id'])) {
        $sql .= " AND c.proveedor_id = ?";
        $params[] = (int)$filters['proveedor_id'];
    }

    if (!empty($filters['desde'])) {
        $sql .= " AND c.fecha_recepcion >= ?";
        $params[] = $filters['desde'];
    }

    if (!empty($filters['hasta'])) {
        $sql .= " AND c.fecha_recepcion <= ?";
        $params[] = $filters['hasta'];
    }

    $sql .= " ORDER BY c.id DESC LIMIT " . (!empty($filters['limit']) ? (int)$filters['limit'] : 50);

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function getPurchaseDetails(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare("SELECT c.*, p.razon_social AS proveedor_nombre, p.ruc AS proveedor_ruc, p.direccion AS proveedor_direccion, u.name AS usuario_nombre
                           FROM compras c
                           JOIN proveedores p ON c.proveedor_id = p.id
                           LEFT JOIN users u ON c.usuario_id = u.id
                           WHERE c.id = ?");
    $stmt->execute([$id]);
    $compra = $stmt->fetch();
    if (!$compra) return null;

    $stmtDet = $pdo->prepare("SELECT d.*, prod.codigo AS producto_codigo, prod.nombre_comercial, prod.presentacion
                              FROM detalle_compras d
                              JOIN productos prod ON d.producto_id = prod.id
                              WHERE d.compra_id = ?");
    $stmtDet->execute([$id]);
    $compra['items'] = $stmtDet->fetchAll();
    return $compra;
}

function registerPurchase(PDO $pdo, array $data, string $userId): array
{
    $proveedorId = (int)($data['proveedor_id'] ?? 0);
    $serieComp = trim($data['serie_comprobante'] ?? '');
    $numComp = trim($data['numero_comprobante'] ?? '');
    $items = $data['items'] ?? [];

    if ($proveedorId <= 0 || $serieComp === '' || $numComp === '' || empty($items)) {
        throw new InvalidArgumentException('Proveedor, comprobante y al menos un ítem son obligatorios.');
    }

    $fechaEmision = trim($data['fecha_emision'] ?? date('Y-m-d'));
    $fechaRecepcion = trim($data['fecha_recepcion'] ?? date('Y-m-d'));
    $tipoComp = trim($data['tipo_comprobante'] ?? 'FACTURA');

    return atomic($pdo, function () use ($pdo, $proveedorId, $tipoComp, $serieComp, $numComp, $fechaEmision, $fechaRecepcion, $items, $userId): array {
        $totalBruto = 0.0;
        foreach ($items as $item) {
            $item = (array)$item;
            $totalBruto += (int)$item['cantidad'] * (float)$item['precio_unitario'];
        }
        $subtotal = round($totalBruto / 1.18, 2);
        $igv = round($totalBruto - $subtotal, 2);

        // 1. Crear Compra
        $stmtCompra = $pdo->prepare("INSERT INTO compras 
            (proveedor_id, tipo_comprobante, serie_comprobante, numero_comprobante, fecha_emision, fecha_recepcion, subtotal, igv, total, estado, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECIBIDO', ?)");
        $stmtCompra->execute([$proveedorId, $tipoComp, $serieComp, $numComp, $fechaEmision, $fechaRecepcion, $subtotal, $igv, $totalBruto, $userId]);
        $compraId = (int)$pdo->lastInsertId();

        $stmtDet = $pdo->prepare("INSERT INTO detalle_compras (compra_id, producto_id, numero_lote, fecha_vencimiento, cantidad, precio_unitario, total) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmtMov = $pdo->prepare("INSERT INTO movimientos_inventario (producto_id, lote_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id) VALUES (?, ?, 'COMPRA', ?, ?, ?, ?, 'COMPRA', ?, ?)");

        // 2. Procesar ítems, crear/actualizar lotes y stock
        foreach ($items as $item) {
            $item = (array)$item;
            $prodId = (int)$item['producto_id'];
            $numeroLote = trim($item['numero_lote']);
            $fechaVenc = trim($item['fecha_vencimiento']);
            $cantidad = (int)$item['cantidad'];
            $precioUnit = (float)$item['precio_unitario'];
            $totalItem = round($cantidad * $precioUnit, 2);

            $stmtDet->execute([$compraId, $prodId, $numeroLote, $fechaVenc, $cantidad, $precioUnit, $totalItem]);

            // Buscar si ya existe el lote para este producto
            $stmtLote = $pdo->prepare("SELECT id, cantidad_actual FROM lotes WHERE producto_id = ? AND numero_lote = ?");
            $stmtLote->execute([$prodId, $numeroLote]);
            $existingLote = $stmtLote->fetch();

            $today = new DateTime('now');
            $expDate = new DateTime($fechaVenc);
            $diffDays = (int)$today->diff($expDate)->format('%r%a');
            $estadoLote = ($diffDays < 0) ? 'VENCIDO' : (($diffDays <= 90) ? 'PROXIMO_A_VENCER' : 'DISPONIBLE');

            if ($existingLote) {
                $loteId = (int)$existingLote['id'];
                $pdo->exec("UPDATE lotes SET cantidad_actual = cantidad_actual + $cantidad, precio_compra_lote = $precioUnit, estado = '$estadoLote' WHERE id = $loteId");
            } else {
                $stmtNewLote = $pdo->prepare("INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_lote, estado) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmtNewLote->execute([$prodId, $numeroLote, $fechaVenc, $cantidad, $cantidad, $precioUnit, $estadoLote]);
                $loteId = (int)$pdo->lastInsertId();
            }

            // Actualizar stock de producto
            $p = $pdo->query("SELECT stock_actual, nombre_comercial FROM productos WHERE id = $prodId")->fetch();
            $stockAnt = (int)$p['stock_actual'];
            $stockNuevo = $stockAnt + $cantidad;
            $pdo->exec("UPDATE productos SET stock_actual = $stockNuevo, precio_compra = $precioUnit, updated_at = CURRENT_TIMESTAMP WHERE id = $prodId");

            // Kardex
            $stmtMov->execute([$prodId, $loteId, $cantidad, $stockAnt, $stockNuevo, "Recepción de compra $serieComp-$numComp (Lote $numeroLote)", $compraId, $userId]);
        }

        $prov = $pdo->query("SELECT razon_social FROM proveedores WHERE id = $proveedorId")->fetch();
        logActivity($pdo, 'COMPRA_MERCADERIA', 'compras', (string)$compraId, "Compra recepcionada $tipoComp $serieComp-$numComp de {$prov['razon_social']} por S/ " . number_format($totalBruto, 2));

        return getPurchaseDetails($pdo, $compraId);
    });
}
