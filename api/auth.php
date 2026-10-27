<?php
require_once __DIR__ . '/common.php';
$action = enumField($_GET, 'action', ['me', 'login', 'logout', 'change_password'], 'me');
$pdo = getDB();
if ($action === 'me') {
    allowMethods(['GET']);
    jsonResponse(['success' => true, 'user' => getCurrentUser(), 'csrf_token' => csrfToken()]);
}
if ($action === 'login') {
    allowMethods(['POST']);
    requireCsrf();
    $input = getJsonInput();
    $email = strtolower(requiredText($input, 'email', 254));
    $password = $input['password'] ?? '';
    if (!is_string($password) || strlen($password) > 1024) jsonError('Credenciales incorrectas.', 401);
    $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $email);
    $stmt = $pdo->prepare('SELECT attempts, started_at FROM login_attempts WHERE id = ?');
    $stmt->execute([$key]);
    $attempt = $stmt->fetch();
    if ($attempt && $attempt['started_at'] > time() - 900 && $attempt['attempts'] >= 10) {
        header('Retry-After: 900'); jsonError('Demasiados intentos. Espera 15 minutos.', 429);
    }
    $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(id) = ?');
    $stmt->execute([$email, $email]);
    $user = $stmt->fetch();
    // Verify a hash for unknown accounts too, avoiding the fast missing-user path.
    $hash = $user['password'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    $validPassword = password_verify($password, $hash);
    if (!$user || !$validPassword) {
        $pdo->prepare('INSERT INTO login_attempts (id, attempts, started_at) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET attempts = CASE WHEN started_at < ? THEN 1 ELSE attempts + 1 END, started_at = CASE WHEN started_at < ? THEN excluded.started_at ELSE started_at END')->execute([$key, time(), time()-900, time()-900]);
        jsonError('Credenciales incorrectas.', 401);
    }

    if (isset($user['is_active']) && (int)$user['is_active'] === 0) {
        jsonError('Tu cuenta de usuario se encuentra inactiva. Comunícate con el Administrador.', 403);
    }

    $pdo->prepare('DELETE FROM login_attempts WHERE id = ? OR started_at < ?')->execute([$key, time()-900]);
    if (password_needs_rehash($user['password'], PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    unset($user['password']);
    session_regenerate_id(true);
    $_SESSION['user'] = $user;
    $_SESSION['last_seen'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    jsonResponse(['success' => true, 'user' => $user, 'csrf_token' => csrfToken()]);
}
if ($action === 'change_password') {
    allowMethods(['POST']);
    requireCsrf();
    $currentUser = requireAuth();
    $input = getJsonInput();
    $currentPass = $input['current_password'] ?? '';
    $newPass = $input['new_password'] ?? '';

    if (!is_string($currentPass) || $currentPass === '') {
        jsonError('Debes ingresar tu contraseña actual.', 422);
    }
    if (!is_string($newPass) || strlen($newPass) < 8) {
        jsonError('La nueva contraseña debe tener al menos 8 caracteres.', 422);
    }

    $stmt = $pdo->prepare('SELECT password FROM users WHERE id = ?');
    $stmt->execute([$currentUser['id']]);
    $dbPass = $stmt->fetchColumn();

    if (!$dbPass || !password_verify($currentPass, $dbPass)) {
        jsonError('La contraseña actual es incorrecta.', 401);
    }

    $hashed = password_hash($newPass, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([$hashed, $currentUser['id']]);

    logActivity($pdo, 'PASSWORD_CHANGED', 'users', $currentUser['id'], "Contraseña actualizada por el usuario {$currentUser['name']}", $currentUser['id'], $currentUser['name']);

    jsonResponse(['success' => true, 'message' => 'Contraseña actualizada exitosamente.']);
}
if ($action === 'logout') {
    allowMethods(['POST']); requireCsrf();
    $_SESSION = [];
    session_regenerate_id(true);
    jsonResponse(['success' => true, 'csrf_token' => csrfToken()]);
}
jsonError('Acción no válida.', 404);
