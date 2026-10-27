<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/pos_sales.php';
require_once dirname(__DIR__) . '/services/medizano_client.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'recent_sales';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'search_products') {
        $q = trim($_GET['q'] ?? '');
        $sql = "SELECT p.*, l.nombre AS laboratorio_nombre, c.nombre AS categoria_nombre
                FROM productos p
                LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                LEFT JOIN categorias_producto c ON p.categoria_id = c.id
                WHERE p.estado = 'Activo' AND p.stock_actual > 0";
        $params = [];
        if ($q !== '') {
            $like = '%' . $q . '%';
            $sql .= " AND (p.codigo LIKE ? OR p.codigo_barras LIKE ? OR p.nombre_comercial LIKE ? OR p.principio_activo LIKE ?)";
            $params = [$like, $like, $like, $like];
        }
        $sql .= " ORDER BY p.nombre_comercial ASC LIMIT 30";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll();

        // Cargar lotes FEFO disponibles
        $stmtLote = $pdo->prepare("SELECT id, numero_lote, fecha_vencimiento, cantidad_actual 
                                   FROM lotes 
                                   WHERE producto_id = ? AND cantidad_actual > 0 AND fecha_vencimiento >= date('now')
                                   ORDER BY fecha_vencimiento ASC");
        foreach ($products as &$p) {
            $stmtLote->execute([$p['id']]);
            $p['lotes_fefo'] = $stmtLote->fetchAll();
            $p['precio_venta'] = (float)$p['precio_venta'];
            $p['stock_actual'] = (int)$p['stock_actual'];
        }

        jsonResponse(['success' => true, 'products' => $products]);
    }

    if ($action === 'active_shift') {
        $user = requireAuth();
        $shift = getActiveShift($pdo, $user['id']);
        jsonResponse(['success' => true, 'has_active_shift' => $shift !== null, 'shift' => $shift]);
    }

    if ($action === 'sale_detail') {
        $id = (int)($_GET['id'] ?? 0);
        $sale = getSaleDetails($pdo, $id);
        if (!$sale) jsonError('Venta no encontrada.', 404);
        jsonResponse(['success' => true, 'sale' => $sale]);
    }

    if ($action === 'recent_sales') {
        $sales = getRecentSales($pdo, [
            'desde' => $_GET['desde'] ?? '',
            'hasta' => $_GET['hasta'] ?? '',
            'estado' => $_GET['estado'] ?? '',
            'search' => $_GET['search'] ?? '',
            'limit' => $_GET['limit'] ?? 50
        ]);
        jsonResponse(['success' => true, 'sales' => $sales, 'total' => count($sales)]);
    }

    jsonError('Acción no soportada.', 400);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $user = requirePharmacyRole(['Farmacéutico', 'Cajero']);

    if ($action === 'create_sale') {
        try {
            $result = processSale($pdo, $input, $user['id']);

            // Intentar sincronización opcional no bloqueante con MediZano si está activo
            $medizanoClient = new MediZanoClient();
            $syncRes = $medizanoClient->syncOrderToMediZano([
                'orderCode' => $result['codigo_venta'],
                'total' => $result['total'],
                'paymentMethod' => $result['metodo_pago']
            ]);
            $result['medizano_sync'] = $syncRes;

            jsonResponse(['success' => true, 'message' => 'Venta registrada y comprobante emitido.', 'sale' => $result]);
        } catch (InvalidArgumentException $e) {
            jsonError($e->getMessage(), 422);
        } catch (RuntimeException $e) {
            jsonError($e->getMessage(), 400);
        } catch (Throwable $e) {
            jsonError('Error inesperado al procesar venta: ' . $e->getMessage(), 500);
        }
    }

    if ($action === 'void_sale') {
        $ventaId = (int)($input['venta_id'] ?? 0);
        $motivo = trim($input['motivo'] ?? '');
        if ($ventaId <= 0 || $motivo === '') {
            jsonError('ID de venta y motivo de anulación son obligatorios.', 422);
        }

        try {
            $result = voidSale($pdo, $ventaId, $motivo, $user['id']);
            jsonResponse(['success' => true, 'message' => 'Venta anulada y stock retornado a inventario correctamente.', 'void' => $result]);
        } catch (RuntimeException $e) {
            jsonError($e->getMessage(), 400);
        } catch (Exception $e) {
            jsonError('Error inesperado al anular venta: ' . $e->getMessage(), 500);
        }
    }

    jsonError('Acción no soportada.', 400);
}
