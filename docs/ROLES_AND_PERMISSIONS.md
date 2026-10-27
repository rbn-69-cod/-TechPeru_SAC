# Matriz de Roles, Permisos y Seguridad — TechPeru SAC

## 1. Definición de Roles

El sistema reconoce 5 roles corporativos vinculados al organigrama de TechPeru SAC:

1. **`Administrador` (Dirección General & TI):**
   - Control total de la plataforma.
   - Acceso exclusivo al módulo de Administración: gestión de usuarios, reseteo de claves, activación de períodos de evaluación, auditoría global y restauración de base de datos demo (solo en modo `APP_DEMO=1`).
2. **`Gerente` (Gerencias de Área):**
   - Gestión integral de estrategia: alta, edición y baja de objetivos estratégicos, indicadores KPI e iniciativas.
   - Corrección auditada de mediciones erróneas con registro de motivo.
   - Acceso completo a reportes analíticos y exportaciones.
3. **`Directivo` (Comité Ejecutivo):**
   - Visualización gerencial y ejecutiva transversal de todas las perspectivas, mapa estratégico, objetivos y reportes corporativos.
   - Capacidad de corrección auditada de mediciones en comités de control.
4. **`Responsable de indicadores` (Control de Gestión):**
   - Captura y registro periódico de mediciones de todos los indicadores del BSC.
   - Consulta completa de metas, iniciativas y reportes ejecutivos.
5. **`Responsable` (Líder Asignado a KPI):**
   - Registro de valores reales exclusivamente para los indicadores donde figure asignado su nombre como responsable oficial.

---

## 2. Matriz de Permisos por Módulo

| Módulo / Acción | Administrador | Gerente | Directivo | Resp. Indicadores | Responsable |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ver Dashboard, Mapa y Reportes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exportar CSV y Reporte HTML | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear / Editar Objetivos y KPIs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar Nueva Medición | ✅ | ✅ | ✅ | ✅ | ✅ (Solo asignados) |
| Corregir Medición con Auditoría | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crear / Editar Iniciativas | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar Usuarios y Estado | ✅ | ❌ | ❌ | ❌ | ❌ |
| Restablecer Claves de Otros | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cambiar Propia Contraseña | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear / Activar Períodos | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver Registro de Auditoría | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 3. Reglas Críticas de Protección

### Regla del Último Administrador Activo
La función `countActiveAdmins(PDO $pdo)` valida en cada operación administrativa (`save_user`, `toggle_user_status`, `delete_user`):
- Un Administrador **nunca** puede desactivarse a sí mismo si es el único Administrador activo en el sistema.
- Un Administrador **nunca** puede cambiar su propio rol a otro inferior si no existe otro Administrador activo.
- Un Administrador **nunca** puede ser eliminado si es el único administrador activo.

### Estado Operativo del Usuario (`is_active`)
- Los usuarios desactivados (`is_active = 0`) son rechazados en el intento de autenticación con mensaje formal y código `HTTP 403 Forbidden`.
- Las sesiones abiertas de usuarios desactivados caducan en su siguiente interacción con el servidor.
