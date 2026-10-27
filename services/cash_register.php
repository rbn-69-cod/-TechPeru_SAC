<?php
/**
 * Servicio de Control de Caja, Turnos, Arqueos e Ingresos/Egresos
 * Botica TechPeru SAC
 */

require_once dirname(__DIR__) . '/repositories/records.php';
require_once dirname(__DIR__) . '/database/transaction.php';

function getCurrentShift(PDO $pdo, ?string $userId = null): ?array
{
    $sql = "SELECT t.*, u.name AS usuario_nombre,
                   (t.monto_apertura + t.total_ventas_efectivo + t.total_ingresos - t.total_egresos) AS efectivo_esperado,
                   (t.total_ventas_efectivo + t.total_ventas_tarjeta + t.total_ventas_digital) AS total_ventas_recaudadas
            FROM caja_turnos t
            JOIN users u ON t.usuario_id = u.id
            WHERE t.estado = 'ABIERTO'";
    $params = [];

    if ($userId) {
        $sql .= " AND t.usuario_id = ?";
        $params[] = $userId;
    }

    $sql .= " ORDER BY t.id DESC LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $shift = $stmt->fetch();

    if ($shift) {
        // Obtener movimientos de este turno
        $stmtMov = $pdo->prepare("SELECT m.*, u.name AS usuario_nombre 
                                  FROM caja_movimientos m 
                                  JOIN users u ON m.usuario_id = u.id 
                                  WHERE m.turno_id = ? 
                                  ORDER BY m.id DESC");
        $stmtMov->execute([$shift['id']]);
        $shift['movimientos'] = $stmtMov->fetchAll();
    }

    return $shift ?: null;
}

function openShift(PDO $pdo, float $montoApertura, string $userId, string $observaciones = ''): array
{
    $montoApertura = max(0, $montoApertura);

    // Verificar si ya tiene un turno abierto
    $active = getCurrentShift($pdo, $userId);
    if ($active) {
        throw new RuntimeException("Ya existe un turno abierto (Turno #{$active['id']}). Debe cerrarlo antes de aperturar uno nuevo.");
    }

    return atomic($pdo, function () use ($pdo, $montoApertura, $userId, $observaciones): array {
        $stmt = $pdo->prepare("INSERT INTO caja_turnos 
            (usuario_id, monto_apertura, total_ventas_efectivo, total_ventas_tarjeta, total_ventas_digital, total_ingresos, total_egresos, fecha_apertura, estado, observaciones)
            VALUES (?, ?, 0, 0, 0, 0, 0, datetime('now'), 'ABIERTO', ?)");
        $stmt->execute([$userId, $montoApertura, $observaciones]);
        $turnoId = (int)$pdo->lastInsertId();

        // Movimiento inicial de fondo
        $stmtMov = $pdo->prepare("INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto, usuario_id) VALUES (?, 'INGRESO', ?, 'Fondo de apertura de caja', ?)");
        $stmtMov->execute([$turnoId, $montoApertura, $userId]);

        logActivity($pdo, 'APERTURA_CAJA', 'caja_turnos', (string)$turnoId, "Turno de caja aperturado con fondo de S/ " . number_format($montoApertura, 2));

        return getCurrentShift($pdo, $userId);
    });
}

function closeShift(PDO $pdo, int $turnoId, float $montoDeclarado, string $observaciones = ''): array
{
    return atomic($pdo, function () use ($pdo, $turnoId, $montoDeclarado, $observaciones): array {
        $turno = $pdo->query("SELECT * FROM caja_turnos WHERE id = $turnoId")->fetch();
        if (!$turno) {
            throw new RuntimeException("El turno #$turnoId no existe.");
        }
        if ($turno['estado'] !== 'ABIERTO') {
            throw new RuntimeException("El turno #$turnoId ya está cerrado.");
        }

        $montoApertura = (float)$turno['monto_apertura'];
        $ventasEfectivo = (float)$turno['total_ventas_efectivo'];
        $ingresos = (float)$turno['total_ingresos'];
        $egresos = (float)$turno['total_egresos'];

        // Arqueo: efectivo teórico en caja
        $efectivoEsperado = round($montoApertura + $ventasEfectivo + $ingresos - $egresos, 2);
        $diferencia = round($montoDeclarado - $efectivoEsperado, 2);

        $stmt = $pdo->prepare("UPDATE caja_turnos SET 
            monto_cierre_declarado = ?,
            monto_cierre_sistema = ?,
            diferencia = ?,
            fecha_cierre = datetime('now'),
            estado = 'CERRADO',
            observaciones = CASE WHEN ? != '' THEN ? ELSE observaciones END
            WHERE id = ?");
        $stmt->execute([$montoDeclarado, $efectivoEsperado, $diferencia, $observaciones, $observaciones, $turnoId]);

        $diffMsg = ($diferencia === 0.0) ? "Cuadre exacto" : (($diferencia > 0) ? "Sobrante de S/ $diferencia" : "Faltante de S/ " . abs($diferencia));
        logActivity($pdo, 'CIERRE_CAJA', 'caja_turnos', (string)$turnoId, "Cierre de caja #$turnoId. Declarado: S/ $montoDeclarado | Esperado: S/ $efectivoEsperado | $diffMsg");

        $stmtRes = $pdo->prepare("SELECT t.*, u.name AS usuario_nombre FROM caja_turnos t JOIN users u ON t.usuario_id = u.id WHERE t.id = ?");
        $stmtRes->execute([$turnoId]);
        return $stmtRes->fetch();
    });
}

function registerCashMovement(PDO $pdo, int $turnoId, string $tipo, float $monto, string $concepto, string $userId): array
{
    $tipo = strtoupper(trim($tipo));
    if (!in_array($tipo, ['INGRESO', 'EGRESO'], true)) {
        throw new InvalidArgumentException('Tipo de movimiento debe ser INGRESO o EGRESO.');
    }
    if ($monto <= 0) {
        throw new InvalidArgumentException('El monto debe ser mayor a cero.');
    }
    if (trim($concepto) === '') {
        throw new InvalidArgumentException('El concepto del movimiento de caja es obligatorio.');
    }

    return atomic($pdo, function () use ($pdo, $turnoId, $tipo, $monto, $concepto, $userId): array {
        $turno = $pdo->query("SELECT * FROM caja_turnos WHERE id = $turnoId AND estado = 'ABIERTO'")->fetch();
        if (!$turno) {
            throw new RuntimeException("El turno de caja especificado no existe o no está abierto.");
        }

        if ($tipo === 'EGRESO') {
            $efectivoActual = (float)$turno['monto_apertura'] + (float)$turno['total_ventas_efectivo'] + (float)$turno['total_ingresos'] - (float)$turno['total_egresos'];
            if ($efectivoActual < $monto) {
                throw new RuntimeException("Efectivo insuficiente en caja para egreso. Saldo disponible: S/ " . number_format($efectivoActual, 2));
            }
            $pdo->exec("UPDATE caja_turnos SET total_egresos = total_egresos + $monto WHERE id = $turnoId");
        } else {
            $pdo->exec("UPDATE caja_turnos SET total_ingresos = total_ingresos + $monto WHERE id = $turnoId");
        }

        $stmt = $pdo->prepare("INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto, usuario_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$turnoId, $tipo, $monto, $concepto, $userId]);
        $movId = (int)$pdo->lastInsertId();

        logActivity($pdo, "CAJA_$tipo", 'caja_movimientos', (string)$movId, "Movimiento de $tipo por S/ " . number_format($monto, 2) . ": $concepto");

        return [
            'movimiento_id' => $movId,
            'turno_id' => $turnoId,
            'tipo' => $tipo,
            'monto' => $monto,
            'concepto' => $concepto
        ];
    });
}

function getShiftHistory(PDO $pdo, int $limit = 30): array
{
    $stmt = $pdo->prepare("SELECT t.*, u.name AS usuario_nombre,
                                  (t.total_ventas_efectivo + t.total_ventas_tarjeta + t.total_ventas_digital) AS total_ventas
                           FROM caja_turnos t
                           JOIN users u ON t.usuario_id = u.id
                           ORDER BY t.id DESC LIMIT ?");
    $stmt->execute([$limit]);
    return $stmt->fetchAll();
}
