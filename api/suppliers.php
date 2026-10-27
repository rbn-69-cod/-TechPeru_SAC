<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/pharmacy_catalog.php';
require_once dirname(__DIR__) . '/services/purchases.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'list_suppliers';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list_suppliers') {
        jsonResponse(['success' => true, 'suppliers' => getSuppliers($pdo)]);
    }

    if ($action === 'list_purchases') {
        $filters = [
            'proveedor_id' => $_GET['proveedor_id'] ?? '',
            'desde' => $_GET['desde'] ?? '',
            'hasta' => $_GET['hasta'] ?? '',
            'limit' => $_GET['limit'] ?? 50
        ];
        jsonResponse(['success' => true, 'purchases' => getPurchases($pdo, $filters)]);
    }

    if ($action === 'purchase_detail') {
        $id = (int)($_GET['id'] ?? 0);
        $purchase = getPurchaseDetails($pdo, $id);
        if (!$purchase) jsonError('Compra no encontrada.', 404);
        jsonResponse(['success' => true, 'purchase' => $purchase]);
    }

    jsonError('Acción no soportada.', 400);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $user = requirePharmacyRole(['Compras', 'Inventario', 'Farmacéutico']);

    if ($action === 'save_supplier') {
        $id = !empty($input['id']) ? (int)$input['id'] : null;
        try {
            $prov = saveSupplier($pdo, $input, $id);
            jsonResponse(['success' => true, 'message' => 'Proveedor guardado correctamente.', 'supplier' => $prov]);
        } catch (InvalidArgumentException $e) {
            jsonError($e->getMessage(), 422);
        }
    }

    if ($action === 'create_purchase') {
        try {
            $compra = registerPurchase($pdo, $input, $user['id']);
            jsonResponse(['success' => true, 'message' => 'Compra y recepción de mercadería registrada. Stock y lotes actualizados.', 'purchase' => $compra]);
        } catch (InvalidArgumentException $e) {
            jsonError($e->getMessage(), 422);
        } catch (Exception $e) {
            jsonError('Error al registrar compra: ' . $e->getMessage(), 500);
        }
    }

    jsonError('Acción no soportada.', 400);
}

