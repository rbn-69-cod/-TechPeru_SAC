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
foreach ($tests as $name => $test) {
    $test();
    echo "PASS $name\n";
}
echo count($tests) . " backend tests passed.\n";
