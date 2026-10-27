<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/pharmacy_catalog.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'list';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'detail') {
        $id = (int)($_GET['id'] ?? 0);
        $prod = getProductById($pdo, $id);
        if (!$prod) jsonError('Producto no encontrado.', 404);
        jsonResponse(['success' => true, 'product' => $prod]);
    }

    if ($action === 'categories') {
        jsonResponse(['success' => true, 'categories' => getCategories($pdo)]);
    }

    if ($action === 'laboratories') {
        jsonResponse(['success' => true, 'laboratories' => getLaboratories($pdo)]);
    }

    // Default list
    $filters = [
        'search' => $_GET['search'] ?? '',
        'categoria_id' => $_GET['categoria_id'] ?? '',
        'laboratorio_id' => $_GET['laboratorio_id'] ?? '',
        'estado' => $_GET['estado'] ?? '',
        'solo_bajo_stock' => !empty($_GET['solo_bajo_stock']),
        'receta_medica' => $_GET['receta_medica'] ?? ''
    ];
    $products = getProducts($pdo, $filters);
    jsonResponse(['success' => true, 'products' => $products, 'total' => count($products)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();

    if ($action === 'save') {
        requirePharmacyRole(['Farmacéutico', 'Inventario', 'Compras']);
        $id = !empty($input['id']) ? (int)$input['id'] : null;
        try {
            $product = saveProduct($pdo, $input, $id);
            jsonResponse(['success' => true, 'message' => 'Producto guardado con éxito.', 'product' => $product]);
        } catch (InvalidArgumentException $e) {
            jsonError($e->getMessage(), 422);
        }
    }

    if ($action === 'save_laboratory') {
        requirePharmacyRole(['Farmacéutico', 'Inventario', 'Compras']);
        $id = !empty($input['id']) ? (int)$input['id'] : null;
        try {
            $lab = saveLaboratory($pdo, $input, $id);
            jsonResponse(['success' => true, 'message' => 'Laboratorio guardado con éxito.', 'laboratory' => $lab]);
        } catch (InvalidArgumentException $e) {
            jsonError($e->getMessage(), 422);
        }
    }

    if ($action === 'delete') {
        requirePharmacyRole(['Farmacéutico', 'Inventario']);
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) jsonError('ID de producto inválido.', 422);

        $pdo->prepare("UPDATE productos SET estado = 'Inactivo', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$id]);
        logActivity($pdo, 'INACTIVAR_PRODUCTO', 'productos', (string)$id, "Producto ID $id marcado como inactivo");
        jsonResponse(['success' => true, 'message' => 'Producto inactivado correctamente.']);
    }

    jsonError('Acción no soportada.', 400);
}

