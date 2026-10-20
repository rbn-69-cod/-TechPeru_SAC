# TechPeru SAC · Balanced Scorecard

Aplicación de seguimiento estratégico con HTML/CSS/JavaScript, PHP 8.3 y SQLite (PDO). Conserva dashboard, mapa, objetivos, indicadores, mediciones, iniciativas, reportes CSV/impresión y administración. Necesita servidor PHP: abrir `index.html` como archivo no ejecuta el backend.

## Ejecutar la demostración

Requisitos: PHP 8.3+ con `pdo_sqlite`, o Docker.

```sh
APP_DEMO=1 php -S 127.0.0.1:8080 router.php
```

Alternativa Docker, con datos persistentes en `storage`:

```sh
docker build -t techperu-bsc .
docker run --rm -p 127.0.0.1:8080:8080 \
  -e APP_DEMO=1 -e DB_PATH=/app/storage/bsc.sqlite \
  -v "$PWD/storage:/app/storage" techperu-bsc
```

Abre http://localhost:8080. Si el puerto está ocupado, cambia el puerto local. En una base nueva, `APP_DEMO=1` carga 4 perspectivas, 12 objetivos, 36 indicadores, 108 mediciones y 12 iniciativas desde los datos de referencia de 2025.

Cuentas **exclusivamente de demostración**: `admin@demo.com`, `gerente@demo.com`, `responsable@demo.com`; contraseña `BSC2026!`. La pantalla de acceso no precarga contraseñas. Las bases existentes se conservan y las contraseñas antiguas se convierten a hashes al aplicar la migración. Antes de migrar una base real, guarda una copia de seguridad.

## Configuración y despliegue

Las variables de `.env.example` se exportan al proceso PHP; no se carga `.env` automáticamente.

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `APP_DEMO` | `0` | Habilita datos iniciales y restauración demo cuando vale `1` |
| `APP_ENV` | `production` | Identificación del entorno |
| `DB_PATH` | `database/bsc.sqlite` | Ruta al archivo SQLite; el directorio debe existir y ser escribible |
| `SESSION_SECURE` | `0` | Usar `1` con HTTPS en producción |

El servidor incorporado y el Dockerfile son herramientas de desarrollo. Para producción usa PHP-FPM o Apache, HTTPS, `SESSION_SECURE=1`, `APP_DEMO=0` y un archivo SQLite fuera de la raíz pública. Apache debe habilitar `mod_rewrite`, `AllowOverride All` y la configuración `.htaccess` incluida. Para Nginx reproduce la lista de rutas públicas de `router.php`; nunca sirvas todo el árbol sin restricciones. Verifica que `/database/bsc.sqlite`, `/.git/config`, `/storage/` y `/config/app.php` devuelvan 404.

Una instalación sin demo crea el esquema vacío. Crea un administrador pasando `ADMIN_EMAIL` y `ADMIN_PASSWORD` mediante el gestor de secretos del entorno y ejecutando `php bin/create-admin.php` (contraseña mínima: 12 caracteres). Ejecuta `php bin/init-reference.php` para insertar las cuatro perspectivas y los períodos de referencia; después registra objetivos e indicadores desde la interfaz. No reutilices usuarios demo en producción.

Mantén copias de seguridad verificadas, supervisión de errores y almacenamiento persistente. SQLite sirve para cargas moderadas; antes de múltiples instancias o alta concurrencia hay que evaluar otra base de datos. La restauración demo borra los registros y las cuentas de esa base: solo está disponible al administrador con `APP_DEMO=1`.

## Organización

- `api/`: endpoints HTTP y consultas de lectura; `common.php` centraliza sesión, permisos, CSRF y errores.
- `services/catalog.php`: operaciones de catálogo, relaciones y transacciones.
- `services/validation.php`: validación de textos, códigos, fechas, números y enumeraciones.
- `services/scorecard.php`: cálculo y utilidades transaccionales.
- `database/db.php`: esquema, migración aditiva y carga demo.
- `config/app.php`: configuración del entorno.
- `js/app.js`: navegación, formularios, filtros, gráficos y cliente HTTP.
- `html/`: enlaces de compatibilidad hacia las vistas de la SPA.
- `tests/`: pruebas HTTP de integración; `docs/AUDITORIA.md`: hallazgos, decisiones y límites.

