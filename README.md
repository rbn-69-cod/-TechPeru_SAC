# TechPeru SAC · Balanced Scorecard (BSC 2025)

Sistema web empresarial de **Balanced Scorecard (Cuadro de Mando Integral)** desarrollado con arquitectura desacoplada: Frontend interactivo SPA (HTML5 semántico, CSS Grid responsivo, JavaScript ES Modules, Chart.js) y Backend en **PHP 8.3 & SQLite 3 (PDO)** con control transaccional ACID, modo WAL de alta concurrencia, auditoría en tiempo real y persistencia oficial de las 4 perspectivas, 12 objetivos estratégicos, 36 indicadores (KPI) con líderes asignados y 12 iniciativas estratégicas.

---

## 🔑 Credenciales de Acceso al Sistema

Para ingresar y verificar la aplicación web, el sistema cuenta con cuentas oficiales de prueba en modo demostración (`APP_DEMO=1`):

| Rol de Usuario | Correo Electrónico | Contraseña | Nivel de Acceso y Funciones |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@demo.com` | `BSC2026!` | **Dirección General & TI**: Control total, gestión de usuarios, reseteo de claves, activación de períodos, auditoría y restauración demo |
| **Gerente de Estrategia** | `gerente@demo.com` | `BSC2026!` | **Gerencia Comercial**: Visualización ejecutiva, edición de objetivos, KPIs e iniciativas, y corrección auditada de mediciones |
| **Responsable de Indicadores** | `responsable@demo.com` | `BSC2026!` | **Control de Gestión**: Registro de mediciones periódicas para todos los KPIs y seguimiento de metas |
| **Líder de Área** | `carlos.mendoza@techperu.pe` | `BSC2026!` | **Gerencia de Finanzas**: Registro de mediciones exclusivamente para sus KPIs asignados |

> **Nota:** La pantalla de inicio de sesión incluye una tarjeta interactiva con botón **"Autocompletar"** para rellenar las credenciales en un solo clic.

---

## 🛠️ Tecnologías y Requisitos

- **Backend:** PHP 8.3 o superior con extensiones `pdo`, `pdo_sqlite`, `sqlite3`, `mbstring`, `json`.
- **Base de Datos:** SQLite 3 con modo `WAL` (`Write-Ahead Logging`) para lectura y escritura concurrente no bloqueante.
- **Servidor Web:** Compatible con FrankenPHP / Caddy (usando el `Caddyfile` provisto), PHP Built-in Server (`php -S` con `router.php`), Apache (con `mod_rewrite`) y Nginx.
- **Frontend:** HTML5, CSS3 Grid (dos columnas fijas `268px minmax(0, 1fr)` sin superposición), JavaScript modular (ES6+) y Chart.js 4.4.4.
- **Pruebas:** PHP CLI para pruebas unitarias de esquema y Python 3.10+ para pruebas de contrato HTTP y seguridad.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el Repositorio
```sh
git clone https://github.com/rbn-69-cod/-TechPeru_SAC.git
cd -TechPeru_SAC
```

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo para configurar tu entorno local:
```sh
cp .env.example .env
```
Las variables principales son:
- `APP_ENV`: `production` o `development`.
- `APP_DEMO`: `1` para modo interactivo de prueba (habilita usuarios demo y botón de restauración); `0` para producción limpia.
- `DB_PATH`: Ruta al archivo SQLite (por defecto: `database/bsc.sqlite`).
- `SESSION_SECURE`: `1` al utilizar HTTPS en producción.

### 3. Ejecutar Localmente

**Opción A — Con FrankenPHP / Caddy (Recomendado):**
```sh
APP_DEMO=1 frankenphp run --config Caddyfile
```

**Opción B — Con el servidor incorporado de PHP:**
```sh
APP_DEMO=1 php -S 127.0.0.1:8080 router.php
```

**Opción C — Con Docker:**
```sh
docker build -t techperu-bsc .
docker run --rm -p 8080:8080 \
  -e APP_DEMO=1 -e DB_PATH=/app/storage/bsc.sqlite \
  -v "$PWD/storage:/app/storage" techperu-bsc
```

Abre en tu navegador: **[http://localhost:8080](http://localhost:8080)**

---

## 🧪 Ejecución de Pruebas Automatizadas

El proyecto incluye dos suites de pruebas automatizadas que se ejecutan sobre bases de datos en memoria o temporales aisladas, **sin alterar nunca la base de datos real**:

### A. Pruebas Unitarias de Esquema, Cálculo y Seguridad (PHP)
Verifica cálculo de umbrales (90% / 75%), KPIs sin medición (`⏳ PENDIENTE`), reversión transaccional, integridad referencial, corrección auditada de mediciones, protección del último administrador y activación atómica de períodos:
```sh
php tests/backend.php
```
*Resultado esperado: 12 tests aprobados (PASS 100%).*

### B. Pruebas de Integración y Contrato HTTP (Python)
Verifica autenticación de sesión, tokens anti-CSRF, rate limiting de fuerza bruta (HTTP 429), bloqueo de acceso a archivos protegidos (HTTP 404), sanitización contra inyección de fórmulas CSV y validación de tipos:
```sh
# 1. Iniciar servidor temporal con base aislada
DB_PATH=/tmp/bsc_test.sqlite APP_DEMO=1 php -S 127.0.0.1:18080 router.php &
SERVER_PID=$!

# 2. Ejecutar la suite de pruebas
TEST_BASE_URL=http://127.0.0.1:18080 python3 tests/integration.py

