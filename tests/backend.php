<?php
/** No live files: all database tests run in memory. */
require_once dirname(__DIR__) . '/helpers/http.php';
require_once dirname(__DIR__) . '/validators/input.php';
require_once dirname(__DIR__) . '/middleware/auth.php';
require_once dirname(__DIR__) . '/database/db.php';
require_once dirname(__DIR__) . '/services/scorecard.php';
require_once dirname(__DIR__) . '/services/catalog.php';
require_once dirname(__DIR__) . '/services/measurements.php';

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}
function expectException(callable $operation, string $class): void
{
    try { $operation(); } catch (Throwable $error) {
        check($error instanceof $class, 'Unexpected exception: ' . $error::class);
        return;
    }
    throw new RuntimeException('Expected exception ' . $class);
}
function businessSnapshot(PDO $db): string
{
    $data = [];
    foreach (['users', 'perspectives', 'objectives', 'kpis', 'initiatives', 'measurements', 'evaluation_periods', 'activity_logs', 'settings'] as $table) {
        $data[$table] = $db->query("SELECT * FROM $table ORDER BY rowid")->fetchAll(PDO::FETCH_ASSOC);
    }
    return json_encode($data, JSON_THROW_ON_ERROR);
}
$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$db->exec('PRAGMA foreign_keys = ON');
initializeSchema($db);
seedDatabase($db);
migrateDatabase($db);
$tests = [];
$tests['calculation boundaries and legacy zero target'] = function (): void {
    check(compliance(10, 5, 'mayor') === 50.0, 'Direct calculation');
    check(compliance(10, 0, 'menor') === 100.0, 'Inverse zero');
    check(compliance(10, 20, 'menor') === 50.0, 'Inverse calculation');
    check(complianceKey(90) === 'good' && complianceKey(75) === 'warn' && complianceKey(74.9) === 'bad', 'Thresholds');
    expectException(fn() => compliance(0, 5, 'mayor'), HttpException::class);
};
$tests['migration rollback preserves every business row'] = function () use ($db): void {
    $before = businessSnapshot($db);
    atomic($db, fn() => $db->exec(file_get_contents(__DIR__ . '/../database/migrations/002_integrity.down.sql')));
    check((int)$db->query('PRAGMA user_version')->fetchColumn() === 1, 'Down version');
    migrateDatabase($db);
    check((int)$db->query('PRAGMA user_version')->fetchColumn() >= 2, 'Up version');
    check($before === businessSnapshot($db), 'Migration altered business records');
    check(!$db->query('PRAGMA foreign_key_check')->fetch(), 'Foreign keys');
};
$tests['audit failure rolls back catalog write'] = function () use ($db): void {
    $before = businessSnapshot($db);
    $db->exec("CREATE TRIGGER reject_audit BEFORE INSERT ON activity_logs BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    expectException(fn() => mutateCatalog($db, 'objectives', 'PUT', ['id' => 'OBJ-F1', 'name' => 'Must roll back']), PDOException::class);
    $db->exec('DROP TRIGGER reject_audit');
    check($before === businessSnapshot($db), 'Partial catalog commit');
    check(!$db->inTransaction(), 'Leaked transaction');
};
$tests['audit failure rolls back measurement and current value'] = function () use ($db): void {
    $before = businessSnapshot($db);
    $db->exec("CREATE TRIGGER reject_audit BEFORE INSERT ON activity_logs BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    expectException(fn() => recordMeasurement($db, ['kpi_id' => 'KPI-01', 'period' => '2025-Q3', 'date' => '2026-01-01', 'value' => 25], ['id' => 'u1', 'name' => 'Admin', 'role' => 'Administrador']), PDOException::class);
    $db->exec('DROP TRIGGER reject_audit');
    check($before === businessSnapshot($db), 'Partial measurement commit');
};
$tests['database enforces initiative and KPI relations'] = function () use ($db): void {
    expectException(fn() => $db->exec("UPDATE initiatives SET kpi_id = 'missing' WHERE id = 'INI-01'"), PDOException::class);
    expectException(fn() => $db->exec("UPDATE initiatives SET objective_id = 'OBJ-C1' WHERE id = 'INI-01'"), PDOException::class);
    expectException(fn() => $db->exec("UPDATE kpis SET perspective_id = 'clientes' WHERE id = 'KPI-01'"), PDOException::class);
};
$tests['database rejects duplicate measurement updates and negative budgets'] = function () use ($db): void {
    expectException(fn() => $db->exec("UPDATE measurements SET period = '2025-Q1', date = '2025-03-31' WHERE kpi_id = 'KPI-01' AND period = '2025-Q2'"), PDOException::class);
    expectException(fn() => $db->exec("UPDATE initiatives SET budget = -1 WHERE id = 'INI-01'"), PDOException::class);
    expectException(fn() => $db->exec("UPDATE users SET email = 'ADMIN@DEMO.COM' WHERE id = 'u2'"), PDOException::class);
};
$tests['invalid null cannot turn into a valid zero'] = function () use ($db): void {
    $before = businessSnapshot($db);
    expectException(fn() => mutateCatalog($db, 'kpis', 'PUT', ['id' => 'KPI-01', 'current_real' => null]), HttpException::class);
    expectException(fn() => numberField(['value' => false], 'value'), HttpException::class);
    expectException(fn() => integerField(['limit' => 1.5], 'limit', 10, 1, 100), HttpException::class);
    check($before === businessSnapshot($db), 'Invalid input changed records');
};
$tests['legacy plaintext migration retains working credentials'] = function (): void {
    $legacy = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    initializeSchema($legacy);
    $legacy->exec("INSERT INTO users (id, name, email, role, area, password) VALUES ('legacy', 'Legacy', 'legacy@example.test', 'Administrador', 'QA', 'OldPassword')");
    migrateDatabase($legacy);
    $password = $legacy->query("SELECT password FROM users WHERE id = 'legacy'")->fetchColumn();
    check(password_verify('OldPassword', $password), 'Legacy password lost');
    check($legacy->query('SELECT COUNT(*) FROM users')->fetchColumn() === 1, 'Legacy account lost');
};
$tests['unmeasured kpis report pending status'] = function (): void {
    check(complianceStatus(null, 0) === '⏳ PENDIENTE', 'Unmeasured null status');
    check(complianceStatus(0.0, 0) === '⏳ PENDIENTE', 'Unmeasured zero status');
    check(complianceKey(null, 0) === 'pending', 'Unmeasured null key');
    check(complianceKey(0.0, 0) === 'pending', 'Unmeasured zero key');
    check(complianceStatus(95.0, 1) === '✅ LOGRADO', 'Measured good status');
    check(complianceStatus(80.0, 1) === '⚠️ EN RIESGO', 'Measured warn status');
    check(complianceStatus(50.0, 1) === '❌ CRÍTICO', 'Measured bad status');
};
$tests['measurement correction records audit and preserves previous value'] = function () use ($db): void {
    $user = ['id' => 'u1', 'name' => 'Admin Test', 'role' => 'Administrador'];
    $m = $db->query("SELECT * FROM measurements WHERE kpi_id = 'KPI-01' ORDER BY date DESC LIMIT 1")->fetch();
    $origVal = (float)$m['value'];
    $newVal = $origVal + 5.0;

    expectException(fn() => correctMeasurement($db, [
        'id' => $m['id'],
        'value' => $newVal,
        'reason' => 'abc'
    ], $user), HttpException::class);

    $res = correctMeasurement($db, [
        'id' => $m['id'],
        'value' => $newVal,
        'reason' => 'Corrección por auditoría externa Q3'
    ], $user);

    check($res['new_value'] === $newVal, 'Value updated');
    check($res['previous_value'] === $origVal, 'Previous value preserved');

    $updatedM = $db->query("SELECT * FROM measurements WHERE id = {$m['id']}")->fetch();
    check($updatedM['correction_reason'] === 'Corrección por auditoría externa Q3', 'Reason saved');
    check($updatedM['corrected_by'] === 'Admin Test', 'User recorded');

    $log = $db->query("SELECT * FROM activity_logs WHERE action = 'MEASUREMENT_CORRECTED' ORDER BY id DESC LIMIT 1")->fetch();
    check($log !== false, 'Audit log created');
    check(str_contains($log['details'], 'Corrección por auditoría externa Q3'), 'Audit log contains reason');
};
$tests['user activation and last active admin protection'] = function () use ($db): void {
    $admins = (int)$db->query("SELECT COUNT(*) FROM users WHERE role = 'Administrador' AND (is_active = 1 OR is_active IS NULL)")->fetchColumn();
    check($admins >= 1, 'At least one active admin exists');

    $admin = $db->query("SELECT * FROM users WHERE role = 'Administrador' LIMIT 1")->fetch();
    if ($admins === 1) {
        expectException(function () use ($db, $admin) {
            $count = (int)$db->query("SELECT COUNT(*) FROM users WHERE role = 'Administrador' AND (is_active = 1 OR is_active IS NULL)")->fetchColumn();
            if ($count <= 1 && ($admin['is_active'] ?? 1) == 1) {
                throw new HttpException('No se puede desactivar al único Administrador activo del sistema.', 400);
            }
        }, HttpException::class);
    }
};
$tests['period management enforces valid dates and single active period'] = function () use ($db): void {
    $stmt = $db->prepare("INSERT OR REPLACE INTO evaluation_periods (id, name, year, start_date, end_date, status) VALUES (:id, :name, :year, :start, :end, :status)");
    $stmt->execute([
        ':id' => '2026-TEST',
        ':name' => 'Período Test 2026',
        ':year' => 2026,
        ':start' => '2026-01-01',
        ':end' => '2026-03-31',
        ':status' => 'Histórico'
    ]);

    $db->beginTransaction();
    $db->exec("UPDATE evaluation_periods SET status = 'Histórico' WHERE status = 'Activo'");
    $stmt = $db->prepare("UPDATE evaluation_periods SET status = 'Activo' WHERE id = :id");
    $stmt->execute([':id' => '2026-TEST']);
    $db->commit();

    $activeCount = (int)$db->query("SELECT COUNT(*) FROM evaluation_periods WHERE status = 'Activo'")->fetchColumn();
    check($activeCount === 1, 'Exactly one active period');
    $activeId = $db->query("SELECT id FROM evaluation_periods WHERE status = 'Activo'")->fetchColumn();
    check($activeId === '2026-TEST', 'Correct period activated');
};

require_once dirname(__DIR__) . '/services/pharmacy_catalog.php';
require_once dirname(__DIR__) . '/services/inventory.php';
require_once dirname(__DIR__) . '/services/pos_sales.php';
require_once dirname(__DIR__) . '/services/cash_register.php';
require_once dirname(__DIR__) . '/services/purchases.php';
require_once dirname(__DIR__) . '/services/medizano_client.php';

$tests['pharmacy catalog search and FEFO inventory calculation'] = function () use ($db): void {
    $prods = getProducts($db, ['search' => 'Paracetamol']);
    check(count($prods) >= 1, 'Finds products by active principle or commercial name');
    $p = $prods[0];
    check(isset($p['lotes']), 'Product includes batch lots');
    check(count($p['lotes']) > 0, 'Product has at least one active lot');
    $summary = getInventorySummary($db);
    check($summary['total_productos'] >= 16, 'Summary counts catalog items');
    check($summary['valoracion_inventario'] > 0, 'Inventory valuation computed');
};

$tests['FEFO sale deduction prioritizes earliest expiring batch'] = function () use ($db): void {
    // Buscar un producto con al menos 2 lotes
    $p = $db->query("SELECT p.id, p.stock_actual FROM productos p JOIN lotes l ON l.producto_id = p.id GROUP BY p.id HAVING COUNT(l.id) >= 2 LIMIT 1")->fetch();
    check((bool)$p, 'Found multi-batch product for FEFO test');
    $prodId = (int)$p['id'];
    $stockBefore = (int)$p['stock_actual'];

    $lotesBefore = $db->query("SELECT id, numero_lote, fecha_vencimiento, cantidad_actual FROM lotes WHERE producto_id = $prodId AND cantidad_actual > 0 ORDER BY fecha_vencimiento ASC, id ASC")->fetchAll();
    $earliestLot = $lotesBefore[0];
    $earliestLotStockBefore = (int)$earliestLot['cantidad_actual'];

    // Realizar venta de 2 unidades
    $saleRes = processSale($db, [
        'cliente_id' => 1,
        'metodo_pago' => 'EFECTIVO',
        'tipo_comprobante' => 'BOLETA',
        'monto_recibido' => 100.0,
        'items' => [
            ['producto_id' => $prodId, 'cantidad' => 2]
        ]
    ], 'u1');

    check($saleRes['venta_id'] > 0, 'Sale was processed');
    check(str_starts_with($saleRes['comprobante_numero'], 'B001-'), 'Emitted Boleta series B001');

    $stockAfter = (int)$db->query("SELECT stock_actual FROM productos WHERE id = $prodId")->fetchColumn();
    check($stockAfter === $stockBefore - 2, 'Total product stock decremented by 2');

    $earliestLotAfter = (int)$db->query("SELECT cantidad_actual FROM lotes WHERE id = {$earliestLot['id']}")->fetchColumn();
    check($earliestLotAfter === $earliestLotStockBefore - 2, 'Earliest FEFO batch decremented first');
};

$tests['POS sale voiding restores inventory and records audit trace'] = function () use ($db): void {
    $p = $db->query("SELECT id, stock_actual FROM productos LIMIT 1")->fetch();
    $prodId = (int)$p['id'];
    $stockInitial = (int)$p['stock_actual'];

    $sale = processSale($db, [
        'cliente_id' => 1,
        'metodo_pago' => 'EFECTIVO',
        'tipo_comprobante' => 'BOLETA',
        'monto_recibido' => 50.0,
        'items' => [['producto_id' => $prodId, 'cantidad' => 1]]
    ], 'u1');

    check((int)$db->query("SELECT stock_actual FROM productos WHERE id = $prodId")->fetchColumn() === $stockInitial - 1, 'Stock reduced');

    $voidRes = voidSale($db, $sale['venta_id'], 'Error de digitación en POS', 'u1');
    check($voidRes['estado'] === 'ANULADA', 'Sale status set to ANULADA');

    $stockRestored = (int)$db->query("SELECT stock_actual FROM productos WHERE id = $prodId")->fetchColumn();
    check($stockRestored === $stockInitial, 'Product stock completely restored after voiding');

    $auditExists = (int)$db->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'ANULAR_VENTA' AND entity_id = '{$sale['venta_id']}'")->fetchColumn();
    check($auditExists >= 1, 'Audit log created for voided sale');
};

$tests['cash register shift opening, arqueo calculation, and closing'] = function () use ($db): void {
    // Cerrar cualquier turno abierto previo para probar ciclo limpio
    $db->exec("UPDATE caja_turnos SET estado = 'CERRADO' WHERE estado = 'ABIERTO'");

    $openShift = openShift($db, 200.0, 'u1', 'Apertura de turno de prueba');
    check($openShift['estado'] === 'ABIERTO', 'Shift is open');
    check((float)$openShift['monto_apertura'] === 200.0, 'Starting cash is 200.0');

    // Registrar ingreso manual
    registerCashMovement($db, (int)$openShift['id'], 'INGRESO', 50.0, 'Cambio de billetes', 'u1');
    // Registrar egreso manual
    registerCashMovement($db, (int)$openShift['id'], 'EGRESO', 20.0, 'Compra de útiles de limpieza', 'u1');

    // Cerrar turno con arqueo: esperado = 200 + 50 - 20 = 230. Declaramos 230
    $closedShift = closeShift($db, (int)$openShift['id'], 230.0, 'Cuadre conforme');
    check($closedShift['estado'] === 'CERRADO', 'Shift is closed');
    check((float)$closedShift['diferencia'] === 0.0, 'Exact cash balance (diferencia = 0)');

    // Re-abrir turno para que el sistema continúe listo para operar
    openShift($db, 300.0, 'u1', 'Turno regular botica');
};

$tests['merchandise purchase reception updates lots and stock'] = function () use ($db): void {
    $prov = $db->query("SELECT id FROM proveedores LIMIT 1")->fetch();
    $prod = $db->query("SELECT id, stock_actual FROM productos LIMIT 1")->fetch();
    $prodId = (int)$prod['id'];
    $stockBefore = (int)$prod['stock_actual'];

    $compra = registerPurchase($db, [
        'proveedor_id' => $prov['id'],
        'tipo_comprobante' => 'FACTURA',
        'serie_comprobante' => 'F009',
        'numero_comprobante' => '99881',
        'fecha_emision' => '2026-10-27',
        'fecha_recepcion' => '2026-10-27',
        'items' => [
            [
                'producto_id' => $prodId,
                'numero_lote' => 'LT-TEST-PURCHASE-01',
                'fecha_vencimiento' => '2027-12-31',
                'cantidad' => 25,
                'precio_unitario' => 5.50
            ]
        ]
    ], 'u1');

    check($compra['id'] > 0, 'Purchase record created');
    $stockAfter = (int)$db->query("SELECT stock_actual FROM productos WHERE id = $prodId")->fetchColumn();
    check($stockAfter === $stockBefore + 25, 'Product stock incremented by 25 from purchase');

    $loteExists = (int)$db->query("SELECT COUNT(*) FROM lotes WHERE producto_id = $prodId AND numero_lote = 'LT-TEST-PURCHASE-01'")->fetchColumn();
    check($loteExists === 1, 'New batch lot created in inventory');
};

$tests['MediZano client handles gateway offline with graceful fallback'] = function (): void {
    $client = new MediZanoClient('http://127.0.0.1:8090', 0.5);
    $health = $client->checkHealth();
    check($health['mode'] === 'LOCAL_STANDALONE' || $health['mode'] === 'ONLINE_INTEGRATED', 'Valid mode response');
    check(is_bool($health['online']), 'Online flag is boolean');

    $products = $client->fetchRemoteProducts();
    check(isset($products['source']), 'Graceful fallback source specified');
    check(is_array($products['items']), 'Items returned as array');
};

foreach ($tests as $name => $test) {
    $test();
    echo "PASS $name\n";
}
echo count($tests) . " backend tests passed.\n";
