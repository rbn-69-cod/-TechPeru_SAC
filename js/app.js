import { createApiClient } from './api.js';
import { $, $$, escapeHtml, fmt, currency, today } from './core.js';

/**
 * TECHPERU SAC — BALANCED SCORECARD 2025
 * Frontend conectado a Backend PHP 8.3 & SQLite
 * Soporte completo para Responsables por KPI, Auditoría y Transacciones
 */
(() => {
  "use strict";


  let currentUser = null;
  let modalReturnFocus = null;
  let currentPage = "dashboard";
  let dashboardViewMode = "matriz"; // 'matriz', 'cuadrantes', 'graficos'
  let activeExcelFilter = null;
  let activeStatusFilter = null;
  let kpiSearchTerm = "";
  let activeRespFilter = null;
  let charts = {};
  let measurementOffset = 0;
  let rendering = false;
  let renderQueued = false;
  let currentDashboardData = null;
  let pendingKpiStatus = "";

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
  const apiFetch = createApiClient({
    onUnauthorized: () => { currentUser = null; showLogin(); },
    onError: error => {
      toast(error.message, 'error');
      const region = $('#modalError');
      if (region && !$('#modalLayer').classList.contains('hidden')) {
        region.textContent = error.message;
        region.classList.remove('hidden');
      }
      if (!$('#loginView').classList.contains('hidden')) {
        $('#loginError').textContent = error.message;
        $('#loginError').classList.remove('hidden');
      }
    }
  });

  async function runAction(action) {
    try { await action(); } catch { /* The API client displays request failures. */ }
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
      await apiFetch("api/auth.php?action=me");
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
    closeModal();
    setSidebar(false);
    destroyCharts();
    $('.notification-pop')?.remove();
    $('#pageContent').replaceChildren();
    $('#loginPass').value = '';
    $("#appView").classList.add("hidden");
    $("#loginView").classList.remove("hidden");
  }

  function setSidebar(open) {
    const mobile = matchMedia('(max-width: 800px)').matches;
    const sidebar = $('#sidebar');
    sidebar.classList.toggle('open', mobile && open);
    sidebar.inert = mobile && !open;
    sidebar.setAttribute('aria-hidden', String(mobile && !open));
    $('#menuToggle').setAttribute('aria-expanded', String(mobile && open));
    $('#sidebarBackdrop').classList.toggle('hidden', !mobile || !open);
    $('.main-column').inert = mobile && open;
    document.body.classList.toggle('sidebar-open', mobile && open);
    if (mobile && open) $('#sidebarClose').focus();
    else if (mobile && sidebar.contains(document.activeElement)) $('#menuToggle').focus();
  }

  function navigate(page) {
    if (!pageTitles[page]) page = 'dashboard';
    if (page === 'administracion' && currentUser?.role !== 'Administrador') page = 'dashboard';
    currentPage = page;
    setSidebar(false);
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
    main.innerHTML = `<div class="loading-state">Cargando datos...</div>`;

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
    main.dataset.page = currentPage;
    } catch (error) {
      main.innerHTML = `<section class="empty-state" role="alert"><h2>No pudimos cargar esta vista</h2><p>${escapeHtml(error.message)}</p><button class="btn primary" id="retryView">Reintentar</button></section>`;
      $('#retryView').onclick = renderCurrentPage;
    } finally {
      main.setAttribute('aria-busy', 'false');
      rendering = false;
      if (renderQueued) { renderQueued = false; renderCurrentPage(); }
    }
  }

  // 1. DASHBOARD EJECUTIVO MODERNO E INTUITIVO
  async function renderDashboard(container) {
    const url = activeRespFilter ? `api/dashboard.php?responsible=${encodeURIComponent(activeRespFilter)}` : "api/dashboard.php";
    const res = await apiFetch(url);
    currentDashboardData = res;
    const g = res.global;

    // Filtrar KPIs según perspectiva, estado y término de búsqueda
    let filteredKpis = res.all_kpis;
    if (activeExcelFilter) {
      filteredKpis = filteredKpis.filter(k => k.perspective_id === activeExcelFilter);
    }
    if (activeStatusFilter) {
      filteredKpis = filteredKpis.filter(k => {
        const p = Number(k.compliance_pct);
        if (activeStatusFilter === 'good') return p >= 90;
        if (activeStatusFilter === 'warn') return p >= 75 && p < 90;
        if (activeStatusFilter === 'bad') return p < 75;
        return true;
      });
    }
    if (kpiSearchTerm) {
      const q = kpiSearchTerm.toLowerCase();
      filteredKpis = filteredKpis.filter(k => 
        k.name.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q) ||
        (k.objective_name && k.objective_name.toLowerCase().includes(q)) ||
        (k.responsible && k.responsible.toLowerCase().includes(q)) ||
        (k.responsible_area && k.responsible_area.toLowerCase().includes(q))
      );
    }

    // Configuración y métricas de las 4 Perspectivas
    const perspConfigs = [
      { id: 'financiera', name: 'Financiera', icon: '💰', color: '#1f3864', softColor: '#eff6ff', tagClass: 'financiera' },
      { id: 'clientes', name: 'Clientes', icon: '👥', color: '#1e4d2b', softColor: '#f0fdf4', tagClass: 'clientes' },
      { id: 'procesos', name: 'Procesos Internos', icon: '🔧', color: '#9a4b08', softColor: '#fffbeb', tagClass: 'procesos' },
      { id: 'aprendizaje', name: 'Aprendizaje y Crecimiento', icon: '📚', color: '#4a2373', softColor: '#faf5ff', tagClass: 'aprendizaje' }
    ];

    const perspCardsHtml = perspConfigs.map(p => {
      const pKpis = res.all_kpis.filter(k => k.perspective_id === p.id);
      const count = pKpis.length;
      const avg = count ? (pKpis.reduce((acc, k) => acc + Number(k.compliance_pct), 0) / count).toFixed(1) : 0;
      const goodCount = pKpis.filter(k => Number(k.compliance_pct) >= 90).length;
      const warnCount = pKpis.filter(k => Number(k.compliance_pct) >= 75 && Number(k.compliance_pct) < 90).length;
      const badCount = pKpis.filter(k => Number(k.compliance_pct) < 75).length;
      const isActive = activeExcelFilter === p.id;
      const barColor = avg >= 90 ? '#16a34a' : (avg >= 75 ? '#d97706' : '#dc2626');

      return `
        <div class="persp-summary-card ${isActive ? 'active' : ''}" data-persp-card="${p.id}" style="--accent:${p.color}">
          <div class="persp-card-header">
            <span class="persp-card-title">${p.icon} ${p.name}</span>
            <span class="tag" style="background:${p.softColor};color:${p.color};font-weight:700">${count} KPIs</span>
          </div>
          <div class="persp-card-pct" style="color:${barColor}">${avg}%</div>
          <div class="persp-card-prog">
            <div class="persp-card-prog-fill" style="width:${Math.min(100, avg)}%;background:${barColor}"></div>
          </div>
          <div class="persp-card-meta">
            <span>3 Objetivos</span>
            <span>${isActive ? '<b>Filtro activo</b>' : 'Clic para filtrar'}</span>
          </div>
          <div class="persp-card-breakdown">
            <span style="color:#16a34a">● ${goodCount} logrados</span>
            <span style="color:#d97706">● ${warnCount} riesgo</span>
            <span style="color:#dc2626">● ${badCount} críticos</span>
          </div>
        </div>
      `;
    }).join("");

    let contentHtml = "";
    if (dashboardViewMode === "matriz") {
      contentHtml = renderModernKpiTable(filteredKpis, res);
    } else if (dashboardViewMode === "cuadrantes") {
      contentHtml = renderQuadrants(res.perspectives);
    } else {
      contentHtml = renderChartsBlock(res.perspectives, res.trend);
    }

    container.innerHTML = `
      ${pageHead("BALANCED SCORECARD — TechPeru SAC | 2025", "Tablero Estratégico Ejecutivo · Persistencia en Base de Datos SQLite · 4 Perspectivas · 36 KPIs", `
        <button class="btn" id="btnExportDashCSV">📥 Exportar Reporte CSV</button>
        <button class="btn primary" id="btnNewMeasurement">＋ Registrar Medición</button>
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
          <div class="metric-top"><span>SALUD DE INDICADORES</span><span class="metric-icon">▥</span></div>
          <div class="metric-value">${g.total}</div>
          <div class="metric-foot">
            <span class="status good">${g.logrado} Logrados</span>
            <span class="status warn">${g.riesgo} Riesgo</span>
            <span class="status bad">${g.critico} Críticos</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top"><span>OBJETIVOS ESTRATÉGICOS</span><span class="metric-icon">⌘</span></div>
          <div class="metric-value">${res.objectives.length}</div>
          <div class="metric-foot"><span class="trend-up">Seguimiento Anual</span><span>4 Perspectivas BSC</span></div>
        </div>

        <div class="metric-card">
          <div class="metric-top"><span>LIDERAZGO Y GESTIÓN</span><span class="metric-icon">👤</span></div>
          <div class="metric-value">${res.responsibles.length}</div>
          <div class="metric-foot"><span class="trend-up">● Líderes Asignados</span><span>100% de KPIs con Responsable</span></div>
        </div>
      </section>

      <!-- 4 PERSPECTIVAS ESTRATÉGICAS DEL BSC (INTERACTIVAS) -->
      <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:13px;color:#1e293b;letter-spacing:-0.02em">Las 4 Perspectivas del Balanced Scorecard (Haz clic en una para filtrar)</strong>
        ${activeExcelFilter ? `<button class="btn small soft" id="btnResetPerspFilter">✕ Quitar filtro (${activeExcelFilter})</button>` : ""}
      </div>
      <section class="persp-cards-grid">
        ${perspCardsHtml}
      </section>

      <!-- BARRA DE HERRAMIENTAS Y FILTROS INTUITIVOS -->
      <section class="modern-toolbar">
        <div class="toolbar-top-row">
          <div class="persp-filter-pills">
            <button class="persp-pill-btn ${!activeExcelFilter ? 'active' : ''}" data-filter-persp="">🌐 Todo el BSC (${res.all_kpis.length})</button>
            <button class="persp-pill-btn ${activeExcelFilter === 'financiera' ? 'active' : ''}" data-filter-persp="financiera">💰 Financiera (9)</button>
            <button class="persp-pill-btn ${activeExcelFilter === 'clientes' ? 'active' : ''}" data-filter-persp="clientes">👥 Clientes (9)</button>
            <button class="persp-pill-btn ${activeExcelFilter === 'procesos' ? 'active' : ''}" data-filter-persp="procesos">🔧 Procesos (9)</button>
            <button class="persp-pill-btn ${activeExcelFilter === 'aprendizaje' ? 'active' : ''}" data-filter-persp="aprendizaje">📚 Aprendizaje (9)</button>
          </div>
          <div class="view-tabs">
            <button class="view-tab ${dashboardViewMode === 'matriz' ? 'active' : ''}" data-view="matriz">📋 Tabla de Indicadores</button>
            <button class="view-tab ${dashboardViewMode === 'cuadrantes' ? 'active' : ''}" data-view="cuadrantes">▦ Cuadrantes BSC</button>
            <button class="view-tab ${dashboardViewMode === 'graficos' ? 'active' : ''}" data-view="graficos">📈 Gráficos</button>
          </div>
        </div>

        <div class="toolbar-search-row">
          <div class="search-input-wrap">
            <span class="search-icon-fixed">⌕</span>
            <input type="search" id="kpiSearchInput" value="${escapeHtml(kpiSearchTerm)}" placeholder="Buscar KPI por código, nombre, objetivo, líder responsable...">
          </div>
          <div class="status-filters">
            <button class="status-pill-btn ${!activeStatusFilter ? 'active' : ''}" data-filter-status="">Todos</button>
            <button class="status-pill-btn ${activeStatusFilter === 'good' ? 'active' : ''}" data-filter-status="good">✅ Logrados (${g.logrado})</button>
            <button class="status-pill-btn ${activeStatusFilter === 'warn' ? 'active' : ''}" data-filter-status="warn">⚠️ En Riesgo (${g.riesgo})</button>
            <button class="status-pill-btn ${activeStatusFilter === 'bad' ? 'active' : ''}" data-filter-status="bad">❌ Críticos (${g.critico})</button>
          </div>
          <select id="dashFilterResp" class="filter-select" style="min-width:210px">
            <option value="">-- Todos los Responsables (${res.responsibles.length}) --</option>
            ${res.responsibles.map(r => `<option value="${escapeHtml(r.responsible)}" ${activeRespFilter === r.responsible ? 'selected' : ''}>${escapeHtml(r.responsible)} (${escapeHtml(r.responsible_area)})</option>`).join("")}
          </select>
          ${(activeExcelFilter || activeStatusFilter || kpiSearchTerm || activeRespFilter) ? `<button class="btn small soft" id="btnClearAllFilters">✕ Limpiar filtros</button>` : ""}
        </div>
      </section>

      <!-- CONTENIDO PRINCIPAL SEGÚN MODO SELECCIONADO -->
      <section id="dashboardMainArea">${contentHtml}</section>
    `;

    bindDashboardEvents();
    if (dashboardViewMode === "graficos") {
      drawPerspectiveChart(res.perspectives);
      drawTrendChart(res.trend);
    }
  }

  function renderModernKpiTable(kpis) {
    if (!kpis.length) {
      return `
        <div class="empty-state" style="padding:48px 24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">🔍</div>
          <h3 style="margin:0 0 6px;color:#1e293b">No se encontraron indicadores</h3>
          <p style="color:#64748b;font-size:12px;margin:0 0 16px">Ningún KPI coincide con los criterios de búsqueda o filtros seleccionados.</p>
          <button class="btn small primary" id="btnResetFiltersEmpty">Restablecer filtros</button>
        </div>
      `;
    }

    const rows = kpis.map(k => {
      const pct = Number(k.compliance_pct);
      const statusClass = pct >= 90 ? 'good' : (pct >= 75 ? 'warn' : 'bad');
      const barFillClass = pct >= 90 ? 'good' : (pct >= 75 ? 'warn' : 'bad');

      return `
        <tr>
          <td>
            <div class="kpi-title-block">
              <strong>${escapeHtml(k.id)} — ${escapeHtml(k.name)}</strong>
              <small>${escapeHtml(k.objective_full_name || k.objective_name || '')}</small>
            </div>
          </td>
          <td>
            <span class="persp-tag ${k.perspective_id}">
              ${escapeHtml(k.perspective_name || k.perspective_id)}
            </span>
          </td>
          <td>
            ${renderRespChip(k.responsible, k.responsible_area)}
          </td>
          <td style="white-space:nowrap">
            <b>${fmt(k.target)}</b> <small class="muted">${escapeHtml(k.unit)}</small>
          </td>
          <td style="white-space:nowrap">
            <button class="kpi-num-btn" data-action="quick-measure" data-id="${escapeHtml(k.id)}" title="Haz clic para registrar nueva medición en SQLite">
              ${fmt(k.current_real)} ✎
            </button>
          </td>
          <td>
            <div class="kpi-prog-wrap">
              <div class="kpi-prog-bar">
                <div class="fill ${barFillClass}" style="width:${Math.min(100, Math.max(5, pct))}%"></div>
              </div>
              <strong style="color:${pct >= 90 ? '#15803d' : (pct >= 75 ? '#b45309' : '#b91c1c')};font-size:11.5px">
                ${fmt(pct)}%
              </strong>
            </div>
          </td>
          <td>
            <span class="kpi-status-badge ${statusClass}">
              ${escapeHtml(k.status)}
            </span>
          </td>
          <td style="max-width:240px;font-size:11px;color:#475569;line-height:1.4">
            ${escapeHtml(k.action_recommended)}
          </td>
          <td>
            <button class="btn small soft" data-action="quick-measure" data-id="${escapeHtml(k.id)}" title="Registrar resultado">
              + Medir
            </button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="modern-table-panel">
        <div class="modern-table-header-info">
          <div>
            <strong style="font-size:13px;color:#0f172a">Matriz Oficial de Indicadores (${kpis.length} KPIs evaluados)</strong>
            <p style="font-size:11px;color:#64748b;margin:2px 0 0">Datos oficiales almacenados en base de datos SQLite · Haz clic en el valor con ✎ o en "+ Medir" para actualizar cualquier resultado.</p>
          </div>
          <span class="tag" style="background:#eff6ff;color:#1d4ed8;font-weight:700">Base de Datos Activa</span>
        </div>
        <div class="table-scroll">
          <table class="modern-kpi-table">
            <thead>
              <tr>
                <th style="min-width:250px">Indicador & Objetivo</th>
                <th>Perspectiva</th>
                <th>Líder Responsable</th>
                <th>Meta</th>
                <th>Real Actual</th>
                <th style="min-width:140px">Progreso</th>
                <th>Estado</th>
                <th style="min-width:220px">Acción / Recomendación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderQuadrants(perspectives) {
    return `
    <div class="quadrant-grid">
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
                    <td><strong class="result-value">${fmt(k.current_real)}</strong></td>
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

  function renderChartsBlock(perspectives, trend) {
    return `
    <div class="grid dashboard-grid">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Cumplimiento por Perspectiva del BSC</h2>
            <p>Promedio de cumplimiento por perspectiva</p>
          </div>
        </div>
        ${window.Chart ? '<div class="chart-wrap"><canvas id="perspChart" role="img" aria-label="Cumplimiento por perspectiva. Datos en la tabla siguiente."></canvas></div>' : '<p class="chart-unavailable">Gráfico no disponible. Puedes consultar todos los datos en la tabla.</p>'}
        <details ${!window.Chart ? 'open' : ''}><summary>Consultar datos por perspectiva</summary><div class="table-scroll"><table><thead><tr><th>Perspectiva</th><th>Cumplimiento</th></tr></thead><tbody>${perspectives.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${fmt(p.avg_pct)}%</td></tr>`).join('')}</tbody></table></div></details>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Tendencia Histórica de Cumplimiento</h2>
            <p>Evolución de mediciones registradas en el período</p>
          </div>
        </div>
        ${window.Chart && trend.length ? '<div class="chart-wrap"><canvas id="trendChart" role="img" aria-label="Tendencia de cumplimiento. Datos en la tabla siguiente."></canvas></div>' : '<p class="chart-unavailable">Consulta las mediciones históricas en la tabla.</p>'}
        <details ${!window.Chart ? 'open' : ''}><summary>Consultar datos históricos</summary><div class="table-scroll"><table><thead><tr><th>Período</th><th>Fecha</th><th>Cumplimiento</th></tr></thead><tbody>${trend.map(t => `<tr><td>${escapeHtml(t.period)}</td><td>${escapeHtml(t.date)}</td><td>${fmt(t.avg_pct)}%</td></tr>`).join('')}</tbody></table></div></details>
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
        scales: { y: { beginAtZero: true, suggestedMax: 100 } }
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
        scales: { y: { beginAtZero: true, suggestedMax: 100 } }
      }
    });
  }

  function bindDashboardEvents() {
    $('#btnExportDashCSV').onclick = () => { location.href = 'api/reports.php?action=export_csv'; };
    $('#btnNewMeasurement').onclick = () => runAction(() => openMeasurementModal());

    // Tarjetas de perspectiva
    $$('[data-persp-card]').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.perspCard;
        activeExcelFilter = (activeExcelFilter === id) ? null : id;
        renderCurrentPage();
      };
    });

    // Pills de perspectiva
    $$('[data-filter-persp]').forEach(btn => {
      btn.onclick = () => {
        activeExcelFilter = btn.dataset.filterPersp || null;
        renderCurrentPage();
      };
    });

    // Filtros de estado
    $$('[data-filter-status]').forEach(btn => {
      btn.onclick = () => {
        activeStatusFilter = btn.dataset.filterStatus || null;
        renderCurrentPage();
      };
    });

    // Búsqueda en vivo
    const searchInput = $('#kpiSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        kpiSearchTerm = e.target.value;
        const mainArea = $('#dashboardMainArea');
        if (dashboardViewMode === 'matriz' && currentDashboardData) {
          let list = currentDashboardData.all_kpis;
          if (activeExcelFilter) list = list.filter(k => k.perspective_id === activeExcelFilter);
          if (activeStatusFilter) {
            list = list.filter(k => {
              const p = Number(k.compliance_pct);
              if (activeStatusFilter === 'good') return p >= 90;
              if (activeStatusFilter === 'warn') return p >= 75 && p < 90;
              if (activeStatusFilter === 'bad') return p < 75;
              return true;
            });
          }
          if (kpiSearchTerm) {
            const q = kpiSearchTerm.toLowerCase();
            list = list.filter(k => 
              k.name.toLowerCase().includes(q) ||
              k.id.toLowerCase().includes(q) ||
              (k.objective_name && k.objective_name.toLowerCase().includes(q)) ||
              (k.responsible && k.responsible.toLowerCase().includes(q)) ||
              (k.responsible_area && k.responsible_area.toLowerCase().includes(q))
            );
          }
          mainArea.innerHTML = renderModernKpiTable(list);
          mainArea.querySelectorAll('[data-action="quick-measure"]').forEach(b => {
            b.onclick = () => runAction(() => openMeasurementModal(b.dataset.id));
          });
          if ($('#btnResetFiltersEmpty')) {
            $('#btnResetFiltersEmpty').onclick = () => {
              activeExcelFilter = null;
              activeStatusFilter = null;
              kpiSearchTerm = "";
              renderCurrentPage();
            };
          }
        }
      };
    }

    // Filtro por responsable
    const respSelect = $('#dashFilterResp');
    if (respSelect) {
      respSelect.onchange = (e) => {
        activeRespFilter = e.target.value || null;
        renderCurrentPage();
      };
    }

    // Botones de reseteo de filtros
    if ($('#btnResetPerspFilter')) {
      $('#btnResetPerspFilter').onclick = () => { activeExcelFilter = null; renderCurrentPage(); };
    }
    if ($('#btnClearAllFilters')) {
      $('#btnClearAllFilters').onclick = () => {
        activeExcelFilter = null;
        activeStatusFilter = null;
        kpiSearchTerm = "";
        activeRespFilter = null;
        renderCurrentPage();
      };
    }
    if ($('#btnResetFiltersEmpty')) {
      $('#btnResetFiltersEmpty').onclick = () => {
        activeExcelFilter = null;
        activeStatusFilter = null;
        kpiSearchTerm = "";
        activeRespFilter = null;
        renderCurrentPage();
      };
    }

    // Pestañas de modo de vista
    $$('[data-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.view === dashboardViewMode));
      button.onclick = () => { dashboardViewMode = button.dataset.view; renderCurrentPage(); };
    });

    // Medición rápida en botones
    $("#pageContent").querySelectorAll('[data-action="quick-measure"]').forEach(button => {
      button.onclick = () => runAction(() => openMeasurementModal(button.dataset.id));
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
    $("#btnNewObj")?.addEventListener("click", () => runAction(() => openObjectiveForm()));
    $$("[data-action='obj-detail']").forEach(btn => {
      btn.addEventListener("click", () => runAction(() => showObjectiveDetail(btn.dataset.id)));
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

    $("#btnCreateObj")?.addEventListener("click", () => runAction(() => openObjectiveForm()));
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
      if (!list.length) return `<tr><td colspan="9" class="empty-cell">No se encontraron objetivos.</td></tr>`;
      return list.map(o => `
        <tr>
          <td><span class="code">${escapeHtml(o.id)}</span></td>
          <td><strong>${escapeHtml(o.name)}</strong></td>
          <td><span class="tag">${escapeHtml(o.perspective_name)}</span></td>
          <td><strong>${escapeHtml(o.leader || 'Dirección General')}</strong></td>
          <td class="text-center">${o.kpi_count}</td>
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
      $$("[data-action='view-obj']").forEach(b => b.onclick = () => runAction(() => showObjectiveDetail(b.dataset.id)));
      $$("[data-action='edit-obj']").forEach(b => b.onclick = () => runAction(() => openObjectiveForm(b.dataset.id)));
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

    $("#btnCreateKpi")?.addEventListener("click", () => runAction(() => openKpiForm()));
    $("#kpiSearch")?.addEventListener("input", filterKpiTable);
    $("#kpiFilterPersp")?.addEventListener("change", filterKpiTable);
    $("#kpiFilterResp")?.addEventListener("change", filterKpiTable);
    $("#kpiFilterStatus")?.addEventListener("change", filterKpiTable);
    bindKpiActions();
    if (pendingKpiStatus) { $("#kpiFilterStatus").value = pendingKpiStatus; pendingKpiStatus = ""; filterKpiTable(); }

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
      if (!list.length) return `<tr><td colspan="10" class="empty-cell">No se encontraron indicadores con los filtros aplicados.</td></tr>`;
      return list.map(k => {
        const sClass = (k.compliance_pct >= 90) ? "good" : (k.compliance_pct >= 75) ? "warn" : "bad";
        return `
        <tr>
          <td><span class="code">${escapeHtml(k.id)}</span></td>
          <td><strong>${escapeHtml(k.name)}</strong></td>
          <td>${renderRespChip(k.responsible, k.responsible_area)}</td>
          <td><span class="tag">${escapeHtml(k.responsible_area || k.perspective_name)}</span></td>
          <td class="text-right"><strong>${fmt(k.target)}</strong> <small class="muted">${escapeHtml(k.unit)}</small></td>
          <td class="text-right"><strong class="result-value">${fmt(k.current_real)}</strong></td>
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
      $$("[data-action='measure-kpi']").forEach(b => b.onclick = () => runAction(() => openMeasurementModal(b.dataset.id)));
      $$("[data-action='edit-kpi']").forEach(b => b.onclick = () => runAction(() => openKpiForm(b.dataset.id)));
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

      <div class="section-space grid split-grid">
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
              <input type="date" id="directMeasureDate" value="${today()}" required>
            </div>
            <div class="field full-span">
              <label>Valor Real Obtenido *</label>
              <input type="number" step="any" id="directMeasureValue" placeholder="Ej: 19.8" required>
            </div>
            <div class="field full-span">
              <label>Observaciones / Análisis de Acción</label>
              <textarea id="directMeasureNotes" placeholder="Detalle de causas o acciones correctivas ejecutadas..."></textarea>
            </div>
            <div class="text-right full-span">
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
          <div class="space-below info-box">
            <strong>KPIs Directos (Mayor = Mejor):</strong><br>
            Cumplimiento = (Real / Meta) × 100
          </div>
          <div class="space-below info-box">
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
                  <td><strong class="result-value">${fmt(m.value)} ${escapeHtml(m.kpi_unit)}</strong></td>
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
    $("#btnOpenNewMeasure")?.addEventListener("click", () => runAction(() => openMeasurementModal()));
    $("#directMeasureForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const button = e.currentTarget.querySelector('button[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
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
        renderCurrentPage();
      } catch (err) {} finally { button.disabled = false; }
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

    $("#btnCreateInit")?.addEventListener("click", () => runAction(() => openInitiativeForm()));
    $$("[data-action='edit-init']").forEach(b => b.onclick = () => runAction(() => openInitiativeForm(b.dataset.id)));
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

      <div class="report-grid grid">
        <div class="panel">
          <h3>Resumen Oficial de Indicadores</h3>
          <p>Exporta los 36 indicadores organizados por perspectiva con responsables, fórmulas, metas y valores reales.</p>
          <button class="space-above btn soft full" id="btnCardCSV">Descargar CSV con UTF-8 BOM</button>
        </div>
        <div class="panel">
          <h3>Reporte de Objetivos Críticos</h3>
          <p>Identifica brechas de cumplimiento inferiores al 75% para la toma de decisiones del directorio.</p>
          <button class="space-above btn soft full" data-action="filter-crit">Ver KPIs Críticos (${res.critical_kpis.length})</button>
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
      <div class="section-space panel">
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
    $$("[data-action='filter-crit']").forEach(b => b.onclick = () => { pendingKpiStatus = "bad"; navigate("kpis"); });
  }

  // 8. ADMINISTRACIÓN
  async function renderAdmin(container) {
    const usersRes = await apiFetch("api/admin.php?action=users");
    const periodsRes = await apiFetch("api/admin.php?action=periods");
    const actRes = await apiFetch("api/admin.php?action=activity");

    container.innerHTML = `
      ${pageHead("Administración del Sistema", "Gestión de usuarios, períodos, registro de auditoría y base de datos.", "")}
      <div class="section-grid grid admin-grid">
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
            <div class="space-below info-box">
              <strong>Restaurar Datos Oficiales del Balanced Scorecard:</strong><br>
              Restaura los 12 objetivos, los 36 KPIs y los responsables oficiales del Balanced Scorecard de TechPeru SAC (2025).
            </div>
            <button class="btn danger full" id="btnResetDB">🔄 Restaurar Base de Datos del BSC (Valores Oficiales 2025)</button>
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
      if (confirm("¿Estás seguro de restablecer la base de datos a los valores oficiales del Balanced Scorecard de TechPeru SAC 2025?")) {
        try {
          const r = await apiFetch("api/admin.php?action=reset", { method: "POST" });
          toast(r.message);
          renderCurrentPage();
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
    $("#modalBody").innerHTML = '<p id="modalError" role="alert" class="form-error hidden"></p>' + bodyHtml;
    $("#modalFooter").innerHTML = `
      <button class="btn" id="modalCancelBtn">Cancelar</button>
      ${confirmText ? `<button class="btn primary" id="modalConfirmBtn">${escapeHtml(confirmText)}</button>` : ""}
    `;
    modalReturnFocus = document.activeElement;
    $("#modalLayer").classList.remove("hidden");
    $("#appView").inert = true;
    enhanceContent($("#modalBody"));
    requestAnimationFrame(() => ($('#modalBody input, #modalBody select') || $('#modalClose')).focus());

    $("#modalCancelBtn")?.addEventListener("click", closeModal);
    const confirm = async () => {
      const form = $('#modalBody form');
      if (form && !form.reportValidity()) return;
      const button = $('#modalConfirmBtn');
      if (!button || button.disabled) return;
      button.disabled = true;
      $('#modalError').classList.add('hidden');
      try { await onConfirm(); } catch (e) { /* apiFetch displays the error */ }
      finally { button.disabled = false; }
    };
    $('#modalConfirmBtn')?.addEventListener('click', confirm);
    $('#modalBody form')?.addEventListener('submit', e => { e.preventDefault(); confirm(); });
  }

  function trapFocus(event, root) {
    const elements = $$('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]', root).filter(element => element.getClientRects().length);
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  function closeModal() {
    $("#modalLayer").classList.add("hidden");
    $("#appView").inert = false;
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
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
              <td><strong class="result-value">${fmt(k.current_real)}</strong></td>
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
          toast("✓ Objetivo actualizado.");
        } else {
          await apiFetch("api/objectives.php", {
            method: "POST",
            body: { id: formId, perspective_id: formPersp, name: formName, leader: formLeader, description: formDesc }
          });
          toast("✓ Objetivo creado.");
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
          toast("✓ Indicador actualizado.");
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
          toast("✓ Indicador creado.");
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
    if (!kpisRes.kpis.length) { toast("Crea un indicador antes de registrar mediciones.", "error"); return; }
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
          <input type="date" id="modalMeasureDate" value="${today()}" required>
        </div>
        <div class="field full-span">
          <label>Valor Real Obtenido *</label>
          <input type="number" step="any" id="modalMeasureVal" value="${kpi?.current_real ?? ''}" autofocus required>
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
        toast(`✓ Medición registrada. Nuevo cumplimiento: ${res.compliance_pct}%.`);
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
        <div class="field"><label>Fecha de inicio</label><input type="date" id="formInitStart" required value="${escapeHtml(init.start_date || today())}"></div>
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
          <input type="number" min="0" step="any" required id="formInitBudget" value="${init.budget}">
        </div>
        <div class="field">
          <label>% Avance</label>
          <input type="number" min="0" max="100" step="any" required id="formInitProgress" value="${init.progress_pct}">
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
          toast("✓ Iniciativa actualizada.");
        } else {
          await apiFetch("api/initiatives.php", {
            method: "POST",
            body: { objective_id: objId, kpi_id: kpiId, start_date: startDate, end_date: endDate, name, leader, budget, progress_pct: progress, status }
          });
          toast("✓ Iniciativa creada.");
        }
        closeModal();
        renderCurrentPage();
      } catch (e) {}
    });
    const filterLinkedKpis = () => {
      const select = $('#formInitKpi');
      const previous = select.value;
      select.innerHTML = '<option value="">Sin indicador</option>' + kpisRes.kpis
       .filter(kpi => kpi.objective_id === $('#formInitObj').value)
       .map(kpi => `<option value="${escapeHtml(kpi.id)}">${escapeHtml(kpi.id)} — ${escapeHtml(kpi.name)}</option>`).join('');
      select.value = [...select.options].some(option => option.value === previous) ? previous : '';
    };
    filterLinkedKpis();
    $('#formInitObj').addEventListener('change', filterLinkedKpis);
    $('#formInitStart').addEventListener('change', () => { $('#formInitEnd').min = $('#formInitStart').value; });
    $('#formInitEnd').min = $('#formInitStart').value;
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
    $$('table', root).forEach(table => {
      if (!table.closest('.table-scroll')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll';
        table.before(wrapper); wrapper.append(table);
      }
    });
    $$('.table-scroll', root).forEach(wrapper => {
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      const title = wrapper.closest('.panel,.table-panel')?.querySelector('h2, h3')?.textContent || pageTitles[currentPage];
      wrapper.setAttribute('aria-label', `Tabla: ${title}. Desplázate horizontalmente para ver todas las columnas.`);
    });
    $$('select', root).forEach(select => {
      if (!select.labels?.length) select.setAttribute('aria-label', select.options[0]?.textContent || 'Seleccionar filtro');
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
      if ($('#modalLayer').classList.contains('hidden')) {
        if ($('#sidebar').classList.contains('open')) {
          if (e.key === 'Escape') setSidebar(false);
          if (e.key === 'Tab') trapFocus(e, $('#sidebar'));
        }
        return;
      }
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') trapFocus(e, $('#modalLayer'));
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

    $('#menuToggle').addEventListener('click', () => setSidebar(!$('#sidebar').classList.contains('open')));
    $('#sidebarClose').addEventListener('click', () => setSidebar(false));
    $('#sidebarBackdrop').addEventListener('click', () => setSidebar(false));
    matchMedia('(max-width: 800px)').addEventListener('change', () => setSidebar(false));
    setSidebar(false);

    // Modal close
    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modalLayer")?.addEventListener("click", e => {
      if (e.target.id === "modalLayer") closeModal();
    });

    // Notificaciones popup
    $("#notificationsBtn")?.addEventListener("click", () => runAction(async () => {
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
    }));
    document.addEventListener('click', event => {
      const pop = $('.notification-pop');
      if (pop && !pop.contains(event.target) && !event.target.closest('#notificationsBtn')) pop.remove();
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
