<?php
require_once __DIR__ . '/common.php';
require_once dirname(__DIR__) . '/services/cash_register.php';

$pdo = getDB();
$action = $_GET['action'] ?? 'current';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'current') {
        $user = requireAuth();
        $shift = getCurrentShift($pdo, $user['id']);
        jsonResponse(['success' => true, 'has_shift' => $shift !== null, 'shift' => $shift]);
    }

    if ($action === 'history') {
        $limit = max(5, min(100, (int)($_GET['limit'] ?? 30)));
        jsonResponse(['success' => true, 'shifts' => getShiftHistory($pdo, $limit)]);
    }

    jsonError('Acción no reconocida.', 400);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $user = requirePharmacyRole(['Cajero', 'Farmacéutico']);

    if ($action === 'open') {
        $montoApertura = (float)($input['monto_apertura'] ?? 0);
        $obs = trim($input['observaciones'] ?? '');
        try {
            $shift = openShift($pdo, $montoApertura, $user['id'], $obs);
            jsonResponse(['success' => true, 'message' => 'Turno de caja aperturado correctamente.', 'shift' => $shift]);
        } catch (RuntimeException $e) {
            jsonError($e->getMessage(), 400);
        }
    }

    if ($action === 'close') {
        $turnoId = (int)($input['turno_id'] ?? 0);
        $montoDeclarado = (float)($input['monto_declarado'] ?? 0);
        $obs = trim($input['observaciones'] ?? '');
        if ($turnoId <= 0) jsonError('ID de turno inválido.', 422);

        try {
            $shift = closeShift($pdo, $turnoId, $montoDeclarado, $obs);
            jsonResponse(['success' => true, 'message' => 'Turno de caja cerrado con arqueo de efectivo.', 'shift' => $shift]);
        } catch (RuntimeException $e) {
            jsonError($e->getMessage(), 400);
        }
    }

    if ($action === 'movement') {
        $turnoId = (int)($input['turno_id'] ?? 0);
        $tipo = trim($input['tipo'] ?? '');
        $monto = (float)($input['monto'] ?? 0);
        $concepto = trim($input['concepto'] ?? '');

        if ($turnoId <= 0 || $monto <= 0 || $concepto === '') {
            jsonError('Turno, monto mayor a cero y concepto son requeridos.', 422);
        }

        try {
            $res = registerCashMovement($pdo, $turnoId, $tipo, $monto, $concepto, $user['id']);
            jsonResponse(['success' => true, 'message' => "Movimiento de $tipo registrado.", 'movement' => $res]);
        } catch (RuntimeException $e) {
            jsonError($e->getMessage(), 400);
        } catch (InvalidArgumentException $e) {
            jsonError($e->getMessage(), 422);
        }
    }

    jsonError('Acción no soportada.', 400);
}
