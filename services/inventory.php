<?php
/**
 * Servicio de Gestión de Inventario, Lotes, FEFO y Kardex
 * Botica TechPeru SAC
 */

require_once dirname(__DIR__) . '/repositories/records.php';
require_once dirname(__DIR__) . '/database/transaction.php';

function getInventorySummary(PDO $pdo): array
{
    // Actualizar estados de lotes según fecha de hoy
    $pdo->exec("UPDATE lotes 
                SET estado = 'VENCIDO' 
                WHERE fecha_vencimiento < date('now') AND estado != 'VENCIDO'");

    $pdo->exec("UPDATE lotes 
                SET estado = 'PROXIMO_A_VENCER' 
                WHERE fecha_vencimiento >= date('now') 
                  AND fecha_vencimiento <= date('now', '+90 days') 
                  AND cantidad_actual > 0 
                  AND estado = 'DISPONIBLE'");

    $totalProducts = (int)$pdo->query("SELECT COUNT(*) FROM productos WHERE estado = 'Activo'")->fetchColumn();
    $totalUnits = (int)$pdo->query("SELECT COALESCE(SUM(stock_actual), 0) FROM productos WHERE estado = 'Activo'")->fetchColumn();
    $lowStockCount = (int)$pdo->query("SELECT COUNT(*) FROM productos WHERE estado = 'Activo' AND stock_actual <= stock_minimo")->fetchColumn();
    
    $expiringCount = (int)$pdo->query("SELECT COUNT(*) FROM lotes WHERE cantidad_actual > 0 AND fecha_vencimiento >= date('now') AND fecha_vencimiento <= date('now', '+90 days')")->fetchColumn();
    $expiredCount = (int)$pdo->query("SELECT COUNT(*) FROM lotes WHERE cantidad_actual > 0 AND fecha_vencimiento < date('now')")->fetchColumn();

    $valuation = (float)$pdo->query("SELECT COALESCE(SUM(l.cantidad_actual * l.precio_compra_lote), 0) FROM lotes l JOIN productos p ON l.producto_id = p.id WHERE p.estado = 'Activo'")->fetchColumn();

    return [
        'total_productos' => $totalProducts,
        'total_unidades' => $totalUnits,
        'bajo_stock_count' => $lowStockCount,
        'proximos_vencer_count' => $expiringCount,
        'vencidos_count' => $expiredCount,
        'valoracion_inventario' => round($valuation, 2)
    ];
}

function getLotes(PDO $pdo, array $filters = []): array
{
    $sql = "SELECT l.*, p.codigo AS producto_codigo, p.nombre_comercial, p.principio_activo, p.presentacion,
                   CAST((julianday(l.fecha_vencimiento) - julianday('now')) AS INTEGER) AS dias_para_vencer
            FROM lotes l
            JOIN productos p ON l.producto_id = p.id
            WHERE 1=1";
    $params = [];

    if (!empty($filters['producto_id'])) {
        $sql .= " AND l.producto_id = ?";
        $params[] = (int)$filters['producto_id'];
    }

    if (!empty($filters['estado'])) {
        $sql .= " AND l.estado = ?";
        $params[] = $filters['estado'];
    }

    if (!empty($filters['solo_con_stock'])) {
        $sql .= " AND l.cantidad_actual > 0";
    }

    if (!empty($filters['dias_alerta'])) {
        $dias = (int)$filters['dias_alerta'];
        $sql .= " AND l.fecha_vencimiento <= date('now', '+$dias days') AND l.cantidad_actual > 0";
    }

    // FEFO: First Expired, First Out
    $sql .= " ORDER BY l.fecha_vencimiento ASC, l.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $lotes = $stmt->fetchAll();

    foreach ($lotes as &$l) {
        $dias = (int)$l['dias_para_vencer'];
        if ($dias < 0) {
            $l['alerta_texto'] = "VENCIDO hace " . abs($dias) . " días";
            $l['alerta_nivel'] = "danger";
        } elseif ($dias <= 30) {
            $l['alerta_texto'] = "Crítico: vence en $dias días";
            $l['alerta_nivel'] = "critical";
        } elseif ($dias <= 90) {
            $l['alerta_texto'] = "Atención: vence en $dias días";
            $l['alerta_nivel'] = "warning";
        } else {
            $l['alerta_texto'] = "Vigente ($dias días restantes)";
            $l['alerta_nivel'] = "good";
        }
    }

    return $lotes;
}

function saveLote(PDO $pdo, array $data, ?int $id = null): array
{
    $productoId = (int)($data['producto_id'] ?? 0);
    $numeroLote = trim($data['numero_lote'] ?? '');
    $fechaVenc = trim($data['fecha_vencimiento'] ?? '');

    if ($productoId <= 0 || $numeroLote === '' || $fechaVenc === '') {
        throw new InvalidArgumentException('Producto, número de lote y fecha de vencimiento son requeridos.');
    }

    $fechaFab = !empty($data['fecha_fabricacion']) ? trim($data['fecha_fabricacion']) : null;
    $cantidad = max(0, (int)($data['cantidad'] ?? 0));
    $precioCompra = max(0, (float)($data['precio_compra_lote'] ?? 0));

    return atomic($pdo, function () use ($pdo, $id, $productoId, $numeroLote, $fechaVenc, $fechaFab, $cantidad, $precioCompra): array {
        $today = new DateTime('now');
        $expDate = new DateTime($fechaVenc);
        $diffDays = (int)$today->diff($expDate)->format('%r%a');

        $estado = 'DISPONIBLE';
        if ($diffDays < 0) {
            $estado = 'VENCIDO';
        } elseif ($diffDays <= 90) {
            $estado = 'PROXIMO_A_VENCER';
        }

        if ($id === null) {
            $stmt = $pdo->prepare("INSERT INTO lotes 
                (producto_id, numero_lote, fecha_vencimiento, fecha_fabricacion, cantidad_inicial, cantidad_actual, precio_compra_lote, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$productoId, $numeroLote, $fechaVenc, $fechaFab, $cantidad, $cantidad, $precioCompra, $estado]);
            $id = (int)$pdo->lastInsertId();

            if ($cantidad > 0) {
                // Actualizar stock de producto
                $pdo->exec("UPDATE productos SET stock_actual = stock_actual + $cantidad WHERE id = $productoId");
                // Registrar movimiento
                $p = $pdo->query("SELECT stock_actual FROM productos WHERE id = $productoId")->fetch();
                $stmtMov = $pdo->prepare("INSERT INTO movimientos_inventario 
                    (producto_id, lote_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id)
                    VALUES (?, ?, 'ENTRADA', ?, ?, ?, 'Alta o reposición manual de lote', 'LOTE_NUEVO', ?, ?)");
                $userId = $_SESSION['user']['id'] ?? 'u1';
                $stmtMov->execute([$productoId, $id, $cantidad, $p['stock_actual'] - $cantidad, $p['stock_actual'], $id, $userId]);
            }
            logActivity($pdo, 'CREAR_LOTE', 'lotes', (string)$id, "Lote $numeroLote creado con $cantidad unidades");
        } else {
            $stmt = $pdo->prepare("UPDATE lotes SET numero_lote = ?, fecha_vencimiento = ?, fecha_fabricacion = ?, precio_compra_lote = ?, estado = ? WHERE id = ?");
            $stmt->execute([$numeroLote, $fechaVenc, $fechaFab, $precioCompra, $estado, $id]);
            logActivity($pdo, 'ACTUALIZAR_LOTE', 'lotes', (string)$id, "Lote $numeroLote actualizado");
        }

        $stmt = $pdo->prepare("SELECT * FROM lotes WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    });
}

function getStockMovements(PDO $pdo, array $filters = []): array
{
    $sql = "SELECT m.*, p.codigo AS producto_codigo, p.nombre_comercial, l.numero_lote, u.name AS usuario_nombre
            FROM movimientos_inventario m
            JOIN productos p ON m.producto_id = p.id
            LEFT JOIN lotes l ON m.lote_id = l.id
            LEFT JOIN users u ON m.usuario_id = u.id
            WHERE 1=1";
    $params = [];

    if (!empty($filters['producto_id'])) {
        $sql .= " AND m.producto_id = ?";
        $params[] = (int)$filters['producto_id'];
    }

    if (!empty($filters['tipo'])) {
        $sql .= " AND m.tipo = ?";
        $params[] = $filters['tipo'];
    }

    if (!empty($filters['desde'])) {
        $sql .= " AND date(m.created_at) >= ?";
        $params[] = $filters['desde'];
    }

    if (!empty($filters['hasta'])) {
        $sql .= " AND date(m.created_at) <= ?";
        $params[] = $filters['hasta'];
    }

    $sql .= " ORDER BY m.id DESC LIMIT " . (!empty($filters['limit']) ? (int)$filters['limit'] : 150);

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function adjustStock(PDO $pdo, int $productoId, int $loteId, int $cantidad, string $tipo, string $motivo, string $userId): array
{
    if ($cantidad <= 0) {
        throw new InvalidArgumentException('La cantidad debe ser mayor a 0.');
    }
    if (!in_array($tipo, ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'], true)) {
        throw new InvalidArgumentException('Tipo de ajuste inválido.');
    }
    if (trim($motivo) === '') {
        throw new InvalidArgumentException('El motivo de ajuste es obligatorio para auditoría.');
    }

    return atomic($pdo, function () use ($pdo, $productoId, $loteId, $cantidad, $tipo, $motivo, $userId): array {
        $lote = $pdo->query("SELECT * FROM lotes WHERE id = $loteId AND producto_id = $productoId")->fetch();
        if (!$lote) {
            throw new RuntimeException('Lote no encontrado para el producto seleccionado.');
        }

        $prod = $pdo->query("SELECT stock_actual, nombre_comercial, codigo FROM productos WHERE id = $productoId")->fetch();
        $stockAntProd = (int)$prod['stock_actual'];
        $stockAntLote = (int)$lote['cantidad_actual'];

        if ($tipo === 'AJUSTE_NEGATIVO') {
            if ($stockAntLote < $cantidad) {
                throw new RuntimeException("El lote tiene solo $stockAntLote unidades disponibles. No se puede reducir $cantidad.");
            }
            $stockNuevoProd = max(0, $stockAntProd - $cantidad);
            $stockNuevoLote = $stockAntLote - $cantidad;
        } else {
            $stockNuevoProd = $stockAntProd + $cantidad;
            $stockNuevoLote = $stockAntLote + $cantidad;
        }

        // Actualizar Lote
        $estadoLote = $lote['estado'];
        if ($stockNuevoLote === 0) {
            $estadoLote = 'AGOTADO';
        } elseif ($estadoLote === 'AGOTADO') {
            $estadoLote = 'DISPONIBLE';
        }
        $stmtLote = $pdo->prepare("UPDATE lotes SET cantidad_actual = ?, estado = ? WHERE id = ?");
        $stmtLote->execute([$stockNuevoLote, $estadoLote, $loteId]);

        // Actualizar Producto
        $stmtProd = $pdo->prepare("UPDATE productos SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmtProd->execute([$stockNuevoProd, $productoId]);

        // Registrar Movimiento de Kardex
        $stmtMov = $pdo->prepare("INSERT INTO movimientos_inventario 
            (producto_id, lote_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'AJUSTE_MANUAL', ?, ?)");
        $stmtMov->execute([$productoId, $loteId, $tipo, $cantidad, $stockAntProd, $stockNuevoProd, $motivo, $loteId, $userId]);
        $movId = (int)$pdo->lastInsertId();

        logActivity($pdo, $tipo, 'inventario', (string)$productoId, "Ajuste $tipo de $cantidad unidades en {$prod['codigo']} ({$prod['nombre_comercial']}). Motivo: $motivo");

        return [
            'movimiento_id' => $movId,
            'producto_id' => $productoId,
            'lote_id' => $loteId,
            'stock_anterior' => $stockAntProd,
            'stock_nuevo' => $stockNuevoProd,
            'stock_lote_nuevo' => $stockNuevoLote
        ];
    });
}
