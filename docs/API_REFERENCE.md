# Referencia de Endpoints API — TechPeru SAC

Todos los endpoints responden en formato JSON con codificación UTF-8 y cabecera `Content-Type: application/json; charset=utf-8`.
Las solicitudes mutantes (`POST`, `PUT`, `DELETE`) requieren autenticación previa y la cabecera `X-CSRF-Token`.

---

## 1. Autenticación (`api/auth.php`)

| Método | Parámetros Query | Cuerpo / Payload | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `action=me` | Ninguno | Obtiene el usuario autenticado y el token CSRF activo. |
| `POST` | `action=login` | `{"email": "...", "password": "..."}` | Inicia sesión y regenera el ID de sesión. |
| `POST` | `action=logout` | `{}` | Cierra la sesión activa y destruye cookies. |
| `POST` | `action=change_password` | `{"current_password": "...", "new_password": "...", "confirm_password": "..."}` | Cambia la contraseña del usuario conectado. |

---

## 2. Dashboard Ejecutivo (`api/dashboard.php`)

| Método | Parámetros Query | Descripción |
| :--- | :--- | :--- |
| `GET` | Ninguno | Retorna el cumplimiento global, resumen de 4 perspectivas, lista de objetivos y matriz de KPIs. |

---

## 3. Indicadores KPI (`api/kpis.php`)

| Método | Parámetros Query | Cuerpo / Payload | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `perspective`, `status`, `q`, `responsible` | Ninguno | Lista filtrada de indicadores con valores actuales y semáforo. |
| `POST` | Ninguno | `{"id": "KPI-XX", "name": "...", "objective_id": "...", "target": 100, ...}` | Crea un nuevo indicador en el Balanced Scorecard. |
| `PUT` | Ninguno | `{"id": "KPI-XX", "target": 120, ...}` | Actualiza parcialmente los datos o metas de un indicador. |
| `DELETE` | `id=KPI-XX` | Ninguno | Elimina un indicador y su historial de mediciones en cascada. |

---

## 4. Mediciones de Desempeño (`api/measurements.php`)

| Método | Parámetros Query | Cuerpo / Payload | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `kpi_id`, `limit`, `offset` | Ninguno | Consulta historial de mediciones con paginación y trazabilidad. |
| `POST` | Ninguno | `{"kpi_id": "...", "period": "...", "date": "YYYY-MM-DD", "value": 15.2, "notes": "..."}` | Registra una nueva medición real periódica. |
| `POST` | `action=correct` | `{"measurement_id": 12, "value": 18.5, "notes": "...", "reason": "Motivo justificado..."}` | Corrige una medición registrada registrando autoría y motivo. |

---

## 5. Administración del Sistema (`api/admin.php`)

| Método | Parámetros Query | Cuerpo / Payload | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `action=users` | Ninguno | Directorio de usuarios con estados activos/inactivos y fotos. |
| `POST` | `action=save_user` | `{"id": "...", "name": "...", "email": "...", "role": "...", "area": "...", "is_active": 1, ...}` | Crea o actualiza un usuario corporativo. |
| `POST` | `action=toggle_user_status` | `{"id": "..."}` | Alterna el estado activo/inactivo (con protección del último admin). |
| `POST` | `action=reset_password` | `{"id": "...", "new_password": "...", "confirm_password": "..."}` | Restablece la contraseña de cualquier usuario. |
| `POST` | `action=delete_user` | `{"id": "..."}` | Elimina una cuenta de usuario (con protección del último admin). |
| `GET` | `action=periods` | Ninguno | Lista de períodos de evaluación con fechas y estados. |
| `POST` | `action=save_period` | `{"id": "...", "name": "...", "year": 2026, "start_date": "...", "end_date": "...", "status": "..."}` | Registra o actualiza un ciclo de evaluación. |
| `POST` | `action=set_active_period`| `{"id": "..."}` | Establece un período como Activo y los demás como Históricos. |
| `GET` | `action=activity` | `q=...`, `filter_action=...` | Consulta el registro inmutable de auditoría con filtros. |
| `POST` | `action=reset` | Ninguno | Restaura la base a los valores oficiales (solo con `APP_DEMO=1`). |

---

## 6. Reportes y Exportación (`api/reports.php`)

| Método | Parámetros Query | Descripción |
| :--- | :--- | :--- |
| `GET` | Ninguno | Datos consolidados de reporte, ranking de responsables y KPIs críticos. |
| `GET` | `action=export_csv&perspective=...&responsible=...&status=...` | Descarga el informe en formato CSV sanitizado contra inyecciones. |
| `GET` | `action=print_html&perspective=...&responsible=...&status=...` | Genera la vista ejecutiva lista para imprimir en PDF. |
