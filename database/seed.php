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

        // Mapeo detallado de Responsables, Áreas y Fórmulas para cada uno de los 36 KPIs (Botica MediZano)
        $metaDetails = [
            // FINANCIERA
            'KPI-01' => ['resp' => 'Lic. Igarlos Mamani', 'area' => 'Finanzas & Pagos', 'freq' => 'Trimestral', 'base' => 28.0, 'formula' => '((Ventas Medicamentos - Costo de Ventas) / Ventas Medicamentos) × 100'],
            'KPI-02' => ['resp' => 'Mg. Patricia Valdivia', 'area' => 'Control Financiero', 'freq' => 'Mensual', 'base' => 20.0, 'formula' => '(EBITDA Operativo de Botica / Ingresos Totales) × 100'],
            'KPI-03' => ['resp' => 'Lic. Igarlos Mamani', 'area' => 'Finanzas & Pagos', 'freq' => 'Trimestral', 'base' => 1.80, 'formula' => 'Ingresos Farmacia - Costos - Gastos Operativos - Impuestos'],
            'KPI-04' => ['resp' => 'Q.F. Kenyi Calsin', 'area' => 'Ventas & Dispensación', 'freq' => 'Trimestral', 'base' => 11.0, 'formula' => '((Ventas Año Actual - Ventas Año Anterior) / Ventas Año Anterior) × 100'],
            'KPI-05' => ['resp' => 'Q.F. Kenyi Calsin', 'area' => 'Ventas & Dispensación', 'freq' => 'Mensual', 'base' => 7.5, 'formula' => '∑ Total facturado en boletas y facturas emitidas por la botica'],
            'KPI-06' => ['resp' => 'Lic. Juan Chambilla', 'area' => 'Facturación & Mostrador', 'freq' => 'Mensual', 'base' => 36.0, 'formula' => 'Ventas Totales del Período / Número de Transacciones de Pacientes'],
            'KPI-07' => ['resp' => 'Q.F. Aldo Calla', 'area' => 'Farmacología & Control de Stock', 'freq' => 'Mensual', 'base' => 2.2, 'formula' => '(Valor de Medicamentos Descartados por Vencimiento / Costo de Ventas) × 100'],
            'KPI-08' => ['resp' => 'Lic. Igarlos Mamani', 'area' => 'Finanzas & Pagos', 'freq' => 'Mensual', 'base' => 18.0, 'formula' => '∑ Cuentas por Cobrar de Pagos Digitales / Ventas Diarias Digitales'],
            'KPI-09' => ['resp' => 'Mg. Patricia Valdivia', 'area' => 'Control Financiero', 'freq' => 'Trimestral', 'base' => 7.8, 'formula' => '(Utilidad Neta de Botica / Activos Totales en Inventario) × 100'],

            // CLIENTES Y PACIENTES
            'KPI-10' => ['resp' => 'Lic. Camila Paredes', 'area' => 'Atención al Paciente & Soporte', 'freq' => 'Trimestral', 'base' => 80.0, 'formula' => '(Pacientes Satisfechos con Atención Farmacéutica / Total Encuestados) × 100'],
            'KPI-11' => ['resp' => 'Lic. Camila Paredes', 'area' => 'Atención al Paciente & Soporte', 'freq' => 'Mensual', 'base' => 50.0, 'formula' => '% Pacientes Promotores - % Pacientes Detractores'],
            'KPI-12' => ['resp' => 'Lic. Juan Chambilla', 'area' => 'Facturación & Mostrador', 'freq' => 'Mensual', 'base' => 6.5, 'formula' => '∑ Minutos desde ingreso a cola hasta entrega de medicamentos / Total Pacientes'],
            'KPI-13' => ['resp' => 'Q.F. Kenyi Calsin', 'area' => 'Ventas & Dispensación', 'freq' => 'Trimestral', 'base' => 74.0, 'formula' => '(Pacientes Crónicos con Recompra Mensual / Total Pacientes Crónicos) × 100'],
            'KPI-14' => ['resp' => 'Lic. Camila Paredes', 'area' => 'Atención al Paciente & Soporte', 'freq' => 'Mensual', 'base' => 38.0, 'formula' => '(Pacientes con ≥ 2 Compras al Mes / Total Pacientes Atendidos) × 100'],
            'KPI-15' => ['resp' => 'Lic. Camila Paredes', 'area' => 'Atención al Paciente & Soporte', 'freq' => 'Mensual', 'base' => 9.5, 'formula' => '(Pacientes Inactivos > 90 días / Pacientes Activos al Inicio) × 100'],
            'KPI-16' => ['resp' => 'Q.F. Kenyi Calsin', 'area' => 'Ventas & Dispensación', 'freq' => 'Trimestral', 'base' => 89.0, 'formula' => '(Recetas con 100% de Medicamentos Dispensados / Total Recetas) × 100'],
            'KPI-17' => ['resp' => 'Lic. Camila Paredes', 'area' => 'Atención al Paciente & Soporte', 'freq' => 'Mensual', 'base' => 180.0, 'formula' => 'Conteo mensual de nuevos pacientes afiliados al sistema MediZano'],
            'KPI-18' => ['resp' => 'Lic. Andrea Gallardo', 'area' => 'Canales Digitales & Marketing', 'freq' => 'Mensual', 'base' => 10.0, 'formula' => '(Ventas por Web y Delivery / Ventas Totales de la Botica) × 100'],

            // PROCESOS INTERNOS FARMACÉUTICOS
            'KPI-19' => ['resp' => 'Q.F. Kenyi Calsin', 'area' => 'Dirección Técnica Farmacéutica', 'freq' => 'Mensual', 'base' => 92.0, 'formula' => '(Ítems de BPD Conformes en Auditoría Sanitaria / Total Ítems) × 100'],
            'KPI-20' => ['resp' => 'Q.F. Aldo Calla', 'area' => 'Farmacología & Control de Stock', 'freq' => 'Mensual', 'base' => 0.5, 'formula' => '(Incidentes de Medicamento Incorrecto o Dosis Equivocada / Total Dispensaciones) × 100'],
            'KPI-21' => ['resp' => 'Lic. Juan Chambilla', 'area' => 'Facturación & Mostrador', 'freq' => 'Mensual', 'base' => 14.0, 'formula' => '∑ Segundos de Procesamiento de Boleta/Factura Electrónica / Total Comprobantes'],
            'KPI-22' => ['resp' => 'Q.F. Aldo Calla', 'area' => 'Farmacología & Control de Stock', 'freq' => 'Mensual', 'base' => 92.0, 'formula' => '(Lotes Despachados con Vencimiento Más Próximo / Total Lotes Despachados) × 100'],
            'KPI-23' => ['resp' => 'Q.F. Aldo Calla', 'area' => 'Farmacología & Control de Stock', 'freq' => 'Mensual', 'base' => 94.0, 'formula' => '(Unidades Farmacéuticas Cuadradas sin Discrepancia / Total Unidades) × 100'],
            'KPI-24' => ['resp' => 'Q.F. Aldo Calla', 'area' => 'Farmacología & Control de Stock', 'freq' => 'Mensual', 'base' => 65.0, 'formula' => '(Lotes con < 90 días Liquidados o Canjeados / Total Lotes Próximos a Caducar) × 100'],
            'KPI-25' => ['resp' => 'Lic. Juan Chambilla', 'area' => 'Cadena de Suministro & Proveedores', 'freq' => 'Mensual', 'base' => 90.0, 'formula' => '(Medicamentos Esenciales con Stock Disponible / Total Lista Esencial) × 100'],
            'KPI-26' => ['resp' => 'Lic. Juan Chambilla', 'area' => 'Cadena de Suministro & Proveedores', 'freq' => 'Mensual', 'base' => 80.0, 'formula' => '(Órdenes de Compra Recibidas a Tiempo y Completas / Total Órdenes) × 100'],
            'KPI-27' => ['resp' => 'Lic. Juan Chambilla', 'area' => 'Cadena de Suministro & Proveedores', 'freq' => 'Mensual', 'base' => 38.0, 'formula' => '∑ Horas desde alerta de stock mínimo hasta ingreso físico a almacén / Total Alertas'],

            // APRENDIZAJE Y CRECIMIENTO
            'KPI-28' => ['resp' => 'Dra. Elena Ramos', 'area' => 'Gestión de Talento & Capacitación', 'freq' => 'Trimestral', 'base' => 25.0, 'formula' => 'Total Horas Efectivas de Formación Farmacéutica / Número de Personal'],
            'KPI-29' => ['resp' => 'Dra. Elena Ramos', 'area' => 'Gestión de Talento & Capacitación', 'freq' => 'Semestral', 'base' => 75.0, 'formula' => '(Colaboradores Certificados en Farmacovigilancia / Total Colaboradores) × 100'],
            'KPI-30' => ['resp' => 'Lic. Víctor Hugo Quispe', 'area' => 'Capacitación Técnica & Salud', 'freq' => 'Trimestral', 'base' => 70.0, 'formula' => '(Competencias Técnicas Aprobadas / Total Competencias Evaluadas) × 100'],
            'KPI-31' => ['resp' => 'Lic. Melissa Barreto', 'area' => 'Cultura & Bienestar Organizacional', 'freq' => 'Semestral', 'base' => 72.0, 'formula' => 'Puntaje Promedio General Encuesta de Clima Laboral y Salud Ocupacional (%)'],
            'KPI-32' => ['resp' => 'Dra. Elena Ramos', 'area' => 'Gestión de Talento & Capacitación', 'freq' => 'Mensual', 'base' => 14.0, 'formula' => '(Renuncias Involuntarias de Químicos y Técnicos / Plantilla Promedio) × 100'],
            'KPI-33' => ['resp' => 'Lic. Melissa Barreto', 'area' => 'Cultura & Bienestar Organizacional', 'freq' => 'Anual', 'base' => 85.0, 'formula' => '(Evaluaciones de Desempeño Efectuadas / Total Personal Programado) × 100'],
            'KPI-34' => ['resp' => 'Lic. Igarlos Mamani', 'area' => 'Innovación Tecnológica & Sistemas', 'freq' => 'Trimestral', 'base' => 70.0, 'formula' => '(Transacciones Realizadas en MediZano POS / Total Transacciones) × 100'],
            'KPI-35' => ['resp' => 'Lic. Igarlos Mamani', 'area' => 'Innovación Tecnológica & Sistemas', 'freq' => 'Trimestral', 'base' => 97.0, 'formula' => '(Minutos Operativos sin Interrupción de Sistema / Minutos Programados) × 100'],
            'KPI-36' => ['resp' => 'Lic. Víctor Hugo Quispe', 'area' => 'Innovación y Calidad', 'freq' => 'Trimestral', 'base' => 6.0, 'formula' => 'Conteo anual de propuestas del personal implementadas para optimizar la atención']
        ];

        $stmtObj = $pdo->prepare("INSERT INTO objectives (id, perspective_id, name, full_name, description, priority, weight, status, leader) VALUES (?, ?, ?, ?, ?, ?, ?, 'Activo', ?)");
        foreach ($data['objectives'] as $obj) {
            $leaderMap = [
                'OBJ-F1' => 'Lic. Igarlos Mamani (Finanzas & Pagos)',
                'OBJ-F2' => 'Q.F. Kenyi Calsin (Ventas & Dispensación)',
                'OBJ-F3' => 'Q.F. Aldo Calla (Farmacología & Stock)',
                'OBJ-C1' => 'Lic. Camila Paredes (Atención al Paciente)',
                'OBJ-C2' => 'Q.F. Kenyi Calsin (Pacientes Crónicos)',
                'OBJ-C3' => 'Lic. Juan Chambilla (Facturación & Acceso)',
                'OBJ-P1' => 'Q.F. Kenyi Calsin (Dirección Técnica)',
                'OBJ-P2' => 'Q.F. Aldo Calla (Control FEFO & Almacén)',
                'OBJ-P3' => 'Lic. Juan Chambilla (Proveedores & Laboratorios)',
                'OBJ-A1' => 'Dra. Elena Ramos (Talento & Capacitación)',
                'OBJ-A2' => 'Lic. Melissa Barreto (Bienestar & Clima)',
                'OBJ-A3' => 'Lic. Igarlos Mamani (Sistemas & MediZano POS)'
            ];
            $leader = $leaderMap[$obj['id']] ?? 'Dirección Técnica MediZano';

            $stmtObj->execute([
                $obj['id'],
                $obj['perspective'],
                $obj['name'],
                $obj['fullName'],
                "Objetivo estratégico oficial de Botica MediZano: {$obj['fullName']}",
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

        // 6. 12 Iniciativas estratégicas oficiales (Botica MediZano)
        $stmtInit = $pdo->prepare("INSERT INTO initiatives (id, objective_id, kpi_id, name, leader, budget, start_date, end_date, progress_pct, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $initiatives = [
            ['INI-01', 'OBJ-F1', 'KPI-02', 'Plan de optimización de márgenes y convenios con laboratorios farmacéuticos', 'Lic. Igarlos Mamani', 150000, '2025-01-15', '2025-11-30', 82, 'En ejecución'],
            ['INI-02', 'OBJ-F2', 'KPI-04', 'Campaña de venta asistida y dispensación de bioequivalentes de calidad', 'Q.F. Kenyi Calsin', 110000, '2025-02-01', '2025-12-15', 70, 'En ejecución'],
            ['INI-03', 'OBJ-F3', 'KPI-07', 'Protocolo estricto de rotación FEFO para reducir mermas por caducidad en mostrador', 'Q.F. Aldo Calla', 95000, '2025-01-10', '2025-10-31', 88, 'En ejecución'],
            ['INI-04', 'OBJ-C1', 'KPI-12', 'Implementación de caja rápida y checkout digital para reducir colas en mostrador', 'Lic. Juan Chambilla', 80000, '2025-02-15', '2025-09-30', 85, 'En ejecución'],
            ['INI-05', 'OBJ-C2', 'KPI-13', 'Programa de adherencia y entrega programada para pacientes con medicación crónica', 'Q.F. Kenyi Calsin', 130000, '2025-01-20', '2025-11-15', 79, 'En ejecución'],
            ['INI-06', 'OBJ-C3', 'KPI-18', 'Despliegue del canal de delivery farmacéutico con trazabilidad de despacho', 'Lic. Camila Paredes', 140000, '2025-03-15', '2025-12-20', 65, 'En ejecución'],
            ['INI-07', 'OBJ-P1', 'KPI-19', 'Auditoría interna y certificación en Buenas Prácticas de Dispensación (BPD Digemid)', 'Q.F. Kenyi Calsin', 105000, '2025-02-01', '2025-10-30', 92, 'En ejecución'],
            ['INI-08', 'OBJ-P1', 'KPI-20', 'Protocolo de doble chequeo de dosis y fármaco antes de entrega al paciente', 'Q.F. Aldo Calla', 75000, '2025-01-25', '2025-11-30', 74, 'En ejecución'],
            ['INI-09', 'OBJ-P3', 'KPI-26', 'Integración de órdenes de compra automáticas con droguerías y laboratorios aliados', 'Lic. Juan Chambilla', 85000, '2025-04-01', '2025-10-15', 86, 'En ejecución'],
            ['INI-10', 'OBJ-A1', 'KPI-28', 'Programa continuo de formación en farmacovigilancia e interacciones terapéuticas', 'Dra. Elena Ramos', 95000, '2025-02-01', '2025-11-15', 78, 'En ejecución'],
            ['INI-11', 'OBJ-A2', 'KPI-32', 'Plan de bienestar laboral e incentivos por cumplimiento de metas en botica', 'Lic. Melissa Barreto', 100000, '2025-03-01', '2025-12-10', 68, 'En ejecución'],
            ['INI-12', 'OBJ-A3', 'KPI-34', 'Adopción total y estabilización del ecosistema distribuido MediZano POS', 'Lic. Igarlos Mamani', 120000, '2025-02-15', '2025-09-30', 90, 'En ejecución']
        ];
        foreach ($initiatives as $init) {
            $stmtInit->execute($init);
        }

        // 7. Configuraciones
        $stmtSet = $pdo->prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
        $stmtSet->execute(['period', '2025']);
        $stmtSet->execute(['org_name', 'Botica MediZano']);
        $stmtSet->execute(['org_desc', 'Balanced Scorecard Farmacéutico · PHP 8.3 & SQLite Enterprise']);

        $pdo->exec("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
        $pdo->exec("INSERT OR REPLACE INTO system_settings (key, value) VALUES 
            ('company_name', 'Botica MediZano'),
            ('bsc_title', 'Balanced Scorecard 2025-2026'),
            ('strategic_period', 'Plan Estratégico Farmacéutico · 2025'),
            ('mission', 'Garantizar a la comunidad el acceso oportuno, seguro y accesible a medicamentos y productos de salud de alta calidad, brindando una atención farmacéutica profesional, ética y personalizada, respaldada por tecnología de vanguardia y rigurosa trazabilidad sanitaria.'),
            ('vision', 'Consolidarnos al 2026 como la botica y plataforma farmacéutica líder en dispensación digital, control estricto de calidad FEFO y excelencia en el cuidado de la salud en el Perú.')");

        // 8. Log de inicio
        logActivity($pdo, 'SEED_DATABASE', 'SYSTEM', 'ALL', 'Base de datos inicializada con 12 objetivos, 36 KPIs y responsables de Botica MediZano.', 'u1', 'Sistema');

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

