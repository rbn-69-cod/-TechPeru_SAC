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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    ");
}

