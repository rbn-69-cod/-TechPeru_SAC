<?php
require_once __DIR__ . '/common.php';

requireAdmin();
$pdo = getDB();

$postActions = [
    'update_profile',
    'save_user',
    'toggle_user_status',
    'delete_user',
    'reset_password',
    'save_period',
    'set_active_period',
    'save_settings',
    'reset'
];
$method = $_SERVER['REQUEST_METHOD'];

$action = $_GET['action'] ?? ($method === 'POST' ? 'save_user' : 'users');

if (in_array($action, $postActions, true)) {
    allowMethods(['POST']);
    requireCsrf();
} else {
    allowMethods(['GET']);
}

function countActiveAdmins(PDO $pdo): int {
    return (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'Administrador' AND (is_active = 1 OR is_active IS NULL)")->fetchColumn();
}

// 1. GET USERS (including avatar & is_active)
if ($action === 'users') {
    $users = $pdo->query("SELECT id, name, email, role, area, avatar, COALESCE(is_active, 1) as is_active, created_at FROM users ORDER BY id ASC")->fetchAll();
    jsonResponse(['success' => true, 'users' => $users]);
}

// 2. GET PERIODS
if ($action === 'periods') {
    $periods = $pdo->query("SELECT * FROM evaluation_periods ORDER BY year DESC, id ASC")->fetchAll();
    jsonResponse(['success' => true, 'periods' => $periods]);
}

// 3. GET ACTIVITY
if ($action === 'activity') {
    $limit = integerField($_GET, 'limit', 50, 1, 500);
    $q = $_GET['q'] ?? null;
    $actionFilter = $_GET['filter_action'] ?? null;

    $sql = "SELECT * FROM activity_logs WHERE 1=1";
    $params = [];

    if ($actionFilter) {
        $sql .= " AND action = ?";
        $params[] = $actionFilter;
    }
    if ($q) {
        $sql .= " AND (details LIKE ? OR user_name LIKE ? OR entity_type LIKE ?)";
        $params[] = "%$q%";
        $params[] = "%$q%";
        $params[] = "%$q%";
    }

    $sql .= " ORDER BY id DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['success' => true, 'logs' => $stmt->fetchAll()]);
}

// 4. GET SYSTEM SETTINGS
if ($action === 'settings') {
    $rows = $pdo->query("SELECT key, value FROM system_settings")->fetchAll();
    $settings = [];
    foreach ($rows as $r) {
        $settings[$r['key']] = $r['value'];
    }
    jsonResponse(['success' => true, 'settings' => $settings]);
}

// 5. UPDATE CURRENT USER PROFILE & AVATAR
if ($action === 'update_profile') {
    $input = getJsonInput();
    $name = requiredText($input, 'name', 120);
    $area = requiredText($input, 'area', 120);
    $avatar = isset($input['avatar']) && is_string($input['avatar']) ? trim($input['avatar']) : null;
    if ($avatar && strlen($avatar) > 2000000) { // Limit to ~2MB data URLs
        jsonError('La imagen de perfil supera el límite permitido.', 422);
    }

    $currentUserId = $_SESSION['user']['id'];
    $stmt = $pdo->prepare("UPDATE users SET name = ?, area = ?, avatar = ? WHERE id = ?");
    $stmt->execute([$name, $area, $avatar, $currentUserId]);

    // Update session
    $_SESSION['user']['name'] = $name;
    $_SESSION['user']['area'] = $area;
    $_SESSION['user']['avatar'] = $avatar;

    logActivity($pdo, 'UPDATE', 'users', $currentUserId, "Perfil y avatar de usuario actualizados: {$name}");
    jsonResponse(['success' => true, 'user' => $_SESSION['user'], 'message' => 'Perfil actualizado exitosamente.']);
}

// 6. SAVE USER (Create or Update by Admin)
if ($action === 'save_user') {
    $input = getJsonInput();
    $id = isset($input['id']) && is_string($input['id']) ? trim($input['id']) : '';
    $name = requiredText($input, 'name', 120);
    $email = strtolower(requiredText($input, 'email', 254));
    $role = enumField($input, 'role', ['Administrador', 'Gerente', 'Directivo', 'Responsable', 'Responsable de indicadores'], 'Responsable');
    $area = requiredText($input, 'area', 120);
    $password = isset($input['password']) && is_string($input['password']) ? trim($input['password']) : '';
    $avatar = isset($input['avatar']) && is_string($input['avatar']) ? trim($input['avatar']) : null;
    $isActive = isset($input['is_active']) ? (int)$input['is_active'] : 1;
    if ($avatar && strlen($avatar) > 2000000) {
        jsonError('La imagen de perfil supera el tamaño máximo permitido.', 422);
    }

    // Check if updating existing user
    if ($id !== '') {
        $existing = $pdo->prepare("SELECT id, role, is_active FROM users WHERE id = ?");
        $existing->execute([$id]);
        $curr = $existing->fetch();
        if (!$curr) {
            jsonError('El usuario que intentas modificar no existe.', 404);
        }

        // Protección del último Administrador activo
        if ($curr['role'] === 'Administrador' && ($role !== 'Administrador' || $isActive === 0)) {
            if (countActiveAdmins($pdo) <= 1) {
                jsonError('No puedes desactivar ni cambiar el rol del único Administrador activo del sistema.', 400);
            }
        }

        // Email uniqueness check for another user
        $emailCheck = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?");
        $emailCheck->execute([$email, $id]);
        if ($emailCheck->fetch()) {
            jsonError('El correo ingresado ya pertenece a otro usuario.', 409);
        }

        if ($password !== '') {
            if (strlen($password) < 8) jsonError('La contraseña debe tener al menos 8 caracteres.', 422);
            $hashed = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, role = ?, area = ?, avatar = ?, is_active = ?, password = ? WHERE id = ?");
            $stmt->execute([$name, $email, $role, $area, $avatar, $isActive, $hashed, $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, role = ?, area = ?, avatar = ?, is_active = ? WHERE id = ?");
            $stmt->execute([$name, $email, $role, $area, $avatar, $isActive, $id]);
        }

        if ($_SESSION['user']['id'] === $id) {
            $_SESSION['user']['name'] = $name;
            $_SESSION['user']['email'] = $email;
            $_SESSION['user']['role'] = $role;
            $_SESSION['user']['area'] = $area;
            $_SESSION['user']['avatar'] = $avatar;
        }

        logActivity($pdo, 'UPDATE', 'users', $id, "Usuario {$name} ({$email}) actualizado. Rol: {$role}. Estado: " . ($isActive ? 'Activo' : 'Inactivo'));
        jsonResponse(['success' => true, 'message' => "Usuario '{$name}' actualizado correctamente."]);
    } else {
        // Create new user
        if ($password === '') {
            jsonError('La contraseña es obligatoria para nuevos usuarios.', 422);
        }
        if (strlen($password) < 8) {
            jsonError('La contraseña debe tener al menos 8 caracteres.', 422);
        }

        $emailCheck = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = ?");
        $emailCheck->execute([$email]);
        if ($emailCheck->fetch()) {
            jsonError('El correo electrónico ya se encuentra registrado.', 409);
        }

        $newId = 'USR-' . strtoupper(substr(uniqid(), -5));
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (id, name, email, role, area, password, avatar, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$newId, $name, $email, $role, $area, $hashed, $avatar, $isActive]);

        logActivity($pdo, 'CREATE', 'users', $newId, "Nuevo usuario creado: {$name} ({$email})");
        jsonResponse(['success' => true, 'id' => $newId, 'message' => "Usuario '{$name}' creado exitosamente."]);
    }
}

// 7. TOGGLE USER ACTIVE STATUS (Soft Enable/Disable)
if ($action === 'toggle_user_status') {
    $input = getJsonInput();
    $id = requiredText($input, 'id', 60);

    if ($id === $_SESSION['user']['id']) {
        jsonError('No puedes desactivar tu propia cuenta en sesión.', 400);
    }

    $existing = $pdo->prepare("SELECT id, name, email, role, COALESCE(is_active, 1) as is_active FROM users WHERE id = ?");
    $existing->execute([$id]);
    $u = $existing->fetch();
    if (!$u) {
        jsonError('El usuario no existe.', 404);
    }

    $newStatus = $u['is_active'] ? 0 : 1;
    if ($newStatus === 0 && $u['role'] === 'Administrador') {
        if (countActiveAdmins($pdo) <= 1) {
            jsonError('No puedes desactivar al único Administrador activo del sistema.', 400);
        }
    }

    $stmt = $pdo->prepare("UPDATE users SET is_active = ? WHERE id = ?");
    $stmt->execute([$newStatus, $id]);

    $statusWord = $newStatus ? 'activada' : 'desactivada';
    logActivity($pdo, 'UPDATE', 'users', $id, "Cuenta del usuario {$u['name']} {$statusWord}");
    jsonResponse(['success' => true, 'is_active' => $newStatus, 'message' => "Cuenta de '{$u['name']}' {$statusWord} exitosamente."]);
}

// 8. DELETE USER
if ($action === 'delete_user') {
    $input = getJsonInput();
    $id = requiredText($input, 'id', 60);

    if ($id === $_SESSION['user']['id']) {
        jsonError('No puedes eliminar tu propio usuario de sesión.', 400);
    }

    $existing = $pdo->prepare("SELECT name, email, role, COALESCE(is_active, 1) as is_active FROM users WHERE id = ?");
    $existing->execute([$id]);
    $u = $existing->fetch();
    if (!$u) {
        jsonError('El usuario que deseas eliminar no existe.', 404);
    }

    if ($u['role'] === 'Administrador' && $u['is_active']) {
        if (countActiveAdmins($pdo) <= 1) {
            jsonError('No puedes eliminar al único Administrador activo del sistema.', 400);
        }
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);

    logActivity($pdo, 'DELETE', 'users', $id, "Usuario eliminado: {$u['name']} ({$u['email']})");
    jsonResponse(['success' => true, 'message' => "Usuario '{$u['name']}' eliminado correctamente."]);
}

// 9. RESET USER PASSWORD (BY ADMIN)
if ($action === 'reset_password') {
    $input = getJsonInput();
    $id = requiredText($input, 'id', 60);
    $newPassword = $input['new_password'] ?? '';

    if (!is_string($newPassword) || strlen($newPassword) < 8) {
        jsonError('La nueva contraseña debe tener al menos 8 caracteres.', 422);
    }

    $existing = $pdo->prepare("SELECT name, email FROM users WHERE id = ?");
    $existing->execute([$id]);
    $u = $existing->fetch();
    if (!$u) {
        jsonError('El usuario no existe.', 404);
    }

    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
    $stmt->execute([$hashed, $id]);

    logActivity($pdo, 'PASSWORD_RESET', 'users', $id, "Contraseña restablecida por Administrador para: {$u['name']} ({$u['email']})");
    jsonResponse(['success' => true, 'message' => "Contraseña restablecida correctamente para {$u['name']}."]);
}

// 10. SAVE EVALUATION PERIOD
if ($action === 'save_period') {
    $input = getJsonInput();
    $id = identifier($input, 'id');
    $name = requiredText($input, 'name', 100);
    $year = integerField($input, 'year', (int)date('Y'), 2020, 2040);
    $status = enumField($input, 'status', ['Activo', 'Cerrado', 'Histórico', 'Planificado'], 'Planificado');
    $startDate = dateField($input, 'start_date', "$year-01-01");
    $endDate = dateField($input, 'end_date', "$year-12-31");

    if ($endDate < $startDate) {
        jsonError('La fecha de fin no puede ser anterior a la fecha de inicio.', 422);
    }

    $stmt = $pdo->prepare("INSERT INTO evaluation_periods (id, name, year, status, start_date, end_date) 
        VALUES (?, ?, ?, ?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, year = excluded.year, status = excluded.status, start_date = excluded.start_date, end_date = excluded.end_date");
    $stmt->execute([$id, $name, $year, $status, $startDate, $endDate]);

    logActivity($pdo, 'SAVE_PERIOD', 'evaluation_periods', $id, "Período guardado: {$id} ({$name})");
    jsonResponse(['success' => true, 'message' => "Período '{$name}' guardado exitosamente."]);
}

// 11. SET ACTIVE PERIOD
if ($action === 'set_active_period') {
    $input = getJsonInput();
    $id = identifier($input, 'id');

    $existing = $pdo->prepare("SELECT id, name FROM evaluation_periods WHERE id = ?");
    $existing->execute([$id]);
    $p = $existing->fetch();
    if (!$p) {
        jsonError('El período no existe.', 404);
    }

    atomic($pdo, function() use ($pdo, $id, $p) {
        $pdo->prepare("UPDATE evaluation_periods SET status = 'Histórico' WHERE status = 'Activo'")->execute();
        $pdo->prepare("UPDATE evaluation_periods SET status = 'Activo' WHERE id = ?")->execute([$id]);
        logActivity($pdo, 'SET_ACTIVE_PERIOD', 'evaluation_periods', $id, "Período activo establecido a: {$p['name']}");
    });

    jsonResponse(['success' => true, 'message' => "Período '{$p['name']}' establecido como activo exitosamente."]);
}

// 12. SAVE SYSTEM SETTINGS
if ($action === 'save_settings') {
    $input = getJsonInput();
    $companyName = requiredText($input, 'company_name', 120);
    $bscTitle = requiredText($input, 'bsc_title', 120);
    $strategicPeriod = requiredText($input, 'strategic_period', 120);

    $stmt = $pdo->prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    $stmt->execute(['company_name', $companyName]);
    $stmt->execute(['bsc_title', $bscTitle]);
    $stmt->execute(['strategic_period', $strategicPeriod]);

    logActivity($pdo, 'UPDATE', 'system_settings', 'all', "Configuración del sistema actualizada: {$companyName} / {$bscTitle}");
    jsonResponse(['success' => true, 'message' => 'Configuración del sistema guardada exitosamente.']);
}

// 13. RESET DATABASE (Demo Mode)
if ($action === 'reset') {
    if (!$config['demo']) jsonError('La restauración está deshabilitada fuera del modo demo.', 403);
    seedDatabase($pdo);
    jsonResponse([
        'success' => true,
        'message' => 'Base de datos SQLite restaurada con los 12 objetivos, 36 KPIs y responsables oficiales de TechPeru SAC 2025.'
    ]);
}

jsonError("Acción no válida", 404);
