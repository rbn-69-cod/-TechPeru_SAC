<?php
/** Additive migration: preserves existing data and upgrades legacy plaintext passwords. */
function migrateDatabaseV1(PDO $pdo): void {
    $version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
    if ($version >= 1) return;
    $pdo->beginTransaction();
    try {
        $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, started_at INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_kpis_objective ON kpis(objective_id);
            CREATE INDEX IF NOT EXISTS idx_kpis_perspective ON kpis(perspective_id);
            CREATE INDEX IF NOT EXISTS idx_measurements_date ON measurements(kpi_id, date DESC, id DESC);
            CREATE INDEX IF NOT EXISTS idx_initiatives_objective ON initiatives(objective_id);
            CREATE INDEX IF NOT EXISTS idx_measurements_period ON measurements(period, date);
            CREATE TRIGGER IF NOT EXISTS measurement_duplicate BEFORE INSERT ON measurements
            WHEN EXISTS (SELECT 1 FROM measurements WHERE kpi_id = NEW.kpi_id AND period = NEW.period AND date = NEW.date)
            BEGIN SELECT RAISE(ABORT, "Duplicate measurement constraint"); END;');
        $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
        foreach ($pdo->query('SELECT id, password FROM users')->fetchAll() as $user) {
            if (!password_get_info($user['password'])['algo']) $stmt->execute([password_hash($user['password'], PASSWORD_DEFAULT), $user['id']]);
        }
        $pdo->exec('PRAGMA user_version = 1');
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}

function migrateDatabaseV3(PDO $pdo): void
{
    $version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
    if ($version >= 3) return;
    atomic($pdo, function () use ($pdo): void {
        $cols = array_column($pdo->query("PRAGMA table_info(users)")->fetchAll(), 'name');
        if (!in_array('avatar', $cols, true)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL");
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
        $pdo->exec("INSERT OR IGNORE INTO system_settings (key, value) VALUES 
            ('company_name', 'TechPeru SAC'),
            ('bsc_title', 'Balanced Scorecard 2025'),
            ('strategic_period', 'Plan Estratégico · 2025')");
        $pdo->exec('PRAGMA user_version = 3');
    });
}

function migrateDatabase(PDO $pdo): void
{
    migrateDatabaseV1($pdo);
    if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() < 2) {
        atomic($pdo, function () use ($pdo): void {
            $pdo->exec(file_get_contents(__DIR__ . '/migrations/002_integrity.up.sql'));
            $pdo->exec('PRAGMA user_version = 2');
        });
    }
    migrateDatabaseV3($pdo);
}
