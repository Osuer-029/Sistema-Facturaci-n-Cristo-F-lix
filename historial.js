const LS_INVOICES = 'facturacion_invoices_v1';

function load(key){ 
  try{ return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch{ return []; } 
}

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

  // calcular totales
  let totalPagado = 0;
  let totalMoras = 0;
  if(facturaActual.pago==="credito"){
    facturaActual.pagos.forEach(p=>{
      if(p.pagado){
        totalPagado += parseFloat(p.monto) + parseFloat(p.mora||0);
      }
      if(p.mora){
        totalMoras += parseFloat(p.mora);
      }
    });
  }
  const saldoPendiente = facturaActual.pago==="credito"
    ? (facturaActual.total + totalMoras) - totalPagado
    : 0;

  // detalle formateado estilo ticket
  let detalle = `
    <div style="text-align:center;">
      <h2>Cristo Felix</h2>
      <p>San de arroz y aceite y más</p>
      <p>Pagos semanal y quincenal</p>
      <p>Tel: 829-444-1880</p>
      <hr>
      <p><b>Factura #${facturaActual.id}</b></p>
      <p><b>Cliente:</b> ${facturaActual.cliente.name} (${facturaActual.cliente.phone})</p>
      <p><b>Fecha:</b> ${new Date(facturaActual.fecha).toLocaleDateString()}</p>
      <hr>
    </div>
    <h4>Productos</h4>
    <ul>
      ${facturaActual.productos.map(p=>`<li>${p.qty} x ${p.name} = $${(p.qty*p.price).toFixed(2)}</li>`).join("")}
    </ul>
    <p><b>Total:</b> $${facturaActual.total.toFixed(2)}</p>
    <p><b>Pago:</b> ${facturaActual.pago}</p>
  `;

  if(facturaActual.pago==="credito"){
    detalle += `<h4>Plan de Pagos</h4><ul>`;
    facturaActual.pagos.forEach((p,i)=>{
      detalle += `<li>
        ${i+1}. ${new Date(p.fecha).toLocaleDateString()} - $${p.monto} 
        ${p.pagado?"✅":"❌"} 
        ${p.mora>0?`<span style="color:red">+ Mora $${p.mora}</span>`:""}
      </li>`;
    });
    detalle += `</ul>
      <p><b>Total Pagado:</b> $${totalPagado.toFixed(2)}</p>
      <p><b>Saldo Pendiente:</b> $${saldoPendiente.toFixed(2)}</p>
    `;
  }

  detalle += `<div style="text-align:center;margin-top:10px;">
    <p>Gracias por elegirnos</p>
  </div>`;

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

  let totalPagado = 0;
  let totalMoras = 0;
  if(facturaActual.pago==="credito"){
    facturaActual.pagos.forEach(p=>{
      if(p.pagado){
        totalPagado += parseFloat(p.monto) + parseFloat(p.mora||0);
      }
      if(p.mora){
        totalMoras += parseFloat(p.mora);
      }
    });
  }
  const saldoPendiente = facturaActual.pago==="credito"
    ? (facturaActual.total + totalMoras) - totalPagado
    : 0;

  let printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
    <head><title>Factura #${facturaActual.id}</title></head>
    <body style="font-family:monospace; text-align:center;">
      <h2>Cristo Felix</h2>
      <p>San de arroz y aceite y más</p>
      <p>Pagos semanal y quincenal</p>
      <p>Tel: 829-444-1880</p>
      <hr>
      <p><b>Factura #${facturaActual.id}</b></p>
      <p><b>Cliente:</b> ${facturaActual.cliente.name} (${facturaActual.cliente.phone})</p>
      <p><b>Fecha:</b> ${new Date(facturaActual.fecha).toLocaleDateString()}</p>
      <hr>
      <h4>Productos</h4>
      <ul style="list-style:none; padding:0;">
        ${facturaActual.productos.map(p=>`<li>${p.qty} x ${p.name} = $${(p.qty*p.price).toFixed(2)}</li>`).join("")}
      </ul>
      <p><b>Total:</b> $${facturaActual.total.toFixed(2)}</p>
      <p><b>Pago:</b> ${facturaActual.pago}</p>
      ${facturaActual.pago==="credito" ? `
        <h4>Plan de Pagos</h4>
        <ul style="list-style:none; padding:0;">
          ${facturaActual.pagos.map((p,i)=>`
            <li>${i+1}. ${new Date(p.fecha).toLocaleDateString()} - $${p.monto} 
              ${p.pagado?"✅":"❌"} 
              ${p.mora>0?`+ Mora $${p.mora}`:""}
            </li>`).join("")}
        </ul>
        <p><b>Total Pagado:</b> $${totalPagado.toFixed(2)}</p>
        <p><b>Saldo Pendiente:</b> $${saldoPendiente.toFixed(2)}</p>
      ` : ""}
      <hr>
      <p>Gracias por elegirnos</p>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

// Buscador
searchInput.addEventListener('input', e=>renderHistorial(e.target.value));
document.addEventListener('DOMContentLoaded', ()=>renderHistorial());
