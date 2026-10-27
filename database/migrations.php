<?php
/** Additive migration: preserves existing data and upgrades legacy plaintext passwords. */
require_once __DIR__ . '/transaction.php';

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

function migrateDatabaseV4(PDO $pdo): void
{
    $version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
    if ($version >= 4) return;
    atomic($pdo, function () use ($pdo): void {
        // 1. Estado activo/inactivo de usuarios
        $colsUsers = array_column($pdo->query("PRAGMA table_info(users)")->fetchAll(), 'name');
        if (!in_array('is_active', $colsUsers, true)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
        }

        // 2. Columnas de trazabilidad para correcciones de medición
        $colsMeas = array_column($pdo->query("PRAGMA table_info(measurements)")->fetchAll(), 'name');
        if (!in_array('previous_value', $colsMeas, true)) {
            $pdo->exec("ALTER TABLE measurements ADD COLUMN previous_value REAL DEFAULT NULL");
        }
        if (!in_array('corrected_at', $colsMeas, true)) {
            $pdo->exec("ALTER TABLE measurements ADD COLUMN corrected_at TEXT DEFAULT NULL");
        }
        if (!in_array('correction_reason', $colsMeas, true)) {
            $pdo->exec("ALTER TABLE measurements ADD COLUMN correction_reason TEXT DEFAULT NULL");
        }
        if (!in_array('corrected_by', $colsMeas, true)) {
            $pdo->exec("ALTER TABLE measurements ADD COLUMN corrected_by TEXT DEFAULT NULL");
        }

        $pdo->exec('PRAGMA user_version = 4');
    });
}

