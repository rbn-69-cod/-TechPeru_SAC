<?php
/**
 * Seeder de datos iniciales para el Sistema Integral de Gestión de Botica TechPeru SAC
 * Carga de plantillas oficiales de Laboratorios, Proveedores y Medicamentos
 */

function seedPharmacyData(PDO $pdo): void {
    // Si ya hay productos, no duplicar la carga inicial
    $prodCount = (int)$pdo->query("SELECT COUNT(*) FROM productos")->fetchColumn();
    if ($prodCount > 0) {
        return;
    }

    // 1. Configuraciones iniciales de Botica
    $settings = [
        ['botica_nombre', 'TechPeru SAC — Botica & Salud', 'Razón social y nombre comercial'],
        ['botica_ruc', '20601234567', 'RUC fiscal para emisión de comprobantes'],
        ['botica_direccion', 'Av. República de Panamá 3545, San Isidro, Lima - Perú', 'Dirección fiscal'],
        ['botica_telefono', '+51 1 710-5000', 'Central telefónica de botica'],
        ['botica_email', 'farmacia@techperu.pe', 'Correo electrónico de contacto'],
        ['botica_igv_pct', '18.0', 'Porcentaje de IGV aplicable'],
        ['botica_dias_alerta_vencimiento', '90', 'Días límite para alerta preventiva de vencimiento FEFO'],
        ['medizano_gateway_url', 'http://127.0.0.1:8090', 'URL del Gateway de microservicios MediZano'],
        ['medizano_sync_enabled', '1', 'Habilitar sincronización con MediZano (1=Sí, 0=No)']
    ];
    $stmtSet = $pdo->prepare("INSERT OR REPLACE INTO botica_settings (clave, valor, descripcion) VALUES (?, ?, ?)");
    foreach ($settings as $s) {
        $stmtSet->execute($s);
    }

    // 2. Usuarios de Farmacia adicionales (sin tocar los usuarios BSC existentes)
    $hasMainAdmin = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE id = 'u1'")->fetchColumn() > 0;
    if ($hasMainAdmin) {
        $hash = password_hash('BSC2026!', PASSWORD_DEFAULT);
        $pharmUsers = [
            ['u_farmacia', 'Q.F. Carlos Sánchez', 'farmaceutico@techperu.pe', 'Farmacéutico', 'Farmacia & Dispensación', $hash],
            ['u_cajero', 'Ana Lucía Torres', 'caja@techperu.pe', 'Cajero', 'Caja & Atención al Cliente', $hash],
            ['u_inventario', 'Marco Aurelio Gómez', 'inventario@techperu.pe', 'Inventario', 'Almacén & Cadena de Suministro', $hash]
        ];
        $stmtUser = $pdo->prepare("INSERT OR IGNORE INTO users (id, name, email, role, area, password, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)");
        foreach ($pharmUsers as $u) {
            $stmtUser->execute([$u[0], $u[1], $u[2], $u[3], $u[4], $u[5]]);
        }
    }

    // 3. Categorías de Productos
    $categorias = [
        ['Analgésicos y Antiinflamatorios', 'Medicamentos para alivio del dolor e inflamación'],
        ['Antibióticos y Antimicrobianos', 'Tratamiento de infecciones bacterianas con receta médica'],
        ['Antigripales y Respiratorios', 'Descongestionantes, antihistamínicos y jarabes'],
        ['Gastrointestinales', 'Antiácidos, protectores gástricos y digestivos'],
        ['Cardiovasculares', 'Control de hipertensión y salud cardiovascular'],
        ['Vitaminas y Suplementos', 'Complejos vitamínicos y minerales'],
        ['Cuidado Personal y Primeros Auxilios', 'Higiene, antisépticos y material médico']
    ];
    $stmtCat = $pdo->prepare("INSERT OR IGNORE INTO categorias_producto (nombre, descripcion) VALUES (?, ?)");
    foreach ($categorias as $c) {
        $stmtCat->execute($c);
    }

    // Mapa de categorías para asignación rápida
    $catMap = [];
    $rows = $pdo->query("SELECT id, nombre FROM categorias_producto")->fetchAll();
    foreach ($rows as $r) {
        $catMap[$r['nombre']] = (int)$r['id'];
    }

    // 4. Laboratorios (Desde CSV o Fallback oficial)
    $labCsv = '/Users/pc/Downloads/Plantilla_Laboratorios.csv';
    $labs = [];
    if (file_exists($labCsv)) {
        if (($h = fopen($labCsv, 'r')) !== false) {
            $header = fgetcsv($h, 0, ',', '"', '\\');
            while (($row = fgetcsv($h, 0, ',', '"', '\\')) !== false) {
                if (count($row) >= 6 && !empty(trim($row[0]))) {
                    $labs[] = [
                        'codigo' => trim($row[0]),
                        'nombre' => trim($row[1]),
                        'ruc' => trim($row[2]),
                        'contacto' => trim($row[3]),
                        'telefono' => trim($row[4]),
                        'email' => trim($row[5])
                    ];
                }
            }
            fclose($h);
        }
    }
    if (empty($labs)) {
        $labs = [
            ['codigo' => 'PORTUGAL', 'nombre' => 'Laboratorios Portugal S.R.L.', 'ruc' => '20100154871', 'contacto' => 'Dr. Fernando Delgado', 'telefono' => '+51 54 234567', 'email' => 'portugal@univer.lat'],
            ['codigo' => 'MEDIFARMA', 'nombre' => 'Medifarma S.A.', 'ruc' => '20100045612', 'contacto' => 'Ing. Alberto Benavides', 'telefono' => '+51 1 315-0500', 'email' => 'medifarma@univer.lat'],
            ['codigo' => 'ROEMMERS', 'nombre' => 'Laboratorio Roemmers S.A.', 'ruc' => '20100078945', 'contacto' => 'Ventas Farmacia', 'telefono' => '+51 1 462-1200', 'email' => 'roemmers@univer.lat'],
            ['codigo' => 'GENFAR', 'nombre' => 'Genfar Laboratorios S.A.', 'ruc' => '20124567891', 'contacto' => 'Lic. Marina Soto', 'telefono' => '+51 1 213-9000', 'email' => 'genfar@univer.lat'],
            ['codigo' => 'FARMINDUSTRIA', 'nombre' => 'Farmindustria S.A.', 'ruc' => '20100098765', 'contacto' => 'Atención Comercial', 'telefono' => '+51 1 313-1600', 'email' => 'farmindustria@univer.lat']
        ];
    }
    $stmtLab = $pdo->prepare("INSERT OR IGNORE INTO laboratorios (codigo, nombre, ruc, contacto, telefono, email) VALUES (?, ?, ?, ?, ?, ?)");
    foreach ($labs as $lab) {
        $stmtLab->execute([$lab['codigo'], $lab['nombre'], $lab['ruc'], $lab['contacto'], $lab['telefono'], $lab['email']]);
    }

    $labMap = [];
    $rows = $pdo->query("SELECT id, codigo, nombre FROM laboratorios")->fetchAll();
    foreach ($rows as $r) {
        $labMap[strtoupper($r['codigo'])] = (int)$r['id'];
        $labMap[strtoupper($r['nombre'])] = (int)$r['id'];
    }

    // 5. Proveedores (Desde CSV o Fallback oficial)
    $provCsv = '/Users/pc/Downloads/Plantilla_Proveedores.csv';
    $provs = [];
    if (file_exists($provCsv)) {
        if (($h = fopen($provCsv, 'r')) !== false) {
            $header = fgetcsv($h, 0, ',', '"', '\\');
            while (($row = fgetcsv($h, 0, ',', '"', '\\')) !== false) {
                if (count($row) >= 6 && !empty(trim($row[1]))) {
                    $provs[] = [
                        'razon_social' => trim($row[0]),
                        'ruc' => trim($row[1]),
                        'telefono' => trim($row[2]),
                        'email' => trim($row[3]),
                        'direccion' => trim($row[4]),
                        'ciudad' => trim($row[5])
                    ];
                }
            }
            fclose($h);
        }
    }
    if (empty($provs)) {
        $provs = [
            ['razon_social' => 'Droguería Farmacéutica del Sur S.A.C.', 'ruc' => '20551000091', 'telefono' => '+51 987 654 321', 'email' => 'ventas@univer.lat', 'direccion' => 'Av. Tacna 234', 'ciudad' => 'Lima'],
            ['razon_social' => 'Distribuidora Médica San Borja S.A.C.', 'ruc' => '20601234567', 'telefono' => '+51 1 456-7890', 'email' => 'contacto@univer.lat', 'direccion' => 'Av. Javier Prado Este 1250', 'ciudad' => 'Lima'],
            ['razon_social' => 'Droguería Central Perú S.R.L.', 'ruc' => '20459876543', 'telefono' => '+51 912 345 678', 'email' => 'pedidos@univer.lat', 'direccion' => 'Jr. Lampa 840', 'ciudad' => 'Lima']
        ];
    }
    $stmtProv = $pdo->prepare("INSERT OR IGNORE INTO proveedores (ruc, razon_social, telefono, email, direccion, ciudad) VALUES (?, ?, ?, ?, ?, ?)");
    foreach ($provs as $pr) {
        $stmtProv->execute([$pr['ruc'], $pr['razon_social'], $pr['telefono'], $pr['email'], $pr['direccion'], $pr['ciudad']]);
    }

    // 6. Clientes Iniciales
    $clientes = [
        ['VARIOS', '00000000', 'CLIENTES VARIOS - PUBLICO GENERAL', '+51 000 0000', 'publico@botica.local', 'Mostrador Principal'],
        ['DNI', '45892314', 'Juan Carlos Pérez Morales', '+51 984 123 456', 'juan.perez@gmail.com', 'Calle Los Jazmines 342, Surco'],
        ['DNI', '72154896', 'María del Pilar Rodríguez Campos', '+51 991 789 012', 'maria.rodriguez@outlook.com', 'Av. Benavides 1890 Dpto 402, Miraflores'],
        ['DNI', '10485963', 'Dr. Jorge Antonio Valdivia Ruiz', '+51 977 456 123', 'jorge.valdivia@clinica.pe', 'Av. Arequipa 2450, Lince'],
        ['RUC', '20548912345', 'CLINICA SAN GABRIEL S.A.C.', '+51 1 614-2222', 'compras@clinicasangabriel.pe', 'Av. Marina 2955, San Miguel']
    ];
    $stmtCli = $pdo->prepare("INSERT OR IGNORE INTO clientes (tipo_documento, numero_documento, nombre_razon_social, telefono, email, direccion) VALUES (?, ?, ?, ?, ?, ?)");
    foreach ($clientes as $cli) {
        $stmtCli->execute($cli);
    }

    // 7. Productos y Medicamentos
    // Combinamos las plantillas de medicamentos
    $medList = [
        // Código, Barcode, Nombre, Principio, Concentración, Presentación, LabCode, Precio Compra, Precio Venta, Stock Min, Stock Inicial, Receta (1/0), CatName
        ['MED-001', '7750100100018', 'Panadol Antigripal', 'Paracetamol + Clorfenamina + Fenilefrina', '500mg / 2mg / 5mg', 'Caja x 100 tabletas', 'PORTUGAL', 1.20, 2.00, 20, 150, 0, 'Antigripales y Respiratorios'],
        ['MED-002', '7750100100025', 'Amoxil 500mg', 'Amoxicilina Trihidrato', '500 mg', 'Caja x 50 cápsulas', 'MEDIFARMA', 2.50, 4.00, 15, 45, 1, 'Antibióticos y Antimicrobianos'],
        ['MED-003', '7750100100032', 'Apronax 550mg', 'Naproxeno Sódico', '550 mg', 'Caja x 20 tabletas', 'ROEMMERS', 1.80, 3.50, 15, 80, 0, 'Analgésicos y Antiinflamatorios'],
        ['MED-004', '7750100100049', 'Nastizol Compuesto', 'Paracetamol + Pseudoefedrina + Clorfenamina', '500mg / 60mg / 4mg', 'Caja x 20 comprimidos', 'FARMINDUSTRIA', 1.00, 1.80, 25, 200, 0, 'Antigripales y Respiratorios'],
        ['MED-005', '7750100100056', 'Bismutol Suspensión', 'Subsalicilato de bismuto', '262 mg / 15ml', 'Frasco x 150 ml', 'PORTUGAL', 15.00, 22.50, 10, 30, 0, 'Gastrointestinales'],
        ['MED-006', '7750100100063', 'Clavulin 500/125mg', 'Amoxicilina + Ácido Clavulánico', '500 mg / 125 mg', 'Caja x 14 tabletas', 'MEDIFARMA', 3.80, 6.50, 10, 25, 1, 'Antibióticos y Antimicrobianos'],
        ['MED-007', '7750100100070', 'Aspirina 100 Protect', 'Ácido Acetilsalicílico', '100 mg', 'Caja x 30 tabletas', 'FARMINDUSTRIA', 0.50, 1.00, 30, 120, 0, 'Cardiovasculares'],
        ['MED-008', '7750100100087', 'Losartán Potásico 50mg', 'Losartán Potásico', '50 mg', 'Caja x 30 tabletas', 'GENFAR', 0.40, 0.90, 25, 90, 1, 'Cardiovasculares'],
        ['MED-009', '7750100100094', 'Salbutamol Inhalador', 'Salbutamol Sulfato', '100 mcg / dosis', 'Frasco aerosol 200 dosis', 'FARMINDUSTRIA', 8.50, 14.00, 10, 18, 1, 'Antigripales y Respiratorios'],
        ['MED-101', '7750100100100', 'Paracetamol Genérico 500 mg', 'Paracetamol', '500 mg', 'Caja x 100 tabletas', 'PORTUGAL', 8.50, 15.00, 20, 100, 0, 'Analgésicos y Antiinflamatorios'],
        ['MED-102', '7750100100117', 'Amoxicilina Genérica 500 mg', 'Amoxicilina', '500 mg', 'Caja x 50 cápsulas', 'MEDIFARMA', 17.50, 28.00, 15, 150, 1, 'Antibióticos y Antimicrobianos'],
        ['MED-103', '7750100100124', 'Ibuprofeno 400 mg', 'Ibuprofeno', '400 mg', 'Caja x 100 tabletas', 'GENFAR', 11.00, 18.50, 20, 50, 0, 'Analgésicos y Antiinflamatorios'],
        ['MED-104', '7750100100131', 'Omeprazol 20 mg', 'Omeprazol', '20 mg', 'Caja x 30 cápsulas', 'ROEMMERS', 12.00, 24.00, 15, 120, 0, 'Gastrointestinales'],
        ['MED-105', '7750100100148', 'Loratadina 10 mg', 'Loratadina', '10 mg', 'Caja x 30 tabletas', 'FARMINDUSTRIA', 6.80, 12.50, 10, 40, 0, 'Antigripales y Respiratorios'],
        ['MED-106', '7750100100155', 'Alcohol Medicinal 70°', 'Alcohol Etílico 70°', '70 %', 'Frasco x 1000 ml', 'PORTUGAL', 4.50, 8.00, 15, 60, 0, 'Cuidado Personal y Primeros Auxilios'],
        ['MED-107', '7750100100162', 'Vitamina C + Zinc Efervescente', 'Ácido Ascórbico + Zinc', '1000 mg / 10 mg', 'Tubo x 10 tabletas', 'ROEMMERS', 9.50, 16.00, 12, 45, 0, 'Vitaminas y Suplementos']
    ];

    $stmtProd = $pdo->prepare("INSERT INTO productos 
        (codigo, codigo_barras, nombre_comercial, principio_activo, concentracion, presentacion, categoria_id, laboratorio_id, precio_compra, precio_venta, stock_minimo, stock_actual, receta_medica, ubicacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $stmtLote = $pdo->prepare("INSERT INTO lotes 
        (producto_id, numero_lote, fecha_vencimiento, fecha_fabricacion, cantidad_inicial, cantidad_actual, precio_compra_lote, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    $stmtMov = $pdo->prepare("INSERT INTO movimientos_inventario
        (producto_id, lote_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $defaultLabId = (int)$pdo->query("SELECT id FROM laboratorios LIMIT 1")->fetchColumn();
    $defaultCatId = (int)$pdo->query("SELECT id FROM categorias_producto LIMIT 1")->fetchColumn();

    $today = new DateTime('2026-10-27');

    foreach ($medList as $idx => $m) {
        $labId = $labMap[strtoupper($m[6])] ?? $defaultLabId;
        $catId = $catMap[$m[12]] ?? $defaultCatId;
        $ubicacion = 'Anaquel ' . chr(65 + ($idx % 5)) . '-' . (($idx % 4) + 1);

        $stmtProd->execute([
            $m[0], $m[1], $m[2], $m[3], $m[4], $m[5], $catId, $labId,
            $m[7], $m[8], $m[9], $m[10], $m[11], $ubicacion
        ]);
        $prodId = (int)$pdo->lastInsertId();

        // Creamos lotes realistas con política FEFO:
        // Lote 1: lote próximo o en rotación (ej. vence en 45 a 120 días)
        // Lote 2: lote posterior (ej. vence en 2027) si el stock > 50
        $qtyTotal = (int)$m[10];
        if ($qtyTotal > 60) {
            $qtyLote1 = (int)ceil($qtyTotal * 0.4);
            $qtyLote2 = $qtyTotal - $qtyLote1;

            // Lote 1 (Próximo para alertar FEFO)
            $exp1 = (clone $today)->modify('+' . (45 + ($idx * 5)) . ' days')->format('Y-m-d');
            $fab1 = (clone $today)->modify('-180 days')->format('Y-m-d');
            $loteNum1 = 'LT-' . date('Y') . '-0' . ($idx + 1) . 'A';
            $estado1 = (new DateTime($exp1) <= (clone $today)->modify('+90 days')) ? 'PROXIMO_A_VENCER' : 'DISPONIBLE';

            $stmtLote->execute([$prodId, $loteNum1, $exp1, $fab1, $qtyLote1, $qtyLote1, $m[7], $estado1]);
            $loteId1 = (int)$pdo->lastInsertId();

            $initialUser = $hasMainAdmin ? 'u1' : null;
            $stmtMov->execute([$prodId, $loteId1, 'ENTRADA', $qtyLote1, 0, $qtyLote1, 'Stock inicial por inventario físico de apertura', 'INVENTARIO_INICIAL', null, $initialUser]);

            // Lote 2 (Más lejano en 2027/2028)
            $exp2 = (clone $today)->modify('+' . (400 + ($idx * 15)) . ' days')->format('Y-m-d');
            $fab2 = (clone $today)->modify('-30 days')->format('Y-m-d');
            $loteNum2 = 'LT-' . date('Y') . '-0' . ($idx + 1) . 'B';

            $stmtLote->execute([$prodId, $loteNum2, $exp2, $fab2, $qtyLote2, $qtyLote2, $m[7], 'DISPONIBLE']);
            $loteId2 = (int)$pdo->lastInsertId();

            $stmtMov->execute([$prodId, $loteId2, 'ENTRADA', $qtyLote2, $qtyLote1, $qtyTotal, 'Stock inicial por inventario físico de apertura', 'INVENTARIO_INICIAL', null, $initialUser]);
        } else {
            // Lote único
            $exp = (clone $today)->modify('+' . (60 + ($idx * 20)) . ' days')->format('Y-m-d');
            $fab = (clone $today)->modify('-120 days')->format('Y-m-d');
            $loteNum = 'LT-' . date('Y') . '-0' . ($idx + 1);
            $estado = (new DateTime($exp) <= (clone $today)->modify('+90 days')) ? 'PROXIMO_A_VENCER' : 'DISPONIBLE';

            $stmtLote->execute([$prodId, $loteNum, $exp, $fab, $qtyTotal, $qtyTotal, $m[7], $estado]);
            $loteId = (int)$pdo->lastInsertId();

            $initialUser = $hasMainAdmin ? 'u1' : null;
            $stmtMov->execute([$prodId, $loteId, 'ENTRADA', $qtyTotal, 0, $qtyTotal, 'Stock inicial por inventario físico de apertura', 'INVENTARIO_INICIAL', null, $initialUser]);
        }
    }

    if (!$hasMainAdmin) {
        return;
    }

    // 8. Apertura de Turno de Caja para el día de hoy
    $stmtTurno = $pdo->prepare("INSERT INTO caja_turnos 
        (usuario_id, monto_apertura, total_ventas_efectivo, total_ventas_tarjeta, total_ventas_digital, total_ingresos, total_egresos, fecha_apertura, estado, observaciones)
        VALUES (?, ?, 0, 0, 0, 0, 0, datetime('now'), 'ABIERTO', 'Turno matutino aperturado para atención al cliente y dispensación')");
    $stmtTurno->execute(['u1', 350.00]);
    $turnoId = (int)$pdo->lastInsertId();

    // Movimiento inicial de apertura
    $stmtCajaMov = $pdo->prepare("INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto, usuario_id) VALUES (?, ?, ?, ?, ?)");
    $stmtCajaMov->execute([$turnoId, 'INGRESO', 350.00, 'Fondo de apertura de caja y sencillo', 'u1']);

    // 9. Simular 2 ventas demostrativas para que el Dashboard y los reportes muestren métricas reales de inmediato
    // Venta 1: Panadol + Apronax (Boleta B001-00000001)
    $prod1 = $pdo->query("SELECT id, precio_venta FROM productos WHERE codigo='MED-001'")->fetch();
    $lote1 = $pdo->query("SELECT id FROM lotes WHERE producto_id = " . (int)$prod1['id'] . " ORDER BY fecha_vencimiento ASC LIMIT 1")->fetch();

    $prod3 = $pdo->query("SELECT id, precio_venta FROM productos WHERE codigo='MED-003'")->fetch();
    $lote3 = $pdo->query("SELECT id FROM lotes WHERE producto_id = " . (int)$prod3['id'] . " ORDER BY fecha_vencimiento ASC LIMIT 1")->fetch();

    $sub1 = 2 * (float)$prod1['precio_venta']; // 2 * 2.00 = 4.00
    $sub2 = 3 * (float)$prod3['precio_venta']; // 3 * 3.50 = 10.50
    $totalVenta1 = $sub1 + $sub2; // 14.50
    $subtotalNeto1 = round($totalVenta1 / 1.18, 2);
    $igv1 = round($totalVenta1 - $subtotalNeto1, 2);

    $stmtVenta = $pdo->prepare("INSERT INTO ventas 
        (codigo_venta, turno_id, cliente_id, usuario_id, subtotal, igv, descuento, total, metodo_pago, monto_recibido, vuelto, estado, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'COMPLETADA', datetime('now', '-3 hours'))");
    $stmtVenta->execute(['VTA-2026-00001', $turnoId, 2, 'u1', $subtotalNeto1, $igv1, $totalVenta1, 'EFECTIVO', 20.00, 5.50]);
    $ventaId1 = (int)$pdo->lastInsertId();

    $stmtDet = $pdo->prepare("INSERT INTO detalle_ventas (venta_id, producto_id, lote_id, cantidad, precio_unitario, subtotal, igv, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtDet->execute([$ventaId1, $prod1['id'], $lote1['id'], 2, $prod1['precio_venta'], round(4.00/1.18, 2), round(4.00 - (4.00/1.18), 2), 4.00]);
    $stmtDet->execute([$ventaId1, $prod3['id'], $lote3['id'], 3, $prod3['precio_venta'], round(10.50/1.18, 2), round(10.50 - (10.50/1.18), 2), 10.50]);

    // Deducción de stock FEFO en Lote y Producto
    $pdo->exec("UPDATE lotes SET cantidad_actual = cantidad_actual - 2 WHERE id = " . (int)$lote1['id']);
    $pdo->exec("UPDATE productos SET stock_actual = stock_actual - 2 WHERE id = " . (int)$prod1['id']);
    $pdo->exec("UPDATE lotes SET cantidad_actual = cantidad_actual - 3 WHERE id = " . (int)$lote3['id']);
    $pdo->exec("UPDATE productos SET stock_actual = stock_actual - 3 WHERE id = " . (int)$prod3['id']);

    // Comprobantes
    $stmtComp = $pdo->prepare("INSERT INTO comprobantes 
        (venta_id, tipo, serie, numero, numero_completo, cliente_tipo_doc, cliente_doc, cliente_nombre, subtotal, igv, total, tipo_comprobante_fiscal, estado_sunat, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INTERNO', 'EMITIDO_LOCAL', datetime('now', '-3 hours'))");
    $stmtComp->execute([$ventaId1, 'BOLETA', 'B001', 1, 'B001-00000001', 'DNI', '45892314', 'Juan Carlos Pérez Morales', $subtotalNeto1, $igv1, $totalVenta1]);

    // Actualizar acumulado del turno de caja
    $pdo->exec("UPDATE caja_turnos SET total_ventas_efectivo = total_ventas_efectivo + 14.50 WHERE id = $turnoId");

    // Venta 2: Omeprazol 20mg (Boleta B001-00000002) vía YAPE
    $prod4 = $pdo->query("SELECT id, precio_venta FROM productos WHERE codigo='MED-104'")->fetch();
    $lote4 = $pdo->query("SELECT id FROM lotes WHERE producto_id = " . (int)$prod4['id'] . " ORDER BY fecha_vencimiento ASC LIMIT 1")->fetch();

    $totalVenta2 = 1 * (float)$prod4['precio_venta']; // 24.00
    $subtotalNeto2 = round($totalVenta2 / 1.18, 2);
    $igv2 = round($totalVenta2 - $subtotalNeto2, 2);

    $stmtVenta->execute(['VTA-2026-00002', $turnoId, 3, 'u1', $subtotalNeto2, $igv2, $totalVenta2, 'YAPE', 24.00, 0.00]);
    $ventaId2 = (int)$pdo->lastInsertId();

    $stmtDet->execute([$ventaId2, $prod4['id'], $lote4['id'], 1, $prod4['precio_venta'], $subtotalNeto2, $igv2, $totalVenta2]);
    $pdo->exec("UPDATE lotes SET cantidad_actual = cantidad_actual - 1 WHERE id = " . (int)$lote4['id']);
    $pdo->exec("UPDATE productos SET stock_actual = stock_actual - 1 WHERE id = " . (int)$prod4['id']);

    $stmtComp->execute([$ventaId2, 'BOLETA', 'B001', 2, 'B001-00000002', 'DNI', '72154896', 'María del Pilar Rodríguez Campos', $subtotalNeto2, $igv2, $totalVenta2]);

    $pdo->exec("UPDATE caja_turnos SET total_ventas_digital = total_ventas_digital + 24.00 WHERE id = $turnoId");
}
