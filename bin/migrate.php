<?php
if (PHP_SAPI !== 'cli') exit;
require_once dirname(__DIR__) . '/database/db.php';
if (($argv[1] ?? '') === '--rollback-v2') {
    $config = require dirname(__DIR__) . '/config/app.php';
    if (!is_file($config['database'])) {
        fwrite(STDERR, "La base de datos no existe.\n");
        exit(1);
    }
    $pdo = new PDO('sqlite:' . $config['database'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() !== 2) {
        fwrite(STDERR, "Solo se admite revertir desde la versión 2.\n");
        exit(1);
    }
    atomic($pdo, fn() => $pdo->exec(file_get_contents(dirname(__DIR__) . '/database/migrations/002_integrity.down.sql')));
    echo "Migración 002 revertida sin borrar datos. Despliega la versión anterior antes de reiniciar la aplicación.\n";
} else {
    $pdo = getDB();
    echo 'Versión del esquema: ' . $pdo->query('PRAGMA user_version')->fetchColumn() . PHP_EOL;
}
