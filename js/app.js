import { createApiClient } from './api.js';
import { $, $$, escapeHtml, fmt, currency, today } from './core.js';
import { createBoticaModule } from './botica.js';

/**
 * TECHPERU SAC — BALANCED SCORECARD 2025 & GESTIÓN INTEGRAL DE BOTICA
 * Frontend conectado a Backend PHP 8.3 & SQLite
 * Soporte completo para Farmacia, POS, Lotes FEFO, Caja, Facturación y BSC Histórico
 */
(() => {
  "use strict";

  let currentUser = null;
  let modalReturnFocus = null;
  let currentPage = "botica_dashboard";
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

  // ========================================================
  // SISTEMA DE ICONOS LUCIDE SVG PROFESIONAL
  // ========================================================
  const ICONS = {
    dashboard: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
    map: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>`,
    target: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    kpi: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
    measure: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>`,
    initiatives: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
    reports: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>`,
    admin: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    bell: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    collapse: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>`,
    expand: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m13 9 3 3-3 3"/></svg>`,
    edit: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    logout: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
    search: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    download: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    plus: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    users: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    gauge: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
    activity: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    check: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
    alert: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
    danger: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>`,
    table: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`,
    quadrants: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
    chart: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
    financiera: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    clientes: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    procesos: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    aprendizaje: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    globe: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    x: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>`
  };

  const perspectives = {
    financiera: { label: "Financiera", title: "PERSPECTIVA FINANCIERA", color: "#1d4ed8", soft: "#eff6ff", iconKey: "financiera", icon: ICONS.financiera },
    clientes: { label: "Clientes", title: "PERSPECTIVA DE CLIENTES", color: "#0d9488", soft: "#f0fdf4", iconKey: "clientes", icon: ICONS.clientes },
    procesos: { label: "Procesos internos", title: "PERSPECTIVA DE PROCESOS INTERNOS", color: "#6366f1", soft: "#f5f3ff", iconKey: "procesos", icon: ICONS.procesos },
    aprendizaje: { label: "Aprendizaje y crecimiento", title: "PERSPECTIVA DE APRENDIZAJE Y CRECIMIENTO", color: "#d97706", soft: "#fffbeb", iconKey: "aprendizaje", icon: ICONS.aprendizaje }
  };

  const pageTitles = {
    botica_dashboard: "Dashboard de Botica",
    botica_pos: "Terminal Punto de Venta (POS)",
    botica_productos: "Medicamentos y Catálogo",
    botica_lotes: "Control de Lotes y FEFO",
    botica_kardex: "Kardex de Movimientos",
    botica_compras: "Compras y Recepción",
    botica_clientes: "Directorio de Clientes",
    botica_caja: "Caja y Arqueo de Turno",
    botica_comprobantes: "Comprobantes Emitidos",
    botica_reportes: "Reportes de Botica",
    botica_config: "Configuración y MediZano",
    dashboard: "Dashboard ejecutivo (BSC)",
    mapa: "Mapa estratégico (BSC)",
    objetivos: "Objetivos estratégicos",
    kpis: "Indicadores (KPI)",
    mediciones: "Registro de resultados",
    iniciativas: "Iniciativas estratégicas",
    reportes: "Reportes (BSC)",
    administracion: "Configuración BSC"
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

  const botica = createBoticaModule(apiFetch, toast);
  window.navigateToPage = (p) => navigate(p);

  function pageHead(title, subtitle, actionsHtml = "") {
    return `
    <div class="page-head modern-page-head">
      <div class="page-head-titles">
        <div class="page-head-badge"><span class="badge-dot"></span> PLAN ESTRATÉGICO OFICIAL · TECHPERU SAC 2025</div>
        <h1 class="page-title">${escapeHtml(title)}</h1>
        <p class="page-subtitle">${escapeHtml(subtitle)}</p>
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
      <div class="resp-chip" title="${escapeHtml(name)} · ${escapeHtml(area || '')}">
        <span class="resp-avatar">${escapeHtml(ini)}</span>
        <div class="resp-details">
          <span class="resp-name">${escapeHtml(name)}</span>
          ${area ? `<span class="resp-area">${escapeHtml(area)}</span>` : ''}
        </div>
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

  function updateUserUI(user) {
    if (!user) return;
    const nameEl1 = $("#sideUserName");
    const nameEl2 = $("#topUserName");
    const roleEl1 = $("#sideUserRole");
    const roleEl2 = $("#topUserRole");
    if (nameEl1) nameEl1.textContent = user.name;
    if (nameEl2) nameEl2.textContent = user.name;
    if (roleEl1) roleEl1.textContent = user.role;
    if (roleEl2) roleEl2.textContent = user.role;

    const sideAv = $("#sideUserAvatar");
    const topAv = $("#topUserAvatar");
    if (user.avatar) {
      if (sideAv) sideAv.innerHTML = `<img src="${escapeHtml(user.avatar)}" class="avatar-img" alt="Foto">`;
      if (topAv) topAv.innerHTML = `<img src="${escapeHtml(user.avatar)}" class="avatar-img" alt="Foto">`;
    } else {
      const initials = getInitials(user.name);
      if (sideAv) sideAv.textContent = initials;
      if (topAv) topAv.textContent = initials;
    }
  }

  function applySystemSettings(settings) {
    if (!settings) return;
    if (settings.company_name) {
      const b1 = $("#sideBrandTitle");
      const b2 = $("#breadcrumbOrg");
      const b3 = $("#orgSwitchName");
      if (b1) b1.textContent = settings.company_name;
      if (b2) b2.textContent = settings.company_name;
      if (b3) b3.textContent = settings.company_name;
    }
    if (settings.bsc_title && $("#sideBrandSubtitle")) {
      $("#sideBrandSubtitle").textContent = settings.bsc_title;
    }
    if (settings.strategic_period && $("#topPeriodTag")) {
      $("#topPeriodTag").textContent = settings.strategic_period;
    }
  }

  function toggleSidebarCollapse() {
    const sidebar = $('#sidebar');
    const shell = $('#appView');
    if (!sidebar) return;
    const isCollapsed = sidebar.classList.toggle('collapsed');
    shell?.classList.toggle('sidebar-collapsed', isCollapsed);
    const btn = $('#sidebarCollapseBtn');
    if (btn) btn.innerHTML = isCollapsed ? ICONS.expand : ICONS.collapse;
    try { localStorage.setItem('bsc_sidebar_collapsed', isCollapsed ? '1' : '0'); } catch (e) {}
  }

  function showApp() {
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    updateUserUI(currentUser);
    $("[data-page='administracion']").classList.toggle('hidden', currentUser?.role !== 'Administrador');
    if (currentPage === 'administracion' && currentUser?.role !== 'Administrador') currentPage = 'dashboard';

    // Siempre iniciar en modo expandido en escritorio con nombres e iconos visibles
    $('#sidebar')?.classList.remove('collapsed');
    $('#appView')?.classList.remove('sidebar-collapsed');
    const collapseBtn = $('#sidebarCollapseBtn');
    if (collapseBtn) collapseBtn.innerHTML = ICONS.collapse;
    try { localStorage.removeItem('bsc_sidebar_collapsed'); } catch (e) {}

    // Load system settings
    apiFetch("api/admin.php?action=settings").then(r => {
      if (r && r.settings) applySystemSettings(r.settings);
    }).catch(() => {});

    navigate(currentPage);
  }

  function showLogin() {
    closeModal();
    setSidebar(false);
    destroyCharts();
    $('.notification-pop')?.remove();
    $('#pageContent').replaceChildren();
    const u = $('#loginUser');
    const p = $('#loginPass');
    if (u && !u.value) u.value = 'admin@demo.com';
    if (p && !p.value) p.value = 'BSC2026!';
    $("#appView").classList.add("hidden");
    $("#loginView").classList.remove("hidden");
  }

  function setSidebar(open) {
    const mobile = matchMedia('(max-width: 768px)').matches;
    const sidebar = $('#sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('open', mobile && open);
    sidebar.inert = mobile && !open;
    sidebar.setAttribute('aria-hidden', String(mobile && !open));
    $('#menuToggle')?.setAttribute('aria-expanded', String(mobile && open));
    $('#sidebarBackdrop')?.classList.toggle('hidden', !mobile || !open);
    $('.main-column')?.setAttribute('aria-hidden', String(mobile && open));
    document.body.classList.toggle('sidebar-open', mobile && open);
    if (mobile && open) $('#sidebarClose')?.focus();
    else if (mobile && sidebar.contains(document.activeElement)) $('#menuToggle')?.focus();
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
      case "botica_dashboard": await botica.renderBoticaDashboard(main); break;
      case "botica_pos": await botica.renderBoticaPos(main); break;
      case "botica_productos": await botica.renderBoticaProductos(main); break;
      case "botica_lotes": await botica.renderBoticaLotes(main); break;
      case "botica_kardex": await botica.renderBoticaKardex(main); break;
      case "botica_compras": await botica.renderBoticaCompras(main); break;
      case "botica_clientes": await botica.renderBoticaClientes(main); break;
      case "botica_caja": await botica.renderBoticaCaja(main); break;
      case "botica_comprobantes": await botica.renderBoticaComprobantes(main); break;
      case "botica_reportes": await botica.renderBoticaReportes(main); break;
      case "botica_config": await botica.renderBoticaConfig(main); break;
      case "dashboard": await renderDashboard(main); break;
      case "mapa": await renderMap(main); break;
      case "objetivos": await renderObjectives(main); break;
      case "kpis": await renderKpis(main); break;
      case "mediciones": await renderMeasurements(main); break;
      case "iniciativas": await renderInitiatives(main); break;
      case "reportes": await renderReports(main); break;
      case "administracion": await renderAdmin(main); break;
      default: await botica.renderBoticaDashboard(main); break;
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
      { id: 'financiera', name: 'Financiera', iconKey: 'financiera', color: '#1d4ed8', softColor: '#eff6ff', tagClass: 'financiera' },
      { id: 'clientes', name: 'Clientes', iconKey: 'clientes', color: '#0d9488', softColor: '#f0fdf4', tagClass: 'clientes' },
      { id: 'procesos', name: 'Procesos Internos', iconKey: 'procesos', color: '#6366f1', softColor: '#f5f3ff', tagClass: 'procesos' },
      { id: 'aprendizaje', name: 'Aprendizaje y Crecimiento', iconKey: 'aprendizaje', color: '#d97706', softColor: '#fffbeb', tagClass: 'aprendizaje' }
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
      const statusText = avg >= 90 ? 'Logrado' : (avg >= 75 ? 'En Riesgo' : 'Crítico');
      const statusKey = avg >= 90 ? 'good' : (avg >= 75 ? 'warn' : 'bad');

      return `
        <div class="persp-summary-card ${isActive ? 'active' : ''}" data-persp-card="${p.id}" style="--accent:${p.color}">
          <div class="persp-accent-top" style="background:${p.color}"></div>
          <div class="persp-card-header">
            <div class="persp-header-left">
              <span class="persp-icon-box" style="background:${p.softColor};color:${p.color}">
                ${ICONS[p.iconKey]}
              </span>
              <strong class="persp-card-title">${p.name}</strong>
            </div>
            <span class="persp-count-pill" style="background:${p.softColor};color:${p.color}">${count} KPIs</span>
          </div>
          <div class="persp-metric-row">
            <span class="persp-card-pct" style="color:${barColor}">${avg}%</span>
            <span class="status-chip ${statusKey}"><i class="dot"></i> ${statusText}</span>
          </div>
          <div class="persp-card-prog">
            <div class="persp-card-prog-fill" style="width:${Math.min(100, avg)}%;background:${barColor}"></div>
          </div>
          <div class="persp-card-meta">
            <span class="meta-objectives"><span class="meta-bullet">▪</span> 3 Objetivos Estratégicos</span>
            <span class="meta-filter-action">${isActive ? '<b class="active-badge">Filtro activo ✕</b>' : 'Clic para filtrar'}</span>
          </div>
          <div class="persp-card-breakdown">
            <span class="breakdown-pill good"><i class="dot"></i> ${goodCount} logrados</span>
            <span class="breakdown-pill warn"><i class="dot"></i> ${warnCount} riesgo</span>
            <span class="breakdown-pill bad"><i class="dot"></i> ${badCount} críticos</span>
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
        <button class="btn btn-secondary" id="btnExportDashCSV">
          ${ICONS.download} <span>Exportar Reporte CSV</span>
        </button>
        <button class="btn btn-primary" id="btnNewMeasurement">
          ${ICONS.plus} <span>Registrar Medición</span>
        </button>
      `)}

      <!-- 4 TARJETAS KPI EJECUTIVAS -->
      <section class="grid metric-grid">
        <div class="metric-card metric-card-global">
          <div class="metric-top">
            <span class="metric-label">CUMPLIMIENTO GLOBAL</span>
            <span class="metric-icon-box blue">${ICONS.gauge}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value" style="color:${g.avg_pct >= 90 ? '#16a34a' : g.avg_pct >= 75 ? '#d97706' : '#dc2626'}">
              ${fmt(g.avg_pct)}%
            </div>
            <span class="status-chip ${g.status_key}">
              <i class="dot"></i> ${g.status_text}
            </span>
          </div>
          <div class="metric-bar-wrap">
            <div class="metric-bar-fill" style="width:${Math.min(100, g.avg_pct)}%;background:${g.avg_pct >= 90 ? '#16a34a' : g.avg_pct >= 75 ? '#d97706' : '#dc2626'}"></div>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">${g.total} KPIs evaluados</span>
            <span class="metric-foot-secondary">Base SQLite activa</span>
          </div>
        </div>

        <div class="metric-card metric-card-health">
          <div class="metric-top">
            <span class="metric-label">SALUD DE INDICADORES</span>
            <span class="metric-icon-box slate">${ICONS.activity}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value">${g.total}</div>
            <span class="metric-sub-label">Total Indicadores</span>
          </div>
          <div class="metric-stacked-bar">
            <div class="stack-seg good" style="width:${(g.logrado/g.total*100).toFixed(1)}%" title="${g.logrado} Logrados"></div>
            <div class="stack-seg warn" style="width:${(g.riesgo/g.total*100).toFixed(1)}%" title="${g.riesgo} En Riesgo"></div>
            <div class="stack-seg bad" style="width:${(g.critico/g.total*100).toFixed(1)}%" title="${g.critico} Críticos"></div>
          </div>
          <div class="metric-foot-pills">
            <span class="status-chip good"><i class="dot"></i> ${g.logrado} Logrados</span>
            <span class="status-chip warn"><i class="dot"></i> ${g.riesgo} Riesgo</span>
            <span class="status-chip bad"><i class="dot"></i> ${g.critico} Críticos</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">OBJETIVOS ESTRATÉGICOS</span>
            <span class="metric-icon-box green">${ICONS.target}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value">${res.objectives.length}</div>
            <span class="status-chip neutral">100% Definidos</span>
          </div>
          <div class="metric-info-text">
            <span>Alineación estratégica transversal</span>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">4 Perspectivas BSC</span>
            <span class="metric-foot-secondary">3 por perspectiva</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">LIDERAZGO Y GESTIÓN</span>
            <span class="metric-icon-box purple">${ICONS.users}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value">${res.responsibles.length}</div>
            <span class="status-chip blue">Líderes de Área</span>
          </div>
          <div class="metric-info-text">
            <span>Rendición de cuentas continua</span>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">100% Asignación</span>
            <span class="metric-foot-secondary">Responsable asignado</span>
          </div>
        </div>
      </section>

      <!-- 4 PERSPECTIVAS ESTRATÉGICAS DEL BSC (INTERACTIVAS) -->
      <div class="section-title-row">
        <div class="section-title-left">
          <h2 class="section-heading">Perspectivas Estratégicas del Balanced Scorecard</h2>
          <span class="section-subheading">Haz clic en una tarjeta para filtrar indicadores o visualizar metas específicas</span>
        </div>
        ${activeExcelFilter ? `<button class="btn-clear-filter-pill" id="btnResetPerspFilter">${ICONS.x} <span>Quitar filtro (${activeExcelFilter})</span></button>` : ""}
      </div>
      <section class="persp-cards-grid">
        ${perspCardsHtml}
      </section>

      <!-- BARRA DE HERRAMIENTAS Y FILTROS EN 2 NIVELES -->
      <section class="modern-toolbar">
        <div class="toolbar-top-row">
          <div class="persp-filter-pills" role="tablist" aria-label="Filtrar por perspectiva">
            <button class="persp-pill-btn ${!activeExcelFilter ? 'active' : ''}" data-filter-persp="">
              ${ICONS.globe} <span>Todo el BSC</span> <span class="pill-count">${res.all_kpis.length}</span>
            </button>
            <button class="persp-pill-btn ${activeExcelFilter === 'financiera' ? 'active' : ''}" data-filter-persp="financiera">
              ${ICONS.financiera} <span>Financiera</span> <span class="pill-count">9</span>
            </button>
            <button class="persp-pill-btn ${activeExcelFilter === 'clientes' ? 'active' : ''}" data-filter-persp="clientes">
              ${ICONS.clientes} <span>Clientes</span> <span class="pill-count">9</span>
            </button>
            <button class="persp-pill-btn ${activeExcelFilter === 'procesos' ? 'active' : ''}" data-filter-persp="procesos">
              ${ICONS.procesos} <span>Procesos</span> <span class="pill-count">9</span>
            </button>
            <button class="persp-pill-btn ${activeExcelFilter === 'aprendizaje' ? 'active' : ''}" data-filter-persp="aprendizaje">
              ${ICONS.aprendizaje} <span>Aprendizaje</span> <span class="pill-count">9</span>
            </button>
          </div>
          <div class="view-tabs" role="group" aria-label="Modo de visualización">
            <button class="view-tab ${dashboardViewMode === 'matriz' ? 'active' : ''}" data-view="matriz" title="Vista Matriz Oficial">
              ${ICONS.table} <span>Tabla de Indicadores</span>
            </button>
            <button class="view-tab ${dashboardViewMode === 'cuadrantes' ? 'active' : ''}" data-view="cuadrantes" title="Vista Cuadrantes BSC">
              ${ICONS.quadrants} <span>Cuadrantes BSC</span>
            </button>
            <button class="view-tab ${dashboardViewMode === 'graficos' ? 'active' : ''}" data-view="graficos" title="Vista Gráficos Ejecutivos">
              ${ICONS.chart} <span>Gráficos</span>
            </button>
          </div>
        </div>

        <div class="toolbar-search-row">
          <div class="search-input-wrap">
            <span class="search-icon-fixed">${ICONS.search}</span>
            <input type="search" id="kpiSearchInput" class="search-input-field" value="${escapeHtml(kpiSearchTerm)}" placeholder="Buscar por código (ej. KPI-01), nombre, objetivo o líder responsable...">
            ${kpiSearchTerm ? `<button class="search-clear-btn" id="btnSearchClear" title="Limpiar búsqueda">${ICONS.x}</button>` : ""}
          </div>
          <div class="status-filters" role="group" aria-label="Filtrar por estado">
            <button class="status-pill-btn ${!activeStatusFilter ? 'active' : ''}" data-filter-status="">Todos</button>
            <button class="status-pill-btn good ${activeStatusFilter === 'good' ? 'active' : ''}" data-filter-status="good">
              <i class="dot"></i> <span>Logrados (${g.logrado})</span>
            </button>
            <button class="status-pill-btn warn ${activeStatusFilter === 'warn' ? 'active' : ''}" data-filter-status="warn">
              <i class="dot"></i> <span>En Riesgo (${g.riesgo})</span>
            </button>
            <button class="status-pill-btn bad ${activeStatusFilter === 'bad' ? 'active' : ''}" data-filter-status="bad">
              <i class="dot"></i> <span>Críticos (${g.critico})</span>
            </button>
          </div>
          <div class="filter-select-wrap">
            <select id="dashFilterResp" class="filter-select">
              <option value="">-- Todos los Responsables (${res.responsibles.length}) --</option>
              ${res.responsibles.map(r => `<option value="${escapeHtml(r.responsible)}" ${activeRespFilter === r.responsible ? 'selected' : ''}>${escapeHtml(r.responsible)} (${escapeHtml(r.responsible_area)})</option>`).join("")}
            </select>
          </div>
          ${(activeExcelFilter || activeStatusFilter || kpiSearchTerm || activeRespFilter) ? `
            <button class="btn-clear-all" id="btnClearAllFilters" title="Limpiar todos los filtros">
              ${ICONS.x} <span>Limpiar filtros</span>
            </button>
          ` : ""}
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
        <div class="modern-table-panel empty-panel">
          <div class="empty-icon-box">${ICONS.search}</div>
          <h3 class="empty-title">No se encontraron indicadores</h3>
          <p class="empty-subtitle">Ningún KPI coincide con los criterios de búsqueda o filtros seleccionados.</p>
          <button class="btn primary small" id="btnResetFiltersEmpty">Restablecer filtros</button>
        </div>
      `;
    }

    const rows = kpis.map(k => {
      const pct = Number(k.compliance_pct);
      const statusClass = pct >= 90 ? 'good' : (pct >= 75 ? 'warn' : 'bad');
      const barFillColor = pct >= 90 ? '#16a34a' : (pct >= 75 ? '#d97706' : '#dc2626');
      const statusLabel = pct >= 90 ? 'Logrado' : (pct >= 75 ? 'En Riesgo' : 'Crítico');

      return `
        <tr class="modern-table-row">
          <td class="col-indicator">
            <div class="kpi-title-block">
              <div class="kpi-meta-tags">
                <span class="kpi-code-pill">${escapeHtml(k.id)}</span>
                ${k.objective_id ? `<span class="kpi-obj-pill">${escapeHtml(k.objective_id)}</span>` : ''}
              </div>
              <strong class="kpi-headline">${escapeHtml(k.name)}</strong>
              <small class="kpi-objective-desc">${escapeHtml(k.objective_full_name || k.objective_name || '')}</small>
            </div>
          </td>
          <td class="col-perspective">
            <span class="persp-tag ${k.perspective_id}">
              ${escapeHtml(k.perspective_name || k.perspective_id)}
            </span>
          </td>
          <td class="col-responsible">
            ${renderRespChip(k.responsible, k.responsible_area)}
          </td>
          <td class="col-target">
            <span class="target-number">${fmt(k.target)}</span>
            <span class="unit-badge">${escapeHtml(k.unit)}</span>
          </td>
          <td class="col-current-real">
            <button class="kpi-num-btn" data-action="quick-measure" data-id="${escapeHtml(k.id)}" title="Haz clic para registrar nueva medición en SQLite">
              <span class="num-val">${fmt(k.current_real)}</span>
              <span class="edit-icon">${ICONS.edit}</span>
            </button>
          </td>
          <td class="col-progress">
            <div class="kpi-prog-wrap">
              <div class="kpi-prog-bar">
                <div class="kpi-prog-fill" style="width:${Math.min(100, Math.max(5, pct))}%;background:${barFillColor}"></div>
              </div>
              <strong class="prog-pct" style="color:${barFillColor}">
                ${fmt(pct)}%
              </strong>
            </div>
          </td>
          <td class="col-status">
            <span class="kpi-status-badge ${statusClass}">
              <i class="dot"></i> ${statusLabel}
            </span>
          </td>
          <td class="col-action-rec">
            <div class="action-rec-box" title="${escapeHtml(k.action_recommended || '')}">
              ${escapeHtml(k.action_recommended || 'Monitoreo activo.')}
            </div>
          </td>
          <td class="col-action-btn">
            <button class="btn-table-measure" data-action="quick-measure" data-id="${escapeHtml(k.id)}" title="Registrar resultado en SQLite">
              ${ICONS.plus} <span>Medir</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="modern-table-panel">
        <div class="modern-table-header-info">
          <div class="header-info-titles">
            <div class="header-badge-row">
              <strong class="panel-main-title">Matriz Oficial de Indicadores</strong>
              <span class="badge-sqlite-live"><i class="pulse-dot"></i> Base SQLite Activa</span>
            </div>
            <p class="panel-sub-desc">
              Mostrando <b>${kpis.length}</b> indicadores. Haz clic sobre el valor numérico ✎ o en el botón "Medir" para registrar una actualización.
            </p>
          </div>
          <div class="header-info-badges">
            <span class="table-total-count">${kpis.length} KPIs en seguimiento</span>
          </div>
        </div>
        <div class="table-scroll">
          <table class="modern-kpi-table">
            <thead>
              <tr>
                <th style="min-width:270px">Indicador & Objetivo</th>
                <th>Perspectiva</th>
                <th>Líder Responsable</th>
                <th>Meta</th>
                <th>Real Actual</th>
                <th style="min-width:140px">Progreso</th>
                <th>Estado</th>
                <th style="min-width:210px">Acción / Recomendación</th>
                <th style="text-align:right">Acción</th>
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
    if ($('#btnSearchClear')) {
      $('#btnSearchClear').onclick = () => {
        kpiSearchTerm = "";
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
          <span style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px;opacity:0.9">PERSPECTIVA</span>
          <div style="font-size:18px;margin-bottom:4px;display:grid;place-items:center">${ICONS[p.iconKey] || ''}</div>
          <b style="font-size:13px;font-weight:800;line-height:1.2;text-align:center">${p.label.toUpperCase()}</b>
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
                <th>Observaciones / Auditoría</th>
                ${['Administrador', 'Gerente', 'Directivo'].includes(currentUser?.role) ? '<th style="text-align:right">Acción</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${mRes.measurements.map(m => {
                const isCorrected = !!m.corrected_at;
                return `
                <tr>
                  <td>${escapeHtml(m.date)}</td>
                  <td><span class="tag">${escapeHtml(m.period)}</span></td>
                  <td><strong>${escapeHtml(m.kpi_name)}</strong></td>
                  <td>${renderRespChip(m.responsible || 'Responsable', m.responsible_area)}</td>
                  <td>
                    <strong class="result-value">${fmt(m.value)} ${escapeHtml(m.kpi_unit)}</strong>
                    ${isCorrected ? `<div style="font-size:9px;color:#92400e;margin-top:2px">Ant: ${fmt(m.previous_value)}</div>` : ''}
                  </td>
                  <td><span class="status ${m.compliance_pct >= 90 ? 'good' : m.compliance_pct >= 75 ? 'warn' : 'bad'}">${fmt(m.compliance_pct)}%</span></td>
                  <td><small>${escapeHtml(m.registered_by)}</small></td>
                  <td style="max-width:280px;white-space:normal;font-size:10px">
                    <div>${escapeHtml(m.notes || '—')}</div>
                    ${isCorrected ? `
                      <span class="badge" style="background:#fef3c7;color:#92400e;font-size:9px;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:3px" title="Corregido por ${escapeHtml(m.corrected_by || '')} el ${escapeHtml(m.corrected_at || '')}: ${escapeHtml(m.correction_reason || '')}">
                        ⚠️ Corregido: ${escapeHtml(m.correction_reason || '')}
                      </span>
                    ` : ''}
                  </td>
                  ${['Administrador', 'Gerente', 'Directivo'].includes(currentUser?.role) ? `
                    <td style="text-align:right">
                      <button class="btn" style="font-size:10.5px;padding:3px 7px" data-correct-measure-id="${m.id}" data-kpi-id="${escapeHtml(m.kpi_id)}" data-kpi-name="${escapeHtml(m.kpi_name)}" data-kpi-unit="${escapeHtml(m.kpi_unit)}" data-period="${escapeHtml(m.period)}" data-value="${m.value}" data-notes="${escapeHtml(m.notes || '')}">
                        ✏️ Corregir
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `;
              }).join("")}
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

    $$('[data-correct-measure-id]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.correctMeasureId, 10);
        const kpiName = btn.dataset.kpiName;
        const kpiUnit = btn.dataset.kpiUnit;
        const period = btn.dataset.period;
        const currentVal = btn.dataset.value;
        const notes = btn.dataset.notes || '';

        const bodyHtml = `
          <div class="field">
            <label><strong>Indicador y Período</strong></label>
            <div style="font-size:13px;font-weight:700;color:#1e3a8a">${escapeHtml(kpiName)}</div>
            <small class="muted">Período de medición: ${escapeHtml(period)} | Valor actual: ${escapeHtml(currentVal)} ${escapeHtml(kpiUnit)}</small>
          </div>
          <div class="field">
            <label for="corrVal"><strong>Nuevo Valor Real *</strong></label>
            <input id="corrVal" type="number" step="any" value="${escapeHtml(currentVal)}" required>
          </div>
          <div class="field">
            <label for="corrNotes"><strong>Observaciones / Notas Actualizadas</strong></label>
            <textarea id="corrNotes" rows="2">${escapeHtml(notes)}</textarea>
          </div>
          <div class="field">
            <label for="corrReason"><strong>Motivo de la Corrección (Obligatorio para auditoría) *</strong></label>
            <input id="corrReason" type="text" placeholder="Ej. Error de digitación en reporte operativo inicial" required minlength="5">
            <small class="muted">Esta corrección quedará registrada con tu usuario y fecha en el registro de auditoría de SQLite.</small>
          </div>
        `;

        showModal(`Corregir Medición: ${period}`, bodyHtml, "Aplicar Corrección", async () => {
          const newVal = parseFloat($('#corrVal').value);
          const newNotes = $('#corrNotes').value.trim();
          const reason = $('#corrReason').value.trim();

          if (isNaN(newVal)) throw new Error('Ingresa un valor numérico válido.');
          if (!reason || reason.length < 5) throw new Error('El motivo de la corrección debe tener al menos 5 caracteres.');

          const r = await apiFetch('api/measurements.php?action=correct', {
            method: 'POST',
            body: {
              measurement_id: id,
              value: newVal,
              notes: newNotes,
              reason: reason
            }
          });
          toast(r.message || 'Medición corregida.');
          closeModal();
          renderCurrentPage();
        }, "CORRECCIÓN AUDITADA");
      });
    });

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
  // 7. CENTRO DE REPORTES EJECUTIVOS
  let repSearchTerm = "";
  let repStatusFilter = "";

  async function renderReports(container) {
    const [res, dashRes] = await Promise.all([
      apiFetch("api/reports.php?action=summary"),
      apiFetch("api/dashboard.php")
    ]);

    const g = dashRes.global;
    const totalBudget = res.initiatives_summary.reduce((a, b) => a + (parseFloat(b.total_budget) || 0), 0);
    const criticalList = res.critical_kpis || [];
    let leadersList = res.responsible_ranking || [];

    // Filtrado interactivo de responsables
    if (repSearchTerm) {
      const q = repSearchTerm.toLowerCase();
      leadersList = leadersList.filter(l => 
        l.responsible.toLowerCase().includes(q) ||
        (l.responsible_area && l.responsible_area.toLowerCase().includes(q))
      );
    }
    if (repStatusFilter) {
      leadersList = leadersList.filter(l => {
        const val = Number(l.avg_compliance);
        if (repStatusFilter === 'good') return val >= 90;
        if (repStatusFilter === 'warn') return val >= 75 && val < 90;
        if (repStatusFilter === 'bad') return val < 75;
        return true;
      });
    }

    container.innerHTML = `
      ${pageHead("Centro de Reportes Ejecutivos", "Informes consolidados, auditoría de líderes, análisis de brechas y exportación oficial de datos.", `
        <button class="btn btn-secondary" id="btnPrintReport">
          ${ICONS.reports} <span>Ver Informe Ejecutivo</span>
        </button>
        <button class="btn btn-primary" id="btnExportCSVReport">
          ${ICONS.download} <span>Exportar Reporte CSV</span>
        </button>
      `)}

      <!-- 6 TARJETAS DE RESUMEN EJECUTIVO -->
      <section class="grid report-kpi-grid">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">TOTAL INDICADORES</span>
            <span class="metric-icon-box blue">${ICONS.table}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value">${g.total}</div>
            <span class="status-chip blue">100% Medidos</span>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">4 Perspectivas BSC</span>
            <span class="metric-foot-secondary">Base SQLite activa</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">KPIS LOGRADOS</span>
            <span class="metric-icon-box green">${ICONS.check}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value" style="color:#16a34a">${g.logrado}</div>
            <span class="status-chip good"><i class="dot"></i> ${(g.logrado/g.total*100).toFixed(1)}%</span>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">Meta Cumplida</span>
            <span class="metric-foot-secondary">≥ 90% logro</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">KPIS EN RIESGO</span>
            <span class="metric-icon-box slate">${ICONS.alert}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value" style="color:#d97706">${g.riesgo}</div>
            <span class="status-chip warn"><i class="dot"></i> ${(g.riesgo/g.total*100).toFixed(1)}%</span>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">Rango de Alerta</span>
            <span class="metric-foot-secondary">75% - 89% logro</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">KPIS CRÍTICOS</span>
            <span class="metric-icon-box purple">${ICONS.danger}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value" style="color:#dc2626">${criticalList.length}</div>
            <span class="status-chip bad"><i class="dot"></i> ${(criticalList.length/g.total*100).toFixed(1)}%</span>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">Brecha Detectada</span>
            <span class="metric-foot-secondary">&lt; 75% logro</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">CUMPLIMIENTO GLOBAL</span>
            <span class="metric-icon-box blue">${ICONS.gauge}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value" style="color:${g.avg_pct >= 90 ? '#16a34a' : g.avg_pct >= 75 ? '#d97706' : '#dc2626'}">
              ${fmt(g.avg_pct)}%
            </div>
            <span class="status-chip ${g.status_key}"><i class="dot"></i> ${g.status_text}</span>
          </div>
          <div class="metric-bar-wrap">
            <div class="metric-bar-fill" style="width:${Math.min(100, g.avg_pct)}%;background:${g.avg_pct >= 90 ? '#16a34a' : g.avg_pct >= 75 ? '#d97706' : '#dc2626'}"></div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">PRESUPUESTO INICIATIVAS</span>
            <span class="metric-icon-box green">${ICONS.financiera}</span>
          </div>
          <div class="metric-main-row">
            <div class="metric-value" style="font-size:23px;color:#1d4ed8">${currency(totalBudget)}</div>
            <span class="status-chip blue">8 Proyectos</span>
          </div>
          <div class="metric-foot">
            <span class="metric-foot-primary">Portafolio Activo</span>
            <span class="metric-foot-secondary">Iniciativas 2025</span>
          </div>
        </div>
      </section>

      <!-- PANELES DE REPORTES EN CUADRÍCULA -->
      <div class="section-title-row" style="margin-top:24px">
        <div class="section-title-left">
          <h2 class="section-heading">Informes Ejecutivos Disponibles</h2>
          <span class="section-subheading">Selecciona un informe para descargar en formato estándar o explorar su desglose detallado</span>
        </div>
      </div>

      <section class="grid report-panels-grid">
        <!-- Panel 1: Matriz Oficial de Indicadores -->
        <div class="report-action-card">
          <div class="report-card-top">
            <span class="report-card-icon blue">${ICONS.table}</span>
            <div class="report-card-head-text">
              <strong class="report-card-title">Reporte General de Indicadores</strong>
              <small class="report-card-badge">36 Indicadores · 12 Objetivos</small>
            </div>
          </div>
          <p class="report-card-desc">
            Matriz completa del Balanced Scorecard organizada por las 4 perspectivas con metas, fórmulas, línea base, frecuencia y líderes responsables.
          </p>
          <div class="report-card-meta">
            <span><b>36</b> KPIs incluidos</span>
            <span><b>4</b> Perspectivas</span>
          </div>
          <button class="btn btn-secondary full" id="btnCardCSV">
            ${ICONS.download} <span>Descargar CSV con UTF-8 BOM</span>
          </button>
        </div>

        <!-- Panel 2: Brechas y KPIs Críticos -->
        <div class="report-action-card">
          <div class="report-card-top">
            <span class="report-card-icon red">${ICONS.danger}</span>
            <div class="report-card-head-text">
              <strong class="report-card-title">Reporte de Objetivos y KPIs Críticos</strong>
              <small class="report-card-badge red">${criticalList.length} Indicadores en Alerta</small>
            </div>
          </div>
          <p class="report-card-desc">
            Identifica indicadores con cumplimiento inferior al 75% para la toma de decisiones del directorio y asignación de planes de mitigación.
          </p>
          <div class="report-card-meta">
            <span style="color:#dc2626"><b>${criticalList.length}</b> Brechas críticas</span>
            <span>Acción requerida</span>
          </div>
          <button class="btn btn-secondary full" data-action="filter-crit">
            ${ICONS.search} <span>Consultar KPIs Críticos (${criticalList.length})</span>
          </button>
        </div>

        <!-- Panel 3: Presupuesto y Ejecución de Iniciativas -->
        <div class="report-action-card">
          <div class="report-card-top">
            <span class="report-card-icon green">${ICONS.initiatives}</span>
            <div class="report-card-head-text">
              <strong class="report-card-title">Presupuesto de Iniciativas Estratégicas</strong>
              <small class="report-card-badge green">${currency(totalBudget)}</small>
            </div>
          </div>
          <p class="report-card-desc">
            Seguimiento financiero y avance porcentual de las iniciativas y proyectos estratégicos implementados en TechPeru SAC para 2025.
          </p>
          <div class="report-card-meta">
            <span><b>${res.initiatives_summary.reduce((a, b) => a + (parseInt(b.count) || 0), 0)}</b> Proyectos</span>
            <span><b>100%</b> Asignado</span>
          </div>
          <button class="btn btn-secondary full" id="btnGoInitiatives">
            ${ICONS.plus} <span>Ver Detalle de Iniciativas</span>
          </button>
        </div>

        <!-- Panel 4: Desempeño Consolidado por Perspectiva -->
        <div class="report-action-card">
          <div class="report-card-top">
            <span class="report-card-icon purple">${ICONS.quadrants}</span>
            <div class="report-card-head-text">
              <strong class="report-card-title">Cumplimiento por Perspectiva BSC</strong>
              <small class="report-card-badge purple">4 Cuadrantes</small>
            </div>
          </div>
          <div class="persp-compact-list">
            ${res.perspectives.map(p => `
              <div class="persp-compact-row">
                <span class="p-name">${escapeHtml(p.name)}</span>
                <div class="p-bar-wrap">
                  <div class="p-bar-fill" style="width:${Math.min(100, p.avg_compliance)}%;background:${p.color}"></div>
                </div>
                <strong class="p-pct" style="color:${p.color}">${fmt(p.avg_compliance)}%</strong>
              </div>
            `).join("")}
          </div>
          <button class="btn btn-secondary full" id="btnGoDashboard">
            ${ICONS.dashboard} <span>Explorar en Dashboard</span>
          </button>
        </div>
      </section>

      <!-- TABLA 1: RANKING OFICIAL DE CUMPLIMIENTO POR RESPONSABLE -->
      <div class="modern-table-panel" style="margin-top:28px">
        <div class="modern-table-header-info">
          <div class="header-info-titles">
            <div class="header-badge-row">
              <strong class="panel-main-title">Ranking Oficial de Desempeño por Responsable</strong>
              <span class="badge-sqlite-live"><i class="pulse-dot"></i> ${leadersList.length} Líderes</span>
            </div>
            <p class="panel-sub-desc">
              Promedio de logro según los KPIs asignados a cada líder y gerencia de TechPeru SAC.
            </p>
          </div>
          <div class="header-info-badges">
            <span class="table-total-count">28 Líderes Asignados</span>
          </div>
        </div>

        <!-- BARRA DE FILTRADO DE RESPONSABLES -->
        <div class="table-sub-toolbar">
          <div class="search-input-wrap" style="max-width:380px">
            <span class="search-icon-fixed">${ICONS.search}</span>
            <input type="search" id="repSearchLeader" class="search-input-field" value="${escapeHtml(repSearchTerm)}" placeholder="Buscar por nombre de líder o gerencia...">
          </div>
          <div class="status-filters">
            <button class="status-pill-btn ${!repStatusFilter ? 'active' : ''}" data-rep-status="">Todos</button>
            <button class="status-pill-btn good ${repStatusFilter === 'good' ? 'active' : ''}" data-rep-status="good">
              <i class="dot"></i> <span>Logrado (≥90%)</span>
            </button>
            <button class="status-pill-btn warn ${repStatusFilter === 'warn' ? 'active' : ''}" data-rep-status="warn">
              <i class="dot"></i> <span>En Riesgo (75-89%)</span>
            </button>
            <button class="status-pill-btn bad ${repStatusFilter === 'bad' ? 'active' : ''}" data-rep-status="bad">
              <i class="dot"></i> <span>Crítico (&lt;75%)</span>
            </button>
          </div>
        </div>

        <div class="table-scroll">
          <table class="modern-kpi-table">
            <thead>
              <tr>
                <th style="min-width:260px">Líder Responsable</th>
                <th>Área / Gerencia</th>
                <th>KPIs Asignados</th>
                <th style="min-width:180px">Cumplimiento Promedio</th>
                <th>Estado General</th>
                <th style="text-align:right">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${leadersList.length ? leadersList.map(r => {
                const avg = Number(r.avg_compliance);
                const sKey = avg >= 90 ? 'good' : (avg >= 75 ? 'warn' : 'bad');
                const sText = avg >= 90 ? 'Logrado' : (avg >= 75 ? 'En Riesgo' : 'Crítico');
                const barColor = avg >= 90 ? '#16a34a' : (avg >= 75 ? '#d97706' : '#dc2626');
                return `
                  <tr class="modern-table-row">
                    <td>${renderRespChip(r.responsible, r.responsible_area)}</td>
                    <td><span class="tag" style="background:#f1f5f9;color:#334155;font-weight:600;padding:4px 8px">${escapeHtml(r.responsible_area)}</span></td>
                    <td><span class="pill-count" style="font-weight:700">${r.total_kpis} ${r.total_kpis === 1 ? 'KPI' : 'KPIs'}</span></td>
                    <td>
                      <div class="kpi-prog-wrap" style="min-width:150px">
                        <div class="kpi-prog-bar">
                          <div class="kpi-prog-fill" style="width:${Math.min(100, Math.max(5, avg))}%;background:${barColor}"></div>
                        </div>
                        <strong class="prog-pct" style="color:${barColor}">${fmt(avg)}%</strong>
                      </div>
                    </td>
                    <td>
                      <span class="kpi-status-badge ${sKey}">
                        <i class="dot"></i> ${sText}
                      </span>
                    </td>
                    <td style="text-align:right">
                      <button class="btn-table-measure" data-filter-by-leader="${escapeHtml(r.responsible)}" title="Ver indicadores de este líder en el dashboard">
                        ${ICONS.search} <span>Ver KPIs</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join("") : `
                <tr>
                  <td colspan="6" style="text-align:center;padding:36px;color:#64748b">
                    No se encontraron responsables que coincidan con la búsqueda.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABLA 2: DETALLE DE KPIS CRÍTICOS Y PLAN DE ACCIÓN RECOMENDADO -->
      <div class="modern-table-panel" style="margin-top:28px">
        <div class="modern-table-header-info" style="border-left:4px solid #dc2626">
          <div class="header-info-titles">
            <div class="header-badge-row">
              <strong class="panel-main-title" style="color:#b91c1c">Detalle de Brechas: ${criticalList.length} Indicadores Críticos</strong>
              <span class="status-chip bad"><i class="dot"></i> Atención Urgente</span>
            </div>
            <p class="panel-sub-desc">
              Lista prioritaria de KPIs con cumplimiento &lt;75% que requieren asignación presupuestal o ajuste correctivo.
            </p>
          </div>
          <span class="table-total-count" style="background:#fef2f2;color:#b91c1c;border-color:#fecaca">
            ${criticalList.length} Brechas Detectadas
          </span>
        </div>
        <div class="table-scroll">
          <table class="modern-kpi-table">
            <thead>
              <tr>
                <th style="min-width:240px">Indicador (KPI)</th>
                <th>Perspectiva</th>
                <th>Responsable</th>
                <th>Meta</th>
                <th>Real Actual</th>
                <th>% Cumpl.</th>
                <th style="min-width:240px">Acción y Recomendación para el Directorio</th>
              </tr>
            </thead>
            <tbody>
              ${criticalList.map(k => {
                const pct = Number(k.compliance_pct);
                return `
                  <tr class="modern-table-row">
                    <td>
                      <div class="kpi-title-block">
                        <span class="kpi-code-pill" style="background:#dc2626">${escapeHtml(k.id)}</span>
                        <strong class="kpi-headline">${escapeHtml(k.name)}</strong>
                        <small class="kpi-objective-desc">${escapeHtml(k.objective_name || '')}</small>
                      </div>
                    </td>
                    <td><span class="persp-tag ${k.perspective_id}">${escapeHtml(k.perspective_name || k.perspective_id)}</span></td>
                    <td>${renderRespChip(k.responsible, k.responsible_area)}</td>
                    <td><b>${fmt(k.target)}</b> <small class="unit-badge">${escapeHtml(k.unit)}</small></td>
                    <td><b style="color:#dc2626">${fmt(k.current_real)}</b></td>
                    <td>
                      <span class="status-chip bad" style="font-size:11px"><i class="dot"></i> ${fmt(pct)}%</span>
                    </td>
                    <td class="col-action-rec">
                      <div class="action-rec-box">${escapeHtml(k.action_recommended || 'Intervención inmediata')}</div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Event listeners
    $("#btnExportCSVReport")?.addEventListener("click", () => window.location.href = "api/reports.php?action=export_csv");
    $("#btnCardCSV")?.addEventListener("click", () => window.location.href = "api/reports.php?action=export_csv");
    $("#btnPrintReport")?.addEventListener("click", () => window.open("api/reports.php?action=print_html", "_blank"));
    $$("[data-action='filter-crit']").forEach(b => b.onclick = () => { pendingKpiStatus = "bad"; navigate("kpis"); });
    $("#btnGoInitiatives")?.addEventListener("click", () => navigate("iniciativas"));
    $("#btnGoDashboard")?.addEventListener("click", () => navigate("dashboard"));

    // Leader search & filter
    const searchLeaderInput = $("#repSearchLeader");
    if (searchLeaderInput) {
      searchLeaderInput.oninput = (e) => {
        repSearchTerm = e.target.value;
        renderCurrentPage();
      };
    }
    $$("[data-rep-status]").forEach(btn => {
      btn.onclick = () => {
        repStatusFilter = btn.dataset.repStatus || "";
        renderCurrentPage();
      };
    });

    // Filter by leader button
    $$("[data-filter-by-leader]").forEach(btn => {
      btn.onclick = () => {
        activeRespFilter = btn.dataset.filterByLeader;
        navigate("dashboard");
      };
    });
  }

  // ========================================================
  // AVATAR PRESETS & HELPERS
  // ========================================================
  const AVATAR_PRESETS = [
    { id: 'pres_1', label: 'Ejecutivo 1', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#1e3a8a"/><circle cx="50" cy="40" r="20" fill="#fed7aa"/><path d="M22 84c4-18 16-24 28-24s24 6 28 24" fill="#0f172a"/><path d="M42 60l8 12 8-12z" fill="#f8fafc"/><path d="M48 68l2 16 2-16z" fill="#dc2626"/><circle cx="44" cy="38" r="2.5" fill="#1e293b"/><circle cx="56" cy="38" r="2.5" fill="#1e293b"/><path d="M32 30c4-12 32-12 36 0-8-4-28-4-36 0z" fill="#334155"/></svg>') },
    { id: 'pres_2', label: 'Ejecutiva 2', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#0d9488"/><circle cx="50" cy="40" r="20" fill="#fed7aa"/><path d="M22 86c3-18 15-24 28-24s25 6 28 24" fill="#134e4a"/><path d="M44 60l6 8 6-8z" fill="#ccfbf1"/><circle cx="44" cy="38" r="2.5" fill="#1e293b"/><circle cx="56" cy="38" r="2.5" fill="#1e293b"/><path d="M28 42c0-20 44-20 44 0 0 14-8 16-8 16s-2-8-6-8c-5 0-6 6-10 6s-5-6-10-6c-4 0-6 8-6 8s-4-6-4-16z" fill="#451a03"/></svg>') },
    { id: 'pres_3', label: 'Líder TI', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2563eb"/><circle cx="50" cy="40" r="20" fill="#fcd34d"/><path d="M20 86c4-19 16-25 30-25s26 6 30 25" fill="#1e293b"/><circle cx="43" cy="38" r="2.5" fill="#1e293b"/><circle cx="57" cy="38" r="2.5" fill="#1e293b"/><path d="M40 37h6v2h-6zm14 0h6v2h-6z" fill="#0284c7"/><path d="M30 32c6-14 34-14 40 0-10-5-30-5-40 0z" fill="#172554"/></svg>') },
    { id: 'pres_4', label: 'Directora CX', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#e11d48"/><circle cx="50" cy="40" r="20" fill="#ffedd5"/><path d="M22 86c3-18 15-24 28-24s25 6 28 24" fill="#881337"/><circle cx="44" cy="38" r="2.5" fill="#1e293b"/><circle cx="56" cy="38" r="2.5" fill="#1e293b"/><path d="M28 34c2-18 42-18 44 0 0 12-4 22-8 22s-2-12-8-12-6 8-10 8-6-8-10-8-6 12-8 12c-4 0-2-14 0-22z" fill="#1c1917"/></svg>') },
    { id: 'pres_5', label: 'Gerente Finanzas', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#15803d"/><circle cx="50" cy="40" r="20" fill="#fed7aa"/><path d="M20 86c4-18 16-24 30-24s26 6 30 24" fill="#14532d"/><path d="M42 62l8 10 8-10z" fill="#dcfce7"/><path d="M48 70l2 14 2-14z" fill="#166534"/><circle cx="44" cy="38" r="2.5" fill="#1e293b"/><circle cx="56" cy="38" r="2.5" fill="#1e293b"/><path d="M34 28c8-10 24-10 32 0-8-3-24-3-32 0z" fill="#475569"/></svg>') },
    { id: 'pres_6', label: 'Estratega Operaciones', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#7c3aed"/><circle cx="50" cy="40" r="20" fill="#fed7aa"/><path d="M20 86c4-18 16-24 30-24s26 6 30 24" fill="#3b0764"/><circle cx="44" cy="38" r="2.5" fill="#1e293b"/><circle cx="56" cy="38" r="2.5" fill="#1e293b"/><path d="M30 34c4-14 36-14 40 0-8-4-32-4-40 0z" fill="#18181b"/></svg>') },
    { id: 'pres_7', label: 'Consultor Senior', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#ea580c"/><circle cx="50" cy="40" r="20" fill="#ffedd5"/><path d="M20 86c4-18 16-24 30-24s26 6 30 24" fill="#431407"/><circle cx="44" cy="38" r="2.5" fill="#1e293b"/><circle cx="56" cy="38" r="2.5" fill="#1e293b"/><path d="M32 30c6-10 30-10 36 0-8-3-28-3-36 0z" fill="#94a3b8"/></svg>') },
    { id: 'pres_8', label: 'Gestión Talento', dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#db2777"/><circle cx="50" cy="40" r="20" fill="#fde68a"/><path d="M22 86c3-18 15-24 28-24s25 6 28 24" fill="#701a75"/><circle cx="44" cy="38" r="2.5" fill="#1e293b"/><circle cx="56" cy="38" r="2.5" fill="#1e293b"/><path d="M26 36c4-20 44-20 48 0 0 14-6 20-10 20s-4-10-8-10-6 6-10 6-4-6-8-6c-4 0-8 6-12 10z" fill="#3b0764"/></svg>') }
  ];

  function compressImageFile(file, maxWidth = 160, maxHeight = 160, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('El archivo seleccionado no es una imagen válida.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagen no soportado.'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const minDim = Math.min(width, height);
          const sx = (width - minDim) / 2;
          const sy = (height - minDim) / 2;
          canvas.width = maxWidth;
          canvas.height = maxHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxWidth, maxHeight);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  let currentAdminTab = 'perfil';

  // 8. ADMINISTRACIÓN (EDITABLE & PERFILES)
  async function renderAdmin(container) {
    const [usersRes, settingsRes, periodsRes, actRes] = await Promise.all([
      apiFetch("api/admin.php?action=users"),
      apiFetch("api/admin.php?action=settings"),
      apiFetch("api/admin.php?action=periods"),
      apiFetch("api/admin.php?action=activity")
    ]);

    const settings = settingsRes?.settings || {};
    let pendingProfileAvatar = currentUser.avatar || null;

    container.innerHTML = `
      ${pageHead("Administración del Sistema", "Gestión editable de usuarios, fotos de perfil, configuración del BSC y auditoría.", `
        <div class="head-actions">
          <button class="btn primary" id="btnAdminQuickNewUser">＋ Registrar Usuario</button>
        </div>
      `)}

      <!-- PESTAÑAS DE NAVEGACIÓN ADMIN -->
      <div class="admin-tabs-nav" role="tablist">
        <button class="admin-tab-btn ${currentAdminTab === 'perfil' ? 'active' : ''}" data-tab="perfil" role="tab">👤 Mi Perfil & Cambiar Foto</button>
        <button class="admin-tab-btn ${currentAdminTab === 'usuarios' ? 'active' : ''}" data-tab="usuarios" role="tab">👥 Directorio de Usuarios (${usersRes.users.length})</button>
        <button class="admin-tab-btn ${currentAdminTab === 'configuracion' ? 'active' : ''}" data-tab="configuracion" role="tab">⚙️ Configuración BSC & Períodos</button>
        <button class="admin-tab-btn ${currentAdminTab === 'auditoria' ? 'active' : ''}" data-tab="auditoria" role="tab">📜 Registro de Auditoría (${actRes.logs.length})</button>
      </div>

      <!-- SECCIÓN 1: MI PERFIL Y FOTO -->
      <div id="tabContentPerfil" class="${currentAdminTab === 'perfil' ? '' : 'hidden'}">
        <div class="split-grid grid" style="grid-template-columns: 360px 1fr; gap: 24px; align-items: start;">
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Foto de Perfil</h3>
                <p>Personaliza tu foto o avatar en el sistema</p>
              </div>
            </div>
            <div class="avatar-preview-wrap">
              <div class="avatar-large-container">
                <div class="avatar-large" id="profileAvatarBig">
                  ${pendingProfileAvatar ? `<img src="${escapeHtml(pendingProfileAvatar)}" alt="Foto">` : getInitials(currentUser.name)}
                </div>
                <label class="avatar-camera-badge" title="Subir foto desde tu dispositivo">
                  📷
                  <input type="file" id="profileFilePicker" accept="image/png,image/jpeg,image/webp" style="display:none">
                </label>
              </div>
              <div class="avatar-actions-row">
                <button type="button" class="btn" id="btnUploadProfileFile">📁 Subir Foto</button>
                <button type="button" class="btn" id="btnRemoveProfileFile" style="color:#dc2626">🗑️ Quitar Foto</button>
              </div>
              <div class="preset-avatars-label">O selecciona un avatar ejecutivo oficial:</div>
              <div class="preset-avatars-grid">
                ${AVATAR_PRESETS.map((p, idx) => `
                  <button type="button" class="preset-avatar-btn ${pendingProfileAvatar === p.dataUrl ? 'selected' : ''}" data-idx="${idx}" title="${p.label}">
                    ${p.dataUrl.startsWith('data:image/svg+xml') ? decodeURIComponent(p.dataUrl.replace('data:image/svg+xml;utf8,', '')) : `<img src="${p.dataUrl}">`}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Datos Personales & Cargo</h3>
                <p>Información de tu cuenta en TechPeru SAC</p>
              </div>
            </div>
            <form id="profileEditForm" class="grid" style="gap:16px">
              <div class="field">
                <label for="profNameInput"><strong>Nombre Completo</strong></label>
                <input id="profNameInput" type="text" value="${escapeHtml(currentUser.name)}" required>
              </div>
              <div class="field">
                <label for="profAreaInput"><strong>Área o Gerencia</strong></label>
                <input id="profAreaInput" type="text" value="${escapeHtml(currentUser.area || '')}" required>
              </div>
              <div class="field">
                <label><strong>Correo Electrónico (Identificador)</strong></label>
                <input type="email" value="${escapeHtml(currentUser.email)}" disabled style="background:#f1f5f9;cursor:not-allowed">
                <small class="muted">El correo electrónico está vinculado a tu cuenta del Balanced Scorecard.</small>
              </div>
              <div class="field">
                <label><strong>Rol de Acceso</strong></label>
                <div><span class="role-badge admin">🛡️ ${escapeHtml(currentUser.role)}</span></div>
              </div>
              <div style="margin-top:8px">
                <button type="submit" class="btn primary" id="btnSaveProfile">💾 Guardar Cambios en Mi Perfil y Foto</button>
              </div>
            </form>

            <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:18px">
              <div class="panel-head" style="margin-bottom:12px;padding:0">
                <div>
                  <h4 style="margin:0;font-size:14px;font-weight:700">Seguridad & Cambio de Contraseña</h4>
                  <p style="margin:2px 0 0;font-size:12px;color:#64748b">Actualiza la contraseña de tu cuenta de acceso</p>
                </div>
              </div>
              <form id="profileChangePassForm" class="grid" style="gap:12px;max-width:440px">
                <div class="field">
                  <label for="profCurrentPass"><strong>Contraseña Actual *</strong></label>
                  <input id="profCurrentPass" type="password" required placeholder="Tu contraseña actual">
                </div>
                <div class="field">
                  <label for="profNewPass"><strong>Nueva Contraseña *</strong></label>
                  <input id="profNewPass" type="password" minlength="8" required placeholder="Mínimo 8 caracteres">
                </div>
                <div class="field">
                  <label for="profConfirmPass"><strong>Confirmar Nueva Contraseña *</strong></label>
                  <input id="profConfirmPass" type="password" minlength="8" required placeholder="Repite la nueva contraseña">
                </div>
                <div>
                  <button type="submit" class="btn">🔑 Actualizar Mi Contraseña</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 2: DIRECTORIO DE USUARIOS (CRUD COMPLETO) -->
      <div id="tabContentUsuarios" class="${currentAdminTab === 'usuarios' ? '' : 'hidden'}">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h3>Directorio de Usuarios y Responsables</h3>
              <p>Edita usuarios, nombres, fotos de perfil, roles y accesos a indicadores</p>
            </div>
            <button class="btn primary" id="btnNewUserModal">＋ Nuevo Usuario</button>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuario / Foto</th>
                  <th>Correo Electrónico</th>
                  <th>Rol</th>
                  <th>Área / Cargo</th>
                  <th>Estado</th>
                  <th>Fecha Registro</th>
                  <th style="text-align:right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${usersRes.users.map(u => {
                  const isCurrent = u.id === currentUser.id;
                  const roleCls = u.role === 'Administrador' ? 'admin' : (u.role.includes('Gerente') || u.role.includes('Directivo') ? 'gerente' : 'responsable');
                  const isActive = u.is_active !== undefined ? (Number(u.is_active) === 1) : true;
                  return `
                    <tr>
                      <td>
                        <div class="admin-user-cell">
                          <div class="avatar">
                            ${u.avatar ? `<img src="${escapeHtml(u.avatar)}" class="avatar-img" alt="Foto">` : getInitials(u.name)}
                          </div>
                          <div>
                            <strong>${escapeHtml(u.name)} ${isCurrent ? '<span style="font-size:10px;color:#2563eb;font-weight:700">(Tú)</span>' : ''}</strong>
                            <small class="muted">ID: ${escapeHtml(u.id)}</small>
                          </div>
                        </div>
                      </td>
                      <td><code>${escapeHtml(u.email)}</code></td>
                      <td><span class="role-badge ${roleCls}">${escapeHtml(u.role)}</span></td>
                      <td>${escapeHtml(u.area)}</td>
                      <td>
                        <span class="status ${isActive ? 'good' : 'bad'}" style="font-size:11px">
                          ${isActive ? '🟢 Activo' : '🔴 Inactivo'}
                        </span>
                      </td>
                      <td><small class="muted">${escapeHtml((u.created_at || '').slice(0, 10))}</small></td>
                      <td style="text-align:right;white-space:nowrap">
                        <button class="btn" data-edit-user-id="${escapeHtml(u.id)}" title="Editar usuario y foto">✏️ Editar</button>
                        <button class="btn" data-reset-pass-user-id="${escapeHtml(u.id)}" data-user-name="${escapeHtml(u.name)}" title="Restablecer contraseña">🔑 Clave</button>
                        ${isCurrent ? '' : `
                          <button class="btn" data-toggle-user-id="${escapeHtml(u.id)}" title="${isActive ? 'Desactivar usuario' : 'Activar usuario'}" style="color:${isActive ? '#b45309' : '#15803d'}">
                            ${isActive ? '⏸️ Desactivar' : '▶️ Activar'}
                          </button>
                          <button class="btn" style="color:#dc2626" data-del-user-id="${escapeHtml(u.id)}" data-del-user-name="${escapeHtml(u.name)}" title="Eliminar usuario">🗑️</button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 3: CONFIGURACIÓN BSC & PERÍODOS -->
      <div id="tabContentConfiguracion" class="${currentAdminTab === 'configuracion' ? '' : 'hidden'}">
        <div class="section-grid grid admin-grid" style="grid-template-columns: 1fr 1fr; gap: 24px;">
          <!-- DATOS ORGANIZACIONALES -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Datos de la Organización y Título BSC</h3>
                <p>Personaliza el nombre de la empresa y encabezados del Scorecard</p>
              </div>
            </div>
            <form id="settingsForm" class="grid" style="gap:14px">
              <div class="field">
                <label for="setCompName"><strong>Nombre de la Organización</strong></label>
                <input id="setCompName" type="text" value="${escapeHtml(settings.company_name || 'TechPeru SAC')}" required>
              </div>
              <div class="field">
                <label for="setBscTitle"><strong>Título del Balanced Scorecard</strong></label>
                <input id="setBscTitle" type="text" value="${escapeHtml(settings.bsc_title || 'Balanced Scorecard 2025')}" required>
              </div>
              <div class="field">
                <label for="setPeriod"><strong>Período Estratégico Visible</strong></label>
                <input id="setPeriod" type="text" value="${escapeHtml(settings.strategic_period || 'Plan Estratégico · 2025')}" required>
              </div>
              <div style="margin-top:10px">
                <button type="submit" class="btn primary full">💾 Guardar Configuración de la Empresa</button>
              </div>
            </form>
          </div>

          <!-- PERÍODOS Y RESET DEMO -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Períodos de Evaluación</h3>
                <p>Ciclos de medición registrados en el BSC</p>
              </div>
              <button class="btn primary" id="btnNewPeriodModal">＋ Nuevo Período</button>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Nombre</th>
                    <th>Fechas</th>
                    <th>Estado</th>
                    <th style="text-align:right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${periodsRes.periods.map(p => `
                    <tr>
                      <td><span class="code">${escapeHtml(p.id)}</span></td>
                      <td><strong>${escapeHtml(p.name)}</strong></td>
                      <td><small class="muted">${escapeHtml(p.start_date || '')} al ${escapeHtml(p.end_date || '')}</small></td>
                      <td><span class="status ${p.status === 'Activo' ? 'good' : 'neutral'}">${escapeHtml(p.status)}</span></td>
                      <td style="text-align:right;white-space:nowrap">
                        <button class="btn" data-edit-period-id="${escapeHtml(p.id)}" title="Editar período">✏️</button>
                        ${p.status !== 'Activo' ? `
                          <button class="btn" style="color:#2563eb" data-set-active-period="${escapeHtml(p.id)}" title="Establecer como activo">⭐ Activar</button>
                        ` : '<span class="tag" style="background:#ecfdf5;color:#065f46">Vigente</span>'}
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>

            <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px">
              <div class="space-below info-box">
                <strong>Restaurar Datos Oficiales del Balanced Scorecard:</strong><br>
                Restaura los 12 objetivos, los 36 KPIs y los responsables oficiales de TechPeru SAC (2025).
              </div>
              <button class="btn danger full" id="btnResetDB">🔄 Restaurar Base de Datos del BSC (Valores Oficiales 2025)</button>
            </div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 4: AUDITORÍA -->
      <div id="tabContentAuditoria" class="${currentAdminTab === 'auditoria' ? '' : 'hidden'}">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h3>Registro de Auditoría en Tiempo Real (Activity Logs)</h3>
              <p>Trazabilidad de cambios, mediciones, perfiles y operaciones en SQLite</p>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <input type="search" id="actSearchInput" placeholder="🔍 Buscar en auditoría..." style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;width:190px">
              <select id="actActionFilter" style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
                <option value="">Todas las acciones</option>
                <option value="MEASURE">Mediciones</option>
                <option value="USER">Usuarios</option>
                <option value="PASSWORD">Contraseñas</option>
                <option value="PERIOD">Períodos</option>
                <option value="CONFIG">Configuración</option>
                <option value="SEED">Restauración</option>
              </select>
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
              <tbody id="activityLogsBody">
                ${renderActivityLogRows(actRes.logs)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    function renderActivityLogRows(logs) {
      if (!logs || logs.length === 0) {
        return '<tr><td colspan="5" class="empty" style="text-align:center;padding:24px;color:#64748b">No se encontraron registros de auditoría.</td></tr>';
      }
      return logs.map(l => `
        <tr>
          <td><small>${escapeHtml(l.created_at)}</small></td>
          <td><strong>${escapeHtml(l.user_name || 'Sistema')}</strong></td>
          <td><span class="audit-badge ${l.action.includes('MEASURE') ? 'measure' : l.action.includes('SEED') ? 'seed' : l.action.includes('DELETE') ? 'delete' : 'kpi'}">${escapeHtml(l.action)}</span></td>
          <td><span class="tag">${escapeHtml(l.entity_type)} ${escapeHtml(l.entity_id || '')}</span></td>
          <td style="max-width:400px;white-space:normal;font-size:11px">${escapeHtml(l.details)}</td>
        </tr>
      `).join("");
    }

    // TAB SWITCHING HANDLER
    const tabBtns = $$('.admin-tab-btn', container);
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        currentAdminTab = tab;
        tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        $('#tabContentPerfil').classList.toggle('hidden', tab !== 'perfil');
        $('#tabContentUsuarios').classList.toggle('hidden', tab !== 'usuarios');
        $('#tabContentConfiguracion').classList.toggle('hidden', tab !== 'configuracion');
        $('#tabContentAuditoria').classList.toggle('hidden', tab !== 'auditoria');
      });
    });

    // 1. MI PERFIL & FOTO EVENTS
    const profileBig = $('#profileAvatarBig');
    const filePicker = $('#profileFilePicker');

    function updateProfileBigPreview(avatarData) {
      pendingProfileAvatar = avatarData;
      if (avatarData) {
        profileBig.innerHTML = `<img src="${escapeHtml(avatarData)}" alt="Foto">`;
      } else {
        profileBig.textContent = getInitials(currentUser.name);
      }
      $$('.preset-avatar-btn', container).forEach(b => {
        const idx = parseInt(b.dataset.idx, 10);
        b.classList.toggle('selected', AVATAR_PRESETS[idx]?.dataUrl === avatarData);
      });
    }

    $('#btnUploadProfileFile')?.addEventListener('click', () => filePicker?.click());
    filePicker?.addEventListener('change', async () => {
      const file = filePicker.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImageFile(file, 160, 160, 0.88);
        updateProfileBigPreview(compressed);
        toast("Foto cargada. Haz clic en 'Guardar Cambios' para confirmar.");
      } catch (err) {
        toast(err.message, 'bad');
      }
    });

    $('#btnRemoveProfileFile')?.addEventListener('click', () => {
      updateProfileBigPreview(null);
      toast("Foto removida. Haz clic en 'Guardar Cambios' para confirmar.");
    });

    $$('.preset-avatar-btn', container).forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.idx, 10);
        const preset = AVATAR_PRESETS[idx];
        if (preset) {
          updateProfileBigPreview(preset.dataUrl);
          toast(`Avatar '${preset.label}' seleccionado.`);
        }
      });
    });

    $('#profileEditForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#profNameInput').value.trim();
      const area = $('#profAreaInput').value.trim();
      if (!name || !area) {
        toast('Por favor completa tu nombre y área.', 'warn');
        return;
      }
      try {
        const r = await apiFetch('api/admin.php?action=update_profile', {
          method: 'POST',
          body: { name, area, avatar: pendingProfileAvatar }
        });
        currentUser = r.user;
        updateUserUI(currentUser);
        toast(r.message || 'Perfil y foto actualizados exitosamente.');
        renderCurrentPage();
      } catch (err) {
        toast(err.message || 'Error al actualizar perfil.', 'bad');
      }
    });

    // 1.1 CAMBIO DE CONTRASEÑA PROPIA
    $('#profileChangePassForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current_password = $('#profCurrentPass').value;
      const new_password = $('#profNewPass').value;
      const confirm_password = $('#profConfirmPass').value;
      if (!current_password || !new_password || !confirm_password) {
        toast('Por favor completa todos los campos de contraseña.', 'warn');
        return;
      }
      if (new_password !== confirm_password) {
        toast('La nueva contraseña y su confirmación no coinciden.', 'bad');
        return;
      }
      if (new_password.length < 8) {
        toast('La nueva contraseña debe tener al menos 8 caracteres.', 'bad');
        return;
      }
      try {
        const r = await apiFetch('api/auth.php?action=change_password', {
          method: 'POST',
          body: { current_password, new_password, confirm_password }
        });
        toast(r.message || 'Contraseña actualizada con éxito.');
        $('#profileChangePassForm').reset();
      } catch (err) {
        toast(err.message || 'Error al cambiar contraseña.', 'bad');
      }
    });

    // 2. CONFIGURACIÓN BSC FORM
    $('#settingsForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const company_name = $('#setCompName').value.trim();
      const bsc_title = $('#setBscTitle').value.trim();
      const strategic_period = $('#setPeriod').value.trim();
      try {
        const r = await apiFetch('api/admin.php?action=save_settings', {
          method: 'POST',
          body: { company_name, bsc_title, strategic_period }
        });
        applySystemSettings({ company_name, bsc_title, strategic_period });
        toast(r.message || 'Configuración guardada.');
      } catch (err) {
        toast(err.message || 'Error al guardar configuración.', 'bad');
      }
    });

    // 3. GESTIÓN DE USUARIOS (CREAR / EDITAR / ESTADO / CLAVE / ELIMINAR)
    function openUserModal(userToEdit = null) {
      let modalUserAvatar = userToEdit?.avatar || null;
      const isEdit = !!userToEdit;
      const title = isEdit ? `Editar Usuario: ${userToEdit.name}` : "Registrar Nuevo Usuario";
      const eyebrow = isEdit ? "ACTUALIZAR USUARIO" : "NUEVO USUARIO";
      const isActive = userToEdit ? (Number(userToEdit.is_active) === 1) : true;

      const bodyHtml = `
        <div class="avatar-preview-wrap" style="padding:14px;margin-bottom:14px">
          <div class="avatar-large-container" style="width:80px;height:80px">
            <div class="avatar-large" id="modalUserAvatarPreview" style="width:80px;height:80px;font-size:24px">
              ${modalUserAvatar ? `<img src="${escapeHtml(modalUserAvatar)}" alt="Foto">` : (isEdit ? getInitials(userToEdit.name) : '👤')}
            </div>
            <label class="avatar-camera-badge" style="width:28px;height:28px;font-size:13px" title="Subir foto">
              📷
              <input type="file" id="modalUserFileInput" accept="image/png,image/jpeg,image/webp" style="display:none">
            </label>
          </div>
          <div class="avatar-actions-row">
            <button type="button" class="btn" id="btnModalUploadFile" style="font-size:10.5px;padding:6px 10px">📁 Subir Foto</button>
            <button type="button" class="btn" id="btnModalRemoveFile" style="font-size:10.5px;padding:6px 10px;color:#dc2626">🗑️ Quitar</button>
          </div>
          <div class="preset-avatars-label" style="font-size:10px">O elegir avatar:</div>
          <div class="preset-avatars-grid" style="gap:6px">
            ${AVATAR_PRESETS.map((p, idx) => `
              <button type="button" class="preset-avatar-btn modal-preset-btn ${modalUserAvatar === p.dataUrl ? 'selected' : ''}" data-idx="${idx}" style="width:36px;height:36px">
                ${p.dataUrl.startsWith('data:image/svg+xml') ? decodeURIComponent(p.dataUrl.replace('data:image/svg+xml;utf8,', '')) : `<img src="${p.dataUrl}">`}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="grid detail-form-grid">
          <div class="field">
            <label for="uName"><strong>Nombre Completo *</strong></label>
            <input id="uName" type="text" value="${escapeHtml(userToEdit?.name || '')}" placeholder="Ej. Lic. Carlos Mendoza" required>
          </div>
          <div class="field">
            <label for="uEmail"><strong>Correo Electrónico *</strong></label>
            <input id="uEmail" type="email" value="${escapeHtml(userToEdit?.email || '')}" placeholder="nombre@techperu.pe" required>
          </div>
          <div class="field">
            <label for="uRole"><strong>Rol de Acceso *</strong></label>
            <select id="uRole">
              <option value="Responsable" ${userToEdit?.role === 'Responsable' ? 'selected' : ''}>Responsable (Registro y seguimiento de KPIs)</option>
              <option value="Responsable de indicadores" ${userToEdit?.role === 'Responsable de indicadores' ? 'selected' : ''}>Responsable de indicadores</option>
              <option value="Directivo" ${userToEdit?.role === 'Directivo' ? 'selected' : ''}>Directivo (Visualización integral)</option>
              <option value="Gerente" ${userToEdit?.role === 'Gerente' ? 'selected' : ''}>Gerente (Gestión estratégica y operativa)</option>
              <option value="Administrador" ${userToEdit?.role === 'Administrador' ? 'selected' : ''}>Administrador (Control total del sistema)</option>
            </select>
          </div>
          <div class="field">
            <label for="uArea"><strong>Área o Gerencia *</strong></label>
            <input id="uArea" type="text" value="${escapeHtml(userToEdit?.area || '')}" placeholder="Ej. Gerencia de Finanzas" required>
          </div>
          <div class="field" style="grid-column: 1 / -1">
            <label for="uPassword"><strong>Contraseña ${isEdit ? '(Opcional, dejar vacío para conservar)' : '*'}</strong></label>
            <input id="uPassword" type="password" placeholder="${isEdit ? 'Dejar en blanco si no deseas cambiarla' : 'Mínimo 8 caracteres'}" ${isEdit ? '' : 'required'}>
          </div>
          <div class="field" style="grid-column: 1 / -1; display:flex; align-items:center; gap:8px; margin-top:4px">
            <input type="checkbox" id="uIsActive" ${isActive ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer">
            <label for="uIsActive" style="margin:0;cursor:pointer"><strong>Usuario activo (permite iniciar sesión en el BSC)</strong></label>
          </div>
        </div>
      `;

      showModal(title, bodyHtml, isEdit ? "Actualizar Usuario" : "Crear Usuario", async () => {
        const name = $('#uName').value.trim();
        const email = $('#uEmail').value.trim();
        const role = $('#uRole').value;
        const area = $('#uArea').value.trim();
        const password = $('#uPassword').value;
        const is_active = $('#uIsActive').checked ? 1 : 0;

        if (!name || !email || !area) {
          throw new Error('Completa los campos obligatorios (*).');
        }
        if (!isEdit && (!password || password.length < 8)) {
          throw new Error('La contraseña es obligatoria para nuevos usuarios y debe tener al menos 8 caracteres.');
        }

        const payload = {
          id: userToEdit ? userToEdit.id : '',
          name,
          email,
          role,
          area,
          password,
          is_active,
          avatar: modalUserAvatar
        };

        const res = await apiFetch('api/admin.php?action=save_user', {
          method: 'POST',
          body: payload
        });
        toast(res.message);
        if (isEdit && userToEdit.id === currentUser.id) {
          currentUser.name = name;
          currentUser.email = email;
          currentUser.role = role;
          currentUser.area = area;
          currentUser.avatar = modalUserAvatar;
          updateUserUI(currentUser);
        }
        closeModal();
        renderCurrentPage();
      }, eyebrow);

      // Modal Avatar handlers
      const modalAvatarBig = $('#modalUserAvatarPreview');
      const modalPicker = $('#modalUserFileInput');
      function setModalAvatar(data) {
        modalUserAvatar = data;
        if (data) {
          modalAvatarBig.innerHTML = `<img src="${escapeHtml(data)}" alt="Foto">`;
        } else {
          modalAvatarBig.textContent = '👤';
        }
        $$('.modal-preset-btn').forEach(b => {
          const idx = parseInt(b.dataset.idx, 10);
          b.classList.toggle('selected', AVATAR_PRESETS[idx]?.dataUrl === data);
        });
      }

      $('#btnModalUploadFile')?.addEventListener('click', () => modalPicker?.click());
      modalPicker?.addEventListener('change', async () => {
        const file = modalPicker.files?.[0];
        if (!file) return;
        try {
          const comp = await compressImageFile(file, 160, 160, 0.88);
          setModalAvatar(comp);
        } catch (e) {
          toast(e.message, 'bad');
        }
      });
      $('#btnModalRemoveFile')?.addEventListener('click', () => setModalAvatar(null));
      $$('.modal-preset-btn').forEach(b => {
        b.addEventListener('click', () => {
          const idx = parseInt(b.dataset.idx, 10);
          if (AVATAR_PRESETS[idx]) setModalAvatar(AVATAR_PRESETS[idx].dataUrl);
        });
      });
    }

    // Modal para Restablecer Contraseña desde Admin
    function openResetPasswordModal(user) {
      const title = `Restablecer Contraseña: ${user.name}`;
      const eyebrow = "SEGURIDAD DE USUARIO";
      const bodyHtml = `
        <div class="grid" style="gap:14px">
          <div class="field">
            <label><strong>Usuario Seleccionado</strong></label>
            <div style="font-weight:700;color:#1e3a8a;font-size:14px">${escapeHtml(user.name)}</div>
            <small class="muted">${escapeHtml(user.email)} · Rol: ${escapeHtml(user.role)}</small>
          </div>
          <div class="field">
            <label for="adminNewPass"><strong>Nueva Contraseña *</strong></label>
            <input id="adminNewPass" type="password" minlength="8" placeholder="Mínimo 8 caracteres" required>
          </div>
          <div class="field">
            <label for="adminConfirmPass"><strong>Confirmar Nueva Contraseña *</strong></label>
            <input id="adminConfirmPass" type="password" minlength="8" placeholder="Repite la contraseña" required>
          </div>
        </div>
      `;
      showModal(title, bodyHtml, "Restablecer Contraseña", async () => {
        const new_password = $('#adminNewPass').value;
        const confirm_password = $('#adminConfirmPass').value;
        if (!new_password || !confirm_password) throw new Error('Completa ambos campos.');
        if (new_password !== confirm_password) throw new Error('Las contraseñas no coinciden.');
        if (new_password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

        const r = await apiFetch('api/admin.php?action=reset_password', {
          method: 'POST',
          body: { id: user.id, new_password, confirm_password }
        });
        toast(r.message || 'Contraseña restablecida exitosamente.');
        closeModal();
      }, eyebrow);
    }

    // Modal para Períodos
    function openPeriodModal(periodToEdit = null) {
      const isEdit = !!periodToEdit;
      const title = isEdit ? `Editar Período: ${periodToEdit.id}` : "Registrar Nuevo Período";
      const eyebrow = isEdit ? "ACTUALIZAR PERÍODO" : "NUEVO PERÍODO";
      const bodyHtml = `
        <div class="grid detail-form-grid" style="gap:14px">
          <div class="field full-span">
            <label for="periodId"><strong>Código de Período *</strong></label>
            <input id="periodId" type="text" value="${escapeHtml(periodToEdit?.id || '')}" ${isEdit ? 'disabled' : 'required'} placeholder="Ej. 2026-Q1 o 2026-S1">
            <small class="muted">Identificador único del ciclo (sin espacios).</small>
          </div>
          <div class="field full-span">
            <label for="periodName"><strong>Nombre Descriptivo *</strong></label>
            <input id="periodName" type="text" value="${escapeHtml(periodToEdit?.name || '')}" placeholder="Ej. Primer Trimestre 2026" required>
          </div>
          <div class="field">
            <label for="periodStart"><strong>Fecha de Inicio *</strong></label>
            <input id="periodStart" type="date" value="${escapeHtml(periodToEdit?.start_date || '')}" required>
          </div>
          <div class="field">
            <label for="periodEnd"><strong>Fecha de Fin *</strong></label>
            <input id="periodEnd" type="date" value="${escapeHtml(periodToEdit?.end_date || '')}" required>
          </div>
          <div class="field full-span">
            <label for="periodStatus"><strong>Estado Operativo *</strong></label>
            <select id="periodStatus">
              <option value="Activo" ${periodToEdit?.status === 'Activo' ? 'selected' : ''}>Activo (Vigente para registro)</option>
              <option value="Histórico" ${periodToEdit?.status === 'Histórico' || !periodToEdit ? 'selected' : ''}>Histórico (Consultas y archivo)</option>
              <option value="Cerrado" ${periodToEdit?.status === 'Cerrado' ? 'selected' : ''}>Cerrado (Sin modificaciones)</option>
            </select>
          </div>
        </div>
      `;
      showModal(title, bodyHtml, isEdit ? "Actualizar Período" : "Crear Período", async () => {
        const id = isEdit ? periodToEdit.id : $('#periodId').value.trim();
        const name = $('#periodName').value.trim();
        const start_date = $('#periodStart').value;
        const end_date = $('#periodEnd').value;
        const status = $('#periodStatus').value;

        if (!id || !name || !start_date || !end_date) {
          throw new Error('Completa todos los campos obligatorios (*).');
        }
        if (end_date < start_date) {
          throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.');
        }

        const year = parseInt(start_date.slice(0, 4), 10) || new Date().getFullYear();
        const r = await apiFetch('api/admin.php?action=save_period', {
          method: 'POST',
          body: { id, name, year, start_date, end_date, status }
        });
        toast(r.message || 'Período guardado exitosamente.');
        closeModal();
        renderCurrentPage();
      }, eyebrow);
    }

    $('#btnAdminQuickNewUser')?.addEventListener('click', () => openUserModal(null));
    $('#btnNewUserModal')?.addEventListener('click', () => openUserModal(null));

    $$('[data-edit-user-id]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.editUserId;
        const u = usersRes.users.find(x => x.id === uid);
        if (u) openUserModal(u);
      });
    });

    $$('[data-reset-pass-user-id]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.resetPassUserId;
        const u = usersRes.users.find(x => x.id === uid);
        if (u) openResetPasswordModal(u);
      });
    });

    $$('[data-toggle-user-id]', container).forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.toggleUserId;
        const u = usersRes.users.find(x => x.id === uid);
        const act = u && Number(u.is_active) === 1 ? 'desactivar' : 'activar';
        if (confirm(`¿Estás seguro de ${act} el acceso de '${u?.name || 'este usuario'}'?`)) {
          try {
            const r = await apiFetch('api/admin.php?action=toggle_user_status', {
              method: 'POST',
              body: { id: uid }
            });
            toast(r.message);
            renderCurrentPage();
          } catch (err) {
            toast(err.message, 'bad');
          }
        }
      });
    });

    $$('[data-del-user-id]', container).forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.delUserId;
        const uname = btn.dataset.delUserName;
        if (confirm(`¿Estás seguro de eliminar al usuario '${uname}'? Esta acción no se puede deshacer.`)) {
          try {
            const r = await apiFetch('api/admin.php?action=delete_user', {
              method: 'POST',
              body: { id: uid }
            });
            toast(r.message);
            renderCurrentPage();
          } catch (err) {
            toast(err.message, 'bad');
          }
        }
      });
    });

    // Períodos handlers
    $('#btnNewPeriodModal')?.addEventListener('click', () => openPeriodModal(null));

    $$('[data-edit-period-id]', container).forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.editPeriodId;
        const p = periodsRes.periods.find(x => x.id === pid);
        if (p) openPeriodModal(p);
      });
    });

    $$('[data-set-active-period]', container).forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.setActivePeriod;
        if (confirm(`¿Estás seguro de establecer el período '${pid}' como Activo (Vigente)? Los demás períodos pasarán a estado Histórico.`)) {
          try {
            const r = await apiFetch('api/admin.php?action=set_active_period', {
              method: 'POST',
              body: { id: pid }
            });
            toast(r.message || 'Período activado exitosamente.');
            renderCurrentPage();
          } catch (err) {
            toast(err.message, 'bad');
          }
        }
      });
    });

    // Auditoría handlers (Buscador y filtro)
    const actSearchInput = $('#actSearchInput', container);
    const actActionFilter = $('#actActionFilter', container);
    const actBody = $('#activityLogsBody', container);

    let actDebounceTimer = null;
    async function reloadActivityLogs() {
      const q = actSearchInput?.value.trim() || '';
      const filter_action = actActionFilter?.value || '';
      try {
        const queryParams = new URLSearchParams();
        if (q) queryParams.set('q', q);
        if (filter_action) queryParams.set('filter_action', filter_action);
        const res = await apiFetch(`api/admin.php?action=activity&${queryParams.toString()}`);
        if (actBody) {
          actBody.innerHTML = renderActivityLogRows(res.logs || []);
        }
      } catch (err) {
        console.error('Error al filtrar auditoría:', err);
      }
    }

    actSearchInput?.addEventListener('input', () => {
      clearTimeout(actDebounceTimer);
      actDebounceTimer = setTimeout(reloadActivityLogs, 250);
    });
    actActionFilter?.addEventListener('change', reloadActivityLogs);

    // 4. RESET DEMO DB
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
    function fillDemoUser() {
      const u = $("#loginUser");
      const p = $("#loginPass");
      if (u) u.value = "admin@demo.com";
      if (p) p.value = "BSC2026!";
      $("#loginError")?.classList.add("hidden");
      $('#loginForm button[type="submit"]')?.focus();
    }
    $("#btnFillDemoUser")?.addEventListener("click", e => {
      e.stopPropagation();
      fillDemoUser();
    });
    $("#demoUserCard")?.addEventListener("click", fillDemoUser);

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

    $('#sidebarCollapseBtn')?.addEventListener('click', toggleSidebarCollapse);
    $('#menuToggle').addEventListener('click', () => setSidebar(!$('#sidebar').classList.contains('open')));
    $('#sidebarClose').addEventListener('click', () => setSidebar(false));
    $('#sidebarBackdrop').addEventListener('click', () => setSidebar(false));
    matchMedia('(max-width: 768px)').addEventListener('change', () => setSidebar(false));
    setSidebar(false);

    // Profile navigation
    function openProfileSection() {
      if (currentUser?.role === 'Administrador') {
        currentAdminTab = 'perfil';
        navigate('administracion');
      } else {
        toast('Conectado como: ' + (currentUser?.name || 'Usuario') + ' (' + (currentUser?.role || '') + ')');
      }
    }
    $('#sideUserProfileCard')?.addEventListener('click', (e) => {
      if (e.target.closest('#logoutBtn')) return;
      openProfileSection();
    });
    $('#sideEditProfileBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileSection();
    });
    $('#topProfileBtn')?.addEventListener('click', openProfileSection);

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
