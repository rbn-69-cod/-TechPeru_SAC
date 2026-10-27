<?php
function seedDatabase(PDO $pdo): void {
    initializeSchema($pdo);
    $pdo->beginTransaction();

    try {
        // 1. Limpieza total
        $pdo->exec("
            DELETE FROM activity_logs;
            DELETE FROM measurements;
            DELETE FROM initiatives;
            DELETE FROM kpis;
            DELETE FROM objectives;
            DELETE FROM perspectives;
            DELETE FROM evaluation_periods;
            DELETE FROM users;
            DELETE FROM settings;
        ");

        // 2. Usuarios
        $stmtUser = $pdo->prepare("INSERT INTO users (id, name, email, role, area, password) VALUES (?, ?, ?, ?, ?, ?)");
        $users = [
            ['u1', 'Administrador TechPeru', 'admin@demo.com', 'Administrador', 'Dirección General', 'BSC2026!'],
            ['u2', 'Gerente de Estrategia', 'gerente@demo.com', 'Gerente', 'Gerencia Comercial', 'BSC2026!'],
            ['u3', 'Responsable de Indicadores', 'responsable@demo.com', 'Responsable de indicadores', 'Control de Gestión', 'BSC2026!'],
            ['u4', 'Lic. Carlos Mendoza', 'carlos.mendoza@techperu.pe', 'Gerente de Finanzas', 'Gerencia de Finanzas', 'BSC2026!'],
            ['u5', 'Ing. Sofía Morales', 'sofia.morales@techperu.pe', 'Jefe de Operaciones', 'Operaciones & Calidad', 'BSC2026!'],
            ['u6', 'Dra. Elena Ramos', 'elena.ramos@techperu.pe', 'Gerente de Talento', 'Gestión de Personas', 'BSC2026!']
        ];
        foreach ($users as $u) {
            $u[5] = password_hash($u[5], PASSWORD_DEFAULT);
            $stmtUser->execute($u);
        }

        // 3. Perspectivas
        $stmtPersp = $pdo->prepare("INSERT INTO perspectives (id, code, name, title, color, soft_color, icon, order_num, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $perspectives = [
            ['financiera', 'FIN', 'Financiera', '💰 PERSPECTIVA FINANCIERA', '#1f3864', '#edf4ff', '💰', 1, 25.0],
            ['clientes', 'CLI', 'Clientes', '👥 PERSPECTIVA DE CLIENTES', '#1e4d2b', '#eaf8f1', '👥', 2, 25.0],
            ['procesos', 'PROC', 'Procesos internos', '🔧 PERSPECTIVA DE PROCESOS INTERNOS', '#9a4b08', '#fff5e6', '🔧', 3, 25.0],
            ['aprendizaje', 'APR', 'Aprendizaje y crecimiento', '📚 PERSPECTIVA DE APRENDIZAJE Y CRECIMIENTO', '#4a2373', '#f2edff', '📚', 4, 25.0]
        ];
        foreach ($perspectives as $p) {
            $stmtPersp->execute($p);
        }

        // 4. Períodos de Evaluación
        $stmtPeriod = $pdo->prepare("INSERT INTO evaluation_periods (id, name, year, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)");
        $periods = [
            ['2025-Q1', '2025 - Primer Trimestre (Q1)', 2025, 'Cerrado', '2025-01-01', '2025-03-31'],
            ['2025-Q2', '2025 - Segundo Trimestre (Q2)', 2025, 'Cerrado', '2025-04-01', '2025-06-30'],
            ['2025-Q3', '2025 - Tercer Trimestre (Q3)', 2025, 'Activo', '2025-07-01', '2025-09-30'],
            ['2025-Q4', '2025 - Cuarto Trimestre (Q4)', 2025, 'Planificado', '2025-10-01', '2025-12-31'],
            ['2025-Acum', '2025 - Acumulado Anual', 2025, 'Activo', '2025-01-01', '2025-12-31']
        ];
        foreach ($periods as $prd) {
            $stmtPeriod->execute($prd);
        }

        // 5. Cargar Objetivos y KPIs (datos nativos en PHP, 100% independiente de Excel)
        $officialDataFile = __DIR__ . '/official_data.php';
        $jsonPath = dirname(__DIR__) . '/js/excel_exact_data.json';
        if (file_exists($officialDataFile)) {
            $data = require $officialDataFile;
        } elseif (file_exists($jsonPath)) {
            $data = json_decode(file_get_contents($jsonPath), true);
        } else {
            throw new Exception("No se encontraron los datos maestros del BSC.");
        }

        // Mapeo detallado de Responsables, Áreas y Fórmulas para cada uno de los 36 KPIs
        $metaDetails = [
            // FINANCIERA
            'KPI-01' => ['resp' => 'Lic. Carlos Mendoza', 'area' => 'Gerencia de Finanzas', 'freq' => 'Trimestral', 'base' => 15.0, 'formula' => '(Utilidad Neta / Patrimonio Neto) × 100'],
            'KPI-02' => ['resp' => 'Mg. Patricia Valdivia', 'area' => 'Control Financiero', 'freq' => 'Mensual', 'base' => 18.5, 'formula' => '(EBITDA / Ingresos Operativos) × 100'],
            'KPI-03' => ['resp' => 'Lic. Carlos Mendoza', 'area' => 'Gerencia de Finanzas', 'freq' => 'Trimestral', 'base' => 1.65, 'formula' => 'Ingresos Totales - Costos - Gastos - Impuestos'],
            'KPI-04' => ['resp' => 'Ing. Roberto Benítez', 'area' => 'Gerencia Comercial', 'freq' => 'Trimestral', 'base' => 10.2, 'formula' => '((Ventas Actual - Ventas Anterior) / Ventas Anterior) × 100'],
            'KPI-05' => ['resp' => 'Ing. Roberto Benítez', 'area' => 'Gerencia Comercial', 'freq' => 'Mensual', 'base' => 7.1, 'formula' => '∑ Facturación bruta neta de devoluciones (S/ MM)'],
            'KPI-06' => ['resp' => 'Lic. Mariana Costa', 'area' => 'Desarrollo de Negocios', 'freq' => 'Trimestral', 'base' => 12.0, 'formula' => '(Facturación Nuevos Productos / Facturación Total) × 100'],
            'KPI-07' => ['resp' => 'Mg. Fernando Zúñiga', 'area' => 'Auditoría de Costos', 'freq' => 'Mensual', 'base' => 61.0, 'formula' => '(Costos Operativos Totales / Ingresos Totales) × 100'],
            'KPI-08' => ['resp' => 'Lic. Andrea Gallardo', 'area' => 'Growth & Marketing', 'freq' => 'Mensual', 'base' => 450.0, 'formula' => 'Gastos Totales Mkt y Ventas / Nuevos Clientes Adquiridos'],
            'KPI-09' => ['resp' => 'Mg. Patricia Valdivia', 'area' => 'Control Financiero', 'freq' => 'Trimestral', 'base' => 7.0, 'formula' => '(Utilidad Neta / Total Activos) × 100'],

            // CLIENTES
            'KPI-10' => ['resp' => 'Lic. Camila Paredes', 'area' => 'Experiencia del Cliente (CX)', 'freq' => 'Trimestral', 'base' => 52.0, 'formula' => '% Promotores - % Detractores (Encuesta NPS)'],
            'KPI-11' => ['resp' => 'Lic. Camila Paredes', 'area' => 'Experiencia del Cliente (CX)', 'freq' => 'Mensual', 'base' => 79.0, 'formula' => '(Calificaciones 4-5 estrellas / Total Calificaciones) × 100'],
            'KPI-12' => ['resp' => 'Ing. Javier Bustamante', 'area' => 'Soporte al Cliente', 'freq' => 'Mensual', 'base' => 3.4, 'formula' => '∑ Días para resolver reclamo / Total Reclamos Resueltos'],
            'KPI-13' => ['resp' => 'Mg. Vanessa Rivas', 'area' => 'Customer Success', 'freq' => 'Trimestral', 'base' => 84.0, 'formula' => '((Clientes Fin - Clientes Nuevos) / Clientes Inicio) × 100'],
            'KPI-14' => ['resp' => 'Mg. Vanessa Rivas', 'area' => 'Customer Success', 'freq' => 'Mensual', 'base' => 42.0, 'formula' => '(Clientes con Recompra / Total Clientes Activos) × 100'],
            'KPI-15' => ['resp' => 'Ing. Diego Alarcón', 'area' => 'Retención & CRM', 'freq' => 'Mensual', 'base' => 8.5, 'formula' => '(Clientes que cancelaron / Total Clientes al Inicio) × 100'],
            'KPI-16' => ['resp' => 'Lic. Martín Velásquez', 'area' => 'Ventas Corporativas', 'freq' => 'Trimestral', 'base' => 88.0, 'formula' => 'Conteo de contratos nuevos formalizados en el período'],
            'KPI-17' => ['resp' => 'Lic. Mariana Costa', 'area' => 'Inteligencia de Mercado', 'freq' => 'Semestral', 'base' => 7.1, 'formula' => '(Ventas TechPeru / Ventas Totales del Mercado) × 100'],
            'KPI-18' => ['resp' => 'Lic. Andrea Gallardo', 'area' => 'Marketing Digital', 'freq' => 'Mensual', 'base' => 240.0, 'formula' => 'Inversión en Pauta Digital / Leads Calificados (SQL)'],

            // PROCESOS INTERNOS
            'KPI-19' => ['resp' => 'Ing. Sofía Morales', 'area' => 'Operaciones & Despacho', 'freq' => 'Mensual', 'base' => 4.2, 'formula' => '∑ Días desde pedido hasta entrega confirmada / N° Pedidos'],
            'KPI-20' => ['resp' => 'Ing. Raúl Espinoza', 'area' => 'Gestión de la Calidad (QA)', 'freq' => 'Mensual', 'base' => 3.5, 'formula' => '(Entregas con Reclamo o Defecto / Total Entregas) × 100'],
            'KPI-21' => ['resp' => 'Mg. Fernando Zúñiga', 'area' => 'Eficiencia Operativa', 'freq' => 'Trimestral', 'base' => 0.19, 'formula' => 'Facturación Total (S/ MM) / Plantilla FTE Promedio'],
            'KPI-22' => ['resp' => 'Ing. Diego Alarcón', 'area' => 'I+D & Ingeniería de Software', 'freq' => 'Semestral', 'base' => 2.0, 'formula' => 'Conteo de nuevas versiones y productos lanzados a producción'],
            'KPI-23' => ['resp' => 'Ing. Diego Alarcón', 'area' => 'I+D & Ingeniería de Software', 'freq' => 'Trimestral', 'base' => 18.0, 'formula' => 'Semanas transcurridas desde Kick-off hasta Despliegue en Vivo'],
            'KPI-24' => ['resp' => 'Lic. Mariana Costa', 'area' => 'Estrategia de Producto', 'freq' => 'Trimestral', 'base' => 14.0, 'formula' => '(Ventas de productos con &lt; 2 años / Ventas Totales) × 100'],
            'KPI-25' => ['resp' => 'Ing. Jorge Navarro', 'area' => 'Cadena de Suministro', 'freq' => 'Mensual', 'base' => 88.0, 'formula' => '(Pedidos de proveedores a tiempo y completos / Total Pedidos) × 100'],
            'KPI-26' => ['resp' => 'Ing. Jorge Navarro', 'area' => 'Compras & Logística', 'freq' => 'Mensual', 'base' => 11.0, 'formula' => 'Total de incidentes de incumplimiento de SLA de proveedores'],
            'KPI-27' => ['resp' => 'Mg. Fernando Zúñiga', 'area' => 'Control de Inventarios', 'freq' => 'Mensual', 'base' => 16.8, 'formula' => '(Valor Valorizado de Inventario / Costo de Ventas) × 100'],

            // APRENDIZAJE Y CRECIMIENTO
            'KPI-28' => ['resp' => 'Dra. Elena Ramos', 'area' => 'Talento & Cultura', 'freq' => 'Trimestral', 'base' => 28.0, 'formula' => 'Total de Horas Capacitadas Efectivas / Total Colaboradores'],
            'KPI-29' => ['resp' => 'Dra. Elena Ramos', 'area' => 'Talento & Cultura', 'freq' => 'Semestral', 'base' => 60.0, 'formula' => '(Colaboradores con PDI vigente / Total Colaboradores) × 100'],
            'KPI-30' => ['resp' => 'Lic. Víctor Hugo Quispe', 'area' => 'Capacitación Técnica', 'freq' => 'Trimestral', 'base' => 68.0, 'formula' => '(Competencias Aprobadas en Evaluación / Requeridas) × 100'],
            'KPI-31' => ['resp' => 'Lic. Melissa Barreto', 'area' => 'Clima Organizacional', 'freq' => 'Semestral', 'base' => 62.0, 'formula' => 'Puntaje Promedio General Encuesta de Clima Laboral (%)'],
            'KPI-32' => ['resp' => 'Dra. Elena Ramos', 'area' => 'Talento & Cultura', 'freq' => 'Mensual', 'base' => 13.0, 'formula' => '(Total Bajas en el Período / Plantilla Promedio) × 100'],
            'KPI-33' => ['resp' => 'Lic. Melissa Barreto', 'area' => 'Desempeño y Compensaciones', 'freq' => 'Anual', 'base' => 78.0, 'formula' => '(Evaluaciones de Desempeño Completadas / Total Evaluables) × 100'],
            'KPI-34' => ['resp' => 'Ing. Sofía Morales', 'area' => 'Mejora Continua', 'freq' => 'Trimestral', 'base' => 3.0, 'formula' => 'Conteo de Proyectos Kaizen / Mejora Continua en marcha'],
            'KPI-35' => ['resp' => 'Ing. Diego Alarcón', 'area' => 'Transformación Digital', 'freq' => 'Trimestral', 'base' => 2.8, 'formula' => '(Presupuesto Ejecutado en I+D / Ingresos Totales) × 100'],
            'KPI-36' => ['resp' => 'Lic. Víctor Hugo Quispe', 'area' => 'Innovación Corporativa', 'freq' => 'Trimestral', 'base' => 10.0, 'formula' => 'Conteo de Ideas de Empleados implementadas con éxito']
        ];

        $stmtObj = $pdo->prepare("INSERT INTO objectives (id, perspective_id, name, full_name, description, priority, weight, status, leader) VALUES (?, ?, ?, ?, ?, ?, ?, 'Activo', ?)");
        foreach ($data['objectives'] as $obj) {
            $leaderMap = [
                'OBJ-F1' => 'Lic. Carlos Mendoza (Finanzas)',
                'OBJ-F2' => 'Ing. Roberto Benítez (Comercial)',
                'OBJ-F3' => 'Mg. Patricia Valdivia (Costos)',
                'OBJ-C1' => 'Lic. Camila Paredes (CX)',
                'OBJ-C2' => 'Mg. Vanessa Rivas (Customer Success)',
                'OBJ-C3' => 'Lic. Martín Velásquez (Ventas)',
                'OBJ-P1' => 'Ing. Sofía Morales (Operaciones)',
                'OBJ-P2' => 'Ing. Diego Alarcón (Producto & TI)',
                'OBJ-P3' => 'Ing. Jorge Navarro (Logística)',
                'OBJ-A1' => 'Dra. Elena Ramos (Talento)',
                'OBJ-A2' => 'Lic. Melissa Barreto (Cultura)',
                'OBJ-A3' => 'Lic. Víctor Hugo Quispe (Innovación)'
            ];
            $leader = $leaderMap[$obj['id']] ?? 'Dirección General';

            $stmtObj->execute([
                $obj['id'],
                $obj['perspective'],
                $obj['name'],
                $obj['fullName'],
                "Objetivo estratégico oficial de TechPeru SAC: {$obj['fullName']}",
                'Alta',
                100,
                $leader
            ]);
        }

        $stmtKpi = $pdo->prepare("
            INSERT INTO kpis (
                id, num, objective_id, perspective_id, name, unit, target, current_real,
                compliance_pct, status, direction, responsible, responsible_area, frequency,
                baseline, calculation_formula, threshold_good, threshold_warn, action_recommended
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 90.0, 75.0, ?)
        ");

        $stmtMeas = $pdo->prepare("INSERT INTO measurements (kpi_id, period, date, value, compliance_pct, notes, registered_by) VALUES (?, ?, ?, ?, ?, ?, ?)");

        foreach ($data['kpis'] as $kpi) {
            $direction = $kpi['inverse'] ? 'menor' : 'mayor';
            $meta = $metaDetails[$kpi['id']] ?? [
                'resp' => 'Responsable Asignado',
                'area' => 'Área Operativa',
                'freq' => 'Trimestral',
                'base' => $kpi['real'] * 0.9,
                'formula' => 'Cálculo estándar BSC'
            ];

            $stmtKpi->execute([
                $kpi['id'],
                $kpi['num'],
                $kpi['objectiveId'],
                $kpi['perspective'],
                $kpi['name'],
                $kpi['unit'],
                $kpi['target'],
                $kpi['real'],
                $kpi['pct'],
                $kpi['status'],
                $direction,
                $meta['resp'],
                $meta['area'],
                $meta['freq'],
                $meta['base'],
                $meta['formula'],
                $kpi['action']
            ]);

            // Mediciones trimestrales históricas
            $m1Val = $direction === 'menor' ? round($kpi['real'] * 1.15, 2) : round($kpi['real'] * 0.85, 2);
            $m2Val = $direction === 'menor' ? round($kpi['real'] * 1.05, 2) : round($kpi['real'] * 0.92, 2);
            $m3Val = $kpi['real'];

            $pct1 = $direction === 'menor' ? ($m1Val > 0 ? round(($kpi['target'] / $m1Val) * 100, 1) : 0) : ($kpi['target'] > 0 ? round(($m1Val / $kpi['target']) * 100, 1) : 0);
            $pct2 = $direction === 'menor' ? ($m2Val > 0 ? round(($kpi['target'] / $m2Val) * 100, 1) : 0) : ($kpi['target'] > 0 ? round(($m2Val / $kpi['target']) * 100, 1) : 0);
            $pct3 = $kpi['pct'];

            $stmtMeas->execute([$kpi['id'], '2025-Q1', '2025-03-31', $m1Val, $pct1, 'Cierre trimestral Q1', $meta['resp']]);
            $stmtMeas->execute([$kpi['id'], '2025-Q2', '2025-06-30', $m2Val, $pct2, 'Cierre trimestral Q2', $meta['resp']]);
            $stmtMeas->execute([$kpi['id'], '2025-Acum', '2025-10-15', $m3Val, $pct3, $kpi['action'], $meta['resp']]);
        }

        // 6. 12 Iniciativas estratégicas oficiales
        $stmtInit = $pdo->prepare("INSERT INTO initiatives (id, objective_id, kpi_id, name, leader, budget, start_date, end_date, progress_pct, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $initiatives = [
            ['INI-01', 'OBJ-F1', 'KPI-02', 'Plan integral de reducción de gastos operativos y eficiencia EBITDA Q3-Q4', 'Lic. Carlos Mendoza', 180000, '2025-01-15', '2025-11-30', 78, 'En ejecución'],
            ['INI-02', 'OBJ-F2', 'KPI-04', 'Aceleración de pipeline comercial corporativo y campañas de upsell', 'Ing. Roberto Benítez', 120000, '2025-02-01', '2025-12-15', 65, 'En ejecución'],
            ['INI-03', 'OBJ-F3', 'KPI-08', 'Optimización de canales de captación digital y reducción de CAC', 'Lic. Andrea Gallardo', 95000, '2025-03-01', '2025-10-31', 70, 'En ejecución'],
            ['INI-04', 'OBJ-C1', 'KPI-12', 'Creación de equipo dedicado de soporte nivel 2 y resolución en < 2 días', 'Ing. Javier Bustamante', 85000, '2025-02-15', '2025-09-30', 82, 'En ejecución'],
            ['INI-05', 'OBJ-C2', 'KPI-15', 'Implementación de unidad de Customer Success y retención de cuentas clave', 'Mg. Vanessa Rivas', 140000, '2025-01-10', '2025-11-15', 75, 'En ejecución'],
            ['INI-06', 'OBJ-C3', 'KPI-16', 'Expansión de fuerza de ventas y desarrollo de mercado en regiones', 'Lic. Martín Velásquez', 160000, '2025-03-15', '2025-12-20', 60, 'En ejecución'],
            ['INI-07', 'OBJ-P1', 'KPI-20', 'Programa de control de calidad por etapas y reducción de defectos', 'Ing. Raúl Espinoza', 110000, '2025-02-01', '2025-10-30', 68, 'En ejecución'],
            ['INI-08', 'OBJ-P2', 'KPI-23', 'Adopción de metodología ágil y aceleración de time-to-market en productos', 'Ing. Diego Alarcón', 130000, '2025-01-20', '2025-11-30', 70, 'En ejecución'],
            ['INI-09', 'OBJ-P3', 'KPI-26', 'Sistema de evaluación mensual y renegociación de SLAs con proveedores', 'Ing. Jorge Navarro', 75000, '2025-04-01', '2025-10-15', 85, 'En ejecución'],
            ['INI-10', 'OBJ-A1', 'KPI-28', 'Programa obligatorio de certificación técnica y plan de carrera por áreas', 'Dra. Elena Ramos', 90000, '2025-02-01', '2025-11-15', 72, 'En ejecución'],
            ['INI-11', 'OBJ-A2', 'KPI-32', 'Revisión de esquema de compensación y plan de retención de talento clave', 'Lic. Melissa Barreto', 105000, '2025-03-01', '2025-12-10', 64, 'En ejecución'],
            ['INI-12', 'OBJ-A3', 'KPI-36', 'Implementación de plataforma digital de ideas de mejora continua e innovación', 'Lic. Víctor Hugo Quispe', 80000, '2025-02-15', '2025-09-30', 90, 'En ejecución']
        ];
        foreach ($initiatives as $init) {
            $stmtInit->execute($init);
        }

        // 7. Configuraciones
        $stmtSet = $pdo->prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
        $stmtSet->execute(['period', '2025']);
        $stmtSet->execute(['org_name', 'TechPeru SAC']);
        $stmtSet->execute(['org_desc', 'Balanced Scorecard Oficial 2025 · PHP 8.3 & SQLite Enterprise']);

        // 8. Log de inicio
        logActivity($pdo, 'SEED_DATABASE', 'SYSTEM', 'ALL', 'Base de datos inicializada con 12 objetivos, 36 KPIs y responsables oficiales del Excel TechPeru SAC 2025.', 'u1', 'Sistema');

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

