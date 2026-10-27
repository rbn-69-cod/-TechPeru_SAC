<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/inventory.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'summary';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'summary') {
        jsonResponse(['success' => true, 'summary' => getInventorySummary($pdo)]);
    }

    if ($action === 'lotes') {
        $filters = [
            'producto_id' => $_GET['producto_id'] ?? '',
            'estado' => $_GET['estado'] ?? '',
            'solo_con_stock' => !empty($_GET['solo_con_stock']),
            'dias_alerta' => $_GET['dias_alerta'] ?? ''
        ];
        $lotes = getLotes($pdo, $filters);
        jsonResponse(['success' => true, 'lotes' => $lotes, 'total' => count($lotes)]);
    }

    if ($action === 'movements') {
        $filters = [
            'producto_id' => $_GET['producto_id'] ?? '',
            'tipo' => $_GET['tipo'] ?? '',
            'desde' => $_GET['desde'] ?? '',
            'hasta' => $_GET['hasta'] ?? '',
            'limit' => $_GET['limit'] ?? 100
        ];
        $movs = getStockMovements($pdo, $filters);
        jsonResponse(['success' => true, 'movements' => $movs, 'total' => count($movs)]);
    }

    jsonError('Acción no reconocida.', 400);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $user = requirePharmacyRole(['Farmacéutico', 'Inventario']);

    if ($action === 'save_lote') {
        $id = !empty($input['id']) ? (int)$input['id'] : null;
        try {
            $lote = saveLote($pdo, $input, $id);
            jsonResponse(['success' => true, 'message' => 'Lote guardado con éxito.', 'lote' => $lote]);
        } catch (InvalidArgumentException $e) {
            jsonError($e->getMessage(), 422);
        } catch (Exception $e) {
            jsonError($e->getMessage(), 500);
        }
    }

    if ($action === 'adjust') {
        $productoId = (int)($input['producto_id'] ?? 0);
        $loteId = (int)($input['lote_id'] ?? 0);
        $cantidad = (int)($input['cantidad'] ?? 0);
        $tipo = trim($input['tipo'] ?? '');
        $motivo = trim($input['motivo'] ?? '');

        if ($productoId <= 0 || $loteId <= 0 || $cantidad <= 0 || $motivo === '') {
            jsonError('Producto, lote, cantidad mayor a 0 y motivo son obligatorios.', 422);
        }

        try {
            $res = adjustStock($pdo, $productoId, $loteId, $cantidad, $tipo, $motivo, $user['id']);
            jsonResponse(['success' => true, 'message' => 'Ajuste de inventario aplicado con éxito.', 'data' => $res]);
        } catch (RuntimeException $e) {
            jsonError($e->getMessage(), 400);
        } catch (Exception $e) {
            jsonError($e->getMessage(), 500);
        }
    }

    jsonError('Acción no soportada.', 400);
}

