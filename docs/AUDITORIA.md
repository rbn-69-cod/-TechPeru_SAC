# Auditoría y mejoras · 20 de octubre de 2026

## Diagnóstico inicial

Se revisaron los endpoints PHP, esquema y carga de SQLite, cliente JavaScript, HTML principal y redirecciones, CSS y datos de referencia. La arquitectura real era una SPA con `fetch` hacia scripts PHP y PDO/SQLite; el README aún describía un prototipo localStorage sin backend.

Hallazgos corregidos:

| Hallazgo | Corrección |
| --- | --- |
| Sesión automática de administrador sin credenciales | Autenticación obligatoria, renovación de sesión y caducidad por inactividad |
| Contraseñas en texto plano | Hashes en carga demo y migración aditiva de usuarios existentes |
| Escrituras y restauración sin permisos ni CSRF | Middleware compartido, roles y token en toda escritura; reset solo POST y modo demo |
| Intentos de contraseña ilimitados | Límite persistente por correo/IP con ventana de 15 minutos |
| JSON inválido convertido en entrada vacía; errores SQL expuestos | Validación de estructura/tamaño y respuestas controladas sin detalle SQL |
| Campos editados ignorados o sobrescritos por valores por defecto | PUT parcial; persistencia de líder, objetivo vinculado, fechas y KPI de iniciativa |
| Eliminaciones fallidas por mediciones dependientes | Limpieza relacionada en transacción, incluyendo referencias opcionales de iniciativas |
| Creación de IDs por cantidad de iniciativas | IDs aleatorios para evitar colisiones al eliminar y crear |
| Fórmulas duplicadas y caso inverso de cero incorrecto | Función compartida y tratamiento explícito de cero |
| Medición atrasada reemplazaba el valor actual | Selección cronológica de última medición; duplicados rechazados |
| Historial completo descargado y solo 30 filas visibles | Paginación SQL y navegación anterior/siguiente en interfaz |
| Gráfico de tendencia ignoraba el filtro de responsable | Filtro aplicado también a mediciones históricas |
| División por cero en reporte sin KPI | Promedio protegido; cantidad de indicadores dinámica |
| Riesgo de fórmulas al abrir CSV | Neutralización de celdas textuales que comienzan con operadores de fórmula |
| Archivos SQLite y código interno potencialmente públicos | Router y reglas Apache con lista de archivos públicos permitidos |
| Credenciales precargadas en HTML | Campos vacíos y orientación de acceso sin divulgar contraseñas |
| Selector 2026 sin efecto real | Etiqueta explícita del plan de referencia 2025 |
| Formularios/modales con problemas de teclado y foco | Labels asociados, validación nativa, foco contenido y retorno, Escape, bloqueo de doble envío modal |
| Falta de estados de error/vacío y problemas en móvil | Reintento de vistas, estados vacíos, navegación accesible y estilos responsivos |

## Decisiones de arquitectura y compatibilidad

Se mantuvieron PHP y SQLite, las rutas `.php`, las ocho vistas y sus contratos de lectura. La escritura se concentró en servicios pequeños; no se añadieron framework, ORM ni repositorios que duplicaran PDO. Se preservó la base local original y se creó una copia en `storage/bsc.before-audit.sqlite`, excluida de Git.

Se conservaron los umbrales reales de la aplicación (90/75) y el promedio aritmético, no las reglas de un README antiguo que no correspondían al código. El historial conserva sus porcentajes capturados. Los responsables nominales existentes no se sustituyeron por nuevos identificadores, para no alterar los datos originales.

## Validación realizada

- Sintaxis de todos los archivos PHP de aplicación, servicios, configuración, base y herramientas CLI; sintaxis de `js/app.js`.
- 13 pruebas HTTP reproducibles en `tests/integration.py`, con base temporal y servidor PHP 8.3 en Docker.
- Navegación de las ocho vistas con Chrome automatizado; creación de objetivo, lectura del líder persistido y eliminación desde formulario; revisión de errores JavaScript.
- Revisión a 1440 px y 390 px; corrección del desbordamiento del filtro de responsables.
- Migración sobre copia de la base original: todos los passwords quedaron como hashes y `PRAGMA foreign_key_check` no detectó referencias inválidas.
- Creación de administrador e inicialización de referencias en otra base vacía con demo desactivada.

GitHub Actions queda configurado, pero su ejecución remota depende de la publicación y del servicio GitHub; las comprobaciones anteriores se ejecutaron localmente.

## Límites y trabajo de operación

Esta revisión no certifica producción ni constituye una prueba de penetración o carga. No se ha desplegado un servidor público. Antes de operar con datos reales hay que configurar HTTPS, credenciales propias, reglas del servidor web, almacenamiento y copias de seguridad, y probar restauración y carga con las necesidades reales.

Se conservan estas capacidades y límites deliberadamente:

- Administración consulta usuarios y períodos; altas de administrador y referencias se hacen por CLI. No hay pantalla de recuperación/cambio de contraseña ni gestión completa de usuarios/períodos.
- El plan de referencia de la interfaz es 2025; no se implementó selección multi-año ficticia. Los períodos cerrados son informativos y se admite registro tardío.
- El rol Responsable de indicadores puede capturar mediciones de todo el catálogo; las cuentas nominales solo las de su nombre. Para escalas mayores conviene migrar la asignación por nombre a IDs de usuario.
- No se editan/eliminan mediciones individualmente. El borrado de objetivo/KPI elimina su historial y conserva una entrada de auditoría de la operación.
- Los pesos y umbrales almacenados no tienen editor ni cambian las reglas 90/75 existentes. Los registros sin KPI muestran promedio cero; no se introdujo un estado nuevo de “sin medición”.
- Los catálogos, dashboard y exportación trabajan con la colección completa; el historial y auditoría tienen límites. Para muchos miles de KPI se requiere paginar y agregar esos endpoints.
- Chart.js y la tipografía dependen de CDN. El servidor incorporado PHP y el contenedor suministrado son para desarrollo.
- La limitación de login por correo/IP es una primera defensa; un despliegue público debería complementar con controles del proxy y monitoreo.
