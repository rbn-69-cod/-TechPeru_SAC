export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export function today() {
  // Dates entered in this Peruvian scorecard must not roll over at midnight UTC.
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

export function fmt(n, d = 1) {
    return n === null || n === undefined || isNaN(n) ? "—" : Number(n).toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  }

export function currency(n) {
    return "S/ " + Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 });
  }

