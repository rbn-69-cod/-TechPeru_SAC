import { escapeHtml, fmt, currency, today, $, $$ } from './core.js';

/**
 * MÓDULOS DE GESTIÓN INTEGRAL DE BOTICA — TECHPERU SAC
 * Conexión completa con Backend PHP & Base de Datos SQLite
 * Arquitectura basada en microservicios MediZano con fallback local resiliente
 */

export function createBoticaModule(apiFetch, toast) {

  // =========================================================================
  // 1. DASHBOARD BOTICA
  // =========================================================================
  async function renderBoticaDashboard(container) {
    container.innerHTML = `<div class="loading-state">Cargando métricas de botica...</div>`;
    const res = await apiFetch('api/pharmacy_dashboard.php');
    if (!res || !res.success) throw new Error(res?.error || 'No se pudo cargar el dashboard de botica.');

    const d = res.dashboard;
    const vHoy = d.ventas_hoy;
    const inv = d.inventario;
    const caja = d.caja_activa;
    const medizano = d.medizano_integration;

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">OPERACIÓN DIARIA · FARMACIA & DISPENSACIÓN</span>
          <h1>Dashboard de Botica</h1>
          <p class="muted">Monitoreo en tiempo real de ventas, inventario FEFO, caja y conectividad.</p>
        </div>
        <div class="header-actions">
          <button class="btn secondary" id="btnRefreshDash">↻ Actualizar</button>
          <button class="btn primary" id="btnGoToPos">🛒 Abrir Terminal POS</button>
        </div>
      </section>

      <!-- BANNER DE INTEGRACIÓN MEDIZANO -->
      <div class="banner-integration ${medizano.online ? 'banner-online' : 'banner-local'}">
        <div class="banner-status-badge">
          <span class="pulse-dot ${medizano.online ? 'pulse-green' : 'pulse-amber'}"></span>
          <strong>Modo: ${escapeHtml(medizano.mode === 'ONLINE_INTEGRATED' ? 'Conectado a MediZano Microservicios' : 'Operación Autónoma Local (SQLite)')}</strong>
        </div>
        <div class="banner-info">
          <span>Gateway: <code>${escapeHtml(medizano.gateway_url)}</code></span> · 
          <span>${escapeHtml(medizano.message)}</span>
        </div>
        <button class="btn btn-sm secondary" id="btnPingMediZano">Probar Gateway</button>
      </div>

      <!-- KPI METRIC CARDS -->
      <div class="kpi-grid botica-kpi-grid">
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-badge good">Hoy</span>
            <span class="kpi-card-title">Ventas del Día</span>
          </div>
          <div class="kpi-card-value">${currency(vHoy.total)}</div>
          <div class="kpi-card-footer">
            <span><b>${vHoy.tickets}</b> tickets emitidos</span>
            <small class="muted">Subt: ${currency(vHoy.subtotal)} | IGV: ${currency(vHoy.igv)}</small>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-badge neutral">Stock</span>
            <span class="kpi-card-title">Inventario Valorizado</span>
          </div>
          <div class="kpi-card-value">${currency(inv.valoracion_inventario)}</div>
          <div class="kpi-card-footer">
            <span><b>${inv.total_productos}</b> medicamentos activos</span>
            <small class="muted">${inv.total_unidades} unidades físicas en almacén</small>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-badge ${inv.proximos_vencer_count > 0 ? 'warning' : 'good'}">FEFO</span>
            <span class="kpi-card-title">Lotes por Vencer (&le;90d)</span>
          </div>
          <div class="kpi-card-value ${inv.proximos_vencer_count > 0 ? 'text-warn' : ''}">${inv.proximos_vencer_count}</div>
          <div class="kpi-card-footer">
            <span>${inv.vencidos_count > 0 ? `<b class="text-danger">${inv.vencidos_count} vencidos</b>` : '0 lotes vencidos'}</span>
            <button class="link-btn" id="btnVerLotesExp">Ver lotes &rarr;</button>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-badge ${caja ? 'good' : 'warning'}">Caja</span>
            <span class="kpi-card-title">Turno Actual</span>
          </div>
          <div class="kpi-card-value">${caja ? currency(caja.recaudado) : 'CERRADA'}</div>
          <div class="kpi-card-footer">
            <span>${caja ? `Cajero: <b>${escapeHtml(caja.cajero)}</b>` : 'Sin turno abierto'}</span>
            <button class="link-btn" id="btnVerCaja">${caja ? 'Arqueo &rarr;' : 'Aperturar &rarr;'}</button>
          </div>
        </div>
      </div>

      <!-- SECCIÓN PRINCIPAL: TENDENCIAS Y TOP PRODUCTOS -->
      <div class="dashboard-columns">
        <div class="panel">
          <div class="panel-header">
            <h3>Top 5 Medicamentos Más Vendidos</h3>
            <button class="btn btn-sm secondary" id="btnVerCatalogo">Catálogo completo</button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Medicamento</th>
                  <th>Presentación</th>
                  <th>Unidades</th>
                  <th>Total Venta</th>
                </tr>
              </thead>
              <tbody>
                ${(d.top_productos || []).map(p => `
                  <tr>
                    <td><code>${escapeHtml(p.codigo)}</code></td>
                    <td><strong>${escapeHtml(p.nombre_comercial)}</strong></td>
                    <td><small class="muted">${escapeHtml(p.presentacion || '')}</small></td>
                    <td><b>${p.unidades_vendidas}</b></td>
                    <td>${currency(p.total_recaudado)}</td>
                  </tr>
                `).join('')}
                ${(!d.top_productos || d.top_productos.length === 0) ? '<tr><td colspan="5" class="empty-cell">No hay ventas registradas aún.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h3>Distribución de Métodos de Pago</h3>
          </div>
          <div class="payments-breakdown">
            ${(d.metodos_pago || []).map(m => `
              <div class="payment-stat-card">
                <div class="pay-method-badge pay-${escapeHtml(m.metodo_pago.toLowerCase())}">${escapeHtml(m.metodo_pago)}</div>
                <div class="pay-amount">${currency(m.total)}</div>
                <small class="muted">${m.tickets} transacciones</small>
              </div>
            `).join('')}
            ${(!d.metodos_pago || d.metodos_pago.length === 0) ? '<p class="muted">Sin transacciones registradas hoy.</p>' : ''}
          </div>
        </div>
      </div>

      <!-- ÚLTIMAS VENTAS -->
      <div class="panel mt-4">
        <div class="panel-header">
          <h3>Últimas Ventas Emitidas</h3>
          <button class="btn btn-sm secondary" id="btnVerTodasVentas">Ver todas las ventas</button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Método</th>
                <th>Total</th>
                <th>Cajero</th>
                <th>Fecha / Hora</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${(d.ultimas_ventas || []).map(v => `
                <tr>
                  <td><code>${escapeHtml(v.codigo_venta)}</code></td>
                  <td><strong>${escapeHtml(v.comprobante_numero || 'S/C')}</strong></td>
                  <td>${escapeHtml(v.cliente_nombre || 'Público General')}</td>
                  <td><span class="pay-tag">${escapeHtml(v.metodo_pago)}</span></td>
                  <td><b>${currency(v.total)}</b></td>
                  <td><small>${escapeHtml(v.usuario_nombre || 'Sistema')}</small></td>
                  <td><small class="muted">${escapeHtml(v.created_at)}</small></td>
                  <td><span class="status-badge ${v.estado === 'COMPLETADA' ? 'status-good' : 'status-bad'}">${escapeHtml(v.estado)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Event listeners
    $('#btnRefreshDash').onclick = () => renderBoticaDashboard(container);
    $('#btnGoToPos').onclick = () => window.navigateToPage('botica_pos');
    $('#btnVerLotesExp').onclick = () => window.navigateToPage('botica_lotes');
    $('#btnVerCaja').onclick = () => window.navigateToPage('botica_caja');
    $('#btnVerCatalogo').onclick = () => window.navigateToPage('botica_productos');
    $('#btnVerTodasVentas').onclick = () => window.navigateToPage('botica_comprobantes');
    $('#btnPingMediZano').onclick = async () => {
      toast('Verificando conexión con MediZano Gateway...', 'info');
      const ping = await apiFetch('api/botica_settings.php?action=check_medizano');
      if (ping && ping.medizano) {
        toast(ping.medizano.online ? '✓ Gateway MediZano en línea' : 'Operando en modo local (SQLite)', ping.medizano.online ? 'success' : 'info');
        renderBoticaDashboard(container);
      }
    };
  }

  // =========================================================================
  // 2. PUNTO DE VENTA (POS) Y DISPENSACIÓN FEFO
  // =========================================================================
  let posCart = [];
  let posShift = null;
  let posClients = [];

  async function renderBoticaPos(container) {
    container.innerHTML = `<div class="loading-state">Iniciando Terminal POS...</div>`;

    // 1. Verificar Turno de Caja y Clientes
    const [shiftRes, cliRes] = await Promise.all([
      apiFetch('api/pos.php?action=active_shift'),
      apiFetch('api/customers.php')
    ]);

    posShift = shiftRes?.shift || null;
    posClients = cliRes?.customers || [];

    if (!posShift) {
      container.innerHTML = `
        <div class="pos-no-shift empty-state">
          <h2>⚠️ Caja Cerrada</h2>
          <p>Para emitir ventas y dispensar medicamentos, debes aperturar un turno de caja.</p>
          <div class="open-shift-box">
            <label>Monto de apertura en efectivo (S/):</label>
            <input type="number" id="inpMontoApertura" class="form-control" value="250.00" step="0.50" min="0">
            <button class="btn primary" id="btnAperturarCajaPos">Aperturar Turno de Caja</button>
          </div>
        </div>
      `;
      $('#btnAperturarCajaPos').onclick = async () => {
        const monto = parseFloat($('#inpMontoApertura').value) || 0;
        const openRes = await apiFetch('api/cash_register.php?action=open', {
          method: 'POST',
          body: JSON.stringify({ monto_apertura: monto, observaciones: 'Apertura desde Terminal POS' })
        });
        if (openRes && openRes.success) {
          toast('Turno de caja aperturado correctamente', 'success');
          renderBoticaPos(container);
        }
      };
      return;
    }

    // Render POS Workspace
    container.innerHTML = `
      <div class="pos-workspace">
        <!-- BARRA SUPERIOR POS -->
        <div class="pos-header">
          <div>
            <span class="eyebrow">TERMINAL DE VENTAS · DESPACHO FEFO</span>
            <h2>Punto de Venta (POS)</h2>
          </div>
          <div class="pos-cashier-pill">
            <span class="online-indicator"></span>
            <span>Turno #${posShift.id} · Cajero: <b>${escapeHtml(posShift.usuario_nombre || 'Usuario')}</b></span>
            <span class="badge neutral">Fondo: ${currency(posShift.monto_apertura)}</span>
          </div>
        </div>

        <div class="pos-grid">
          <!-- COLUMNA IZQUIERDA: BÚSQUEDA Y CATÁLOGO DE PRODUCTOS -->
          <div class="pos-catalog-column">
            <div class="pos-search-bar">
              <input type="text" id="posSearchInput" class="form-control" placeholder="Buscar por código de barras, nombre comercial o principio activo..." autofocus>
              <button class="btn secondary" id="btnSearchPos">Buscar</button>
            </div>

            <div id="posProductsList" class="pos-products-grid">
              <div class="loading-state">Cargando medicamentos...</div>
            </div>
          </div>

          <!-- COLUMNA DERECHA: TICKET Y COBRO -->
          <div class="pos-ticket-column panel">
            <div class="pos-ticket-header">
              <h3>Detalle de Venta</h3>
              <button class="btn btn-sm secondary" id="btnClearCart" title="Limpiar carrito">Vaciar</button>
            </div>

            <!-- SELECCIÓN DE CLIENTE -->
            <div class="form-group mb-2">
              <label class="form-label-sm">Cliente:</label>
              <select id="posClientSelect" class="form-control">
                <option value="1">00000000 - CLIENTES VARIOS (Público General)</option>
                ${posClients.filter(c => c.id !== 1).map(c => `
                  <option value="${c.id}">${escapeHtml(c.numero_documento)} - ${escapeHtml(c.nombre_razon_social)} (${escapeHtml(c.tipo_documento)})</option>
                `).join('')}
              </select>
            </div>

            <!-- TIPO DE COMPROBANTE -->
            <div class="form-group mb-2">
              <label class="form-label-sm">Tipo de Comprobante:</label>
              <div class="pos-btn-group" id="btnGroupComp">
                <button type="button" class="pos-tab active" data-comp="BOLETA">Boleta (B001)</button>
                <button type="button" class="pos-tab" data-comp="FACTURA">Factura (F001)</button>
                <button type="button" class="pos-tab" data-comp="NOTA_VENTA">Nota Vta (NV01)</button>
              </div>
            </div>

            <!-- LISTA DE ÍTEMS EN EL CARRITO -->
            <div class="pos-cart-items" id="posCartItems">
              <p class="empty-state">El carrito está vacío. Busca o haz clic en un medicamento para agregarlo.</p>
            </div>

            <!-- TOTALES Y COBRO -->
            <div class="pos-totals-box">
              <div class="pos-tot-row">
                <span>Subtotal (Neto):</span>
                <span id="posSubtotalLbl">S/ 0.00</span>
              </div>
              <div class="pos-tot-row">
                <span>IGV (18%):</span>
                <span id="posIgvLbl">S/ 0.00</span>
              </div>
              <div class="pos-tot-row pos-tot-main">
                <strong>TOTAL A PAGAR:</strong>
                <strong id="posTotalLbl">S/ 0.00</strong>
              </div>

              <!-- MÉTODO DE PAGO -->
              <div class="pos-pay-selector mt-2">
                <label class="form-label-sm">Método de Pago:</label>
                <div class="pos-btn-group" id="btnGroupPay">
                  <button type="button" class="pos-tab active" data-pay="EFECTIVO">💵 Efectivo</button>
                  <button type="button" class="pos-tab" data-pay="YAPE">📱 Yape / Plin</button>
                  <button type="button" class="pos-tab" data-pay="TARJETA">💳 Tarjeta</button>
                </div>
              </div>

              <div class="pos-cash-calc mt-2" id="posCashCalc">
                <div class="form-group">
                  <label class="form-label-sm">Monto Recibido (S/):</label>
                  <input type="number" id="posMontoRecibido" class="form-control" step="0.50" value="0.00">
                </div>
                <div class="pos-vuelto-box">
                  <span>Vuelto:</span>
                  <strong id="posVueltoLbl" class="text-good">S/ 0.00</strong>
                </div>
              </div>

              <button class="btn primary full btn-lg mt-3" id="btnEmitirVenta" disabled>
                EMITIR COMPROBANTE Y COBRAR &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cargar productos en catálogo
    async function searchPosProducts(q = '') {
      const pGrid = $('#posProductsList');
      pGrid.innerHTML = `<div class="loading-state">Buscando medicamentos...</div>`;
      const res = await apiFetch(`api/pos.php?action=search_products&q=${encodeURIComponent(q)}`);
      const prods = res?.products || [];

      if (prods.length === 0) {
        pGrid.innerHTML = `<p class="empty-state">No se encontraron medicamentos disponibles con stock para "${escapeHtml(q)}".</p>`;
        return;
      }

      pGrid.innerHTML = prods.map(p => {
        const nextLot = p.lotes_fefo?.[0];
        const isExpiring = nextLot && (new Date(nextLot.fecha_vencimiento) - new Date()) / (1000*60*60*24) <= 90;
        return `
          <div class="pos-prod-card" data-id="${p.id}">
            <div class="pos-prod-code">${escapeHtml(p.codigo)} · ${escapeHtml(p.categoria_nombre || '')}</div>
            <div class="pos-prod-name">${escapeHtml(p.nombre_comercial)}</div>
            <div class="pos-prod-sub">${escapeHtml(p.principio_activo)} · ${escapeHtml(p.presentacion || '')}</div>
            <div class="pos-prod-footer">
              <span class="pos-prod-price">${currency(p.precio_venta)}</span>
              <span class="pos-prod-stock badge ${p.stock_actual <= p.stock_minimo ? 'bad' : 'good'}">Stock: ${p.stock_actual}</span>
            </div>
            ${nextLot ? `
              <div class="pos-fefo-pill ${isExpiring ? 'fefo-warn' : ''}">
                <small>FEFO: Lote ${escapeHtml(nextLot.numero_lote)} (Vence: ${escapeHtml(nextLot.fecha_vencimiento)})</small>
              </div>
            ` : ''}
            ${p.receta_medica ? '<span class="badge bad badge-receta">Req. Receta Médica</span>' : ''}
          </div>
        `;
      }).join('');

      // Click para agregar al carrito
      $$('.pos-prod-card', pGrid).forEach(card => {
        card.onclick = () => {
          const id = parseInt(card.dataset.id, 10);
          const p = prods.find(item => item.id === id);
          if (p) addToCart(p);
        };
      });
    }

    function addToCart(p) {
      const existing = posCart.find(item => item.id === p.id);
      if (existing) {
        if (existing.cantidad + 1 > p.stock_actual) {
          toast(`Stock máximo disponible alcanzado (${p.stock_actual} unidades)`, 'warning');
          return;
        }
        existing.cantidad += 1;
      } else {
        posCart.push({
          id: p.id,
          codigo: p.codigo,
          nombre_comercial: p.nombre_comercial,
          precio_venta: p.precio_venta,
          stock_actual: p.stock_actual,
          cantidad: 1
        });
      }
      updateCartUI();
    }

    function updateCartUI() {
      const cBox = $('#posCartItems');
      const btnCobrar = $('#btnEmitirVenta');

      if (posCart.length === 0) {
        cBox.innerHTML = `<p class="empty-state">El carrito está vacío. Haz clic en un medicamento para agregarlo.</p>`;
        $('#posSubtotalLbl').textContent = 'S/ 0.00';
        $('#posIgvLbl').textContent = 'S/ 0.00';
        $('#posTotalLbl').textContent = 'S/ 0.00';
        $('#posMontoRecibido').value = '0.00';
        $('#posVueltoLbl').textContent = 'S/ 0.00';
        btnCobrar.disabled = true;
        return;
      }

      let total = 0;
      cBox.innerHTML = posCart.map((item, idx) => {
        const sub = item.cantidad * item.precio_venta;
        total += sub;
        return `
          <div class="pos-cart-row">
            <div class="pos-cart-info">
              <strong>${escapeHtml(item.nombre_comercial)}</strong>
              <small class="muted">${currency(item.precio_venta)} c/u · Stock: ${item.stock_actual}</small>
            </div>
            <div class="pos-cart-qty">
              <button class="btn-qty btn-minus" data-idx="${idx}">-</button>
              <input type="number" class="inp-cart-qty" data-idx="${idx}" value="${item.cantidad}" min="1" max="${item.stock_actual}">
              <button class="btn-qty btn-plus" data-idx="${idx}">+</button>
            </div>
            <div class="pos-cart-sub">
              ${currency(sub)}
            </div>
            <button class="btn-del-cart" data-idx="${idx}" title="Quitar">&times;</button>
          </div>
        `;
      }).join('');

      const subNeto = total / 1.18;
      const igv = total - subNeto;

      $('#posSubtotalLbl').textContent = currency(subNeto);
      $('#posIgvLbl').textContent = currency(igv);
      $('#posTotalLbl').textContent = currency(total);

      // Calcular vuelto
      const mRecibido = parseFloat($('#posMontoRecibido').value) || 0;
      if (mRecibido === 0 || mRecibido < total) {
        $('#posMontoRecibido').value = total.toFixed(2);
        $('#posVueltoLbl').textContent = 'S/ 0.00';
      } else {
        $('#posVueltoLbl').textContent = currency(mRecibido - total);
      }

      btnCobrar.disabled = false;

      // Listeners de cantidad y eliminar
      $$('.btn-minus', cBox).forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.idx, 10);
          if (posCart[idx].cantidad > 1) {
            posCart[idx].cantidad -= 1;
          } else {
            posCart.splice(idx, 1);
          }
          updateCartUI();
        };
      });

      $$('.btn-plus', cBox).forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.idx, 10);
          if (posCart[idx].cantidad + 1 <= posCart[idx].stock_actual) {
            posCart[idx].cantidad += 1;
            updateCartUI();
          } else {
            toast('Stock máximo alcanzado', 'warning');
          }
        };
      });

      $$('.inp-cart-qty', cBox).forEach(inp => {
        inp.onchange = () => {
          const idx = parseInt(inp.dataset.idx, 10);
          let val = parseInt(inp.value, 10) || 1;
          val = Math.max(1, Math.min(posCart[idx].stock_actual, val));
          posCart[idx].cantidad = val;
          updateCartUI();
        };
      });

      $$('.btn-del-cart', cBox).forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.idx, 10);
          posCart.splice(idx, 1);
          updateCartUI();
        };
      });
    }

    // Eventos de Comprobante y Método de Pago
    let currentComp = 'BOLETA';
    let currentPay = 'EFECTIVO';

    $$('#btnGroupComp button').forEach(b => {
      b.onclick = () => {
        $$('#btnGroupComp button').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        currentComp = b.dataset.comp;
      };
    });

    $$('#btnGroupPay button').forEach(b => {
      b.onclick = () => {
        $$('#btnGroupPay button').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        currentPay = b.dataset.pay;
        $('#posCashCalc').style.display = (currentPay === 'EFECTIVO') ? 'block' : 'none';
      };
    });

    $('#posMontoRecibido').oninput = () => {
      const tot = posCart.reduce((sum, item) => sum + (item.cantidad * item.precio_venta), 0);
      const rec = parseFloat($('#posMontoRecibido').value) || 0;
      $('#posVueltoLbl').textContent = currency(Math.max(0, rec - tot));
    };

    $('#btnClearCart').onclick = () => {
      posCart = [];
      updateCartUI();
    };

    $('#posSearchInput').oninput = (e) => searchPosProducts(e.target.value);
    $('#btnSearchPos').onclick = () => searchPosProducts($('#posSearchInput').value);

    // COBRAR Y PROCESAR VENTA
    $('#btnEmitirVenta').onclick = async () => {
      if (posCart.length === 0) return;
      const btn = $('#btnEmitirVenta');
      btn.disabled = true;
      btn.textContent = 'Procesando venta y despacho FEFO...';

      const clienteId = parseInt($('#posClientSelect').value, 10) || 1;
      const mRecibido = parseFloat($('#posMontoRecibido').value) || 0;

      const payload = {
        cliente_id: clienteId,
        metodo_pago: currentPay,
        tipo_comprobante: currentComp,
        monto_recibido: mRecibido,
        items: posCart.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_venta
        }))
      };

      try {
        const res = await apiFetch('api/pos.php?action=create_sale', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res && res.success) {
          toast(`✓ Venta completada exitosamente (${res.sale.comprobante_numero})`, 'success');
          showThermalTicketModal(res.sale);
          posCart = [];
          updateCartUI();
          searchPosProducts($('#posSearchInput').value);
        } else {
          toast(res?.error || 'Error al emitir venta', 'error');
        }
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'EMITIR COMPROBANTE Y COBRAR →';
      }
    };

    // Búsqueda inicial
    searchPosProducts();
  }

  // MODAL DE COMPROBANTE / TICKET TÉRMICO
  function showThermalTicketModal(sale) {
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="pos-ticket-paper">
        <div class="ticket-header">
          <h3>TECHPERU SAC</h3>
          <p>BOTICA & FARMACIA CENTRAL</p>
          <small>RUC: 20601234567</small><br>
          <small>Av. República de Panamá 3545, San Isidro</small>
        </div>
        <div class="ticket-divider">================================</div>
        <div class="ticket-body">
          <div><strong>COMPROBANTE: ${escapeHtml(sale.comprobante_numero)}</strong></div>
          <div>Código Venta: ${escapeHtml(sale.codigo_venta)}</div>
          <div>Cliente: ${escapeHtml(sale.cliente)}</div>
          <div>Forma de Pago: ${escapeHtml(sale.metodo_pago)}</div>
        </div>
        <div class="ticket-divider">--------------------------------</div>
        <div class="ticket-totals">
          <div class="d-flex justify-between"><span>Subtotal Neto:</span> <span>${currency(sale.subtotal)}</span></div>
          <div class="d-flex justify-between"><span>IGV (18%):</span> <span>${currency(sale.igv)}</span></div>
          <div class="d-flex justify-between ticket-tot-main"><strong>TOTAL:</strong> <strong>${currency(sale.total)}</strong></div>
          <div class="d-flex justify-between"><small>Importe Recibido:</small> <small>${currency(sale.monto_recibido)}</small></div>
          <div class="d-flex justify-between"><small>Vuelto:</small> <small>${currency(sale.vuelto)}</small></div>
        </div>
        <div class="ticket-divider">================================</div>
        <div class="ticket-footer text-center">
          <small>¡Gracias por su compra!<br>Conserve su comprobante para cualquier reclamo.</small>
          ${sale.medizano_sync?.synced ? '<br><small class="text-good">✓ Sincronizado con MediZano</small>' : '<br><small class="muted">Comprobante Interno Emitido</small>'}
        </div>
        <div class="ticket-actions mt-3">
          <button class="btn primary btn-sm full" id="btnPrintTicket">Imprimir Ticket</button>
          <button class="btn secondary btn-sm full mt-1" id="btnCloseTicket">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnCloseTicket', modal).onclick = () => modal.remove();
    $('#btnPrintTicket', modal).onclick = () => {
      window.print();
    };
  }

  // =========================================================================
  // 3. CATÁLOGO DE PRODUCTOS Y MEDICAMENTOS
  // =========================================================================
  async function renderBoticaProductos(container) {
    container.innerHTML = `<div class="loading-state">Cargando catálogo farmacéutico...</div>`;
    const [prodsRes, catsRes, labsRes] = await Promise.all([
      apiFetch('api/products.php'),
      apiFetch('api/products.php?action=categories'),
      apiFetch('api/products.php?action=laboratories')
    ]);

    const prods = prodsRes?.products || [];
    const cats = catsRes?.categories || [];
    const labs = labsRes?.laboratories || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">CATÁLOGO OFICIAL · VENTA & DISPENSACIÓN</span>
          <h1>Catálogo de Productos y Medicamentos</h1>
          <p class="muted">Gestión de medicamentos, principios activos, concentraciones, precios y stock.</p>
        </div>
        <div class="header-actions">
          <button class="btn primary" id="btnNuevoProd">+ Nuevo Medicamento</button>
        </div>
      </section>

      <!-- FILTROS -->
      <div class="panel mb-3">
        <div class="filter-row">
          <div class="filter-group flex-2">
            <input type="text" id="inpProdSearch" class="form-control" placeholder="Buscar por código, nombre o principio activo...">
          </div>
          <div class="filter-group">
            <select id="selProdCat" class="form-control">
              <option value="">Todas las categorías</option>
              ${cats.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <select id="selProdLab" class="form-control">
              <option value="">Todos los laboratorios</option>
              ${labs.map(l => `<option value="${l.id}">${escapeHtml(l.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="checkbox-inline">
              <input type="checkbox" id="chkLowStock"> Solo bajo stock
            </label>
          </div>
        </div>
      </div>

      <!-- TABLA DE PRODUCTOS -->
      <div class="panel">
        <div class="table-responsive">
          <table class="data-table" id="tableProds">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre Comercial</th>
                <th>Principio Activo</th>
                <th>Concentración / Presentación</th>
                <th>Laboratorio</th>
                <th>P. Compra</th>
                <th>P. Venta</th>
                <th>Stock</th>
                <th>Receta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${renderProductRows(prods)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    function renderProductRows(list) {
      if (list.length === 0) return '<tr><td colspan="11" class="empty-cell">No se encontraron medicamentos.</td></tr>';
      return list.map(p => `
        <tr>
          <td><code>${escapeHtml(p.codigo)}</code></td>
          <td><strong>${escapeHtml(p.nombre_comercial)}</strong></td>
          <td>${escapeHtml(p.principio_activo)}</td>
          <td><small>${escapeHtml(p.concentracion || '')} · ${escapeHtml(p.presentacion || '')}</small></td>
          <td><small class="muted">${escapeHtml(p.laboratorio_nombre || 'N/A')}</small></td>
          <td>${currency(p.precio_compra)}</td>
          <td><b>${currency(p.precio_venta)}</b></td>
          <td>
            <span class="badge ${p.stock_actual <= p.stock_minimo ? 'bad' : 'good'}">
              ${p.stock_actual} unid. (Mín: ${p.stock_minimo})
            </span>
          </td>
          <td>${p.receta_medica ? '<span class="badge bad">SÍ</span>' : '<span class="badge neutral">NO</span>'}</td>
          <td><span class="status-badge ${p.estado === 'Activo' ? 'status-good' : 'status-bad'}">${escapeHtml(p.estado)}</span></td>
          <td>
            <button class="btn btn-sm secondary btn-edit-prod" data-id="${p.id}">Editar</button>
          </td>
        </tr>
      `).join('');
    }

    // Filtrado dinámico
    const applyFilters = async () => {
      const q = $('#inpProdSearch').value;
      const cat = $('#selProdCat').value;
      const lab = $('#selProdLab').value;
      const low = $('#chkLowStock').checked ? '1' : '';

      const filtered = await apiFetch(`api/products.php?search=${encodeURIComponent(q)}&categoria_id=${cat}&laboratorio_id=${lab}&solo_bajo_stock=${low}`);
      $('#tableProds tbody').innerHTML = renderProductRows(filtered?.products || []);
      wireEditButtons();
    };

    $('#inpProdSearch').oninput = applyFilters;
    $('#selProdCat').onchange = applyFilters;
    $('#selProdLab').onchange = applyFilters;
    $('#chkLowStock').onchange = applyFilters;

    function wireEditButtons() {
      $$('.btn-edit-prod').forEach(b => {
        b.onclick = async () => {
          const id = parseInt(b.dataset.id, 10);
          const pRes = await apiFetch(`api/products.php?action=detail&id=${id}`);
          if (pRes?.product) showProductModal(pRes.product, cats, labs, () => renderBoticaProductos(container));
        };
      });
    }

    $('#btnNuevoProd').onclick = () => showProductModal(null, cats, labs, () => renderBoticaProductos(container));
    wireEditButtons();
  }

  function showProductModal(prod, cats, labs, onSaved) {
    const isEdit = prod !== null;
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h3>${isEdit ? 'Editar Medicamento' : 'Nuevo Medicamento'}</h3>
          <button class="icon-btn" id="btnModalClose">&times;</button>
        </div>
        <form id="formProduct" class="modal-body form-grid">
          <div class="form-group">
            <label>Código de Producto *</label>
            <input type="text" name="codigo" class="form-control" value="${escapeHtml(prod?.codigo || '')}" required ${isEdit ? 'readonly' : ''}>
          </div>
          <div class="form-group">
            <label>Código de Barras (EAN/UPC)</label>
            <input type="text" name="codigo_barras" class="form-control" value="${escapeHtml(prod?.codigo_barras || '')}">
          </div>
          <div class="form-group span-2">
            <label>Nombre Comercial *</label>
            <input type="text" name="nombre_comercial" class="form-control" value="${escapeHtml(prod?.nombre_comercial || '')}" required>
          </div>
          <div class="form-group span-2">
            <label>Principio Activo *</label>
            <input type="text" name="principio_activo" class="form-control" value="${escapeHtml(prod?.principio_activo || '')}" required>
          </div>
          <div class="form-group">
            <label>Concentración</label>
            <input type="text" name="concentracion" class="form-control" value="${escapeHtml(prod?.concentracion || '')}" placeholder="Ej: 500 mg">
          </div>
          <div class="form-group">
            <label>Presentación</label>
            <input type="text" name="presentacion" class="form-control" value="${escapeHtml(prod?.presentacion || '')}" placeholder="Ej: Caja x 100 tabletas">
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <select name="categoria_id" class="form-control">
              <option value="">Seleccione categoría</option>
              ${cats.map(c => `<option value="${c.id}" ${prod?.categoria_id === c.id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Laboratorio</label>
            <select name="laboratorio_id" class="form-control">
              <option value="">Seleccione laboratorio</option>
              ${labs.map(l => `<option value="${l.id}" ${prod?.laboratorio_id === l.id ? 'selected' : ''}>${escapeHtml(l.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Precio Compra (S/)</label>
            <input type="number" step="0.01" name="precio_compra" class="form-control" value="${prod?.precio_compra || 0.0}">
          </div>
          <div class="form-group">
            <label>Precio Venta (S/) *</label>
            <input type="number" step="0.01" name="precio_venta" class="form-control" value="${prod?.precio_venta || 0.0}" required>
          </div>
          <div class="form-group">
            <label>Stock Mínimo de Alerta</label>
            <input type="number" name="stock_minimo" class="form-control" value="${prod?.stock_minimo || 10}">
          </div>
          <div class="form-group">
            <label>Ubicación en Anaquel</label>
            <input type="text" name="ubicacion" class="form-control" value="${escapeHtml(prod?.ubicacion || '')}" placeholder="Ej: Anaquel A-2">
          </div>
          <div class="form-group span-2">
            <label class="checkbox-inline">
              <input type="checkbox" name="receta_medica" ${prod?.receta_medica ? 'checked' : ''}> Requiere Receta Médica Obligatoria
            </label>
          </div>
          <div class="modal-footer span-2">
            <button type="button" class="btn secondary" id="btnModalCancel">Cancelar</button>
            <button type="submit" class="btn primary">Guardar Medicamento</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnModalClose', modal).onclick = () => modal.remove();
    $('#btnModalCancel', modal).onclick = () => modal.remove();

    $('#formProduct', modal).onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        id: isEdit ? prod.id : undefined,
        codigo: form.codigo.value,
        codigo_barras: form.codigo_barras.value,
        nombre_comercial: form.nombre_comercial.value,
        principio_activo: form.principio_activo.value,
        concentracion: form.concentracion.value,
        presentacion: form.presentacion.value,
        categoria_id: form.categoria_id.value ? parseInt(form.categoria_id.value, 10) : null,
        laboratorio_id: form.laboratorio_id.value ? parseInt(form.laboratorio_id.value, 10) : null,
        precio_compra: parseFloat(form.precio_compra.value) || 0,
        precio_venta: parseFloat(form.precio_venta.value) || 0,
        stock_minimo: parseInt(form.stock_minimo.value, 10) || 10,
        ubicacion: form.ubicacion.value,
        receta_medica: form.receta_medica.checked ? 1 : 0
      };

      const res = await apiFetch('api/products.php?action=save', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (res && res.success) {
        toast('Medicamento guardado con éxito', 'success');
        modal.remove();
        onSaved();
      } else {
        toast(res?.error || 'Error al guardar medicamento', 'error');
      }
    };
  }

  // =========================================================================
  // 4. CONTROL DE LOTES, FEFO Y AJUSTES DE INVENTARIO
  // =========================================================================
  async function renderBoticaLotes(container) {
    container.innerHTML = `<div class="loading-state">Cargando control de lotes y vencimientos FEFO...</div>`;
    const [lotesRes, prodsRes] = await Promise.all([
      apiFetch('api/inventory.php?action=lotes'),
      apiFetch('api/products.php')
    ]);

    const lotes = lotesRes?.lotes || [];
    const prods = prodsRes?.products || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">POLÍTICA FEFO · PRIMERO EN VENCER, PRIMERO EN SALIR</span>
          <h1>Control de Lotes y Vencimientos</h1>
          <p class="muted">Priorización automática de despacho por fecha de caducidad para prevenir mermas.</p>
        </div>
        <div class="header-actions">
          <button class="btn secondary" id="btnAjusteStockManual">⚖ Ajuste de Stock</button>
          <button class="btn primary" id="btnNuevoLoteModal">+ Nuevo Lote</button>
        </div>
      </section>

      <!-- TABLA DE LOTES FEFO -->
      <div class="panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Prioridad FEFO</th>
                <th>Código</th>
                <th>Medicamento</th>
                <th>Número de Lote</th>
                <th>Fecha Vencimiento</th>
                <th>Días Restantes</th>
                <th>Stock Lote</th>
                <th>Costo Unit.</th>
                <th>Valor Lote</th>
                <th>Estado FEFO</th>
              </tr>
            </thead>
            <tbody>
              ${lotes.map((l, idx) => `
                <tr>
                  <td><b>#${idx + 1}</b></td>
                  <td><code>${escapeHtml(l.producto_codigo)}</code></td>
                  <td><strong>${escapeHtml(l.nombre_comercial)}</strong></td>
                  <td><span class="badge neutral">${escapeHtml(l.numero_lote)}</span></td>
                  <td>${escapeHtml(l.fecha_vencimiento)}</td>
                  <td>
                    <span class="badge ${l.alerta_nivel === 'danger' || l.alerta_nivel === 'critical' ? 'bad' : (l.alerta_nivel === 'warning' ? 'warning' : 'good')}">
                      ${escapeHtml(l.alerta_texto)}
                    </span>
                  </td>
                  <td><b>${l.cantidad_actual}</b> unid.</td>
                  <td>${currency(l.precio_compra_lote)}</td>
                  <td>${currency(l.cantidad_actual * l.precio_compra_lote)}</td>
                  <td><span class="status-badge ${l.estado === 'DISPONIBLE' ? 'status-good' : (l.estado === 'PROXIMO_A_VENCER' ? 'status-warn' : 'status-bad')}">${escapeHtml(l.estado)}</span></td>
                </tr>
              `).join('')}
              ${lotes.length === 0 ? '<tr><td colspan="10" class="empty-cell">No hay lotes registrados.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Modal para ajuste manual de stock
    $('#btnAjusteStockManual').onclick = () => showAjusteModal(prods, lotes, () => renderBoticaLotes(container));
    $('#btnNuevoLoteModal').onclick = () => showNuevoLoteModal(prods, () => renderBoticaLotes(container));
  }

  function showAjusteModal(prods, lotes, onDone) {
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Ajuste Manual de Inventario</h3>
          <button class="icon-btn" id="btnCloseAjuste">&times;</button>
        </div>
        <form id="formAjuste" class="modal-body">
          <div class="form-group mb-2">
            <label>Seleccionar Lote a Ajustar *</label>
            <select name="lote_id" class="form-control" required>
              <option value="">Seleccione lote</option>
              ${lotes.filter(l => l.cantidad_actual > 0).map(l => `
                <option value="${l.id}" data-prod="${l.producto_id}" data-max="${l.cantidad_actual}">
                  ${escapeHtml(l.producto_codigo)} - ${escapeHtml(l.nombre_comercial)} | Lote: ${escapeHtml(l.numero_lote)} (Stock: ${l.cantidad_actual})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group mb-2">
            <label>Tipo de Ajuste *</label>
            <select name="tipo" class="form-control" required>
              <option value="AJUSTE_POSITIVO">Ajuste Positivo (+ Ingreso por hallazgo)</option>
              <option value="AJUSTE_NEGATIVO">Ajuste Negativo (- Salida por merma, rotura o descarte)</option>
            </select>
          </div>
          <div class="form-group mb-2">
            <label>Cantidad *</label>
            <input type="number" name="cantidad" class="form-control" min="1" value="1" required>
          </div>
          <div class="form-group mb-2">
            <label>Motivo Obligatorio (Auditoría) *</label>
            <textarea name="motivo" class="form-control" rows="3" placeholder="Indicar razón precisa del ajuste para trazabilidad..." required></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="btnCancelAjuste">Cancelar</button>
            <button type="submit" class="btn primary">Aplicar Ajuste en Kardex</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnCloseAjuste', modal).onclick = () => modal.remove();
    $('#btnCancelAjuste', modal).onclick = () => modal.remove();

    $('#formAjuste', modal).onsubmit = async (e) => {
      e.preventDefault();
      const sel = e.target.lote_id;
      const opt = sel.options[sel.selectedIndex];
      const prodId = parseInt(opt.dataset.prod, 10);
      const loteId = parseInt(sel.value, 10);
      const tipo = e.target.tipo.value;
      const cant = parseInt(e.target.cantidad.value, 10);
      const motivo = e.target.motivo.value;

      const res = await apiFetch('api/inventory.php?action=adjust', {
        method: 'POST',
        body: JSON.stringify({ producto_id: prodId, lote_id: loteId, tipo, cantidad: cant, motivo })
      });

      if (res && res.success) {
        toast('Ajuste de inventario aplicado correctamente', 'success');
        modal.remove();
        onDone();
      } else {
        toast(res?.error || 'Error al aplicar ajuste', 'error');
      }
    };
  }

  function showNuevoLoteModal(prods, onDone) {
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Registrar Nuevo Lote</h3>
          <button class="icon-btn" id="btnCloseNewLote">&times;</button>
        </div>
        <form id="formNewLote" class="modal-body">
          <div class="form-group mb-2">
            <label>Medicamento *</label>
            <select name="producto_id" class="form-control" required>
              <option value="">Seleccione medicamento</option>
              ${prods.map(p => `<option value="${p.id}">${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre_comercial)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-2">
            <label>Número de Lote *</label>
            <input type="text" name="numero_lote" class="form-control" placeholder="Ej: LT-2026-09A" required>
          </div>
          <div class="form-group mb-2">
            <label>Fecha de Vencimiento *</label>
            <input type="date" name="fecha_vencimiento" class="form-control" required>
          </div>
          <div class="form-group mb-2">
            <label>Cantidad de Unidades *</label>
            <input type="number" name="cantidad" class="form-control" min="1" value="50" required>
          </div>
          <div class="form-group mb-2">
            <label>Costo de Compra del Lote (S/)</label>
            <input type="number" step="0.01" name="precio_compra_lote" class="form-control" value="5.00">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="btnCancelNewLote">Cancelar</button>
            <button type="submit" class="btn primary">Registrar Lote</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnCloseNewLote', modal).onclick = () => modal.remove();
    $('#btnCancelNewLote', modal).onclick = () => modal.remove();

    $('#formNewLote', modal).onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        producto_id: parseInt(form.producto_id.value, 10),
        numero_lote: form.numero_lote.value,
        fecha_vencimiento: form.fecha_vencimiento.value,
        cantidad: parseInt(form.cantidad.value, 10),
        precio_compra_lote: parseFloat(form.precio_compra_lote.value) || 0
      };

      const res = await apiFetch('api/inventory.php?action=save_lote', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (res && res.success) {
        toast('Lote creado y stock actualizado', 'success');
        modal.remove();
        onDone();
      } else {
        toast(res?.error || 'Error al guardar lote', 'error');
      }
    };
  }

  // =========================================================================
  // 5. KARDEX DE MOVIMIENTOS
  // =========================================================================
  async function renderBoticaKardex(container) {
    container.innerHTML = `<div class="loading-state">Cargando movimientos del Kardex...</div>`;
    const res = await apiFetch('api/inventory.php?action=movements&limit=100');
    const movs = res?.movements || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">TRAZABILIDAD Y AUDITORÍA DE EXISTENCIAS</span>
          <h1>Kardex de Movimientos</h1>
          <p class="muted">Registro inmutable de todas las entradas, salidas, ventas y ajustes de stock.</p>
        </div>
      </section>

      <div class="panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha y Hora</th>
                <th>Medicamento</th>
                <th>Lote</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Stock Ant. &rarr; Nuevo</th>
                <th>Motivo / Referencia</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              ${movs.map(m => `
                <tr>
                  <td><code>#${m.id}</code></td>
                  <td><small class="muted">${escapeHtml(m.created_at)}</small></td>
                  <td><strong>${escapeHtml(m.nombre_comercial)}</strong> (${escapeHtml(m.producto_codigo)})</td>
                  <td><span class="badge neutral">${escapeHtml(m.numero_lote || 'N/A')}</span></td>
                  <td>
                    <span class="badge ${m.tipo.includes('ENTRADA') || m.tipo.includes('COMPRA') || m.tipo.includes('POSITIVO') ? 'good' : 'bad'}">
                      ${escapeHtml(m.tipo)}
                    </span>
                  </td>
                  <td><b>${m.cantidad}</b></td>
                  <td>${m.stock_anterior} &rarr; <b>${m.stock_nuevo}</b></td>
                  <td><small>${escapeHtml(m.motivo)}</small></td>
                  <td><small>${escapeHtml(m.usuario_nombre || 'Sistema')}</small></td>
                </tr>
              `).join('')}
              ${movs.length === 0 ? '<tr><td colspan="9" class="empty-cell">No hay movimientos registrados en el Kardex.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 6. CAJA Y ARQUEO DE TURNOS
  // =========================================================================
  async function renderBoticaCaja(container) {
    container.innerHTML = `<div class="loading-state">Cargando estado de caja...</div>`;
    const [curRes, histRes] = await Promise.all([
      apiFetch('api/cash_register.php?action=current'),
      apiFetch('api/cash_register.php?action=history')
    ]);

    const shift = curRes?.shift || null;
    const history = histRes?.shifts || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">CONTROL DE EFECTIVO Y TURNOS</span>
          <h1>Caja y Arqueo</h1>
          <p class="muted">Gestión de aperturas, cierres de turno, ingresos y egresos de efectivo.</p>
        </div>
      </section>

      ${shift ? `
        <div class="panel active-shift-card mb-4">
          <div class="shift-banner">
            <div>
              <span class="status-badge status-good">TURNO #${shift.id} ABIERTO</span>
              <h3>Cajero: ${escapeHtml(shift.usuario_nombre)}</h3>
              <small class="muted">Apertura: ${escapeHtml(shift.fecha_apertura)}</small>
            </div>
            <div class="header-actions">
              <button class="btn secondary" id="btnMovCajaIngreso">+ Ingreso Efectivo</button>
              <button class="btn secondary" id="btnMovCajaEgreso">- Retiro / Gasto</button>
              <button class="btn primary" id="btnCerrarTurno">Realizar Arqueo y Cerrar Turno</button>
            </div>
          </div>

          <div class="shift-metrics-grid mt-3">
            <div class="shift-box">
              <span class="shift-lbl">Monto Apertura</span>
              <span class="shift-val">${currency(shift.monto_apertura)}</span>
            </div>
            <div class="shift-box">
              <span class="shift-lbl">Ventas Efectivo</span>
              <span class="shift-val text-good">+ ${currency(shift.total_ventas_efectivo)}</span>
            </div>
            <div class="shift-box">
              <span class="shift-lbl">Ventas Digitales</span>
              <span class="shift-val">+ ${currency(shift.total_ventas_digital)}</span>
            </div>
            <div class="shift-box">
              <span class="shift-lbl">Ingresos Manuales</span>
              <span class="shift-val text-good">+ ${currency(shift.total_ingresos)}</span>
            </div>
            <div class="shift-box">
              <span class="shift-lbl">Egresos / Gastos</span>
              <span class="shift-val text-bad">- ${currency(shift.total_egresos)}</span>
            </div>
            <div class="shift-box highlight">
              <span class="shift-lbl">EFECTIVO TEÓRICO EN CAJA</span>
              <span class="shift-val">${currency(shift.efectivo_esperado)}</span>
            </div>
          </div>
        </div>
      ` : `
        <div class="panel empty-state mb-4">
          <h3>No hay un turno de caja abierto</h3>
          <p class="muted">Apertura un turno para comenzar a registrar transacciones de venta en efectivo.</p>
          <div class="open-box">
            <input type="number" id="inpOpenShiftMonto" class="form-control" value="250.00" step="0.50">
            <button class="btn primary" id="btnAperturarTurnoPage">Aperturar Turno de Caja</button>
          </div>
        </div>
      `}

      <!-- HISTORIAL DE TURNOS -->
      <div class="panel">
        <div class="panel-header">
          <h3>Historial de Turnos de Caja</h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Turno #</th>
                <th>Cajero</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Fondo Inicial</th>
                <th>Ventas Efectivo</th>
                <th>Cierre Teórico</th>
                <th>Cierre Declarado</th>
                <th>Diferencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(t => `
                <tr>
                  <td><b>#${t.id}</b></td>
                  <td>${escapeHtml(t.usuario_nombre)}</td>
                  <td><small>${escapeHtml(t.fecha_apertura)}</small></td>
                  <td><small class="muted">${escapeHtml(t.fecha_cierre || 'En curso...')}</small></td>
                  <td>${currency(t.monto_apertura)}</td>
                  <td>${currency(t.total_ventas_efectivo)}</td>
                  <td>${t.monto_cierre_sistema !== null ? currency(t.monto_cierre_sistema) : '-'}</td>
                  <td>${t.monto_cierre_declarado !== null ? currency(t.monto_cierre_declarado) : '-'}</td>
                  <td>
                    ${t.diferencia !== null ? `
                      <span class="badge ${t.diferencia === 0 ? 'good' : (t.diferencia > 0 ? 'warning' : 'bad')}">
                        ${t.diferencia === 0 ? 'Cuadre exacto' : (t.diferencia > 0 ? `+${currency(t.diferencia)} (Sobrante)` : `${currency(t.diferencia)} (Faltante)`)}
                      </span>
                    ` : '-'}
                  </td>
                  <td><span class="status-badge ${t.estado === 'ABIERTO' ? 'status-good' : 'status-neutral'}">${escapeHtml(t.estado)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Eventos
    if (shift) {
      $('#btnCerrarTurno').onclick = () => showArqueoCierreModal(shift, () => renderBoticaCaja(container));
      $('#btnMovCajaIngreso').onclick = () => showMovCajaModal(shift.id, 'INGRESO', () => renderBoticaCaja(container));
      $('#btnMovCajaEgreso').onclick = () => showMovCajaModal(shift.id, 'EGRESO', () => renderBoticaCaja(container));
    } else {
      $('#btnAperturarTurnoPage').onclick = async () => {
        const m = parseFloat($('#inpOpenShiftMonto').value) || 0;
        const res = await apiFetch('api/cash_register.php?action=open', {
          method: 'POST',
          body: JSON.stringify({ monto_apertura: m, observaciones: 'Apertura manual desde módulo Caja' })
        });
        if (res && res.success) {
          toast('Turno de caja aperturado', 'success');
          renderBoticaCaja(container);
        }
      };
    }
  }

  function showArqueoCierreModal(shift, onDone) {
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Arqueo y Cierre de Turno #${shift.id}</h3>
          <button class="icon-btn" id="btnCloseArqueo">&times;</button>
        </div>
        <form id="formArqueo" class="modal-body">
          <div class="arqueo-calc-banner">
            <div>Efectivo esperado por el sistema: <strong>${currency(shift.efectivo_esperado)}</strong></div>
            <small class="muted">Monto inicial (${currency(shift.monto_apertura)}) + Ventas (${currency(shift.total_ventas_efectivo)}) + Ingresos (${currency(shift.total_ingresos)}) - Egresos (${currency(shift.total_egresos)})</small>
          </div>
          <div class="form-group mt-3">
            <label>Monto Real Contado en Gaveta (Declarado en S/) *</label>
            <input type="number" step="0.50" name="monto_declarado" id="inpMontoDeclarado" class="form-control" value="${shift.efectivo_esperado.toFixed(2)}" required>
          </div>
          <div class="diff-feedback mt-2">
            <span>Diferencia de Cuadre:</span>
            <strong id="lblArqueoDiff" class="text-good">S/ 0.00 (Cuadre Exacto)</strong>
          </div>
          <div class="form-group mt-3">
            <label>Observaciones de Cierre</label>
            <textarea name="observaciones" class="form-control" placeholder="Anotaciones de arqueo, billetes rotos o cuadre..."></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="btnCancelArqueo">Cancelar</button>
            <button type="submit" class="btn primary">Confirmar Cierre de Turno</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnCloseArqueo', modal).onclick = () => modal.remove();
    $('#btnCancelArqueo', modal).onclick = () => modal.remove();

    const inp = $('#inpMontoDeclarado', modal);
    const diffLbl = $('#lblArqueoDiff', modal);

    inp.oninput = () => {
      const decl = parseFloat(inp.value) || 0;
      const diff = decl - shift.efectivo_esperado;
      if (Math.abs(diff) < 0.01) {
        diffLbl.textContent = 'S/ 0.00 (Cuadre Exacto)';
        diffLbl.className = 'text-good';
      } else if (diff > 0) {
        diffLbl.textContent = `+S/ ${diff.toFixed(2)} (Sobrante)`;
        diffLbl.className = 'text-warn';
      } else {
        diffLbl.textContent = `-S/ ${Math.abs(diff).toFixed(2)} (Faltante)`;
        diffLbl.className = 'text-danger';
      }
    };

    $('#formArqueo', modal).onsubmit = async (e) => {
      e.preventDefault();
      const decl = parseFloat(inp.value) || 0;
      const obs = e.target.observaciones.value;

      const res = await apiFetch('api/cash_register.php?action=close', {
        method: 'POST',
        body: JSON.stringify({ turno_id: shift.id, monto_declarado: decl, observaciones: obs })
      });

      if (res && res.success) {
        toast('Turno de caja cerrado y arqueo registrado', 'success');
        modal.remove();
        onDone();
      } else {
        toast(res?.error || 'Error al cerrar caja', 'error');
      }
    };
  }

  function showMovCajaModal(turnoId, tipo, onDone) {
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>${tipo === 'INGRESO' ? 'Registrar Ingreso de Efectivo' : 'Registrar Retiro / Egreso de Efectivo'}</h3>
          <button class="icon-btn" id="btnCloseMov">&times;</button>
        </div>
        <form id="formMovCaja" class="modal-body">
          <div class="form-group mb-2">
            <label>Monto (S/) *</label>
            <input type="number" step="0.50" name="monto" class="form-control" value="20.00" min="0.50" required>
          </div>
          <div class="form-group mb-2">
            <label>Concepto / Justificación *</label>
            <input type="text" name="concepto" class="form-control" placeholder="${tipo === 'INGRESO' ? 'Ej: Sencillo adicional' : 'Ej: Pago de entrega de mensajería'}" required>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="btnCancelMov">Cancelar</button>
            <button type="submit" class="btn primary">Registrar ${tipo}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnCloseMov', modal).onclick = () => modal.remove();
    $('#btnCancelMov', modal).onclick = () => modal.remove();

    $('#formMovCaja', modal).onsubmit = async (e) => {
      e.preventDefault();
      const monto = parseFloat(e.target.monto.value) || 0;
      const concepto = e.target.concepto.value;

      const res = await apiFetch('api/cash_register.php?action=movement', {
        method: 'POST',
        body: JSON.stringify({ turno_id: turnoId, tipo, monto, concepto })
      });

      if (res && res.success) {
        toast(`Movimiento de ${tipo} registrado`, 'success');
        modal.remove();
        onDone();
      } else {
        toast(res?.error || 'Error al registrar movimiento', 'error');
      }
    };
  }

  // =========================================================================
  // 7. COMPROBANTES EMITIDOS Y FACTURACIÓN
  // =========================================================================
  async function renderBoticaComprobantes(container) {
    container.innerHTML = `<div class="loading-state">Cargando comprobantes...</div>`;
    const res = await apiFetch('api/invoices.php');
    const invoices = res?.invoices || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">REGISTRO TRIBUTARIO Y FISCAL</span>
          <h1>Comprobantes Emitidos</h1>
          <p class="muted">Boletas de Venta, Facturas y Notas de Venta con trazabilidad de despacho.</p>
        </div>
      </section>

      <div class="panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Tipo</th>
                <th>Código Venta</th>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Subtotal</th>
                <th>IGV</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Cajero</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td><strong>${escapeHtml(inv.numero_completo)}</strong></td>
                  <td><span class="badge neutral">${escapeHtml(inv.tipo)}</span></td>
                  <td><code>${escapeHtml(inv.codigo_venta)}</code></td>
                  <td>${escapeHtml(inv.cliente_nombre)}</td>
                  <td><small>${escapeHtml(inv.cliente_doc || '')}</small></td>
                  <td>${currency(inv.subtotal)}</td>
                  <td>${currency(inv.igv)}</td>
                  <td><b>${currency(inv.total)}</b></td>
                  <td><span class="pay-tag">${escapeHtml(inv.metodo_pago)}</span></td>
                  <td><small>${escapeHtml(inv.cajero_nombre || 'Sistema')}</small></td>
                  <td><small class="muted">${escapeHtml(inv.created_at)}</small></td>
                  <td>
                    <button class="btn btn-sm secondary btn-view-inv" data-id="${inv.id}">Ver Ticket</button>
                    ${inv.venta_estado === 'COMPLETADA' ? `<button class="btn btn-sm text-danger btn-void-sale" data-id="${inv.venta_id}">Anular</button>` : '<span class="badge bad">Anulada</span>'}
                  </td>
                </tr>
              `).join('')}
              ${invoices.length === 0 ? '<tr><td colspan="12" class="empty-cell">No hay comprobantes emitidos.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $$('.btn-view-inv', container).forEach(b => {
      b.onclick = async () => {
        const id = parseInt(b.dataset.id, 10);
        const invRes = await apiFetch(`api/invoices.php?action=detail&id=${id}`);
        if (invRes?.invoice) {
          showThermalTicketModal({
            comprobante_numero: invRes.invoice.numero_completo,
            codigo_venta: invRes.invoice.codigo_venta,
            cliente: invRes.invoice.cliente_nombre,
            metodo_pago: invRes.invoice.metodo_pago,
            subtotal: invRes.invoice.subtotal,
            igv: invRes.invoice.igv,
            total: invRes.invoice.total,
            monto_recibido: invRes.invoice.monto_recibido,
            vuelto: invRes.invoice.vuelto
          });
        }
      };
    });

    $$('.btn-void-sale', container).forEach(b => {
      b.onclick = async () => {
        const id = parseInt(b.dataset.id, 10);
        const motivo = prompt('Ingrese motivo de anulación de la venta (el stock se restituirá a sus lotes correspondientes):');
        if (!motivo) return;

        const res = await apiFetch('api/pos.php?action=void_sale', {
          method: 'POST',
          body: JSON.stringify({ venta_id: id, motivo })
        });

        if (res && res.success) {
          toast('Venta anulada y stock retornado a inventario', 'success');
          renderBoticaComprobantes(container);
        } else {
          toast(res?.error || 'Error al anular venta', 'error');
        }
      };
    });
  }

  // =========================================================================
  // 8. REPORTES DE BOTICA & EXPORTACIÓN CSV
  // =========================================================================
  async function renderBoticaReportes(container) {
    container.innerHTML = `<div class="loading-state">Generando reportes analíticos de botica...</div>`;
    const [salesRep, rankRep, expRep] = await Promise.all([
      apiFetch('api/pharmacy_reports.php?action=sales_summary'),
      apiFetch('api/pharmacy_reports.php?action=ranking'),
      apiFetch('api/pharmacy_reports.php?action=expiring&dias=90')
    ]);

    const report = salesRep?.report || [];
    const totales = salesRep?.totales || {};
    const ranking = rankRep?.ranking || [];
    const expiring = expRep?.lotes_por_vencer || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">INTELIGENCIA DE NEGOCIO · ANALÍTICA & AUDITORÍA</span>
          <h1>Reportes y Exportaciones de Botica</h1>
          <p class="muted">Ventas consolidadas, ranking de productos y descargas protegidas contra inyección CSV.</p>
        </div>
        <div class="header-actions">
          <a href="api/pharmacy_reports.php?action=export_csv&type=ventas" class="btn secondary" download>📥 Exportar Ventas (CSV)</a>
          <a href="api/pharmacy_reports.php?action=export_csv&type=inventario" class="btn secondary" download>📥 Exportar Stock (CSV)</a>
          <a href="api/pharmacy_reports.php?action=export_csv&type=vencimientos" class="btn secondary" download>📥 Exportar FEFO (CSV)</a>
        </div>
      </section>

      <!-- RESUMEN DE VENTAS DIARIAS -->
      <div class="panel mb-4">
        <div class="panel-header">
          <h3>Ventas Diarias Consolidadas</h3>
          <div class="badge neutral">${totales.tickets || 0} ventas totales · Recaudación: ${currency(totales.total || 0)}</div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Transacciones</th>
                <th>Subtotal</th>
                <th>IGV</th>
                <th>Total Facturado</th>
                <th>Efectivo</th>
                <th>Tarjeta</th>
                <th>Digital (Yape/Plin)</th>
              </tr>
            </thead>
            <tbody>
              ${report.map(r => `
                <tr>
                  <td><strong>${escapeHtml(r.fecha)}</strong></td>
                  <td>${r.total_ventas}</td>
                  <td>${currency(r.subtotal)}</td>
                  <td>${currency(r.igv)}</td>
                  <td><b>${currency(r.total)}</b></td>
                  <td>${currency(r.total_efectivo)}</td>
                  <td>${currency(r.total_tarjeta)}</td>
                  <td>${currency(r.total_digital)}</td>
                </tr>
              `).join('')}
              ${report.length === 0 ? '<tr><td colspan="8" class="empty-cell">No hay ventas registradas en el período.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- RANKING DE MEDICAMENTOS -->
      <div class="panel mb-4">
        <div class="panel-header">
          <h3>Ranking de Rotación de Medicamentos</h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Posición</th>
                <th>Código</th>
                <th>Medicamento</th>
                <th>Principio Activo</th>
                <th>Laboratorio</th>
                <th>Unidades Vendidas</th>
                <th>Total Generado</th>
                <th>Precio Promedio</th>
              </tr>
            </thead>
            <tbody>
              ${ranking.map((rk, idx) => `
                <tr>
                  <td><b>#${idx + 1}</b></td>
                  <td><code>${escapeHtml(rk.codigo)}</code></td>
                  <td><strong>${escapeHtml(rk.nombre_comercial)}</strong></td>
                  <td>${escapeHtml(rk.principio_activo)}</td>
                  <td><small class="muted">${escapeHtml(rk.laboratorio_nombre || 'N/A')}</small></td>
                  <td><b>${rk.total_unidades}</b></td>
                  <td>${currency(rk.total_recaudado)}</td>
                  <td>${currency(rk.precio_promedio)}</td>
                </tr>
              `).join('')}
              ${ranking.length === 0 ? '<tr><td colspan="8" class="empty-cell">Sin datos de ranking.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 9. CLIENTES DE BOTICA
  // =========================================================================
  async function renderBoticaClientes(container) {
    container.innerHTML = `<div class="loading-state">Cargando directorio de clientes...</div>`;
    const res = await apiFetch('api/customers.php');
    const clientes = res?.customers || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">CLIENTES Y PACIENTES REGISTRADOS</span>
          <h1>Gestión de Clientes</h1>
          <p class="muted">Directorio de pacientes y empresas con RUC para emisión de Facturas.</p>
        </div>
        <div class="header-actions">
          <button class="btn primary" id="btnNuevoClienteModal">+ Nuevo Cliente</button>
        </div>
      </section>

      <div class="panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipo Doc</th>
                <th>Número</th>
                <th>Nombre / Razón Social</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${clientes.map(c => `
                <tr>
                  <td><span class="badge neutral">${escapeHtml(c.tipo_documento)}</span></td>
                  <td><code>${escapeHtml(c.numero_documento)}</code></td>
                  <td><strong>${escapeHtml(c.nombre_razon_social)}</strong></td>
                  <td>${escapeHtml(c.telefono || '-')}</td>
                  <td><small>${escapeHtml(c.email || '-')}</small></td>
                  <td><small class="muted">${escapeHtml(c.direccion || '-')}</small></td>
                  <td><span class="status-badge ${c.estado === 'Activo' ? 'status-good' : 'status-bad'}">${escapeHtml(c.estado)}</span></td>
                  <td>
                    <button class="btn btn-sm secondary btn-edit-cli" data-id="${c.id}">Editar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#btnNuevoClienteModal').onclick = () => showClienteModal(null, () => renderBoticaClientes(container));
    $$('.btn-edit-cli', container).forEach(b => {
      b.onclick = () => {
        const id = parseInt(b.dataset.id, 10);
        const cli = clientes.find(item => item.id === id);
        if (cli) showClienteModal(cli, () => renderBoticaClientes(container));
      };
    });
  }

  function showClienteModal(cli, onDone) {
    const isEdit = cli !== null;
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>${isEdit ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</h3>
          <button class="icon-btn" id="btnCloseCli">&times;</button>
        </div>
        <form id="formCli" class="modal-body">
          <div class="form-group mb-2">
            <label>Tipo de Documento *</label>
            <select name="tipo_documento" class="form-control" required>
              <option value="DNI" ${cli?.tipo_documento === 'DNI' ? 'selected' : ''}>DNI (Persona Natural)</option>
              <option value="RUC" ${cli?.tipo_documento === 'RUC' ? 'selected' : ''}>RUC (Empresa / Persona Jurídica)</option>
              <option value="CE" ${cli?.tipo_documento === 'CE' ? 'selected' : ''}>Carnet de Extranjería</option>
              <option value="PASAPORTE" ${cli?.tipo_documento === 'PASAPORTE' ? 'selected' : ''}>Pasaporte</option>
            </select>
          </div>
          <div class="form-group mb-2">
            <label>Número de Documento *</label>
            <input type="text" name="numero_documento" class="form-control" value="${escapeHtml(cli?.numero_documento || '')}" required>
          </div>
          <div class="form-group mb-2">
            <label>Nombres y Apellidos / Razón Social *</label>
            <input type="text" name="nombre_razon_social" class="form-control" value="${escapeHtml(cli?.nombre_razon_social || '')}" required>
          </div>
          <div class="form-group mb-2">
            <label>Teléfono / Celular</label>
            <input type="text" name="telefono" class="form-control" value="${escapeHtml(cli?.telefono || '')}">
          </div>
          <div class="form-group mb-2">
            <label>Correo Electrónico</label>
            <input type="email" name="email" class="form-control" value="${escapeHtml(cli?.email || '')}">
          </div>
          <div class="form-group mb-2">
            <label>Dirección</label>
            <input type="text" name="direccion" class="form-control" value="${escapeHtml(cli?.direccion || '')}">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="btnCancelCli">Cancelar</button>
            <button type="submit" class="btn primary">Guardar Cliente</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnCloseCli', modal).onclick = () => modal.remove();
    $('#btnCancelCli', modal).onclick = () => modal.remove();

    $('#formCli', modal).onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        id: isEdit ? cli.id : undefined,
        tipo_documento: form.tipo_documento.value,
        numero_documento: form.numero_documento.value,
        nombre_razon_social: form.nombre_razon_social.value,
        telefono: form.telefono.value,
        email: form.email.value,
        direccion: form.direccion.value
      };

      const res = await apiFetch('api/customers.php', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (res && res.success) {
        toast('Cliente guardado correctamente', 'success');
        modal.remove();
        onDone();
      } else {
        toast(res?.error || 'Error al guardar cliente', 'error');
      }
    };
  }

  // =========================================================================
  // 10. COMPRAS, RECEPCIÓN Y PROVEEDORES
  // =========================================================================
  async function renderBoticaCompras(container) {
    container.innerHTML = `<div class="loading-state">Cargando compras y proveedores...</div>`;
    const [compRes, provRes, prodRes] = await Promise.all([
      apiFetch('api/suppliers.php?action=list_purchases'),
      apiFetch('api/suppliers.php?action=list_suppliers'),
      apiFetch('api/products.php')
    ]);

    const compras = compRes?.purchases || [];
    const provs = provRes?.suppliers || [];
    const prods = prodRes?.products || [];

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">ABASTECIMIENTO Y LOGÍSTICA</span>
          <h1>Compras y Recepción de Mercadería</h1>
          <p class="muted">Recepción de pedidos de laboratorios y alta automática de lotes en inventario.</p>
        </div>
        <div class="header-actions">
          <button class="btn primary" id="btnNuevaCompraModal">+ Recepcionar Compra</button>
        </div>
      </section>

      <div class="panel">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Comprobante</th>
                <th>Proveedor / Droguería</th>
                <th>RUC</th>
                <th>F. Emisión</th>
                <th>F. Recepción</th>
                <th>Total (S/)</th>
                <th>Usuario</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              ${compras.map(c => `
                <tr>
                  <td><code>#${c.id}</code></td>
                  <td><strong>${escapeHtml(c.tipo_comprobante)} ${escapeHtml(c.serie_comprobante)}-${escapeHtml(c.numero_comprobante)}</strong></td>
                  <td>${escapeHtml(c.proveedor_nombre)}</td>
                  <td><code>${escapeHtml(c.proveedor_ruc)}</code></td>
                  <td><small>${escapeHtml(c.fecha_emision)}</small></td>
                  <td><small class="muted">${escapeHtml(c.fecha_recepcion)}</small></td>
                  <td><b>${currency(c.total)}</b></td>
                  <td><small>${escapeHtml(c.usuario_nombre || 'Sistema')}</small></td>
                  <td><span class="status-badge status-good">${escapeHtml(c.estado)}</span></td>
                  <td>
                    <button class="btn btn-sm secondary btn-det-compra" data-id="${c.id}">Ver Ítems</button>
                  </td>
                </tr>
              `).join('')}
              ${compras.length === 0 ? '<tr><td colspan="10" class="empty-cell">No hay compras registradas aún.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#btnNuevaCompraModal').onclick = () => showNuevaCompraModal(provs, prods, () => renderBoticaCompras(container));

    $$('.btn-det-compra', container).forEach(b => {
      b.onclick = async () => {
        const id = parseInt(b.dataset.id, 10);
        const res = await apiFetch(`api/suppliers.php?action=purchase_detail&id=${id}`);
        if (res?.purchase) showDetalleCompraModal(res.purchase);
      };
    });
  }

  function showNuevaCompraModal(provs, prods, onDone) {
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    let compraItems = [];

    modal.innerHTML = `
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h3>Recepción de Mercadería / Orden de Compra</h3>
          <button class="icon-btn" id="btnCloseCompra">&times;</button>
        </div>
        <form id="formNuevaCompra" class="modal-body">
          <div class="form-grid">
            <div class="form-group span-2">
              <label>Proveedor / Droguería *</label>
              <select name="proveedor_id" class="form-control" required>
                <option value="">Seleccione proveedor</option>
                ${provs.map(p => `<option value="${p.id}">${escapeHtml(p.ruc)} - ${escapeHtml(p.razon_social)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Tipo Comprobante *</label>
              <select name="tipo_comprobante" class="form-control">
                <option value="FACTURA">Factura</option>
                <option value="GUIA_REMISION">Guía de Remisión</option>
                <option value="BOLETA">Boleta</option>
              </select>
            </div>
            <div class="form-group">
              <label>Serie *</label>
              <input type="text" name="serie_comprobante" class="form-control" placeholder="Ej: F001" required>
            </div>
            <div class="form-group">
              <label>Número *</label>
              <input type="text" name="numero_comprobante" class="form-control" placeholder="Ej: 0012458" required>
            </div>
            <div class="form-group">
              <label>Fecha Recepción *</label>
              <input type="date" name="fecha_recepcion" class="form-control" value="${today()}" required>
            </div>
          </div>

          <!-- AGREGAR ÍTEMS -->
          <div class="panel mt-3 p-2">
            <h4>Agregar Medicamentos Recibidos</h4>
            <div class="form-grid mt-2">
              <div class="form-group span-2">
                <label>Medicamento</label>
                <select id="inpAddProdId" class="form-control">
                  ${prods.map(p => `<option value="${p.id}" data-price="${p.precio_compra}">${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre_comercial)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Lote</label>
                <input type="text" id="inpAddLote" class="form-control" placeholder="LT-2026-X">
              </div>
              <div class="form-group">
                <label>F. Vencimiento</label>
                <input type="date" id="inpAddVenc" class="form-control">
              </div>
              <div class="form-group">
                <label>Cantidad</label>
                <input type="number" id="inpAddCant" class="form-control" min="1" value="50">
              </div>
              <div class="form-group">
                <label>Costo Unit (S/)</label>
                <input type="number" step="0.01" id="inpAddPrice" class="form-control" value="5.00">
              </div>
            </div>
            <button type="button" class="btn secondary btn-sm mt-2" id="btnAddItemToCompra">+ Agregar al Detalle</button>
          </div>

          <!-- TABLA DE DETALLE -->
          <div class="table-responsive mt-3">
            <table class="data-table" id="tableCompraDet">
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Lote</th>
                  <th>Vencimiento</th>
                  <th>Cantidad</th>
                  <th>Costo Unit.</th>
                  <th>Total</th>
                  <th>Quitar</th>
                </tr>
              </thead>
              <tbody id="bodyCompraDet">
                <tr><td colspan="7" class="empty-cell">Agregue al menos un medicamento recibido.</td></tr>
              </tbody>
            </table>
          </div>

          <div class="modal-footer mt-3">
            <button type="button" class="btn secondary" id="btnCancelCompra">Cancelar</button>
            <button type="submit" class="btn primary" id="btnSubmitCompra" disabled>Procesar Recepción e Incrementar Stock</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    $('#btnCloseCompra', modal).onclick = () => modal.remove();
    $('#btnCancelCompra', modal).onclick = () => modal.remove();

    function updateDetUI() {
      const b = $('#bodyCompraDet', modal);
      const btn = $('#btnSubmitCompra', modal);
      if (compraItems.length === 0) {
        b.innerHTML = `<tr><td colspan="7" class="empty-cell">Agregue al menos un medicamento recibido.</td></tr>`;
        btn.disabled = true;
        return;
      }
      b.innerHTML = compraItems.map((item, idx) => `
        <tr>
          <td><strong>${escapeHtml(item.nombre)}</strong></td>
          <td><code>${escapeHtml(item.numero_lote)}</code></td>
          <td>${escapeHtml(item.fecha_vencimiento)}</td>
          <td>${item.cantidad}</td>
          <td>${currency(item.precio_unitario)}</td>
          <td><b>${currency(item.cantidad * item.precio_unitario)}</b></td>
          <td><button type="button" class="btn-del-item" data-idx="${idx}">&times;</button></td>
        </tr>
      `).join('');
      btn.disabled = false;

      $$('.btn-del-item', b).forEach(btnDel => {
        btnDel.onclick = () => {
          compraItems.splice(parseInt(btnDel.dataset.idx, 10), 1);
          updateDetUI();
        };
      });
    }

    $('#btnAddItemToCompra', modal).onclick = () => {
      const sel = $('#inpAddProdId', modal);
      const prodId = parseInt(sel.value, 10);
      const nombre = sel.options[sel.selectedIndex].text;
      const lote = $('#inpAddLote', modal).value.trim();
      const venc = $('#inpAddVenc', modal).value;
      const cant = parseInt($('#inpAddCant', modal).value, 10) || 0;
      const price = parseFloat($('#inpAddPrice', modal).value) || 0;

      if (!lote || !venc || cant <= 0) {
        toast('Complete lote, fecha de vencimiento y cantidad mayor a cero', 'warning');
        return;
      }

      compraItems.push({
        producto_id: prodId,
        nombre,
        numero_lote: lote,
        fecha_vencimiento: venc,
        cantidad: cant,
        precio_unitario: price
      });

      $('#inpAddLote', modal).value = '';
      $('#inpAddVenc', modal).value = '';
      updateDetUI();
    };

    $('#formNuevaCompra', modal).onsubmit = async (e) => {
      e.preventDefault();
      if (compraItems.length === 0) return;
      const form = e.target;
      const payload = {
        proveedor_id: parseInt(form.proveedor_id.value, 10),
        tipo_comprobante: form.tipo_comprobante.value,
        serie_comprobante: form.serie_comprobante.value,
        numero_comprobante: form.numero_comprobante.value,
        fecha_recepcion: form.fecha_recepcion.value,
        items: compraItems
      };

      const res = await apiFetch('api/suppliers.php?action=create_purchase', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        toast('Compra registrada. Stock y lotes actualizados.', 'success');
        modal.remove();
        onDone();
      } else {
        toast(res?.error || 'Error al recepcionar compra', 'error');
      }
    };
  }

  function showDetalleCompraModal(compra) {
    const modal = document.createElement('div');
    modal.className = 'pos-ticket-modal-overlay';
    modal.innerHTML = `
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h3>Detalle de Compra #${compra.id}</h3>
          <button class="icon-btn" id="btnCloseDetCompra">&times;</button>
        </div>
        <div class="modal-body">
          <div class="compra-info-banner mb-3">
            <div><strong>${escapeHtml(compra.tipo_comprobante)}:</strong> ${escapeHtml(compra.serie_comprobante)}-${escapeHtml(compra.numero_comprobante)}</div>
            <div><strong>Proveedor:</strong> ${escapeHtml(compra.proveedor_nombre)} (RUC: ${escapeHtml(compra.proveedor_ruc)})</div>
            <div><strong>Fecha Recepción:</strong> ${escapeHtml(compra.fecha_recepcion)} · <strong>Total:</strong> ${currency(compra.total)}</div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Medicamento</th>
                <th>Lote Asignado</th>
                <th>Fecha Vencimiento</th>
                <th>Cantidad</th>
                <th>Costo Unit.</th>
                <th>Total Ítem</th>
              </tr>
            </thead>
            <tbody>
              ${(compra.items || []).map(i => `
                <tr>
                  <td><code>${escapeHtml(i.producto_codigo)}</code></td>
                  <td><strong>${escapeHtml(i.nombre_comercial)}</strong></td>
                  <td><span class="badge neutral">${escapeHtml(i.numero_lote)}</span></td>
                  <td>${escapeHtml(i.fecha_vencimiento)}</td>
                  <td><b>${i.cantidad}</b></td>
                  <td>${currency(i.precio_unitario)}</td>
                  <td>${currency(i.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="modal-footer mt-3">
            <button class="btn secondary" id="btnCloseDetCompra2">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    $('#btnCloseDetCompra', modal).onclick = () => modal.remove();
    $('#btnCloseDetCompra2', modal).onclick = () => modal.remove();
  }

  // =========================================================================
  // 11. CONFIGURACIÓN DE BOTICA & MEDIZANO GATEWAY
  // =========================================================================
  async function renderBoticaConfig(container) {
    container.innerHTML = `<div class="loading-state">Cargando configuración del sistema de botica...</div>`;
    const res = await apiFetch('api/botica_settings.php');
    const settings = res?.settings || {};
    const medizano = res?.medizano || {};

    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="eyebrow">CONFIGURACIÓN INSTITUCIONAL & INTEGRACIÓN</span>
          <h1>Configuración de Botica y MediZano</h1>
          <p class="muted">Parámetros de empresa, impuestos, políticas de vencimiento y microservicios.</p>
        </div>
      </section>

      <div class="dashboard-columns">
        <!-- DATOS DE LA BOTICA -->
        <div class="panel">
          <div class="panel-header">
            <h3>Parámetros Comerciales y Fiscales</h3>
          </div>
          <form id="formBoticaSettings" class="form-grid">
            <div class="form-group span-2">
              <label>Razón Social / Nombre Comercial *</label>
              <input type="text" name="botica_nombre" class="form-control" value="${escapeHtml(settings.botica_nombre || '')}" required>
            </div>
            <div class="form-group">
              <label>RUC *</label>
              <input type="text" name="botica_ruc" class="form-control" value="${escapeHtml(settings.botica_ruc || '')}" required>
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="text" name="botica_telefono" class="form-control" value="${escapeHtml(settings.botica_telefono || '')}">
            </div>
            <div class="form-group span-2">
              <label>Dirección Fiscal</label>
              <input type="text" name="botica_direccion" class="form-control" value="${escapeHtml(settings.botica_direccion || '')}">
            </div>
            <div class="form-group">
              <label>IGV Aplicable (%)</label>
              <input type="number" step="0.1" name="botica_igv_pct" class="form-control" value="${escapeHtml(settings.botica_igv_pct || '18.0')}">
            </div>
            <div class="form-group">
              <label>Días para Alerta de Vencimiento FEFO</label>
              <input type="number" name="botica_dias_alerta_vencimiento" class="form-control" value="${escapeHtml(settings.botica_dias_alerta_vencimiento || '90')}">
            </div>
            <div class="form-group span-2 mt-2">
              <button type="submit" class="btn primary">Guardar Parámetros de Botica</button>
            </div>
          </form>
        </div>

        <!-- INTEGRACIÓN MEDIZANO -->
        <div class="panel">
          <div class="panel-header">
            <h3>Integración con Microservicios MediZano</h3>
          </div>
          <div class="banner-integration ${medizano.online ? 'banner-online' : 'banner-local'} mb-3">
            <span class="pulse-dot ${medizano.online ? 'pulse-green' : 'pulse-amber'}"></span>
            <div>
              <strong>${escapeHtml(medizano.mode === 'ONLINE_INTEGRATED' ? 'CONECTADO A MEDIZANO' : 'OPERACIÓN LOCAL RESILIENTE')}</strong>
              <p class="muted mb-0">${escapeHtml(medizano.message)}</p>
            </div>
          </div>

          <form id="formMediZanoSettings">
            <div class="form-group mb-3">
              <label>URL de MediZano Gateway</label>
              <input type="url" name="medizano_gateway_url" id="inpGatewayUrl" class="form-control" value="${escapeHtml(settings.medizano_gateway_url || 'http://127.0.0.1:8090')}">
              <small class="muted">Microservicios de referencia: catálogo, clientes, facturación, inventario, orden, pago y proveedor.</small>
            </div>
            <div class="form-group mb-3">
              <label class="checkbox-inline">
                <input type="checkbox" name="medizano_sync_enabled" ${settings.medizano_sync_enabled === '1' ? 'checked' : ''}> Habilitar sincronización bidireccional automática
              </label>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn secondary" id="btnTestMediZanoConnect">Test de Latencia y Salud</button>
              <button type="submit" class="btn primary">Guardar Configuración Gateway</button>
            </div>
          </form>

          <div id="testResultBox" class="mt-3"></div>
        </div>
      </div>
    `;

    $('#formBoticaSettings').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        botica_nombre: form.botica_nombre.value,
        botica_ruc: form.botica_ruc.value,
        botica_telefono: form.botica_telefono.value,
        botica_direccion: form.botica_direccion.value,
        botica_igv_pct: form.botica_igv_pct.value,
        botica_dias_alerta_vencimiento: form.botica_dias_alerta_vencimiento.value
      };
      const res = await apiFetch('api/botica_settings.php', { method: 'POST', body: JSON.stringify(data) });
      if (res && res.success) toast('Parámetros guardados correctamente', 'success');
    };

    $('#formMediZanoSettings').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        medizano_gateway_url: form.medizano_gateway_url.value,
        medizano_sync_enabled: form.medizano_sync_enabled.checked ? '1' : '0'
      };
      const res = await apiFetch('api/botica_settings.php', { method: 'POST', body: JSON.stringify(data) });
      if (res && res.success) {
        toast('Configuración de Gateway actualizada', 'success');
        renderBoticaConfig(container);
      }
    };

    $('#btnTestMediZanoConnect').onclick = async () => {
      const box = $('#testResultBox');
      box.innerHTML = `<div class="loading-state">Conectando con ${escapeHtml($('#inpGatewayUrl').value)}...</div>`;
      const tStart = performance.now();
      const ping = await apiFetch('api/botica_settings.php?action=check_medizano');
      const tEnd = performance.now();
      const ms = Math.round(tEnd - tStart);

      if (ping && ping.medizano) {
        const m = ping.medizano;
        box.innerHTML = `
          <div class="test-result-card ${m.online ? 'result-success' : 'result-warn'}">
            <strong>Resultado: ${escapeHtml(m.status)} (${ms} ms)</strong>
            <p>${escapeHtml(m.message)}</p>
            <small>Modo activo: <code>${escapeHtml(m.mode)}</code></small>
          </div>
        `;
      }
    };
  }

  return {
    renderBoticaDashboard,
    renderBoticaPos,
    renderBoticaProductos,
    renderBoticaLotes,
    renderBoticaKardex,
    renderBoticaCaja,
    renderBoticaComprobantes,
    renderBoticaReportes,
    renderBoticaClientes,
    renderBoticaCompras,
    renderBoticaConfig
  };
}
