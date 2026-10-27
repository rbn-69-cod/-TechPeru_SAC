# Reglas de Cálculo del Balanced Scorecard — TechPeru SAC

## 1. Sentido del Indicador y Fórmulas de Cumplimiento

Cada indicador posee un sentido que determina cómo se evalúa el resultado real respecto a la meta establecida:

### A. Indicadores Directos (`direction = 'mayor'`)
Aplican a indicadores donde un mayor valor refleja un mejor desempeño (ej. Ingresos, Ventas, Rentabilidad, Satisfacción del Cliente):
$$\text{Cumplimiento (\%)} = \left( \frac{\text{Valor Real}}{\text{Meta}} \right) \times 100$$
- Las metas directas deben ser valores estrictamente positivos ($> 0$).
- Si el valor real supera la meta, el cumplimiento excede el 100% de forma proporcional sin truncamiento artificial.

### B. Indicadores Inversos (`direction = 'menor'`)
Aplican a indicadores donde un menor valor refleja un mejor desempeño (ej. Tasa de Deserción, Costos Operativos, Tiempos de Entrega, Defectos):
$$\text{Cumplimiento (\%)} = \left( \frac{\text{Meta}}{\text{Valor Real}} \right) \times 100$$
- Caso especial de valor cero: Si el valor real obtenido es $0$ (ej. cero incidentes de seguridad), el cumplimiento es evaluado al **100%** de logro.
- Las metas y valores reales de indicadores inversos no pueden ser negativos ($\ge 0$).

---

## 2. Indicadores sin Medición Registrada (`⏳ PENDIENTE`)
Cuando un KPI se da de alta en el sistema pero aún no cuenta con mediciones periódicas en la tabla `measurements` ($count = 0$), el sistema **no** le asigna 0% de cumplimiento ni lo clasifica como estado crítico.
- **Clave interna:** `pending`
- **Etiqueta oficial:** `⏳ PENDIENTE`
- En el dashboard y tablas, se muestra un indicador visual en gris neutro indicando que el ciclo de recolección de datos no ha comenzado.

---

## 3. Umbrales Oficiales de Semáforo
Para indicadores que cuentan con al menos una medición registrada:

| Estado Oficial | Clave Interna | Rango de Cumplimiento | Color / Semáforo |
| :--- | :---: | :---: | :---: |
| **Logrado** | `good` | $\ge 90.0\%$ | 🟢 Verde (#16845b) |
| **En Riesgo** | `warn` | $75.0\% \le x < 90.0\%$ | 🟡 Ámbar (#d99a19) |
| **Crítico** | `bad` | $< 75.0\%$ | 🔴 Rojo (#d23f49) |
| **Pendiente** | `pending` | Sin mediciones / `null` | ⚪ Gris Neutro (#64748b) |

---

## 4. Agregación a Nivel de Objetivos y Perspectivas
- **Cumplimiento de Objetivo:** Promedio aritmético de los porcentajes de cumplimiento de todos los KPIs vinculados a dicho objetivo.
- **Cumplimiento de Perspectiva:** Promedio aritmético de los porcentajes de los objetivos que pertenecen a esa perspectiva.
- **Cumplimiento Global Corporativo:** Promedio ponderado de las 4 perspectivas estratégicas (Financiera, Clientes, Procesos Internos, Aprendizaje y Crecimiento).
