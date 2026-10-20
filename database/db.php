<?php
require_once __DIR__ . '/schema.php';
require_once __DIR__ . '/seed.php';
require_once __DIR__ . '/migrations.php';
require_once __DIR__ . '/transaction.php';
require_once dirname(__DIR__) . '/repositories/records.php';
/**
 * Conexión a Base de Datos SQLite y Helper PDO para TechPeru SAC
 * Versión Empresarial Mejorada: Integridad referencial, Auditoría, Responsables y Transacciones
 */

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $config = require dirname(__DIR__) . '/config/app.php';
    $dbFile = $config['database'];
    $needSeed = !file_exists($dbFile) || filesize($dbFile) === 0;

    $pdo = new PDO('sqlite:' . $dbFile, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');

    if ($needSeed) {
        initializeSchema($pdo);
        if ($config['demo']) seedDatabase($pdo);
    }

    migrateDatabase($pdo);
    return $pdo;
}