Chart.js 4.4.4 y la fuente Inter se cargan desde CDN. Las tablas y operaciones no necesitan gráficos para funcionar. `js/techperu_data.js` se conserva por compatibilidad histórica, pero no se carga: SQLite es la fuente de datos operativa; el JSON solo se usa para la demo.

## Contrato y permisos

`GET api/auth.php?action=me` devuelve el usuario (o `null`) y `csrf_token`. Toda escritura, incluido login/logout, requiere `X-CSRF-Token`. El login renueva la sesión y el token. El cliente conserva cookies de mismo origen. La sesión caduca tras 30 minutos sin actividad.

| Operación | Permiso |
| --- | --- |
| Consultar módulos y reportes | Usuario autenticado |
| Crear/editar/eliminar objetivos, KPI e iniciativas | Administrador o Gerente |
| Registrar mediciones | Administrador, Gerente, Responsable de indicadores; otras cuentas solo sus KPI asignados por nombre |
| Ver usuarios, períodos y auditoría; restaurar demo | Administrador |

Los catálogos usan GET/POST/PUT/DELETE; PUT admite campos parciales. Los códigos no se pueden cambiar. Crear devuelve 201; validación 422; no encontrado 404; duplicado/integridad 409; sin sesión 401; sin permiso o CSRF 403; método inválido 405. Los errores no incluyen detalles internos de SQL.

`GET api/measurements.php` acepta `kpi_id`, `limit` (1–500) y `offset`, y devuelve `total`. La interfaz pagina de 30 en 30. Los KPI admiten `perspective`, `objective_id`, `status`, `q`, `responsible` y `area`; los catálogos pequeños se filtran también en el navegador. Auditoría limita la consulta a 200 registros.

Las mediciones son un historial de inserción: no se editan ni eliminan individualmente. Se rechaza repetir KPI, período y fecha. Una medición antigua no sustituye el resultado cronológicamente más reciente; a igual fecha prevalece el último registro. El período identifica el ciclo evaluado, mientras la fecha identifica la medición: se permite captura tardía y no se bloquean períodos cerrados en esta versión.

## Reglas de cálculo

Se conserva el comportamiento del backend y del conjunto 2025: mayor es mejor = `real/meta × 100`; menor es mejor = `meta/real × 100`, con 100% para real cero. Metas directas deben ser positivas; inversas y resultados inversos no negativos. El semáforo es logrado ≥90%, riesgo ≥75%, crítico <75%. Los promedios son aritméticos de KPI, sin ponderación. El campo de peso de objetivo se conserva como metadato; no modifica el cálculo. Los porcentajes no se limitan a 100%.

Editar meta/sentido recalcula el valor actual, conservando los porcentajes históricos capturados. El valor actual también puede editarse en el catálogo; ese cambio queda en auditoría y no crea una medición. Usa Registro de resultados para conservar el historial de valores.

## Verificación

Ejecuta las pruebas solo contra una base aislada, nunca datos reales:

```sh
APP_DEMO=1 DB_PATH=/tmp/techperu-tests.sqlite php -S 127.0.0.1:18080 router.php
TEST_BASE_URL=http://127.0.0.1:18080 python3 tests/integration.py
node --check js/app.js
```

Las pruebas requieren Python 3 sin dependencias externas. Cubren permisos, CSRF, métodos HTTP, validación, cambios parciales, duplicados, borrado relacionado, paginación, historial, exportaciones, archivos privados, logout y limitación de intentos. El workflow de GitHub Actions ejecuta sintaxis PHP/JS e integración en una base temporal.
