# Auditoría y Controles de Seguridad — TechPeru SAC

## 1. Controles de Seguridad Implementados

### A. Protección contra Cross-Site Request Forgery (CSRF)
- En cada sesión iniciada se genera un token criptográfico pseudoaleatorio de 64 caracteres hexadecimales (`bin2hex(random_bytes(32))`).
- Toda solicitud HTTP mutante (`POST`, `PUT`, `DELETE`) exige la cabecera `X-CSRF-Token`.
- Los intentos sin token o con token ajeno son rechazados con `HTTP 403 Forbidden`.

### B. Prevención de Inyección de Fórmulas en Exportaciones (CSV Formula Injection)
- Al exportar archivos `.csv`, cualquier celda que comience con los caracteres `=`, `+`, `-`, `@`, `\t` o `\r` es neutralizada mediante la función `sanitizeCsvFormula()`.
- Se prefija un apóstrofe `'` para forzar a hojas de cálculo (Excel, LibreOffice, Google Sheets) a tratar el contenido estrictamente como texto plano, imposibilitando la ejecución de comandos `HYPERLINK` o `DDE`.

### C. Almacenamiento Cifrado de Credenciales
- Todas las contraseñas se almacenan mediante el algoritmo **Bcrypt** con costo adaptativo (`PASSWORD_DEFAULT`).
- En cada inicio de sesión exitoso, si el hash fue generado con parámetros antiguos, `password_needs_rehash()` actualiza el hash de manera transparente.
- Las contraseñas en formularios administrativos exigen una longitud mínima de 8 caracteres (12 caracteres recomendados en producción).

### D. Protección contra Ataques de Fuerza Bruta (Rate Limiting)
- La tabla `login_attempts` registra intentos fallidos combinando IP y correo electrónico evaluado.
- Tras 10 intentos fallidos en una ventana de 15 minutos, la IP queda temporalmente bloqueada con respuesta `HTTP 429 Too Many Requests` y cabecera `Retry-After: 900`.

### E. Protección de Archivos y Rutas del Servidor (Server Hardening)
- Tanto en `Caddyfile` como en `router.php`, se bloquea el acceso HTTP a:
  - Archivos de base de datos (`*.sqlite`, `*.sqlite-*`, `*.sql`).
  - Variables de entorno (`.env`, `.env.*`).
  - Metadatos de Git (`.git/*`).
  - Directorios de lógica interna (`database/`, `config/`, `storage/`, `helpers/`, `services/`, `repositories/`, `validators/`, `middleware/`).
- Todas las solicitudes a estos recursos retornan de forma homogénea `HTTP 404 Not Found`.

---

## 2. Registro Inmutable de Auditoría (`activity_logs`)

Cada operación sensible queda registrada en la tabla `activity_logs`:
- **`created_at`:** Marca temporal con hora oficial de la transacción.
- **`user_id` / `user_name`:** Identidad del usuario autenticado que ejecutó la acción.
- **`action`:** Código tipificado de la acción (`MEASUREMENT_RECORDED`, `MEASUREMENT_CORRECTED`, `CREATE`, `UPDATE`, `DELETE`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `SEED_DATABASE`).
- **`entity_type` / `entity_id`:** Entidad intervenida (ej. `KPI`, `OBJECTIVE`, `USER`, `PERIOD`).
- **`details`:** Descripción legible con los valores previos y nuevos para auditoría forense.
