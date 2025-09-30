const LS_PRODUCTS = 'facturacion_products_v1';
const LS_CLIENTS = 'facturacion_clients_v1';
const LS_INVOICES = 'facturacion_invoices_v1';

// helpers
function load(key){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

function renderStats(){
  const prods = load(LS_PRODUCTS);
  document.getElementById('totalProducts').textContent = prods.length;
  const out = prods.filter(p => p.stock <= 0).length;
  document.getElementById('outOfStock').textContent = out;

  const clients = load(LS_CLIENTS);
  document.getElementById('totalClients').textContent = clients.length;

  const invoices = load(LS_INVOICES);
  document.getElementById('totalInvoices').textContent = invoices.length;
  const pending = invoices.filter(f => f.pago==="credito" && f.estado==="pendiente").length;
  document.getElementById('pendingInvoices').textContent = pending;
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderStats();
});
document.addEventListener('DOMContentLoaded', renderStats);
