<?php
require_once __DIR__ . '/common.php';

requireAdmin();
$pdo = getDB();

$postActions = ['update_profile', 'save_user', 'delete_user', 'save_settings', 'reset'];
$method = $_SERVER['REQUEST_METHOD'];

$action = $_GET['action'] ?? ($method === 'POST' ? 'save_user' : 'users');

if (in_array($action, $postActions, true)) {
    allowMethods(['POST']);
    requireCsrf();
} else {
    allowMethods(['GET']);
}

// 1. GET USERS (including avatar)
if ($action === 'users') {
    $users = $pdo->query("SELECT id, name, email, role, area, avatar, created_at FROM users ORDER BY id ASC")->fetchAll();
    jsonResponse(['success' => true, 'users' => $users]);
}

// 2. GET PERIODS
if ($action === 'periods') {
    $periods = $pdo->query("SELECT * FROM evaluation_periods ORDER BY id ASC")->fetchAll();
    jsonResponse(['success' => true, 'periods' => $periods]);
}

// 3. GET ACTIVITY
if ($action === 'activity') {
    $limit = integerField($_GET, 'limit', 50, 1, 200);
    $stmt = $pdo->prepare("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?");
    $stmt->execute([$limit]);
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
    $role = enumField($input, 'role', ['Administrador', 'Directivo', 'Responsable'], 'Responsable');
    $area = requiredText($input, 'area', 120);
    $password = isset($input['password']) && is_string($input['password']) ? trim($input['password']) : '';
    $avatar = isset($input['avatar']) && is_string($input['avatar']) ? trim($input['avatar']) : null;
    if ($avatar && strlen($avatar) > 2000000) {
        jsonError('La imagen de perfil supera el tamaño máximo permitido.', 422);
    }

    // Check if updating existing user
    if ($id !== '') {
        $existing = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $existing->execute([$id]);
        if (!$existing->fetch()) {
            jsonError('El usuario que intentas modificar no existe.', 404);
        }

        // Email uniqueness check for another user
        $emailCheck = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?");
        $emailCheck->execute([$email, $id]);
        if ($emailCheck->fetch()) {
            jsonError('El correo ingresado ya pertenece a otro usuario.', 409);
        }

        if ($password !== '') {
            if (strlen($password) < 6) jsonError('La contraseña debe tener al menos 6 caracteres.', 422);
            $hashed = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, role = ?, area = ?, avatar = ?, password = ? WHERE id = ?");
            $stmt->execute([$name, $email, $role, $area, $avatar, $hashed, $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, role = ?, area = ?, avatar = ? WHERE id = ?");
            $stmt->execute([$name, $email, $role, $area, $avatar, $id]);
        }

        if ($_SESSION['user']['id'] === $id) {
            $_SESSION['user']['name'] = $name;
            $_SESSION['user']['email'] = $email;
            $_SESSION['user']['role'] = $role;
            $_SESSION['user']['area'] = $area;
            $_SESSION['user']['avatar'] = $avatar;
        }

        logActivity($pdo, 'UPDATE', 'users', $id, "Usuario {$name} ({$email}) actualizado");
        jsonResponse(['success' => true, 'message' => "Usuario '{$name}' actualizado correctamente."]);
    } else {
        // Create new user
        if ($password === '') {
            jsonError('La contraseña es obligatoria para nuevos usuarios.', 422);
        }
        if (strlen($password) < 6) {
            jsonError('La contraseña debe tener al menos 6 caracteres.', 422);
        }

        $emailCheck = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = ?");
        $emailCheck->execute([$email]);
        if ($emailCheck->fetch()) {
            jsonError('El correo electrónico ya se encuentra registrado.', 409);
        }

        $newId = 'USR-' . strtoupper(substr(uniqid(), -5));
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (id, name, email, role, area, password, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$newId, $name, $email, $role, $area, $hashed, $avatar]);

        logActivity($pdo, 'CREATE', 'users', $newId, "Nuevo usuario creado: {$name} ({$email})");
        jsonResponse(['success' => true, 'id' => $newId, 'message' => "Usuario '{$name}' creado exitosamente."]);
    }
}

// 7. DELETE USER
if ($action === 'delete_user') {
    $input = getJsonInput();
    $id = requiredText($input, 'id', 60);

    if ($id === $_SESSION['user']['id']) {
        jsonError('No puedes eliminar tu propio usuario de sesión.', 400);
    }

    $existing = $pdo->prepare("SELECT name, email FROM users WHERE id = ?");
    $existing->execute([$id]);
    $u = $existing->fetch();
    if (!$u) {
        jsonError('El usuario que deseas eliminar no existe.', 404);
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);

    logActivity($pdo, 'DELETE', 'users', $id, "Usuario eliminado: {$u['name']} ({$u['email']})");
    jsonResponse(['success' => true, 'message' => "Usuario '{$u['name']}' eliminado correctamente."]);
}

// 8. SAVE SYSTEM SETTINGS
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

// 9. RESET DATABASE (Demo Mode)
if ($action === 'reset') {
    if (!$config['demo']) jsonError('La restauración está deshabilitada fuera del modo demo.', 403);
    seedDatabase($pdo);
    jsonResponse([
        'success' => true,
        'message' => 'Base de datos SQLite restaurada con los 12 objetivos, 36 KPIs y responsables oficiales de TechPeru SAC 2025.'
    ]);
}

jsonError("Acción no válida", 404);
