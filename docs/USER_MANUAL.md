# Manual de Usuario — Balanced Scorecard TechPeru SAC 2025

Bienvenido al Cuadro de Mando Integral oficial de TechPeru SAC. Esta guía describe el funcionamiento de cada uno de los 8 módulos de la plataforma.

---

## 1. Acceso al Sistema (Login)
1. Ingrese a la URL de la plataforma (`http://localhost:8080`).
2. En la pantalla de bienvenida, ingrese su correo corporativo y contraseña.
   - En ambientes de prueba, puede hacer clic en el botón **"Autocompletar"** de la tarjeta demo para rellenar las credenciales del Administrador en un clic.
3. Presione **"Ingresar al sistema"**.

---

## 2. Dashboard Ejecutivo
- **Indicadores Clave en la Cabecera:**
  - *Cumplimiento Global:* Porcentaje general ponderado de la empresa.
  - *Salud de Indicadores:* Distribución total entre Logrados (≥90%), En Riesgo (75%-89.9%) y Críticos (<75%).
  - *Objetivos Estratégicos:* 12 objetivos definidos distribuidos en las 4 perspectivas.
  - *Liderazgo y Gestión:* 28 líderes con indicadores asignados.
- **Tarjetas de Perspectiva:**
  - Haga clic en cualquiera de las 4 perspectivas (*Financiera, Clientes, Procesos Internos, Aprendizaje y Crecimiento*) para filtrar inmediatamente la tabla inferior.
- **Filtros Rápidos y Búsqueda:**
  - Filtre por texto, por estado de semáforo o por líder responsable en el menú desplegable.

---

## 3. Mapa Estratégico Corporativo
- Muestra el flujo causa-efecto de la estrategia organizacional:
  - **Aprendizaje y Crecimiento:** Cimientos de talento, cultura y capacidades.
  - **Procesos Internos:** Excelencia operativa, calidad e innovación.
  - **Clientes:** Satisfacción, retención y expansión de mercado.
  - **Financiera:** Rentabilidad, crecimiento y estructura de costos.
- Cada objetivo muestra su líder a cargo, cantidad de indicadores vinculados y porcentaje de avance.

---

## 4. Objetivos Estratégicos
- Lista completa de los 12 objetivos oficiales de TechPeru SAC.
- Permite crear nuevos objetivos estratégicos indicando perspectiva, líder responsable, prioridad y peso estratégico.

---

## 5. Indicadores (KPI)
- Catálogo maestro de los 36 KPIs oficiales.
- Permite registrar metas, unidad de medida (`%`, `S/.`, `USD`, `días`, `puntos`), frecuencia de evaluación y sentido de la medición (Mayor es mejor / Menor es mejor).

---

## 6. Registro de Resultados y Mediciones
- **Registro Directo:**
  1. Seleccione el KPI de la lista desplegable.
  2. Seleccione el período de evaluación (`2025-Q1`, `2025-Q2`, `2025-Q3`, `2025-Q4`, `2025-Acum`).
  3. Ingrese el valor real obtenido y las observaciones correspondientes.
  4. Haga clic en **"Guardar resultado"**.
- **Corrección Auditada de Errores:**
  - En la tabla de historial inferior, los Administradores y Gerentes disponen del botón `✏️ Corregir`.
  - Al corregir un valor, se exige ingresar el **motivo de la corrección** (mínimo 5 caracteres).
  - El sistema conserva el valor previo y muestra una etiqueta ámbar indicando quién corrigió y por qué razón.

---

## 7. Iniciativas Estratégicas
- Proyectos estratégicos orientados a impulsar el cumplimiento de los objetivos y KPIs.
- Monitoreo de presupuesto asignado, porcentaje de avance, líder de proyecto y fechas de ejecución.

---

## 8. Centro de Reportes
- Resumen ejecutivo para comités de dirección.
- Ranking de desempeño por líderes de área.
- Lista prioritaria de indicadores en estado crítico con plan de acción recomendado.
- Botones de exportación:
  - **📥 Exportar CSV:** Descarga un archivo compatible con Excel, protegido contra inyección de fórmulas.
  - **🖨️ Informe Imprimible:** Genera una versión lista para imprimir o exportar a PDF con estilos limpios y profesionales.

---

## 9. Administración del Sistema (Solo Administradores)
Dispone de 4 pestañas especializadas:
1. **Mi Perfil & Cambiar Foto:** Personalice su nombre, área y foto de perfil (subiendo un archivo o seleccionando un avatar corporativo). Incluye formulario de cambio de contraseña.
2. **Directorio de Usuarios:** Edite roles, restablezca contraseñas en caso de olvido y active/desactive accesos mediante el botón de estado `🟢 Activo` / `🔴 Inactivo`.
3. **Configuración BSC & Períodos:** Modifique el nombre oficial de la organización y gestione los ciclos de evaluación. Utilice el botón `⭐ Activar` para definir el ciclo vigente.
4. **Registro de Auditoría:** Buscador en tiempo real y filtro por acción para consultar la trazabilidad inmutable de todas las operaciones registradas en la base de datos.
