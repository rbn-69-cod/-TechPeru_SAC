/**
 * TECHPERU SAC — BALANCED SCORECARD 2025
 * Frontend conectado a Backend PHP 8.3 & SQLite
 * Soporte completo para Responsables por KPI, Auditoría y Transacciones
 */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  let currentUser = null;
  let csrfToken = "";
  let modalReturnFocus = null;
  let currentPage = "dashboard";
  let dashboardViewMode = "excel"; // 'excel', 'cuadrantes', 'graficos'
  let activeExcelFilter = null;
  let activeRespFilter = null;
  let charts = {};
  let measurementOffset = 0;
  let rendering = false;
  let renderQueued = false;
  let currentDashboardData = null;

  const perspectives = {
    financiera: { label: "Financiera", title: "💰 PERSPECTIVA FINANCIERA", color: "#1f3864", soft: "#edf4ff", icon: "💰" },
    clientes: { label: "Clientes", title: "👥 PERSPECTIVA DE CLIENTES", color: "#1e4d2b", soft: "#eaf8f1", icon: "👥" },
    procesos: { label: "Procesos internos", title: "🔧 PERSPECTIVA DE PROCESOS INTERNOS", color: "#9a4b08", soft: "#fff5e6", icon: "🔧" },
    aprendizaje: { label: "Aprendizaje y crecimiento", title: "📚 PERSPECTIVA DE APRENDIZAJE Y CRECIMIENTO", color: "#4a2373", soft: "#f2edff", icon: "📚" }
  };

  const pageTitles = {
    dashboard: "Dashboard ejecutivo",
    mapa: "Mapa estratégico",
    objetivos: "Objetivos estratégicos",
    kpis: "Indicadores (KPI)",
    mediciones: "Registro de resultados",
    iniciativas: "Iniciativas estratégicas",
    reportes: "Reportes",
    administracion: "Administración"
  };

  // ========================================================
  // HELPERS Y COMUNICACIÓN CON PHP BACKEND
  // ========================================================
  async function apiFetch(endpoint, options = {}) {
    try {
      options.headers = options.headers || {};
      if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
      }
      if (options.method && options.method !== 'GET') options.headers['X-CSRF-Token'] = csrfToken;
      const res = await fetch(endpoint, {credentials: 'same-origin', ...options});
      if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('El servidor no está disponible. Ejecuta la aplicación con PHP.');
      const json = await res.json();
      if (json.csrf_token) csrfToken = json.csrf_token;
      if (res.status === 401 && !endpoint.includes('action=login')) { currentUser = null; showLogin(); }
      if (!res.ok) {
        throw new Error(json.error || `Error ${res.status}: ${res.statusText}`);
      }
      return json;
    } catch (e) {
      console.error(`API Error [${endpoint}]:`, e);
      toast(e.message, "error");
      throw e;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmt(n, d = 1) {
    return n === null || n === undefined || isNaN(n) ? "—" : Number(n).toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  }

  function currency(n) {
    return "S/ " + Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 });
  }

  function toast(msg, type = "success") {
    const region = $("#toastRegion");
    if (!region) return;
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = msg;
    region.append(t);
    setTimeout(() => t.remove(), 3500);
  }

  function pageHead(title, subtitle, actionsHtml = "") {
    return `
    <div class="page-head">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div class="head-actions">${actionsHtml}</div>
    </div>`;
  }

  function getInitials(name) {
    return (name || "RP").split(" ").filter(Boolean).map(x => x[0]).slice(0, 2).join("").toUpperCase();
  }

  function renderRespChip(name, area) {
    const ini = getInitials(name);
    return `
      <div class="resp-chip" title="Área: ${escapeHtml(area || '')}">
        <span class="resp-avatar">${escapeHtml(ini)}</span>
        <span>${escapeHtml(name)}</span>
      </div>
    `;
  }

  // ========================================================
  // AUTENTICACIÓN CON PHP
  // ========================================================
  async function login(email, password) {
    try {
      const data = await apiFetch("api/auth.php?action=login", {
        method: "POST",
        body: { email, password }
      });
      if (data.success && data.user) {
        currentUser = data.user;
        showApp();
        toast(`Bienvenido, ${currentUser.name}`);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  async function logout() {
    try {
      await apiFetch("api/auth.php?action=logout", { method: "POST" });
    } catch (e) { return; }
    currentUser = null;
    showLogin();
    toast("Sesión cerrada.");
  }

  async function checkAuth() {
    try {
      const data = await apiFetch("api/auth.php?action=me");
      if (data.success && data.user) {
        currentUser = data.user;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function showApp() {
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    if (currentUser) {
      $("#sideUserName").textContent = currentUser.name;
      $("#topUserName").textContent = currentUser.name;
      $("#sideUserRole").textContent = currentUser.role;
      $("#topUserRole").textContent = currentUser.role;
      const initials = getInitials(currentUser.name);
      $("#sideUserAvatar").textContent = initials;
      $("#topUserAvatar").textContent = initials;
    }
    $("[data-page='administracion']").classList.toggle('hidden', currentUser?.role !== 'Administrador');
    if (currentPage === 'administracion' && currentUser?.role !== 'Administrador') currentPage = 'dashboard';
    navigate(currentPage);
  }

  function showLogin() {
    $("#appView").classList.add("hidden");
    $("#loginView").classList.remove("hidden");
  }

  function navigate(page) {
    if (!pageTitles[page]) page = 'dashboard';
    if (page === 'administracion' && currentUser?.role !== 'Administrador') page = 'dashboard';
    currentPage = page;
    $("#sidebar").classList.remove('open');
    $("#menuToggle").setAttribute('aria-expanded', 'false');
    $$('.nav-item').forEach(b => b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'));
    window.location.hash = page;
    $("#breadcrumbPage").textContent = pageTitles[page] || "Dashboard ejecutivo";
    $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    renderCurrentPage();
  }

  // ========================================================
  // RENDERIZADO DE PÁGINAS PRINCIPALES
  // ========================================================
  async function renderCurrentPage() {
    if (rendering) { renderQueued = true; return; }
    rendering = true;
    destroyCharts();
    const main = $("#pageContent");
    main.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b">Cargando datos ...</div>`;

    main.setAttribute("aria-busy", "true");
    try {
    switch (currentPage) {
      case "dashboard": await renderDashboard(main); break;
      case "mapa": await renderMap(main); break;
      case "objetivos": await renderObjectives(main); break;
      case "kpis": await renderKpis(main); break;
      case "mediciones": await renderMeasurements(main); break;
      case "iniciativas": await renderInitiatives(main); break;
      case "reportes": await renderReports(main); break;
      case "administracion": await renderAdmin(main); break;
      default: await renderDashboard(main); break;
    }
    enhanceContent(main);
    } catch (error) {
      main.innerHTML = `<section class="empty-state" role="alert"><h2>No pudimos cargar esta vista</h2><p>${escapeHtml(error.message)}</p><button class="btn primary" id="retryView">Reintentar</button></section>`;
      $('#retryView').onclick = renderCurrentPage;
    } finally {
      main.setAttribute('aria-busy', 'false');
      rendering = false;
      if (renderQueued) { renderQueued = false; renderCurrentPage(); }
    }
  }

  // 1. DASHBOARD EJECUTIVO
  async function renderDashboard(container) {
    const url = activeRespFilter ? `api/dashboard.php?responsible=${encodeURIComponent(activeRespFilter)}` : "api/dashboard.php";
    const res = await apiFetch(url);
    currentDashboardData = res;
    const g = res.global;

    let contentHtml = "";
    if (dashboardViewMode === "excel") {
      contentHtml = renderExcelTable(res.all_kpis, activeExcelFilter);
    } else if (dashboardViewMode === "cuadrantes") {
      contentHtml = renderQuadrants(res.perspectives);
    } else {
      contentHtml = renderChartsBlock(res.perspectives);
    }

    container.innerHTML = `
      ${pageHead("BALANCED SCORECARD — TechPeru SAC | 2025", `4 perspectivas · ${res.objectives.length} objetivos · ${g.total} indicadores`, `
        <button class="btn" id="btnExportDashCSV">📥 Exportar CSV Oficial</button>
        <button class="btn primary" id="btnNewMeasurement">＋ Registrar resultado</button>
      `)}

      <!-- 4 TARJETAS KPI EJECUTIVAS -->
      <section class="grid metric-grid">
        <div class="metric-card">
          <div class="metric-top"><span>CUMPLIMIENTO GLOBAL</span><span class="metric-icon">◎</span></div>
          <div class="metric-value" style="color:${g.avg_pct >= 90 ? '#16845b' : g.avg_pct >= 75 ? '#b97708' : '#c23a42'}">
            ${fmt(g.avg_pct)}%
          </div>
          <div class="metric-foot">
            <span class="status ${g.status_key}">${g.status_text}</span>
            <span>${g.total} KPIs evaluados</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top"><span>OBJETIVOS ESTRATÉGICOS</span><span class="metric-icon">⌘</span></div>
          <div class="metric-value">${res.objectives.length}</div>
          <div class="metric-foot"><span class="trend-up">Seguimiento estratégico</span><span>4 perspectivas</span></div>
        </div>

        <div class="metric-card">
          <div class="metric-top"><span>ESTADO DE LOS KPIS</span><span class="metric-icon">▥</span></div>
          <div class="metric-value">${g.total}</div>
          <div class="metric-foot">
            <span class="status good">${g.logrado} Logrado</span>
            <span class="status warn">${g.riesgo} Riesgo</span>
            <span class="status bad">${g.critico} Crítico</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top"><span>RESPONSABLES ASIGNADOS</span><span class="metric-icon">👤</span></div>
          <div class="metric-value">${res.responsibles.length}</div>
          <div class="metric-foot"><span class="trend-up">● Líderes de Área</span><span>Asignación por indicador</span></div>
        </div>
      </section>

      <!-- BARRA DE FILTRO POR RESPONSABLE Y ESTADO -->
      <div style="background:#fff;padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div class="dashboard-responsible-filter" style="display:flex;align-items:center;gap:10px">
          <strong>👤 Filtrar por Responsable:</strong>
          <select id="dashFilterResp" style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;min-width:240px">
            <option value="">-- Todos los Responsables (${res.responsibles.length}) --</option>
            ${res.responsibles.map(r => `<option value="${escapeHtml(r.responsible)}" ${activeRespFilter === r.responsible ? 'selected' : ''}>${escapeHtml(r.responsible)} (${escapeHtml(r.responsible_area)})</option>`).join("")}
          </select>
          ${activeRespFilter ? `<button class="btn small soft" id="btnClearRespFilter">✕ Limpiar filtro</button>` : ""}
        </div>
        <div style="font-size:11px;color:#64748b">
          Mostrando <strong>${g.total}</strong> KPIs
        </div>
      </div>

      <!-- BANNER DE RESUMEN EJECUTIVO -->
      <section class="health-summary-banner">
        <div class="health-title">
          <div class="health-badge ${g.status_key}">
            ⚠️ Cumplimiento Promedio: ${fmt(g.avg_pct)}% — ${g.status_text}
          </div>
          <span style="font-size:11px;color:#64748b">(Datos actualizados)</span>
        </div>
        <div class="health-stats">
          <span class="pill-stat good">✅ LOGRADO: ${g.logrado} KPIs</span>
          <span class="pill-stat warn">⚠️ EN RIESGO: ${g.riesgo} KPIs</span>
          <span class="pill-stat bad">❌ CRÍTICO: ${g.critico} KPIs</span>
          <div class="view-tabs" style="margin-left:12px">
            <button class="view-tab ${dashboardViewMode === 'excel' ? 'active' : ''}" data-view="excel">📊 Tabla Excel</button>
            <button class="view-tab ${dashboardViewMode === 'cuadrantes' ? 'active' : ''}" data-view="cuadrantes">▦ Cuadrantes BSC</button>
            <button class="view-tab ${dashboardViewMode === 'graficos' ? 'active' : ''}" data-view="graficos">📈 Gráficos</button>
          </div>
        </div>
      </section>

      <!-- CONTENIDO PRINCIPAL SEGÚN MODO SELECCIONADO -->
      <section id="dashboardMainArea">${contentHtml}</section>

      <!-- TABLA DE KPIS QUE REQUIEREN ATENCIÓN -->
      <section class="panel" style="margin-top:20px">
        <div class="panel-head">
          <div>
            <h3>⚠️ Indicadores Críticos que Requieren Atención Inmediata (${res.critical_kpis.length})</h3>
            <p>KPIs con cumplimiento menor al 75%, sus líderes responsables y acciones recomendadas</p>
          </div>
          <button class="btn small primary" data-action="go-mediciones">＋ Registrar medición</button>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>KPI</th>
                <th>Responsable</th>
                <th>Área</th>
                <th>Meta</th>
                <th>Real Actual</th>
                <th>% Cumpl.</th>
                <th>Acción Correctiva Recomendada</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${res.critical_kpis.map(k => `
                <tr>
                  <td><strong>${escapeHtml(k.name)}</strong></td>
                  <td>${renderRespChip(k.responsible, k.responsible_area)}</td>
                  <td><span class="tag">${escapeHtml(k.responsible_area)}</span></td>
                  <td>${fmt(k.target)} <small class="muted">${escapeHtml(k.unit)}</small></td>
                  <td><strong style="color:#002060">${fmt(k.current_real)}</strong></td>
                  <td><span class="status bad">❌ ${fmt(k.compliance_pct)}%</span></td>
                  <td style="max-width:300px;white-space:normal;font-size:11px">${escapeHtml(k.action_recommended)}</td>
                  <td><button class="btn small soft" data-action="quick-measure" data-id="${escapeHtml(k.id)}">Medir</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;

    bindDashboardEvents();
    if (dashboardViewMode === "graficos") {
      drawPerspectiveChart(res.perspectives);
      drawTrendChart(res.trend);
    }
  }

  function renderExcelTable(allKpis, filter) {
    const list = filter ? allKpis.filter(k => k.perspective_id === filter) : allKpis;
    const persps = [
      { key: "financiera", label: "💰 PERSPECTIVA FINANCIERA", cellClass: "excel-persp-fin" },
      { key: "clientes", label: "👥 PERSPECTIVA DE CLIENTES", cellClass: "excel-persp-cli" },
      { key: "procesos", label: "🔧 PERSPECTIVA DE PROCESOS INTERNOS", cellClass: "excel-persp-proc" },
      { key: "aprendizaje", label: "📚 PERSPECTIVA DE APRENDIZAJE Y CRECIMIENTO", cellClass: "excel-persp-apr" }
    ].filter(p => !filter || p.key === filter);

    let rowsHtml = "";
    persps.forEach(p => {
      const pKpis = list.filter(k => k.perspective_id === p.key);
      if (!pKpis.length) return;

      pKpis.forEach((kpi, kIdx) => {
        const isFirstInPersp = kIdx === 0;
        const objKpis = pKpis.filter(x => x.objective_id === kpi.objective_id);
        const isFirstInObj = objKpis[0].id === kpi.id;
        const statusClass = (kpi.compliance_pct >= 90) ? "good" : (kpi.compliance_pct >= 75) ? "warn" : "bad";

        rowsHtml += `
          <tr>
            ${isFirstInPersp ? `<td class="${p.cellClass}" rowspan="${pKpis.length}"><b>${p.label}</b></td>` : ""}
            ${isFirstInObj ? `<td class="excel-obj-cell" rowspan="${objKpis.length}"><b>${escapeHtml(kpi.objective_full_name)}</b></td>` : ""}
            <td>
              <strong>${escapeHtml(kpi.name)}</strong>
              <div style="margin-top:4px">${renderRespChip(kpi.responsible, kpi.responsible_area)}</div>
            </td>
            <td style="text-align:center">${escapeHtml(kpi.unit)}</td>
            <td class="excel-bold-num">${fmt(kpi.target)}</td>
            <td class="excel-blue-num" data-action="quick-measure" data-id="${escapeHtml(kpi.id)}" title="Clic para registrar nuevo valor real">
              ${fmt(kpi.current_real)}
            </td>
            <td class="excel-bold-num">${fmt(kpi.compliance_pct)}%</td>
            <td class="excel-status ${statusClass}"><b>${escapeHtml(kpi.status)}</b></td>
            <td style="font-size:10.5px;max-width:300px;white-space:normal">${escapeHtml(kpi.action_recommended)}</td>
          </tr>
        `;
      });
    });

    return `
    <div class="excel-container">
      <div class="excel-title-banner">
        BALANCED SCORECARD — TechPeru SAC 2025 · ${list.length} indicadores
      </div>
      <div style="background:#f8fafc;padding:8px 14px;border-bottom:1px solid #d9e1f2;font-size:11px;color:#64748b;display:flex;justify-content:space-between">
        <span>💡 <strong>Valores en AZUL:</strong> Haz clic en cualquier valor real para registrar una nueva medición en la base de datos SQLite.</span>
        <span>Regla: ✅ ≥90% | ⚠️ 75-89% | ❌ &lt;75%</span>
      </div>
      <div class="table-scroll">
        <table class="excel-table">
          <thead>
            <tr>
              <th class="excel-th" style="width:160px">PERSPECTIVA</th>
              <th class="excel-th" style="width:200px">OBJETIVO ESTRATÉGICO</th>
              <th class="excel-th">INDICADOR (KPI) Y RESPONSABLE</th>
              <th class="excel-th" style="width:65px">UNIDAD</th>
              <th class="excel-th" style="width:75px">META</th>
              <th class="excel-th" style="width:75px">REAL</th>
              <th class="excel-th" style="width:75px">% CUMPL.</th>
              <th class="excel-th" style="width:115px">ESTADO</th>
              <th class="excel-th" style="width:280px">ANÁLISIS / ACCIÓN RECOMENDADA</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="excel-sheet-tabs">
        <button class="excel-sheet-tab ${!filter ? 'active' : ''}" data-sheet-filter="">📊 BSC Completo</button>
        <button class="excel-sheet-tab ${filter === 'financiera' ? 'active' : ''}" data-sheet-filter="financiera">💰 Financiera</button>
        <button class="excel-sheet-tab ${filter === 'clientes' ? 'active' : ''}" data-sheet-filter="clientes">👥 Clientes</button>
        <button class="excel-sheet-tab ${filter === 'procesos' ? 'active' : ''}" data-sheet-filter="procesos">🔧 Procesos</button>
        <button class="excel-sheet-tab ${filter === 'aprendizaje' ? 'active' : ''}" data-sheet-filter="aprendizaje">📚 Aprendizaje</button>
      </div>
    </div>
    `;
  }

  function renderQuadrants(perspectives) {
    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
      ${perspectives.map(p => `
        <div class="panel" style="padding:0;overflow:hidden">
          <div style="background:${p.soft_color};color:${p.color};padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0">
            <strong>${escapeHtml(p.title)}</strong>
            <span class="tag" style="background:#fff;color:${p.color};font-weight:800">${fmt(p.avg_pct)}% (${p.count} KPIs)</span>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Responsable</th>
                  <th>Meta</th>
                  <th>Real</th>
                  <th>% Cumpl.</th>
                </tr>
              </thead>
              <tbody>
                ${p.kpis.map(k => {
                  const sClass = (k.compliance_pct >= 90) ? "good" : (k.compliance_pct >= 75) ? "warn" : "bad";
                  return `
                  <tr>
                    <td><strong>${escapeHtml(k.name)}</strong></td>
                    <td>${renderRespChip(k.responsible, k.responsible_area)}</td>
                    <td>${fmt(k.target)} <small class="muted">${escapeHtml(k.unit)}</small></td>
                    <td><strong style="color:#002060">${fmt(k.current_real)}</strong></td>
                    <td><span class="status ${sClass}">${fmt(k.compliance_pct)}%</span></td>
                  </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `).join("")}
    </div>
    `;
  }

  function renderChartsBlock(perspectives) {
    return `
    <div class="grid dashboard-grid">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Cumplimiento por Perspectiva del BSC</h2>
            <p>Promedio de cumplimiento por perspectiva</p>
          </div>
        </div>
        <div class="chart-wrap"><canvas id="perspChart"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Tendencia Histórica de Cumplimiento</h2>
            <p>Evolución de mediciones registradas en el período</p>
          </div>
        </div>
        <div class="chart-wrap"><canvas id="trendChart"></canvas></div>
      </div>
    </div>
    `;
  }

  function drawPerspectiveChart(perspectives) {
    const ctx = $("#perspChart");
    if (!ctx || !window.Chart) return;
    charts.persp = new Chart(ctx, {
      type: "bar",
      data: {
        labels: perspectives.map(p => p.name),
        datasets: [{
          label: "% Cumplimiento",
          data: perspectives.map(p => p.avg_pct),
          backgroundColor: ["#1f3864", "#1e4d2b", "#9a4b08", "#4a2373"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 120 } }
      }
    });
  }

  function drawTrendChart(trend) {
    const ctx = $("#trendChart");
    if (!ctx || !window.Chart || !trend || !trend.length) return;
    charts.trend = new Chart(ctx, {
      type: "line",
      data: {
        labels: trend.map(t => t.period),
        datasets: [{
          label: "Cumplimiento Promedio (%)",
          data: trend.map(t => t.avg_pct),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.1)",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 50, max: 110 } }
      }
    });
  }

  function bindDashboardEvents() {
    $("#btnExportDashCSV")?.addEventListener("click", () => {
      window.location.href = "api/reports.php?action=export_csv";
    });
    $("#btnNewMeasurement")?.addEventListener("click", () => openMeasurementModal());

    $("#dashFilterResp")?.addEventListener("change", e => {
      activeRespFilter = e.target.value || null;
      renderDashboard($("#pageContent"));
    });

    $("#btnClearRespFilter")?.addEventListener("click", () => {
      activeRespFilter = null;
      renderDashboard($("#pageContent"));
    });

    $$("[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        dashboardViewMode = btn.dataset.view;
        renderCurrentPage();
      });
    });

    $$("[data-sheet-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeExcelFilter = btn.dataset.sheetFilter || null;
        const mainArea = $("#dashboardMainArea");
        if (mainArea && currentDashboardData) {
          mainArea.innerHTML = renderExcelTable(currentDashboardData.all_kpis, activeExcelFilter);
          bindDashboardEvents();
        }
      });
    });

    $$("[data-action='quick-measure']").forEach(btn => {
      btn.addEventListener("click", () => openMeasurementModal(btn.dataset.id));
    });
    $$("[data-action='go-mediciones']").forEach(btn => {
      btn.addEventListener("click", () => navigate("mediciones"));
    });
  }

  // 2. MAPA ESTRATÉGICO
  async function renderMap(container) {
    const res = await apiFetch("api/dashboard.php");
    const flowDescriptions = [
      "▲ Genera valor financiero, rentabilidad sobre patrimonio y optimización de costos ▲",
      "▲ Conduce a la lealtad, satisfacción post-venta y retención de clientes ▲",
      "▲ Es impulsado por la excelencia operativa, calidad, OTD de proveedores e innovación ▲",
      "● Base y cimientos: Capital humano, cultura organizacional, I+D e ideas implementadas ●"
    ];

    const order = ["financiera", "clientes", "procesos", "aprendizaje"];

    const lanesHtml = order.map((key, idx) => {
      const p = perspectives[key];
      const pObjs = res.objectives.filter(o => o.perspective_id === key);
      const flow = idx < 3 ? `<div class="map-flow-indicator"><span></span>${flowDescriptions[idx]}<span></span></div>` : "";

      return `
      <div class="map-lane">
        <div class="map-lane-label" style="background:${p.soft};color:${p.color}">
          <div style="font-size:20px;margin-bottom:6px">${p.icon}</div>
          <b>${p.label.toUpperCase()}</b>
        </div>
        <div class="map-lane-items">
          ${pObjs.map(o => {
            const col = o.avg_pct >= 90 ? "#16845b" : o.avg_pct >= 75 ? "#d99a19" : "#d23f49";
            return `
            <button class="map-objective" data-action="obj-detail" data-id="${escapeHtml(o.id)}">
              <span class="mini-status" style="background:${col}"></span>
              <span class="code" style="font-size:10px">${escapeHtml(o.id)}</span>
              <div style="margin:4px 0 6px;font-size:12px;font-weight:700">${escapeHtml(o.name)}</div>
              <small>${o.kpi_count} KPIs · ${fmt(o.avg_pct)}% cumplimiento</small>
              <div style="margin-top:6px;font-size:9.5px;color:#475569">👤 ${escapeHtml(o.leader || 'Dirección')}</div>
            </button>`;
          }).join("")}
        </div>
      </div>
      ${flow}
      `;
    }).join("");

    container.innerHTML = `
      ${pageHead("Mapa Estratégico — TechPeru SAC 2025", "Relaciones de causa y efecto a través de las 4 perspectivas del Balanced Scorecard.", `
        <button class="btn" id="btnExportMapCSV">📥 Exportar CSV</button>
        <button class="btn primary" id="btnNewObj">＋ Nuevo objetivo</button>
      `)}
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Mapa Estratégico Corporativo</h2>
            <p>Consulta los indicadores, responsables y acciones de cada objetivo</p>
          </div>
          <span class="tag">TechPeru SAC · Gestión estratégica</span>
        </div>
        <div class="strategy-map">${lanesHtml}</div>
        <div class="map-legend" style="margin-top:18px">
          <span class="legend-item"><i class="legend-dot" style="background:#16845b"></i>✅ Logrado (≥ 90%)</span>
          <span class="legend-item"><i class="legend-dot" style="background:#d99a19"></i>⚠️ En riesgo (75% - 89.9%)</span>
          <span class="legend-item"><i class="legend-dot" style="background:#d23f49"></i>❌ Crítico (&lt; 75%)</span>
        </div>
      </section>
    `;

    $("#btnExportMapCSV")?.addEventListener("click", () => window.location.href = "api/reports.php?action=export_csv");
    $("#btnNewObj")?.addEventListener("click", () => openObjectiveForm());
    $$("[data-action='obj-detail']").forEach(btn => {
      btn.addEventListener("click", () => showObjectiveDetail(btn.dataset.id));
    });
  }

  // 3. OBJETIVOS ESTRATÉGICOS
  async function renderObjectives(container) {
    const res = await apiFetch("api/objectives.php");
    container.innerHTML = `
      ${pageHead("Gestión de Objetivos Estratégicos", "Definición, líderes responsables y seguimiento de metas estratégicas.", `
        <button class="btn primary" id="btnCreateObj">＋ Nuevo objetivo</button>
      `)}
      <div class="toolbar">
        <div class="search-box"><input id="objSearch" placeholder="Buscar objetivo por código o nombre..."></div>
        <select id="objFilterPersp">
          <option value="">Todas las perspectivas</option>
          <option value="financiera">💰 Financiera</option>
          <option value="clientes">👥 Clientes</option>
          <option value="procesos">🔧 Procesos internos</option>
          <option value="aprendizaje">📚 Aprendizaje y crecimiento</option>
        </select>
      </div>
      <div class="table-panel">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Objetivo</th>
                <th>Perspectiva</th>
                <th>Líder Responsable</th>
                <th>KPIs</th>
                <th>Cumplimiento</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="objTableBody">
              ${renderObjRows(res.objectives)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $("#btnCreateObj")?.addEventListener("click", () => openObjectiveForm());
    $("#objSearch")?.addEventListener("input", filterObjTable);
    $("#objFilterPersp")?.addEventListener("change", filterObjTable);
    bindObjActions();

    function filterObjTable() {
      const q = $("#objSearch").value.toLowerCase();
      const p = $("#objFilterPersp").value;
      const filtered = res.objectives.filter(o => {
        const matchQ = o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q) || (o.leader || "").toLowerCase().includes(q);
        const matchP = !p || o.perspective_id === p;
        return matchQ && matchP;
      });
      $("#objTableBody").innerHTML = renderObjRows(filtered);
      bindObjActions();
      enhanceContent(container);
    }

    function renderObjRows(list) {
      if (!list.length) return `<tr><td colspan="9" style="text-align:center;padding:24px">No se encontraron objetivos.</td></tr>`;
      return list.map(o => `
        <tr>
          <td><span class="code">${escapeHtml(o.id)}</span></td>
          <td><strong>${escapeHtml(o.name)}</strong></td>
          <td><span class="tag">${escapeHtml(o.perspective_name)}</span></td>
          <td><strong>${escapeHtml(o.leader || 'Dirección General')}</strong></td>
          <td style="text-align:center">${o.kpi_count}</td>
          <td><span class="status ${o.status_key}">${fmt(o.avg_pct)}%</span></td>
          <td><span class="tag">${escapeHtml(o.priority)}</span></td>
          <td><span class="status good">${escapeHtml(o.status)}</span></td>
          <td class="table-actions">
            <button class="text-action" data-action="view-obj" data-id="${escapeHtml(o.id)}">Ver</button>
            <button class="text-action" data-action="edit-obj" data-id="${escapeHtml(o.id)}">Editar</button>
            <button class="text-action danger" data-action="del-obj" data-id="${escapeHtml(o.id)}">Eliminar</button>
          </td>
        </tr>
      `).join("");
    }

    function bindObjActions() {
      $$("[data-action='view-obj']").forEach(b => b.onclick = () => showObjectiveDetail(b.dataset.id));
      $$("[data-action='edit-obj']").forEach(b => b.onclick = () => openObjectiveForm(b.dataset.id));
      $$("[data-action='del-obj']").forEach(b => b.onclick = () => deleteObjective(b.dataset.id));
    }
  }

  // 4. INDICADORES KPI
  async function renderKpis(container) {
    const res = await apiFetch("api/kpis.php");
    container.innerHTML = `
      ${pageHead("Gestión de Indicadores (KPI)", "Catálogo de indicadores, líderes responsables, fórmulas y metas.", `
        <button class="btn primary" id="btnCreateKpi">＋ Nuevo indicador</button>
      `)}
      <div class="toolbar">
        <div class="search-box"><input id="kpiSearch" placeholder="Buscar KPI por código, nombre, responsable o acción..."></div>
        <select id="kpiFilterPersp">
          <option value="">Todas las perspectivas</option>
          <option value="financiera">💰 Financiera</option>
          <option value="clientes">👥 Clientes</option>
          <option value="procesos">🔧 Procesos internos</option>
          <option value="aprendizaje">📚 Aprendizaje y crecimiento</option>
        </select>
        <select id="kpiFilterResp">
          <option value="">Todos los responsables (${res.responsibles.length})</option>
          ${res.responsibles.map(r => `<option value="${escapeHtml(r.responsible)}">${escapeHtml(r.responsible)}</option>`).join("")}
        </select>
        <select id="kpiFilterStatus">
          <option value="">Todos los estados</option>
          <option value="good">✅ Logrado (≥90%)</option>
          <option value="warn">⚠️ En riesgo (75-89%)</option>
          <option value="bad">❌ Crítico (&lt;75%)</option>
        </select>
      </div>
      <div class="table-panel">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del KPI</th>
                <th>Responsable / Líder</th>
                <th>Área</th>
                <th>Meta</th>
                <th>Real Actual</th>
                <th>% Cumpl.</th>
                <th>Estado</th>
                <th>Frecuencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="kpiTableBody">
              ${renderKpiRows(res.kpis)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $("#btnCreateKpi")?.addEventListener("click", () => openKpiForm());
    $("#kpiSearch")?.addEventListener("input", filterKpiTable);
    $("#kpiFilterPersp")?.addEventListener("change", filterKpiTable);
    $("#kpiFilterResp")?.addEventListener("change", filterKpiTable);
    $("#kpiFilterStatus")?.addEventListener("change", filterKpiTable);
    bindKpiActions();

    function filterKpiTable() {
      const q = $("#kpiSearch").value.toLowerCase();
      const p = $("#kpiFilterPersp").value;
      const r = $("#kpiFilterResp").value;
      const s = $("#kpiFilterStatus").value;
      const filtered = res.kpis.filter(k => {
        const matchQ = k.id.toLowerCase().includes(q) || k.name.toLowerCase().includes(q) || (k.responsible || "").toLowerCase().includes(q) || (k.action_recommended || "").toLowerCase().includes(q);
        const matchP = !p || k.perspective_id === p;
        const matchR = !r || k.responsible === r;
        let matchS = true;
        if (s === "good") matchS = k.compliance_pct >= 90;
        else if (s === "warn") matchS = k.compliance_pct >= 75 && k.compliance_pct < 90;
        else if (s === "bad") matchS = k.compliance_pct < 75;
        return matchQ && matchP && matchR && matchS;
      });
      $("#kpiTableBody").innerHTML = renderKpiRows(filtered);
      bindKpiActions();
      enhanceContent(container);
    }

    function renderKpiRows(list) {
      if (!list.length) return `<tr><td colspan="10" style="text-align:center;padding:24px">No se encontraron indicadores con los filtros aplicados.</td></tr>`;
      return list.map(k => {
        const sClass = (k.compliance_pct >= 90) ? "good" : (k.compliance_pct >= 75) ? "warn" : "bad";
        return `
        <tr>
          <td><span class="code">${escapeHtml(k.id)}</span></td>
          <td><strong>${escapeHtml(k.name)}</strong></td>
          <td>${renderRespChip(k.responsible, k.responsible_area)}</td>
          <td><span class="tag">${escapeHtml(k.responsible_area || k.perspective_name)}</span></td>
          <td style="text-align:right"><strong>${fmt(k.target)}</strong> <small class="muted">${escapeHtml(k.unit)}</small></td>
          <td style="text-align:right"><strong style="color:#002060">${fmt(k.current_real)}</strong></td>
          <td><span class="status ${sClass}">${fmt(k.compliance_pct)}%</span></td>
          <td><span class="status ${sClass}">${escapeHtml(k.status)}</span></td>
          <td><small>${escapeHtml(k.frequency || 'Trimestral')}</small></td>
          <td class="table-actions">
            <button class="text-action" data-action="measure-kpi" data-id="${escapeHtml(k.id)}">Medir</button>
            <button class="text-action" data-action="edit-kpi" data-id="${escapeHtml(k.id)}">Editar</button>
            <button class="text-action danger" data-action="del-kpi" data-id="${escapeHtml(k.id)}">Eliminar</button>
          </td>
        </tr>`;
      }).join("");
    }

    function bindKpiActions() {
      $$("[data-action='measure-kpi']").forEach(b => b.onclick = () => openMeasurementModal(b.dataset.id));
      $$("[data-action='edit-kpi']").forEach(b => b.onclick = () => openKpiForm(b.dataset.id));
      $$("[data-action='del-kpi']").forEach(b => b.onclick = () => deleteKpi(b.dataset.id));
    }
  }

  // 5. REGISTRO DE RESULTADOS (MEDICIONES)
  async function renderMeasurements(container) {
    const kpisRes = await apiFetch("api/kpis.php");
    const mRes = await apiFetch(`api/measurements.php?limit=30&offset=${measurementOffset}`);

    container.innerHTML = `
      ${pageHead("Registro de Resultados", "Captura de valores reales periódicos, cálculo de cumplimiento y actualización con control transaccional.", `
        <button class="btn primary" id="btnOpenNewMeasure">＋ Nueva medición</button>
      `)}

      <div class="grid split-grid" style="margin-bottom:20px">
        <!-- FORMULARIO DIRECTO -->
        <div class="panel">
          <div class="panel-head">
            <div>
              <h3>Registrar Nueva Medición Real</h3>
              <p>Actualiza el semáforo y almacena en la base de datos de TechPeru SAC</p>
            </div>
          </div>
          <form id="directMeasureForm" class="detail-form-grid">
            <div class="field full-span">
              <label>Seleccionar Indicador (KPI) *</label>
              <select id="directMeasureKpi" required>
                ${kpisRes.kpis.map(k => `<option value="${escapeHtml(k.id)}">${escapeHtml(k.id)} - ${escapeHtml(k.name)} (${escapeHtml(k.unit)}) — Resp: ${escapeHtml(k.responsible)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>Período *</label>
              <select id="directMeasurePeriod">
                <option value="2025-Q1">2025 - Q1</option>
                <option value="2025-Q2">2025 - Q2</option>
                <option value="2025-Q3" selected>2025 - Q3</option>
                <option value="2025-Q4">2025 - Q4</option>
                <option value="2025-Acum">2025 - Acumulado Anual</option>
              </select>
            </div>
            <div class="field">
              <label>Fecha de Medición *</label>
              <input type="date" id="directMeasureDate" value="${new Date().toISOString().slice(0, 10)}" required>
            </div>
            <div class="field full-span">
              <label>Valor Real Obtenido *</label>
              <input type="number" step="any" id="directMeasureValue" placeholder="Ej: 19.8" required>
            </div>
            <div class="field full-span">
              <label>Observaciones / Análisis de Acción</label>
              <textarea id="directMeasureNotes" placeholder="Detalle de causas o acciones correctivas ejecutadas..."></textarea>
            </div>
            <div class="full-span" style="text-align:right">
              <button class="btn primary" type="submit">Guardar resultado</button>
            </div>
          </form>
        </div>

        <!-- RESUMEN LATERAL -->
        <div class="panel">
          <div class="panel-head">
            <div>
              <h3>Reglas de Negocio del Cuadro de Mando</h3>
              <p>Lógica automática de negocio del Balanced Scorecard</p>
            </div>
          </div>
          <div class="info-box" style="margin-bottom:12px">
            <strong>KPIs Directos (Mayor = Mejor):</strong><br>
            Cumplimiento = (Real / Meta) × 100
          </div>
          <div class="info-box" style="margin-bottom:12px">
            <strong>KPIs Inversos (Menor = Mejor):</strong><br>
            Defectos, rotación, costos, CAC, tiempo de entrega.<br>
            Cumplimiento = (Meta / Real) × 100
          </div>
          <div class="info-box">
            <strong>Semáforos Oficiales:</strong><br>
            ✅ Logrado: ≥ 90.0%<br>
            ⚠️ En Riesgo: 75.0% - 89.9%<br>
            ❌ Crítico: &lt; 75.0%
          </div>
        </div>
      </div>

      <!-- HISTORIAL DE MEDICIONES -->
      <div class="table-panel">
        <div class="panel-head" style="padding:16px 16px 0">
          <h3>Historial Reciente de Mediciones en Base de Datos</h3>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Período</th>
                <th>Indicador (KPI)</th>
                <th>Responsable</th>
                <th>Valor Real</th>
                <th>% Cumpl.</th>
                <th>Registrado Por</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${mRes.measurements.map(m => `
                <tr>
                  <td>${escapeHtml(m.date)}</td>
                  <td><span class="tag">${escapeHtml(m.period)}</span></td>
                  <td><strong>${escapeHtml(m.kpi_name)}</strong></td>
                  <td>${renderRespChip(m.responsible || 'Responsable', m.responsible_area)}</td>
                  <td><strong style="color:#002060">${fmt(m.value)} ${escapeHtml(m.kpi_unit)}</strong></td>
                  <td><span class="status ${m.compliance_pct >= 90 ? 'good' : m.compliance_pct >= 75 ? 'warn' : 'bad'}">${fmt(m.compliance_pct)}%</span></td>
                  <td><small>${escapeHtml(m.registered_by)}</small></td>
                  <td style="max-width:280px;white-space:normal;font-size:10px">${escapeHtml(m.notes || '—')}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', `<div class="pagination" aria-label="Paginación del historial">
      <span>${mRes.total} mediciones · Página ${Math.floor(measurementOffset / 30) + 1}</span>
      <button class="btn" id="previousMeasurements" ${measurementOffset === 0 ? 'disabled' : ''}>Anterior</button>
      <button class="btn" id="nextMeasurements" ${measurementOffset + 30 >= mRes.total ? 'disabled' : ''}>Siguiente</button>
    </div>`);
    $('#previousMeasurements').onclick = () => { measurementOffset = Math.max(0, measurementOffset - 30); renderCurrentPage(); };
    $('#nextMeasurements').onclick = () => { measurementOffset += 30; renderCurrentPage(); };
    $("#btnOpenNewMeasure")?.addEventListener("click", () => openMeasurementModal());
    $("#directMeasureForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const kpiId = $("#directMeasureKpi").value;
      const period = $("#directMeasurePeriod").value;
      const date = $("#directMeasureDate").value;
      const value = parseFloat($("#directMeasureValue").value);
      const notes = $("#directMeasureNotes").value;

      try {
        await apiFetch("api/measurements.php", {
          method: "POST",
          body: { kpi_id: kpiId, period, date, value, notes }
        });
        toast("✓ Medición guardada exitosamente en la base de datos.");
        renderMeasurements(container);
      } catch (err) {}
    });
  }

  // 6. INICIATIVAS ESTRATÉGICAS
  async function renderInitiatives(container) {
    const res = await apiFetch("api/initiatives.php");
    container.innerHTML = `
      ${pageHead("Iniciativas Estratégicas", "Proyectos vinculados a los objetivos estratégicos de la organización.", `
        <button class="btn primary" id="btnCreateInit">＋ Nueva iniciativa</button>
      `)}
      <div class="table-panel">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Proyecto / Acción</th>
                <th>Objetivo Estratégico</th>
                <th>Líder Responsable</th>
                <th>Presupuesto</th>
                <th>Fechas</th>
                <th>Avance</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${res.initiatives.map(i => `
                <tr>
                  <td><span class="code">${escapeHtml(i.id)}</span></td>
                  <td><strong>${escapeHtml(i.name)}</strong></td>
                  <td><small>${escapeHtml(i.objective_full_name)}</small></td>
                  <td>${renderRespChip(i.leader, 'Líder de Iniciativa')}</td>
                  <td><strong>${currency(i.budget)}</strong></td>
                  <td><small>${escapeHtml(i.start_date)} al ${escapeHtml(i.end_date)}</small></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      <div class="progress-track" style="width:70px"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, Number(i.progress_pct)))}%"></div></div>
                      <b>${fmt(i.progress_pct)}%</b>
                    </div>
                  </td>
                  <td><span class="status good">${escapeHtml(i.status)}</span></td>
                  <td class="table-actions">
                    <button class="text-action" data-action="edit-init" data-id="${escapeHtml(i.id)}">Editar</button>
                    <button class="text-action danger" data-action="del-init" data-id="${escapeHtml(i.id)}">Eliminar</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $("#btnCreateInit")?.addEventListener("click", () => openInitiativeForm());
    $$("[data-action='edit-init']").forEach(b => b.onclick = () => openInitiativeForm(b.dataset.id));
    $$("[data-action='del-init']").forEach(b => b.onclick = () => deleteInitiative(b.dataset.id));
  }

  // 7. REPORTES
  async function renderReports(container) {
    const res = await apiFetch("api/reports.php?action=summary");
    container.innerHTML = `
      ${pageHead("Centro de Reportes del Balanced Scorecard", "Informes consolidados, exportación oficial a hojas de cálculo y vista de impresión ejecutiva.", `
        <button class="btn primary" id="btnExportCSVReport">📥 Descargar CSV Oficial</button>
        <button class="btn soft" id="btnPrintReport">🖨️ Ver Informe Ejecutivo Impreso</button>
      `)}

      <div class="grid" style="grid-template-columns:repeat(3, 1fr);margin-bottom:20px">
        <div class="panel">
          <h3>Resumen Oficial de Indicadores</h3>
          <p>Exporta los 36 indicadores organizados por perspectiva con responsables, fórmulas, metas y valores reales.</p>
          <button class="btn soft full" style="margin-top:12px" id="btnCardCSV">Descargar CSV con UTF-8 BOM</button>
        </div>
        <div class="panel">
          <h3>Reporte de Objetivos Críticos</h3>
          <p>Identifica brechas de cumplimiento inferiores al 75% para la toma de decisiones del directorio.</p>
          <button class="btn soft full" style="margin-top:12px" data-action="filter-crit">Ver KPIs Críticos (${res.critical_kpis.length})</button>
        </div>
        <div class="panel">
          <h3>Presupuesto de Iniciativas</h3>
          <p>Total presupuestado en proyectos estratégicos activos de TechPeru SAC.</p>
          <div style="font-size:22px;font-weight:800;color:#1e40af;margin-top:10px">
            ${currency(res.initiatives_summary.reduce((a, b) => a + (parseFloat(b.total_budget) || 0), 0))}
          </div>
        </div>
      </div>

      <!-- DESEMPEÑO POR RESPONSABLE -->
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-head">
          <div>
            <h3>Ranking de Cumplimiento por Responsable</h3>
            <p>Promedio de logro según los KPIs asignados a cada líder</p>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Líder Responsable</th>
                <th>Área / Gerencia</th>
                <th>KPIs Asignados</th>
                <th>Cumplimiento Promedio</th>
                <th>Estado General</th>
              </tr>
            </thead>
            <tbody>
              ${(res.responsible_ranking || []).map(r => `
                <tr>
                  <td>${renderRespChip(r.responsible, r.responsible_area)}</td>
                  <td><span class="tag">${escapeHtml(r.responsible_area)}</span></td>
                  <td><strong>${r.total_kpis}</strong> KPIs</td>
                  <td><strong>${fmt(r.avg_compliance)}%</strong></td>
                  <td><span class="status ${r.avg_compliance >= 90 ? 'good' : r.avg_compliance >= 75 ? 'warn' : 'bad'}">${r.avg_compliance >= 90 ? 'Logrado' : r.avg_compliance >= 75 ? 'En Riesgo' : 'Crítico'}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <h3>Desempeño Consolidado por Perspectiva</h3>
            <p>Datos sincronizados desde la base de datos SQLite</p>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Perspectiva</th>
                <th>KPIs Asignados</th>
                <th>Cumplimiento Promedio</th>
                <th>Estado General</th>
              </tr>
            </thead>
            <tbody>
              ${res.perspectives.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.title || p.name)}</strong></td>
                  <td>${p.kpi_count} KPIs</td>
                  <td><strong>${fmt(p.avg_compliance)}%</strong></td>
                  <td><span class="status ${p.avg_compliance >= 90 ? 'good' : p.avg_compliance >= 75 ? 'warn' : 'bad'}">${p.avg_compliance >= 90 ? 'Logrado' : p.avg_compliance >= 75 ? 'En Riesgo' : 'Crítico'}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $("#btnExportCSVReport")?.addEventListener("click", () => window.location.href = "api/reports.php?action=export_csv");
    $("#btnCardCSV")?.addEventListener("click", () => window.location.href = "api/reports.php?action=export_csv");
    $("#btnPrintReport")?.addEventListener("click", () => window.open("api/reports.php?action=print_html", "_blank"));
    $$("[data-action='filter-crit']").forEach(b => b.onclick = () => navigate("kpis"));
  }

  // 8. ADMINISTRACIÓN
  async function renderAdmin(container) {
    const usersRes = await apiFetch("api/admin.php?action=users");
    const periodsRes = await apiFetch("api/admin.php?action=periods");
    const actRes = await apiFetch("api/admin.php?action=activity");

    container.innerHTML = `
      ${pageHead("Administración del Sistema", "Gestión de usuarios, períodos, registro de auditoría y base de datos.", "")}
      <div class="grid admin-grid" style="grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <!-- USUARIOS -->
        <div class="panel">
          <div class="panel-head">
            <div>
              <h3>Usuarios y Permisos de Acceso</h3>
              <p>Cuentas registradas en la tabla de usuarios de SQLite</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Área</th>
              </tr>
            </thead>
            <tbody>
              ${usersRes.users.map(u => `
                <tr>
                  <td>
                    <strong>${escapeHtml(u.name)}</strong>
                    <div style="font-size:10px;color:#64748b">${escapeHtml(u.email)}</div>
                  </td>
                  <td><span class="tag">${escapeHtml(u.role)}</span></td>
                  <td>${escapeHtml(u.area)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- PERÍODOS DE EVALUACIÓN Y MANTENIMIENTO -->
        <div class="panel">
          <div class="panel-head">
            <div>
              <h3>Períodos de Evaluación</h3>
              <p>Ciclos de medición registrados en el BSC</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Nombre</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${periodsRes.periods.map(p => `
                <tr>
                  <td><span class="code">${escapeHtml(p.id)}</span></td>
                  <td>${escapeHtml(p.name)}</td>
                  <td><span class="status ${p.status === 'Activo' ? 'good' : 'neutral'}">${escapeHtml(p.status)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px">
            <div class="info-box" style="margin-bottom:12px">
              <strong>Restaurar Datos Oficiales del Excel:</strong><br>
              Vuelve a cargar  los 12 objetivos, los 36 KPIs y los responsables oficiales exactos del archivo <code>BSC_TechPeru_Ampliado_2025.XLSX</code>.
            </div>
            <button class="btn danger full" id="btnResetDB">🔄 Restaurar Base de Datos desde Excel</button>
          </div>
        </div>
      </div>

      <!-- AUDITORÍA DE ACTIVIDAD EN TIEMPO REAL -->
      <div class="panel">
        <div class="panel-head">
          <div>
            <h3>Registro de Auditoría en Tiempo Real (Activity Logs)</h3>
            <p>Trazabilidad de cambios, mediciones y operaciones en la base de datos SQLite</p>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalles de la Operación</th>
              </tr>
            </thead>
            <tbody>
              ${actRes.logs.map(l => `
                <tr>
                  <td><small>${escapeHtml(l.created_at)}</small></td>
                  <td><strong>${escapeHtml(l.user_name || 'Sistema')}</strong></td>
                  <td><span class="audit-badge ${l.action.includes('MEASURE') ? 'measure' : l.action.includes('SEED') ? 'seed' : 'kpi'}">${escapeHtml(l.action)}</span></td>
                  <td><span class="tag">${escapeHtml(l.entity_type)} ${escapeHtml(l.entity_id || '')}</span></td>
                  <td style="max-width:400px;white-space:normal;font-size:11px">${escapeHtml(l.details)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $("#btnResetDB")?.addEventListener("click", async () => {
      if (confirm("¿Estás seguro de restablecer la base de datos a los valores oficiales del Excel de TechPeru SAC 2025?")) {
        try {
          const r = await apiFetch("api/admin.php?action=reset", { method: "POST" });
          toast(r.message);
          renderAdmin(container);
        } catch (e) {}
      }
    });
  }

  // ========================================================
  // MODALES (OBJETIVOS, KPIS, MEDICIONES, INICIATIVAS)
  // ========================================================
  function showModal(title, bodyHtml, confirmText, onConfirm, eyebrow = "FORMULARIO") {
    $("#modalTitle").textContent = title;
    $("#modalEyebrow").textContent = eyebrow;
    $("#modalBody").innerHTML = bodyHtml;
    $("#modalFooter").innerHTML = `
      <button class="btn" id="modalCancelBtn">Cancelar</button>
      ${confirmText ? `<button class="btn primary" id="modalConfirmBtn">${escapeHtml(confirmText)}</button>` : ""}
    `;
    modalReturnFocus = document.activeElement;
    $("#modalLayer").classList.remove("hidden");
    $("#appView").inert = true;
    enhanceContent($("#modalBody"));
    setTimeout(() => $("#modalBody input, #modalBody select, #modalClose")?.focus(), 0);

    $("#modalCancelBtn")?.addEventListener("click", closeModal);
    const confirm = async () => {
      const form = $('#modalBody form');
      if (form && !form.reportValidity()) return;
      const button = $('#modalConfirmBtn');
      if (!button || button.disabled) return;
      button.disabled = true;
      try { await onConfirm(); } catch (e) { /* apiFetch displays the error */ }
      finally { button.disabled = false; }
    };
    $('#modalConfirmBtn')?.addEventListener('click', confirm);
    $('#modalBody form')?.addEventListener('submit', e => { e.preventDefault(); confirm(); });
  }

  function closeModal() {
    $("#modalLayer").classList.add("hidden");
    $("#appView").inert = false;
    modalReturnFocus?.focus();
  }

  async function showObjectiveDetail(id) {
    const res = await apiFetch(`api/objectives.php?id=${encodeURIComponent(id)}`);
    const o = res.objective;
    showModal(o.full_name, `
      <div style="margin-bottom:12px;font-size:12px;color:#475569">
        <strong>Perspectiva:</strong> ${escapeHtml(o.perspective_name)} ·
        <strong>Líder Responsable:</strong> ${escapeHtml(o.leader || 'Dirección')} ·
        <strong>Prioridad:</strong> ${escapeHtml(o.priority)}
      </div>
      <p style="margin-bottom:16px">${escapeHtml(o.description)}</p>
      <h4>Indicadores KPI Asociados (${o.kpis.length})</h4>
      <table style="margin-top:8px">
        <thead>
          <tr>
            <th>KPI</th>
            <th>Responsable</th>
            <th>Meta</th>
            <th>Real</th>
            <th>% Cumpl.</th>
            <th>Estado</th>
            <th>Acción Recomendada</th>
          </tr>
        </thead>
        <tbody>
          ${o.kpis.map(k => `
            <tr>
              <td><strong>${escapeHtml(k.name)}</strong></td>
              <td>${renderRespChip(k.responsible, k.responsible_area)}</td>
              <td>${fmt(k.target)} ${escapeHtml(k.unit)}</td>
              <td><strong style="color:#002060">${fmt(k.current_real)}</strong></td>
              <td><span class="status ${k.compliance_pct >= 90 ? 'good' : k.compliance_pct >= 75 ? 'warn' : 'bad'}">${fmt(k.compliance_pct)}%</span></td>
              <td><small>${escapeHtml(k.status)}</small></td>
              <td style="max-width:240px;white-space:normal;font-size:10px">${escapeHtml(k.action_recommended)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `, "Cerrar", closeModal, "DETALLE DE OBJETIVO");
  }

  async function openObjectiveForm(id = null) {
    let obj = { id: "", perspective_id: "financiera", name: "", description: "", priority: "Alta", weight: 100, leader: "" };
    if (id) {
      const res = await apiFetch(`api/objectives.php?id=${encodeURIComponent(id)}`);
      obj = res.objective;
    }

    showModal(id ? `Editar Objetivo: ${obj.id}` : "Nuevo Objetivo Estratégico", `
      <form id="objModalForm" class="detail-form-grid">
        <div class="field">
          <label>Código (ID) *</label>
          <input id="formObjId" value="${escapeHtml(obj.id)}" ${id ? 'readonly style="background:#f1f5f9"' : ''} placeholder="Ej: OBJ-F4" required>
        </div>
        <div class="field">
          <label>Perspectiva *</label>
          <select id="formObjPersp">
            <option value="financiera" ${obj.perspective_id === 'financiera' ? 'selected' : ''}>💰 Financiera</option>
            <option value="clientes" ${obj.perspective_id === 'clientes' ? 'selected' : ''}>👥 Clientes</option>
            <option value="procesos" ${obj.perspective_id === 'procesos' ? 'selected' : ''}>🔧 Procesos internos</option>
            <option value="aprendizaje" ${obj.perspective_id === 'aprendizaje' ? 'selected' : ''}>📚 Aprendizaje y crecimiento</option>
          </select>
        </div>
        <div class="field full-span">
          <label>Nombre del Objetivo *</label>
          <input id="formObjName" value="${escapeHtml(obj.name)}" placeholder="Ej: Optimizar el capital de trabajo" required>
        </div>
        <div class="field full-span">
          <label>Líder Responsable</label>
          <input id="formObjLeader" value="${escapeHtml(obj.leader || '')}" placeholder="Ej: Lic. Carlos Mendoza (Gerencia de Finanzas)">
        </div>
        <div class="field full-span">
          <label>Descripción Estratégica</label>
          <textarea id="formObjDesc" placeholder="Finalidad y alcance del objetivo...">${escapeHtml(obj.description)}</textarea>
        </div>
      </form>
    `, id ? "Guardar Cambios" : "Crear registro", async () => {
      const formId = $("#formObjId").value.trim();
      const formPersp = $("#formObjPersp").value;
      const formName = $("#formObjName").value.trim();
      const formLeader = $("#formObjLeader").value.trim();
      const formDesc = $("#formObjDesc").value.trim();

      if (!formId || !formName) {
        alert("El código y el nombre son obligatorios.");
        return;
      }

      try {
        if (id) {
          await apiFetch("api/objectives.php", {
            method: "PUT",
            body: { id: formId, perspective_id: formPersp, name: formName, leader: formLeader, description: formDesc }
          });
          toast("✓ Objetivo actualizado .");
        } else {
          await apiFetch("api/objectives.php", {
            method: "POST",
            body: { id: formId, perspective_id: formPersp, name: formName, leader: formLeader, description: formDesc }
          });
          toast("✓ Objetivo creado .");
        }
        closeModal();
        renderCurrentPage();
      } catch (e) {}
    });
  }

  async function deleteObjective(id) {
    if (!confirm(`¿Eliminar el objetivo ${id} y sus indicadores asociados de la base de datos?`)) return;
    try {
      await apiFetch(`api/objectives.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("✓ Objetivo eliminado.");
      renderCurrentPage();
    } catch (e) {}
  }

  async function openKpiForm(id = null) {
    const objsRes = await apiFetch("api/objectives.php");
    let kpi = {
      id: "",
      objective_id: objsRes.objectives[0]?.id || "",
      name: "",
      unit: "%",
      target: 100,
      current_real: 0,
      direction: "mayor",
      responsible: "Lic. Carlos Mendoza",
      responsible_area: "Gerencia de Finanzas",
      frequency: "Trimestral",
      baseline: 0,
      calculation_formula: "",
      action_recommended: ""
    };

    if (id) {
      const res = await apiFetch(`api/kpis.php?id=${encodeURIComponent(id)}`);
      kpi = res.kpi;
    }

    showModal(id ? `Editar Indicador: ${escapeHtml(kpi.id)}` : "Nuevo Indicador (KPI)", `
      <form id="kpiModalForm" class="detail-form-grid">
        <div class="field">
          <label>Código del KPI *</label>
          <input id="formKpiId" value="${escapeHtml(kpi.id)}" ${id ? 'readonly style="background:#f1f5f9"' : ''} placeholder="Ej: KPI-37" required>
        </div>
        <div class="field">
          <label>Objetivo Estratégico Asociado *</label>
          <select id="formKpiObj">
            ${objsRes.objectives.map(o => `<option value="${escapeHtml(o.id)}" ${kpi.objective_id === o.id ? 'selected' : ''}>${escapeHtml(o.id)}: ${escapeHtml(o.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field full-span">
          <label>Nombre del Indicador *</label>
          <input id="formKpiName" value="${escapeHtml(kpi.name)}" placeholder="Ej: Ratio de liquidez corriente" required>
        </div>
        <div class="field">
          <label>Líder Responsable *</label>
          <input id="formKpiResp" value="${escapeHtml(kpi.responsible)}" placeholder="Ej: Lic. Carlos Mendoza" required>
        </div>
        <div class="field">
          <label>Área / Gerencia Responsable *</label>
          <input id="formKpiArea" value="${escapeHtml(kpi.responsible_area)}" placeholder="Ej: Gerencia de Finanzas" required>
        </div>
        <div class="field">
          <label>Unidad de Medida *</label>
          <input id="formKpiUnit" value="${escapeHtml(kpi.unit)}" placeholder="Ej: %, S/, días, #" required>
        </div>
        <div class="field">
          <label>Sentido del Indicador *</label>
          <select id="formKpiDir">
            <option value="mayor" ${kpi.direction === 'mayor' ? 'selected' : ''}>Mayor es mejor (Ventas, margen, satisfacción)</option>
            <option value="menor" ${kpi.direction === 'menor' ? 'selected' : ''}>Menor es mejor (Costos, defectos, rotación, tiempo)</option>
          </select>
        </div>
        <div class="field">
          <label>Frecuencia de Medición</label>
          <select id="formKpiFreq">
            <option value="Mensual" ${kpi.frequency === 'Mensual' ? 'selected' : ''}>Mensual</option>
            <option value="Trimestral" ${kpi.frequency === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
            <option value="Semestral" ${kpi.frequency === 'Semestral' ? 'selected' : ''}>Semestral</option>
            <option value="Anual" ${kpi.frequency === 'Anual' ? 'selected' : ''}>Anual</option>
          </select>
        </div>
        <div class="field">
          <label>Línea Base</label>
          <input type="number" step="any" id="formKpiBase" value="${kpi.baseline || 0}">
        </div>
        <div class="field">
          <label>Meta Establecida *</label>
          <input type="number" step="any" id="formKpiTarget" value="${kpi.target}" required>
        </div>
        <div class="field">
          <label>Valor Real Actual *</label>
          <input type="number" step="any" id="formKpiReal" value="${kpi.current_real}" required>
        </div>
        <div class="field full-span">
          <label>Fórmula de Cálculo Documentada</label>
          <input id="formKpiFormula" value="${escapeHtml(kpi.calculation_formula || '')}" placeholder="Ej: (Activo Corriente / Pasivo Corriente)">
        </div>
        <div class="field full-span">
          <label>Análisis / Acción Recomendada</label>
          <textarea id="formKpiAction" placeholder="Acción correctiva si no se alcanza la meta...">${escapeHtml(kpi.action_recommended)}</textarea>
        </div>
      </form>
    `, id ? "Guardar Cambios" : "Crear registro", async () => {
      const formId = $("#formKpiId").value.trim();
      const formObj = $("#formKpiObj").value;
      const formName = $("#formKpiName").value.trim();
      const formResp = $("#formKpiResp").value.trim();
      const formArea = $("#formKpiArea").value.trim();
      const formUnit = $("#formKpiUnit").value.trim();
      const formDir = $("#formKpiDir").value;
      const formFreq = $("#formKpiFreq").value;
      const formBase = parseFloat($("#formKpiBase").value) || 0;
      const formTarget = parseFloat($("#formKpiTarget").value);
      const formReal = parseFloat($("#formKpiReal").value);
      const formFormula = $("#formKpiFormula").value.trim();
      const formAction = $("#formKpiAction").value.trim();

      if (!formId || !formName || isNaN(formTarget)) {
        alert("Código, nombre y meta son obligatorios.");
        return;
      }

      try {
        if (id) {
          await apiFetch("api/kpis.php", {
            method: "PUT",
            body: {
              id: formId,
              objective_id: formObj,
              name: formName,
              unit: formUnit,
              target: formTarget,
              current_real: formReal,
              direction: formDir,
              responsible: formResp,
              responsible_area: formArea,
              frequency: formFreq,
              baseline: formBase,
              calculation_formula: formFormula,
              action_recommended: formAction
            }
          });
          toast("✓ Indicador actualizado .");
        } else {
          await apiFetch("api/kpis.php", {
            method: "POST",
            body: {
              id: formId,
              objective_id: formObj,
              name: formName,
              unit: formUnit,
              target: formTarget,
              current_real: formReal,
              direction: formDir,
              responsible: formResp,
              responsible_area: formArea,
              frequency: formFreq,
              baseline: formBase,
              calculation_formula: formFormula,
              action_recommended: formAction
            }
          });
          toast("✓ Indicador creado .");
        }
        closeModal();
        renderCurrentPage();
      } catch (e) {}
    });
  }

  async function deleteKpi(id) {
    if (!confirm(`¿Eliminar el indicador ${id} de la base de datos?`)) return;
    try {
      await apiFetch(`api/kpis.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("✓ Indicador eliminado.");
      renderCurrentPage();
    } catch (e) {}
  }

  async function openMeasurementModal(preselectedKpiId = null) {
    const kpisRes = await apiFetch("api/kpis.php");
    const kpi = preselectedKpiId ? kpisRes.kpis.find(k => k.id === preselectedKpiId) : kpisRes.kpis[0];

    showModal("Registrar Resultado (Medición Real)", `
      <form id="modalMeasureForm" class="detail-form-grid">
        <div class="field full-span">
          <label>Indicador (KPI) *</label>
          <select id="modalMeasureKpi">
            ${kpisRes.kpis.map(k => `<option value="${escapeHtml(k.id)}" ${k.id === (kpi?.id) ? 'selected' : ''}>${escapeHtml(k.id)} - ${escapeHtml(k.name)} (${escapeHtml(k.unit)}) — Resp: ${escapeHtml(k.responsible)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Período *</label>
          <select id="modalMeasurePeriod">
            <option value="2025-Q1">2025 - Q1</option>
            <option value="2025-Q2">2025 - Q2</option>
            <option value="2025-Q3" selected>2025 - Q3</option>
            <option value="2025-Q4">2025 - Q4</option>
            <option value="2025-Acum">2025 - Acumulado</option>
          </select>
        </div>
        <div class="field">
          <label>Fecha de Medición *</label>
          <input type="date" id="modalMeasureDate" value="${new Date().toISOString().slice(0, 10)}" required>
        </div>
        <div class="field full-span">
          <label>Valor Real Obtenido *</label>
          <input type="number" step="any" id="modalMeasureVal" value="${kpi?.current_real || ''}" autofocus required>
        </div>
        <div class="field full-span">
          <label>Observaciones / Acción</label>
          <textarea id="modalMeasureNotes" placeholder="Detalle de causas o acciones correctivas ejecutadas...">${escapeHtml(kpi?.action_recommended || '')}</textarea>
        </div>
      </form>
    `, "Guardar resultado", async () => {
      const kpiId = $("#modalMeasureKpi").value;
      const period = $("#modalMeasurePeriod").value;
      const date = $("#modalMeasureDate").value;
      const val = parseFloat($("#modalMeasureVal").value);
      const notes = $("#modalMeasureNotes").value;

      if (isNaN(val)) {
        alert("Por favor ingresa un valor numérico válido.");
        return;
      }

      try {
        const res = await apiFetch("api/measurements.php", {
          method: "POST",
          body: { kpi_id: kpiId, period, date, value: val, notes }
        });
        toast(`✓ Medición registrada . Nuevo cumplimiento: ${res.compliance_pct}%.`);
        closeModal();
        renderCurrentPage();
      } catch (e) {}
    }, "MEDICIÓN DE DESEMPEÑO");
  }

  async function openInitiativeForm(id = null) {
    const kpisRes = await apiFetch("api/kpis.php");
    const objsRes = await apiFetch("api/objectives.php");
    let init = { id: "", objective_id: objsRes.objectives[0]?.id || "", name: "", leader: "Lic. Carlos Mendoza", budget: 50000, progress_pct: 0, status: "En ejecución" };
    if (id) {
      const res = await apiFetch(`api/initiatives.php?id=${encodeURIComponent(id)}`);
      init = res.initiative;
    }

    showModal(id ? `Editar Iniciativa: ${escapeHtml(init.id)}` : "Nueva Iniciativa Estratégica", `
      <form class="detail-form-grid">
        <div class="field"><label>Fecha de inicio</label><input type="date" id="formInitStart" required value="${escapeHtml(init.start_date || new Date().toISOString().slice(0,10))}"></div>
        <div class="field"><label>Fecha de cierre</label><input type="date" id="formInitEnd" required value="${escapeHtml(init.end_date || new Date().getFullYear() + '-12-31')}"></div>
        <div class="field full-span"><label>Indicador vinculado (opcional)</label><select id="formInitKpi"><option value="">Sin indicador</option>${kpisRes.kpis.map(k => `<option value="${escapeHtml(k.id)}" ${init.kpi_id === k.id ? 'selected' : ''}>${escapeHtml(k.id)} — ${escapeHtml(k.name)}</option>`).join('')}</select></div>
        <div class="field full-span">
          <label>Objetivo Estratégico Vinculado *</label>
          <select id="formInitObj">
            ${objsRes.objectives.map(o => `<option value="${escapeHtml(o.id)}" ${init.objective_id === o.id ? 'selected' : ''}>${escapeHtml(o.id)}: ${escapeHtml(o.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field full-span">
          <label>Nombre de la Iniciativa / Proyecto *</label>
          <input id="formInitName" value="${escapeHtml(init.name)}" placeholder="Ej: Implementación de módulo ERP" required>
        </div>
        <div class="field">
          <label>Líder Responsable *</label>
          <input id="formInitLeader" value="${escapeHtml(init.leader)}" placeholder="Ej: Lic. Carlos Mendoza" required>
        </div>
        <div class="field">
          <label>Presupuesto (S/) *</label>
          <input type="number" id="formInitBudget" value="${init.budget}">
        </div>
        <div class="field">
          <label>% Avance</label>
          <input type="number" min="0" max="100" id="formInitProgress" value="${init.progress_pct}">
        </div>
        <div class="field">
          <label>Estado</label>
          <select id="formInitStatus">
            <option value="En ejecución" ${init.status === 'En ejecución' ? 'selected' : ''}>En ejecución</option>
            <option value="Finalizada" ${init.status === 'Finalizada' ? 'selected' : ''}>Finalizada</option>
            <option value="Retrasada" ${init.status === 'Retrasada' ? 'selected' : ''}>Retrasada</option>
          </select>
        </div>
      </form>
    `, id ? "Guardar Cambios" : "Crear registro", async () => {
      const name = $("#formInitName").value.trim();
      const objId = $("#formInitObj").value;
      const leader = $("#formInitLeader").value.trim();
      const budget = Number($("#formInitBudget").value);
      const startDate = $('#formInitStart').value;
      const endDate = $('#formInitEnd').value;
      const kpiId = $('#formInitKpi').value;
      const progress = parseFloat($("#formInitProgress").value) || 0;
      const status = $("#formInitStatus").value;

      if (!name) {
        alert("El nombre de la iniciativa es obligatorio.");
        return;
      }

      try {
        if (id) {
          await apiFetch("api/initiatives.php", {
            method: "PUT",
            body: { id, objective_id: objId, kpi_id: kpiId, start_date: startDate, end_date: endDate, name, leader, budget, progress_pct: progress, status }
          });
          toast("✓ Iniciativa actualizada .");
        } else {
          await apiFetch("api/initiatives.php", {
            method: "POST",
            body: { objective_id: objId, kpi_id: kpiId, start_date: startDate, end_date: endDate, name, leader, budget, progress_pct: progress, status }
          });
          toast("✓ Iniciativa creada .");
        }
        closeModal();
        renderCurrentPage();
      } catch (e) {}
    });
  }

  async function deleteInitiative(id) {
    if (!confirm(`¿Eliminar la iniciativa ${id} de la base de datos?`)) return;
    try {
      await apiFetch(`api/initiatives.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("✓ Iniciativa eliminada.");
      renderCurrentPage();
    } catch (e) {}
  }

  function enhanceContent(root) {
    $$('.field', root).forEach(field => {
      const control = $('input, select, textarea', field), label = $('label', field);
      if (label && control?.id) label.htmlFor = control.id;
    });
    $$('th', root).forEach(th => th.scope = 'col');
    $$('input[placeholder]', root).forEach(input => {
      if (!input.labels?.length) input.setAttribute('aria-label', input.placeholder);
    });
    $$('tbody', root).forEach(body => {
      if (!body.children.length) body.innerHTML = '<tr><td colspan="20" class="empty-state">No hay registros para mostrar.</td></tr>';
    });
    const manager = ['Administrador', 'Gerente'].includes(currentUser?.role);
    if (!manager) $$('[data-action^="edit-"], [data-action^="del-"], #btnCreateObj, #btnNewObj, #btnCreateKpi, #btnNewKpi, #btnCreateInit, #btnNewInit', root).forEach(b => b.classList.add('hidden'));
  }

  function destroyCharts() {
    Object.keys(charts).forEach(k => {
      if (charts[k]) {
        charts[k].destroy();
        delete charts[k];
      }
    });
  }

  // ========================================================
  // INICIALIZACIÓN
  // ========================================================
  async function init() {
    if (location.protocol === 'file:') {
      $('#loginError').textContent = 'Abre la aplicación : http://localhost:8080.';
      $('#loginError').classList.remove('hidden');
      return;
    }
    window.addEventListener('hashchange', () => {
      const page = location.hash.slice(1);
      if (currentUser && page !== currentPage) navigate(page);
    });
    document.addEventListener('keydown', e => {
      if ($('#modalLayer').classList.contains('hidden')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') {
        const items = $$('button:not(:disabled), input, select, textarea, [tabindex="0"]', $('#modalLayer'));
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
    // Formulario de login
    $("#loginForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const u = $("#loginUser").value.trim();
      const p = $("#loginPass").value;
      const submit = $('#loginForm button');
      submit.disabled = true;
      const ok = await login(u, p);
      submit.disabled = false;
      $("#loginError")?.classList.toggle("hidden", ok);
    });

    // Cerrar sesión
    $("#logoutBtn")?.addEventListener("click", logout);

    // Navegación menú lateral
    $("#mainNav")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-page]");
      if (btn) navigate(btn.dataset.page);
    });

    // Mobile sidebar
    $("#menuToggle")?.addEventListener("click", () => {
      const open = $("#sidebar").classList.toggle("open");
      $("#menuToggle").setAttribute('aria-expanded', String(open));
    });
    $("#sidebarClose")?.addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#menuToggle").setAttribute("aria-expanded", "false"); });

    // Modal close
    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modalLayer")?.addEventListener("click", e => {
      if (e.target.id === "modalLayer") closeModal();
    });

    // Notificaciones popup
    $("#notificationsBtn")?.addEventListener("click", async () => {
      const old = $(".notification-pop");
      if (old) { old.remove(); return; }

      const dash = await apiFetch("api/dashboard.php");
      const alerts = dash.critical_kpis;
      const pop = document.createElement("div");
      pop.className = "notification-pop";
      pop.innerHTML = `
        <h3>Alertas de KPIs Críticos (${alerts.length})</h3>
        <p style="font-size:10.5px;color:#64748b;margin-bottom:8px">Indicadores con cumplimiento menor a 75% </p>
        <div style="max-height:280px;overflow-y:auto">
          ${alerts.map(k => `
            <div class="notification-item">
              <div style="display:flex;justify-content:space-between">
                <strong>${escapeHtml(k.name)}</strong>
                <span class="status bad">${fmt(k.compliance_pct)}%</span>
              </div>
              <div style="font-size:10px;color:#2563eb;margin-top:2px">👤 ${escapeHtml(k.responsible)} (${escapeHtml(k.responsible_area)})</div>
              <small>${escapeHtml(k.action_recommended)}</small>
            </div>
          `).join("")}
        </div>
      `;
      document.body.append(pop);
      document.addEventListener("click", function closePop(ev) {
        if (!pop.contains(ev.target) && ev.target !== $("#notificationsBtn")) {
          pop.remove();
          document.removeEventListener("click", closePop);
        }
      });
    });

    // Hash inicial
    if (location.hash && pageTitles[location.hash.slice(1)]) {
      currentPage = location.hash.slice(1);
    }

    // Comprobar sesión PHP
    const authed = await checkAuth();
    if (authed) {
      showApp();
    } else {
      showLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
