<?php
function initializeSchema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            area TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            avatar TEXT DEFAULT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS perspectives (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            title TEXT NOT NULL,
            color TEXT NOT NULL,
            soft_color TEXT NOT NULL,
            icon TEXT NOT NULL,
            order_num INTEGER NOT NULL,
            weight REAL DEFAULT 25.0
        );

        CREATE TABLE IF NOT EXISTS objectives (
            id TEXT PRIMARY KEY,
            perspective_id TEXT NOT NULL,
            name TEXT NOT NULL,
            full_name TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'Alta',
            weight INTEGER DEFAULT 100,
            status TEXT DEFAULT 'Activo',
            leader TEXT DEFAULT 'Dirección General',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (perspective_id) REFERENCES perspectives(id)
        );

        CREATE TABLE IF NOT EXISTS kpis (
            id TEXT PRIMARY KEY,
            num INTEGER NOT NULL,
            objective_id TEXT NOT NULL,
            perspective_id TEXT NOT NULL,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            target REAL NOT NULL,
            current_real REAL NOT NULL,
            compliance_pct REAL NOT NULL,
            status TEXT NOT NULL,
            direction TEXT NOT NULL, -- 'mayor' o 'menor'
            responsible TEXT NOT NULL, -- Nombre del responsable
            responsible_area TEXT NOT NULL, -- Área o gerencia del responsable
            frequency TEXT DEFAULT 'Trimestral', -- Frecuencia de medición
            baseline REAL DEFAULT 0, -- Línea base
            calculation_formula TEXT, -- Fórmula de cálculo documentada
            threshold_good REAL DEFAULT 90.0,
            threshold_warn REAL DEFAULT 75.0,
            action_recommended TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (objective_id) REFERENCES objectives(id),
            FOREIGN KEY (perspective_id) REFERENCES perspectives(id)
        );

        CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kpi_id TEXT NOT NULL,
            period TEXT NOT NULL,
            date TEXT NOT NULL,
            value REAL NOT NULL,
            compliance_pct REAL NOT NULL,
            notes TEXT,
            registered_by TEXT,
            previous_value REAL DEFAULT NULL,
            corrected_at TEXT DEFAULT NULL,
            correction_reason TEXT DEFAULT NULL,
            corrected_by TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (kpi_id) REFERENCES kpis(id)
        );

        CREATE TABLE IF NOT EXISTS initiatives (
            id TEXT PRIMARY KEY,
            objective_id TEXT NOT NULL,
            kpi_id TEXT,
            name TEXT NOT NULL,
            leader TEXT NOT NULL,
            budget REAL DEFAULT 0,
            start_date TEXT,
            end_date TEXT,
            progress_pct REAL DEFAULT 0,
            status TEXT DEFAULT 'En ejecución',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (objective_id) REFERENCES objectives(id)
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS evaluation_periods (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            year INTEGER NOT NULL,
            status TEXT DEFAULT 'Activo',
            start_date TEXT,
            end_date TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

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
}