# 3. Finalizar servidor temporal
kill $SERVER_PID
rm -f /tmp/bsc_test.sqlite
```
*Resultado esperado: 20 tests aprobados (OK 100%).*

---

## 📁 Estructura del Repositorio

```
.
├── .github/workflows/ci.yml # Integración continua automatizada (PHP Lint, Unit & Integration Tests)
├── api/                     # Controladores y endpoints REST JSON
│   ├── activity.php         # Consulta de logs de auditoría
│   ├── admin.php            # CRUD usuarios, reseteo claves, activación períodos y settings
│   ├── auth.php             # Login, sesión, CSRF, cambio de clave y perfil
│   ├── dashboard.php        # Resumen ejecutivo agregado del BSC
│   ├── initiatives.php      # CRUD de planes de acción e iniciativas
│   ├── kpis.php             # CRUD y filtros de indicadores
│   ├── measurements.php     # Captura de resultados y corrección auditada con motivo
│   ├── objectives.php       # CRUD de objetivos estratégicos
│   └── reports.php          # Resumen directivo, exportación CSV sanitizada y vista imprimible
├── bin/                     # Scripts CLI de mantenimiento y aprovisionamiento
│   ├── create-admin.php     # Creación segura de administradores iniciales
│   ├── init-reference.php   # Carga de catálogo de referencia
│   └── migrate.php          # Ejecutor manual de migraciones
├── config/                  # Configuración del entorno
│   └── app.php              # Carga de variables y rutas del sistema
├── css/                     # Hojas de estilo
│   └── styles.css           # Layout CSS Grid, variables corporativas y media queries responsivas
├── database/                # Persistencia SQLite
│   ├── backups/             # Copias de seguridad fechadas (.gitignore)
│   ├── db.php               # Conexión PDO, modo WAL y control de transacciones
│   ├── migrations.php       # Migraciones aditivas idempotentes (V1 - V4)
│   ├── official_data.php    # Datos canónicos oficiales TechPeru SAC 2025
│   ├── schema.php           # Esquema declarativo DDL (9 tablas, índices y triggers)
│   └── seed.php             # Semillero controlado para modo demostración
├── docs/                    # Documentación técnica y funcional exhaustiva
│   ├── ARCHITECTURE.md      # Arquitectura de software y flujo de datos
│   ├── AUDIT_AND_SECURITY.md# Controles de seguridad, CSRF, rate limit y sanitización CSV
│   ├── BUSINESS_RULES.md    # Fórmulas de cálculo del Scorecard y umbrales de semáforo
│   ├── DATA_MODEL.md        # Diagrama entidad-relación y restricciones DDL
│   ├── MIGRATIONS_AND_BACKUPS.md # Gestión de versiones y recuperación ante desastres
│   ├── ROLES_AND_PERMISSIONS.md # Matriz de roles y protección del último administrador
│   ├── API_REFERENCE.md     # Documentación detallada de endpoints HTTP
│   └── USER_MANUAL.md       # Guía de uso de los 8 módulos del sistema
├── helpers/                 # Utilidades HTTP y formato JSON
│   └── http.php             # Respuestas JSON normalizadas y excepciones HTTP
├── middleware/              # Filtros de seguridad
│   └── auth.php             # Control de sesiones, roles y tokens CSRF
├── repositories/            # Capa de persistencia y registro de auditoría
│   └── records.php          # Operaciones en base de datos y activity logs
├── services/                # Lógica de negocio
│   ├── catalog.php          # Validaciones de relaciones y sincronización
│   ├── measurements.php     # Lógica de mediciones y correcciones auditadas
│   └── scorecard.php        # Motor matemático de cálculo BSC
├── tests/                   # Pruebas automatizadas
│   ├── backend.php          # 12 pruebas unitarias en memoria (PHP)
│   └── integration.py       # 20 pruebas de contrato HTTP y seguridad (Python)
├── validators/              # Validación de entradas
│   ├── catalog.php          # Validación de entidades maestras
│   └── input.php            # Validadores tipados (texto, entero, flotante, fecha, enum)
├── views/                   # Vistas del servidor
│   └── report.php           # Plantilla HTML para impresión y exportación PDF
├── Caddyfile                # Configuración de FrankenPHP/Caddy con bloqueo de rutas privadas
├── Dockerfile               # Contenedor oficial para despliegue de desarrollo/pruebas
├── index.html               # SPA corporativa
└── router.php               # Enrutador de desarrollo para PHP CLI con bloqueo de archivos privados
```

---

## 🔒 Buenas Prácticas de Seguridad en Producción

1. **Aislamiento de la Base de Datos:** En entornos productivos, almacena el archivo `bsc.sqlite` en un directorio fuera de la raíz web accesible por HTTP (ej. `/var/lib/techperu/bsc.sqlite`).
2. **Protección de Rutas:** El archivo `Caddyfile` (o `router.php` en Docker) bloquea estrictamente el acceso a cualquier archivo `.sqlite`, `.env`, `.git` o directorios internos, respondiendo de inmediato con `HTTP 404 Not Found`.
3. **HTTPS y Cookies Seguras:** Configura `SESSION_SECURE=1` y utiliza un certificado TLS válido. Las cookies de sesión se generan con las directivas `HttpOnly`, `SameSite=Strict` y `Secure`.
4. **Respaldos Periódicos:** Emplea el comando `VACUUM INTO` para generar copias en caliente sin detener el servicio ni generar bloqueos de lectura.
