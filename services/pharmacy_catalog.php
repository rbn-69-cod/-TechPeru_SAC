<?php
/**
 * Servicio de Catálogo de Productos, Laboratorios, Proveedores y Clientes
 * Botica TechPeru SAC
 */

require_once dirname(__DIR__) . '/repositories/records.php';

function getProducts(PDO $pdo, array $filters = []): array
{
    $sql = "SELECT p.*, c.nombre AS categoria_nombre, l.nombre AS laboratorio_nombre, l.codigo AS laboratorio_codigo
            FROM productos p
            LEFT JOIN categorias_producto c ON p.categoria_id = c.id
            LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
            WHERE 1=1";
    $params = [];

    if (!empty($filters['search'])) {
        $search = '%' . trim($filters['search']) . '%';
        $sql .= " AND (p.codigo LIKE ? OR p.codigo_barras LIKE ? OR p.nombre_comercial LIKE ? OR p.principio_activo LIKE ?)";
        $params[] = $search;
        $params[] = $search;
        $params[] = $search;
        $params[] = $search;
    }

    if (!empty($filters['categoria_id'])) {
        $sql .= " AND p.categoria_id = ?";
        $params[] = (int)$filters['categoria_id'];
    }

    if (!empty($filters['laboratorio_id'])) {
        $sql .= " AND p.laboratorio_id = ?";
        $params[] = (int)$filters['laboratorio_id'];
    }

    if (isset($filters['estado']) && $filters['estado'] !== '') {
        $sql .= " AND p.estado = ?";
        $params[] = $filters['estado'];
    }

    if (!empty($filters['solo_bajo_stock'])) {
        $sql .= " AND p.stock_actual <= p.stock_minimo";
    }

    if (isset($filters['receta_medica']) && $filters['receta_medica'] !== '') {
        $sql .= " AND p.receta_medica = ?";
        $params[] = (int)$filters['receta_medica'];
    }

    $sql .= " ORDER BY p.nombre_comercial ASC";

    if (!empty($filters['limit'])) {
        $sql .= " LIMIT " . (int)$filters['limit'];
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    // Obtener información de lotes disponibles por producto
    $loteStmt = $pdo->prepare("SELECT id, numero_lote, fecha_vencimiento, cantidad_actual, estado 
                               FROM lotes 
                               WHERE producto_id = ? AND cantidad_actual > 0 
                               ORDER BY fecha_vencimiento ASC");

    foreach ($products as &$p) {
        $loteStmt->execute([$p['id']]);
        $p['lotes'] = $loteStmt->fetchAll();
        $p['is_low_stock'] = (int)$p['stock_actual'] <= (int)$p['stock_minimo'];
        $p['precio_compra'] = (float)$p['precio_compra'];
        $p['precio_venta'] = (float)$p['precio_venta'];
        $p['stock_actual'] = (int)$p['stock_actual'];
        $p['stock_minimo'] = (int)$p['stock_minimo'];
        $p['receta_medica'] = (int)$p['receta_medica'];
    }

    return $products;
}

function getProductById(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare("SELECT p.*, c.nombre AS categoria_nombre, l.nombre AS laboratorio_nombre
                           FROM productos p
                           LEFT JOIN categorias_producto c ON p.categoria_id = c.id
                           LEFT JOIN laboratorios l ON p.laboratorio_id = l.id
                           WHERE p.id = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) return null;

    $loteStmt = $pdo->prepare("SELECT * FROM lotes WHERE producto_id = ? ORDER BY fecha_vencimiento ASC");
    $loteStmt->execute([$id]);
    $p['lotes'] = $loteStmt->fetchAll();
    $p['is_low_stock'] = (int)$p['stock_actual'] <= (int)$p['stock_minimo'];
    return $p;
}

function saveProduct(PDO $pdo, array $data, ?int $id = null): array
{
    $codigo = trim($data['codigo'] ?? '');
    $nombre = trim($data['nombre_comercial'] ?? '');
    $principio = trim($data['principio_activo'] ?? '');

    if ($codigo === '' || $nombre === '' || $principio === '') {
        throw new InvalidArgumentException('Código, nombre comercial y principio activo son obligatorios.');
    }

    $barCode = !empty($data['codigo_barras']) ? trim($data['codigo_barras']) : null;
    $concentracion = trim($data['concentracion'] ?? '');
    $presentacion = trim($data['presentacion'] ?? '');
    $catId = !empty($data['categoria_id']) ? (int)$data['categoria_id'] : null;
    $labId = !empty($data['laboratorio_id']) ? (int)$data['laboratorio_id'] : null;
    $precioCompra = max(0, (float)($data['precio_compra'] ?? 0));
    $precioVenta = max(0, (float)($data['precio_venta'] ?? 0));
    $stockMin = max(1, (int)($data['stock_minimo'] ?? 10));
    $receta = !empty($data['receta_medica']) ? 1 : 0;
    $ubicacion = trim($data['ubicacion'] ?? '');
    $estado = in_array($data['estado'] ?? 'Activo', ['Activo', 'Inactivo'], true) ? $data['estado'] : 'Activo';

    if ($id === null) {
        $stmt = $pdo->prepare("INSERT INTO productos 
            (codigo, codigo_barras, nombre_comercial, principio_activo, concentracion, presentacion, categoria_id, laboratorio_id, precio_compra, precio_venta, stock_minimo, stock_actual, receta_medica, ubicacion, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)");
        $stmt->execute([$codigo, $barCode, $nombre, $principio, $concentracion, $presentacion, $catId, $labId, $precioCompra, $precioVenta, $stockMin, $receta, $ubicacion, $estado]);
        $id = (int)$pdo->lastInsertId();
        logActivity($pdo, 'CREAR_PRODUCTO', 'productos', (string)$id, "Producto creado: $codigo - $nombre");
    } else {
        $stmt = $pdo->prepare("UPDATE productos SET 
            codigo = ?, codigo_barras = ?, nombre_comercial = ?, principio_activo = ?, concentracion = ?, presentacion = ?, categoria_id = ?, laboratorio_id = ?, precio_compra = ?, precio_venta = ?, stock_minimo = ?, receta_medica = ?, ubicacion = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?");
        $stmt->execute([$codigo, $barCode, $nombre, $principio, $concentracion, $presentacion, $catId, $labId, $precioCompra, $precioVenta, $stockMin, $receta, $ubicacion, $estado, $id]);
        logActivity($pdo, 'ACTUALIZAR_PRODUCTO', 'productos', (string)$id, "Producto actualizado: $codigo - $nombre");
    }

    return getProductById($pdo, $id);
}

function getLaboratories(PDO $pdo): array
{
    return $pdo->query("SELECT * FROM laboratorios ORDER BY nombre ASC")->fetchAll();
}

function saveLaboratory(PDO $pdo, array $data, ?int $id = null): array
{
    $codigo = strtoupper(trim($data['codigo'] ?? ''));
    $nombre = trim($data['nombre'] ?? '');
    if ($codigo === '' || $nombre === '') {
        throw new InvalidArgumentException('Código y nombre de laboratorio son obligatorios.');
    }
    $ruc = trim($data['ruc'] ?? '');
    $contacto = trim($data['contacto'] ?? '');
    $telefono = trim($data['telefono'] ?? '');
    $email = trim($data['email'] ?? '');
    $estado = ($data['estado'] ?? 'Activo') === 'Inactivo' ? 'Inactivo' : 'Activo';

    if ($id === null) {
        $stmt = $pdo->prepare("INSERT INTO laboratorios (codigo, nombre, ruc, contacto, telefono, email, estado) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$codigo, $nombre, $ruc, $contacto, $telefono, $email, $estado]);
        $id = (int)$pdo->lastInsertId();
        logActivity($pdo, 'CREAR_LABORATORIO', 'laboratorios', (string)$id, "Laboratorio creado: $codigo - $nombre");
    } else {
        $stmt = $pdo->prepare("UPDATE laboratorios SET codigo = ?, nombre = ?, ruc = ?, contacto = ?, telefono = ?, email = ?, estado = ? WHERE id = ?");
        $stmt->execute([$codigo, $nombre, $ruc, $contacto, $telefono, $email, $estado, $id]);
        logActivity($pdo, 'ACTUALIZAR_LABORATORIO', 'laboratorios', (string)$id, "Laboratorio actualizado: $codigo - $nombre");
    }

    $stmt = $pdo->prepare("SELECT * FROM laboratorios WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function getSuppliers(PDO $pdo): array
{
    return $pdo->query("SELECT * FROM proveedores ORDER BY razon_social ASC")->fetchAll();
}

function saveSupplier(PDO $pdo, array $data, ?int $id = null): array
{
    $ruc = trim($data['ruc'] ?? '');
    $razonSocial = trim($data['razon_social'] ?? '');
    if ($ruc === '' || $razonSocial === '') {
        throw new InvalidArgumentException('RUC y Razón Social son obligatorios.');
    }
    $telefono = trim($data['telefono'] ?? '');
    $email = trim($data['email'] ?? '');
    $direccion = trim($data['direccion'] ?? '');
    $ciudad = trim($data['ciudad'] ?? 'Lima');
    $contacto = trim($data['contacto'] ?? '');
    $estado = ($data['estado'] ?? 'Activo') === 'Inactivo' ? 'Inactivo' : 'Activo';

    if ($id === null) {
        $stmt = $pdo->prepare("INSERT INTO proveedores (ruc, razon_social, telefono, email, direccion, ciudad, contacto, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$ruc, $razonSocial, $telefono, $email, $direccion, $ciudad, $contacto, $estado]);
        $id = (int)$pdo->lastInsertId();
        logActivity($pdo, 'CREAR_PROVEEDOR', 'proveedores', (string)$id, "Proveedor creado: $ruc - $razonSocial");
    } else {
        $stmt = $pdo->prepare("UPDATE proveedores SET ruc = ?, razon_social = ?, telefono = ?, email = ?, direccion = ?, ciudad = ?, contacto = ?, estado = ? WHERE id = ?");
        $stmt->execute([$ruc, $razonSocial, $telefono, $email, $direccion, $ciudad, $contacto, $estado, $id]);
        logActivity($pdo, 'ACTUALIZAR_PROVEEDOR', 'proveedores', (string)$id, "Proveedor actualizado: $ruc - $razonSocial");
    }

    $stmt = $pdo->prepare("SELECT * FROM proveedores WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function getCategories(PDO $pdo): array
{
    return $pdo->query("SELECT * FROM categorias_producto ORDER BY nombre ASC")->fetchAll();
}

function getCustomers(PDO $pdo, string $search = ''): array
{
    if ($search !== '') {
        $s = '%' . trim($search) . '%';
        $stmt = $pdo->prepare("SELECT * FROM clientes WHERE numero_documento LIKE ? OR nombre_razon_social LIKE ? ORDER BY nombre_razon_social ASC LIMIT 50");
        $stmt->execute([$s, $s]);
        return $stmt->fetchAll();
    }
    return $pdo->query("SELECT * FROM clientes ORDER BY nombre_razon_social ASC LIMIT 100")->fetchAll();
}

function saveCustomer(PDO $pdo, array $data, ?int $id = null): array
{
    $tipoDoc = strtoupper(trim($data['tipo_documento'] ?? 'DNI'));
    $numDoc = trim($data['numero_documento'] ?? '');
    $nombre = trim($data['nombre_razon_social'] ?? '');

    if ($numDoc === '' || $nombre === '') {
        throw new InvalidArgumentException('Número de documento y Nombre o Razón Social son requeridos.');
    }

    $telefono = trim($data['telefono'] ?? '');
    $email = trim($data['email'] ?? '');
    $direccion = trim($data['direccion'] ?? '');
    $estado = ($data['estado'] ?? 'Activo') === 'Inactivo' ? 'Inactivo' : 'Activo';

    if ($id === null) {
        $stmt = $pdo->prepare("INSERT INTO clientes (tipo_documento, numero_documento, nombre_razon_social, telefono, email, direccion, estado) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$tipoDoc, $numDoc, $nombre, $telefono, $email, $direccion, $estado]);
        $id = (int)$pdo->lastInsertId();
        logActivity($pdo, 'CREAR_CLIENTE', 'clientes', (string)$id, "Cliente creado: $numDoc - $nombre");
    } else {
        $stmt = $pdo->prepare("UPDATE clientes SET tipo_documento = ?, numero_documento = ?, nombre_razon_social = ?, telefono = ?, email = ?, direccion = ?, estado = ? WHERE id = ?");
        $stmt->execute([$tipoDoc, $numDoc, $nombre, $telefono, $email, $direccion, $estado, $id]);
        logActivity($pdo, 'ACTUALIZAR_CLIENTE', 'clientes', (string)$id, "Cliente actualizado: $numDoc - $nombre");
    }

    $stmt = $pdo->prepare("SELECT * FROM clientes WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
}
