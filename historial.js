const LS_INVOICES = 'facturacion_invoices_v1';

function load(key){ try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch{ return []; } }

const lista = document.getElementById('listaHistorial');
const searchInput = document.getElementById('searchHistorial');
let facturaActual = null;

// Render facturas
function renderHistorial(filtro=""){
  const facturas = load(LS_INVOICES);
  const q = filtro.toLowerCase();

  const filtradas = facturas.filter(f =>
    f.cliente.name.toLowerCase().includes(q) || String(f.id).includes(q)
  );

  if(filtradas.length===0){
    lista.innerHTML = "<li>No hay facturas registradas</li>";
    return;
  }

  lista.innerHTML = filtradas.map(f => `
    <li>
      <div>
        <b>Factura #${f.id}</b><br>
        Cliente: ${f.cliente.name}<br>
        Total: $${f.total.toFixed(2)}<br>
        Pago: ${f.pago} <br>
        Estado: ${f.estado || "—"}<br>
        Fecha: ${new Date(f.fecha).toLocaleDateString()}
      </div>
      <button onclick="abrirHistorial(${f.id})">🔍 Ver</button>
    </li>
  `).join("");
}

// Abrir detalle
window.abrirHistorial = (id)=>{
  const facturas = load(LS_INVOICES);
  facturaActual = facturas.find(f=>f.id===id);
  if(!facturaActual) return;

  let detalle = `
    <p><b>Factura #${facturaActual.id}</b></p>
    <p><b>Cliente:</b> ${facturaActual.cliente.name} (${facturaActual.cliente.phone})</p>
    <p><b>Fecha:</b> ${new Date(facturaActual.fecha).toLocaleDateString()}</p>
    <h4>Productos</h4>
    <ul>
      ${facturaActual.productos.map(p=>`<li>${p.name} - $${p.price} x ${p.qty}</li>`).join("")}
    </ul>
    <p><b>Total:</b> $${facturaActual.total.toFixed(2)}</p>
    <p><b>Pago:</b> ${facturaActual.pago}</p>
  `;

  if(facturaActual.pago==="credito"){
    detalle += `<h4>Plan de Pagos</h4><ul>`;
    facturaActual.pagos.forEach((p,i)=>{
      detalle += `<li>${new Date(p.fecha).toLocaleDateString()} - $${p.monto} ${p.pagado?"✅":"❌"} ${p.mora>0?`<span style="color:red">+ Mora $${p.mora}</span>`:""}</li>`;
    });
    detalle += `</ul>`;
  }

  document.getElementById('detalleHistorial').innerHTML = detalle;
  document.getElementById('modalFacturaHist').classList.remove('hidden');
};

// Cerrar modal
document.getElementById('cerrarHistorial').onclick = ()=>{
  document.getElementById('modalFacturaHist').classList.add('hidden');
  facturaActual=null;
};

// Imprimir factura
document.getElementById('btnImprimir').onclick = ()=>{
  if(!facturaActual) return;
  let printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
    <head><title>Factura #${facturaActual.id}</title></head>
    <body>
      <h2>Factura #${facturaActual.id}</h2>
      <p><b>Cliente:</b> ${facturaActual.cliente.name} (${facturaActual.cliente.phone})</p>
      <p><b>Fecha:</b> ${new Date(facturaActual.fecha).toLocaleDateString()}</p>
      <h3>Productos</h3>
      <ul>
        ${facturaActual.productos.map(p=>`<li>${p.name} - $${p.price} x ${p.qty}</li>`).join("")}
      </ul>
      <p><b>Total:</b> $${facturaActual.total.toFixed(2)}</p>
      <p><b>Pago:</b> ${facturaActual.pago}</p>
      ${facturaActual.pago==="credito" ? `
        <h3>Pagos</h3>
        <ul>
          ${facturaActual.pagos.map(p=>`<li>${new Date(p.fecha).toLocaleDateString()} - $${p.monto} ${p.pagado?"✅":"❌"} ${p.mora>0?`+ Mora $${p.mora}`:""}</li>`).join("")}
        </ul>
      ` : ""}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

// Buscador
searchInput.addEventListener('input', e=>renderHistorial(e.target.value));
document.addEventListener('DOMContentLoaded', ()=>renderHistorial());
