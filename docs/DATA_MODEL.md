# Modelo de Datos e Integridad Referencial — TechPeru SAC

## 1. Diagrama Entidad-Relación

```mermaid
erDiagram
    PERSPECTIVES ||--o{ OBJECTIVES : "contiene (1:N)"
    OBJECTIVES ||--o{ KPIS : "alinea (1:N)"
    OBJECTIVES ||--o{ INITIATIVES : "orienta (1:N)"
    KPIS ||--o{ MEASUREMENTS : "registra historial (1:N)"
    KPIS ||--o{ INITIATIVES : "impacta (0..1:N)"
    EVALUATION_PERIODS ||--o{ MEASUREMENTS : "ciclo (1:N)"
    USERS ||--o{ ACTIVITY_LOGS : "genera auditoría (1:N)"

    PERSPECTIVES {
        string id PK
        string name
        string description
        string color
        string icon
    }

    OBJECTIVES {
        string id PK
        string perspective_id FK
        string name
        string description
        string leader
        float weight
        string priority
    }

    KPIS {
        string id PK
        string objective_id FK
        string perspective_id FK
        string name
        string code
        string unit
        string direction
        float target
        float current_real
        float compliance_pct
        string status
        string frequency
        string responsible
        string responsible_area
    }

    MEASUREMENTS {
        int id PK
        string kpi_id FK
        string period FK
        string date
        float value
        float compliance_pct
        string registered_by
        string notes
        float previous_value
        string corrected_at
        string correction_reason
        string corrected_by
    }

    INITIATIVES {
        string id PK
        string objective_id FK
        string kpi_id FK
        string name
        string leader
        float budget
        float progress_pct
        string status
        string start_date
        string end_date
    }

    EVALUATION_PERIODS {
        string id PK
        string name
        int year
        string status
        string start_date
        string end_date
    }

    USERS {
        string id PK
        string name
        string email UK
        string role
        string area
        string password
        string avatar
        int is_active
        string created_at
    }

    ACTIVITY_LOGS {
        int id PK
        string action
        string entity_type
        string entity_id
        string details
        string user_id
        string user_name
        string created_at
    }
```

## 2. Restricciones e Índices

### Claves Foráneas (`PRAGMA foreign_keys = ON`)
- `kpis.objective_id` -> `objectives.id` ON DELETE CASCADE
- `kpis.perspective_id` -> `perspectives.id` ON UPDATE CASCADE
- `measurements.kpi_id` -> `kpis.id` ON DELETE CASCADE
- `initiatives.objective_id` -> `objectives.id` ON DELETE CASCADE
- `initiatives.kpi_id` -> `kpis.id` ON DELETE SET NULL

### Índices de Rendimiento
- `idx_kpis_objective`: Búsquedas agrupadas por objetivo.
- `idx_kpis_perspective`: Filtros por perspectiva estratégica.
- `idx_measurements_date`: Búsqueda de la medición más reciente por KPI (`kpi_id, date DESC, id DESC`).
- `idx_measurements_period`: Consultas y cortes por período (`period, date`).
- `idx_initiatives_objective`: Búsqueda de iniciativas por objetivo.

### Triggers de Integridad
- `measurement_duplicate`: Rechaza inserciones duplicadas si ya existe una medición para el mismo KPI, período y fecha.
