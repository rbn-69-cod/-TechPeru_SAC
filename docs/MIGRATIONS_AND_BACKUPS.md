# Migraciones y Procedimiento de Respaldo — TechPeru SAC

## 1. Historial de Migraciones del Esquema SQLite

El esquema de base de datos se versiona mediante la directiva `PRAGMA user_version`. Todas las migraciones son aditivas, transaccionales e idempotentes:

- **Versión 1 (`PRAGMA user_version = 1`):**
  - Creación de tabla `login_attempts` para control de fuerza bruta.
  - Creación de índices en `kpis(objective_id)`, `kpis(perspective_id)`, `measurements(kpi_id, date, id)`, `initiatives(objective_id)`, `measurements(period, date)`.
  - Trigger `measurement_duplicate` para prevenir duplicación por fecha y período.
  - Actualización de contraseñas existentes a Bcrypt.
- **Versión 2 (`PRAGMA user_version = 2`):**
  - Aplicación de restricciones de integridad referencial avanzadas (`002_integrity.up.sql`).
  - Restricciones de valor no negativo en iniciativas y unicidad estricta de emails.
- **Versión 3 (`PRAGMA user_version = 3`):**
  - Tabla `system_settings` para metadatos de la empresa (nombre, título de BSC, período visible).
- **Versión 4 (`PRAGMA user_version = 4`):**
  - Columna `is_active INTEGER NOT NULL DEFAULT 1` en tabla `users`.
  - Columnas de trazabilidad y corrección en `measurements`:
    - `previous_value REAL`: Valor original antes de la corrección.
    - `corrected_at TEXT`: Marca temporal ISO 8601 de la corrección.
    - `correction_reason TEXT`: Justificación obligatoria de la modificación.
    - `corrected_by TEXT`: Nombre del directivo o administrador que ejecutó la corrección.

---

## 2. Procedimiento de Respaldo en Caliente (Hot Backup)

SQLite permite crear copias de seguridad consistentes en caliente sin detener el servidor web mediante la sentencia `VACUUM INTO`:

```sh
# Generar copia de seguridad fechada
php -r "
require 'database/db.php';
\$pdo = getDB();
\$dest = 'database/backups/bsc_backup_' . date('Ymd_His') . '.sqlite';
\$pdo->query('VACUUM INTO ' . \$pdo->quote(\$dest));
echo 'Respaldo generado con éxito: ' . \$dest . PHP_EOL;
"
```

### Reglas de Seguridad de los Respaldos:
1. La carpeta `database/backups/` está protegida por `.gitignore` y **nunca** debe comitearse a repositorios públicos de Git.
2. Los respaldos deben almacenarse en almacenamiento secundario cifrado con retención rotatoria (diaria, semanal, mensual).

---

## 3. Procedimiento de Recuperación ante Desastres (Disaster Recovery)

Para restaurar una copia de seguridad en un ambiente de contingencia o ante fallo de hardware:

1. **Detener el proceso del servidor web:**
   ```sh
   killall frankenphp # o detener el contenedor Docker
   ```
2. **Verificar la integridad del archivo de respaldo:**
   ```sh
   php -r "
   \$db = new PDO('sqlite:database/backups/bsc_backup_NOMBRE.sqlite');
   \$res = \$db->query('PRAGMA integrity_check')->fetchColumn();
   if (\$res !== 'ok') exit('ERROR: Respaldo corrupto' . PHP_EOL);
   echo 'Respaldo íntegro y verificado.' . PHP_EOL;
   "
   ```
3. **Reemplazar la base de datos operativa:**
   ```sh
   cp database/backups/bsc_backup_NOMBRE.sqlite database/bsc.sqlite
   ```
4. **Verificar que los permisos sean adecuados para el usuario del servidor (ej. `www-data`):**
   ```sh
   chmod 644 database/bsc.sqlite
   ```
5. **Iniciar el servidor web y ejecutar las pruebas de integridad.**