function migrateDatabaseV5(PDO $pdo): void
{
    $version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
    if ($version >= 5) return;
    atomic($pdo, function () use ($pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS laboratorios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                nombre TEXT NOT NULL,
                ruc TEXT,
                contacto TEXT,
                telefono TEXT,
                email TEXT,
                estado TEXT DEFAULT 'Activo',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS proveedores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ruc TEXT UNIQUE NOT NULL,
                razon_social TEXT NOT NULL,
                telefono TEXT,
                email TEXT,
                direccion TEXT,
                ciudad TEXT,
                contacto TEXT,
                estado TEXT DEFAULT 'Activo',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS categorias_producto (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT UNIQUE NOT NULL,
                descripcion TEXT
            );

            CREATE TABLE IF NOT EXISTS productos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                codigo_barras TEXT UNIQUE,
                nombre_comercial TEXT NOT NULL,
                principio_activo TEXT NOT NULL,
                concentracion TEXT,
                presentacion TEXT,
                categoria_id INTEGER REFERENCES categorias_producto(id),
                laboratorio_id INTEGER REFERENCES laboratorios(id),
                precio_compra REAL NOT NULL DEFAULT 0.0,
                precio_venta REAL NOT NULL DEFAULT 0.0,
                stock_minimo INTEGER NOT NULL DEFAULT 10,
                stock_actual INTEGER NOT NULL DEFAULT 0,
                receta_medica INTEGER NOT NULL DEFAULT 0,
                ubicacion TEXT,
                estado TEXT NOT NULL DEFAULT 'Activo',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS lotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
                numero_lote TEXT NOT NULL,
                fecha_vencimiento DATE NOT NULL,
                fecha_fabricacion DATE,
                cantidad_inicial INTEGER NOT NULL,
                cantidad_actual INTEGER NOT NULL,
                precio_compra_lote REAL NOT NULL,
                estado TEXT NOT NULL DEFAULT 'DISPONIBLE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(producto_id, numero_lote)
            );

            CREATE TABLE IF NOT EXISTS movimientos_inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                producto_id INTEGER NOT NULL REFERENCES productos(id),
                lote_id INTEGER REFERENCES lotes(id),
                tipo TEXT NOT NULL,
                cantidad INTEGER NOT NULL,
                stock_anterior INTEGER NOT NULL,
                stock_nuevo INTEGER NOT NULL,
                motivo TEXT NOT NULL,
                referencia_tipo TEXT,
                referencia_id INTEGER,
                usuario_id TEXT REFERENCES users(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_documento TEXT NOT NULL DEFAULT 'DNI',
                numero_documento TEXT NOT NULL,
                nombre_razon_social TEXT NOT NULL,
                telefono TEXT,
                email TEXT,
                direccion TEXT,
                estado TEXT DEFAULT 'Activo',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tipo_documento, numero_documento)
            );

            CREATE TABLE IF NOT EXISTS caja_turnos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id TEXT NOT NULL REFERENCES users(id),
                monto_apertura REAL NOT NULL DEFAULT 0.0,
                monto_cierre_declarado REAL DEFAULT NULL,
                monto_cierre_sistema REAL DEFAULT NULL,
                diferencia REAL DEFAULT NULL,
                total_ventas_efectivo REAL DEFAULT 0.0,
                total_ventas_tarjeta REAL DEFAULT 0.0,
                total_ventas_digital REAL DEFAULT 0.0,
                total_ingresos REAL DEFAULT 0.0,
                total_egresos REAL DEFAULT 0.0,
                fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
                fecha_cierre DATETIME DEFAULT NULL,
                estado TEXT NOT NULL DEFAULT 'ABIERTO',
                observaciones TEXT
            );

            CREATE TABLE IF NOT EXISTS caja_movimientos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turno_id INTEGER NOT NULL REFERENCES caja_turnos(id),
                tipo TEXT NOT NULL,
                monto REAL NOT NULL,
                concepto TEXT NOT NULL,
                usuario_id TEXT NOT NULL REFERENCES users(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ventas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo_venta TEXT UNIQUE NOT NULL,
                turno_id INTEGER REFERENCES caja_turnos(id),
                cliente_id INTEGER REFERENCES clientes(id),
                usuario_id TEXT NOT NULL REFERENCES users(id),
                subtotal REAL NOT NULL,
                igv REAL NOT NULL,
                descuento REAL NOT NULL DEFAULT 0.0,
                total REAL NOT NULL,
                metodo_pago TEXT NOT NULL,
                monto_recibido REAL DEFAULT 0.0,
                vuelto REAL DEFAULT 0.0,
                estado TEXT NOT NULL DEFAULT 'COMPLETADA',
                motivo_anulacion TEXT,
                anulado_por TEXT REFERENCES users(id),
                anulado_at DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS detalle_ventas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
                producto_id INTEGER NOT NULL REFERENCES productos(id),
                lote_id INTEGER NOT NULL REFERENCES lotes(id),
                cantidad INTEGER NOT NULL,
                precio_unitario REAL NOT NULL,
                subtotal REAL NOT NULL,
                igv REAL NOT NULL,
                total REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS comprobantes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id INTEGER NOT NULL REFERENCES ventas(id),
                tipo TEXT NOT NULL,
                serie TEXT NOT NULL,
                numero INTEGER NOT NULL,
                numero_completo TEXT NOT NULL,
                emisor_ruc TEXT NOT NULL DEFAULT '20601234567',
                emisor_nombre TEXT NOT NULL DEFAULT 'BOTICA TECHPERU S.A.C.',
                cliente_tipo_doc TEXT NOT NULL,
                cliente_doc TEXT NOT NULL,
                cliente_nombre TEXT NOT NULL,
                subtotal REAL NOT NULL,
                igv REAL NOT NULL,
                total REAL NOT NULL,
                tipo_comprobante_fiscal TEXT NOT NULL DEFAULT 'INTERNO',
                estado_sunat TEXT NOT NULL DEFAULT 'EMITIDO_LOCAL',
                observacion TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(serie, numero)
            );

            CREATE TABLE IF NOT EXISTS compras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
                tipo_comprobante TEXT NOT NULL DEFAULT 'FACTURA',
                serie_comprobante TEXT NOT NULL,
                numero_comprobante TEXT NOT NULL,
                fecha_emision DATE NOT NULL,
                fecha_recepcion DATE NOT NULL,
                subtotal REAL NOT NULL,
                igv REAL NOT NULL,
                total REAL NOT NULL,
                estado TEXT NOT NULL DEFAULT 'RECIBIDO',
                usuario_id TEXT REFERENCES users(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS detalle_compras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
                producto_id INTEGER NOT NULL REFERENCES productos(id),
                numero_lote TEXT NOT NULL,
                fecha_vencimiento DATE NOT NULL,
                cantidad INTEGER NOT NULL,
                precio_unitario REAL NOT NULL,
                total REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS botica_settings (
                clave TEXT PRIMARY KEY,
                valor TEXT NOT NULL,
                descripcion TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_lotes_fefo ON lotes(producto_id, fecha_vencimiento ASC, id ASC);
            CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento ASC);
            CREATE INDEX IF NOT EXISTS idx_productos_busqueda ON productos(codigo, codigo_barras, nombre_comercial, principio_activo);
            CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_comprobantes_serie_num ON comprobantes(serie, numero);
        ");

        require_once __DIR__ . '/pharmacy_seed.php';
        seedPharmacyData($pdo);

        $pdo->exec('PRAGMA user_version = 5');
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
    migrateDatabaseV4($pdo);
    migrateDatabaseV5($pdo);
}
