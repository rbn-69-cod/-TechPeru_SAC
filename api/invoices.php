<?php
require_once __DIR__ . '/common.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'list';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list') {
        $sql = "SELECT c.*, v.codigo_venta, v.metodo_pago, v.estado AS venta_estado, u.name AS cajero_nombre
                FROM comprobantes c
                JOIN ventas v ON c.venta_id = v.id
                JOIN users u ON v.usuario_id = u.id
                WHERE 1=1";
        $params = [];

        if (!empty($_GET['tipo'])) {
            $sql .= " AND c.tipo = ?";
            $params[] = $_GET['tipo'];
        }

        if (!empty($_GET['desde'])) {
            $sql .= " AND date(c.created_at) >= ?";
            $params[] = $_GET['desde'];
        }

        if (!empty($_GET['hasta'])) {
            $sql .= " AND date(c.created_at) <= ?";
            $params[] = $_GET['hasta'];
        }

        if (!empty($_GET['search'])) {
            $s = '%' . trim($_GET['search']) . '%';
            $sql .= " AND (c.numero_completo LIKE ? OR c.cliente_nombre LIKE ? OR c.cliente_doc LIKE ?)";
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $sql .= " ORDER BY c.id DESC LIMIT 100";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $invoices = $stmt->fetchAll();

        jsonResponse(['success' => true, 'invoices' => $invoices, 'total' => count($invoices)]);
    }

    if ($action === 'detail') {
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT c.*, v.codigo_venta, v.metodo_pago, v.monto_recibido, v.vuelto, v.descuento, v.estado AS venta_estado, u.name AS cajero_nombre
                               FROM comprobantes c
                               JOIN ventas v ON c.venta_id = v.id
                               JOIN users u ON v.usuario_id = u.id
                               WHERE c.id = ?");
        $stmt->execute([$id]);
        $inv = $stmt->fetch();
        if (!$inv) jsonError('Comprobante no encontrado.', 404);

        $stmtDet = $pdo->prepare("SELECT d.*, p.codigo AS producto_codigo, p.nombre_comercial, p.presentacion, l.numero_lote
                                  FROM detalle_ventas d
                                  JOIN productos p ON d.producto_id = p.id
                                  JOIN lotes l ON d.lote_id = l.id
                                  WHERE d.venta_id = ?");
        $stmtDet->execute([$inv['venta_id']]);
        $inv['items'] = $stmtDet->fetchAll();

        jsonResponse(['success' => true, 'invoice' => $inv]);
    }

    jsonError('Acción no soportada.', 400);
}
