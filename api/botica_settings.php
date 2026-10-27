<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/medizano_client.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'get';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'check_medizano') {
        $gatewayUrl = $pdo->query("SELECT valor FROM botica_settings WHERE clave = 'medizano_gateway_url'")->fetchColumn() ?: 'http://127.0.0.1:8090';
        $client = new MediZanoClient($gatewayUrl);
        jsonResponse(['success' => true, 'medizano' => $client->checkHealth()]);
    }

    $rows = $pdo->query("SELECT clave, valor, descripcion FROM botica_settings")->fetchAll();
    $settings = [];
    foreach ($rows as $r) {
        $settings[$r['clave']] = $r['valor'];
    }

    $gatewayUrl = $settings['medizano_gateway_url'] ?? 'http://127.0.0.1:8090';
    $client = new MediZanoClient($gatewayUrl);
    $health = $client->checkHealth();

    jsonResponse([
        'success' => true,
        'settings' => $settings,
        'medizano' => $health
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin();
    $input = getJsonInput();

    $stmt = $pdo->prepare("INSERT OR REPLACE INTO botica_settings (clave, valor) VALUES (?, ?)");
    foreach ($input as $clave => $valor) {
        if (is_scalar($valor)) {
            $stmt->execute([$clave, (string)$valor]);
        }
    }

    logActivity($pdo, 'CONFIG_BOTICA', 'botica_settings', 'global', 'Parámetros y configuración de botica actualizados');
    jsonResponse(['success' => true, 'message' => 'Configuración de botica actualizada correctamente.']);
}
