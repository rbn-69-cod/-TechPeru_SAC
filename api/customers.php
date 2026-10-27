<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/pharmacy_catalog.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'list';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $search = $_GET['search'] ?? '';
    $customers = getCustomers($pdo, $search);
    jsonResponse(['success' => true, 'customers' => $customers, 'total' => count($customers)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    requirePharmacyRole(['Farmacéutico', 'Cajero', 'Compras']);

    try {
        $id = !empty($input['id']) ? (int)$input['id'] : null;
        $customer = saveCustomer($pdo, $input, $id);
        jsonResponse(['success' => true, 'message' => 'Cliente guardado correctamente.', 'customer' => $customer]);
    } catch (InvalidArgumentException $e) {
        jsonError($e->getMessage(), 422);
    } catch (Exception $e) {
        jsonError('Error al guardar cliente: ' . $e->getMessage(), 500);
    }
}

