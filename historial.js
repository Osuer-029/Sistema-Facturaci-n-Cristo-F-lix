
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

  // detalle estilo ticket
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

  if(facturaActual.pago==="credito" && facturaActual.pagos){
    let totalPagado = 0;
    let totalMoras = 0;
    facturaActual.pagos.forEach(p=>{
      if(p.pagado) totalPagado += parseFloat(p.monto) + parseFloat(p.mora||0);
      if(p.mora) totalMoras += parseFloat(p.mora);
    });
    const saldoPendiente = (facturaActual.total + totalMoras) - totalPagado;

    detalle += `<h4>Plan de Pagos</h4><ul>`;
    facturaActual.pagos.forEach((p,i)=>{
      detalle += `<li>${i+1}. ${new Date(p.fecha).toLocaleDateString()} - $${p.monto} ${p.pagado?"✅":"❌"} ${p.mora>0?`+ Mora $${p.mora}`:""}</li>`;
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

// Imprimir factura (igual que facturación)
document.getElementById('btnImprimir').onclick = ()=>{
  if(!facturaActual) return;

  const { jsPDF } = window.jspdf; // si quieres usar jsPDF igual que facturación
  const doc = new jsPDF({orientation:"portrait",unit:"pt",format:[220,600]});
  let y=20;
  doc.setFont("courier","normal");
  doc.setFontSize(12);
  doc.text("Cristo Felix",110,y,{align:"center"}); y+=16;
  doc.setFontSize(10);
  doc.text("San de arroz y aceite y más",110,y,{align:"center"}); y+=14;
  doc.text("Pagos semanal y quincenal",110,y,{align:"center"}); y+=14;
  doc.text("Tel: 829-444-1880",110,y,{align:"center"}); y+=20;
  doc.line(10,y,210,y); y+=14;

  doc.text(`Factura: ${facturaActual.id}`,110,y,{align:"center"}); y+=12;
  doc.text(`Cliente: ${facturaActual.cliente.name}`,110,y,{align:"center"}); y+=14;

  facturaActual.productos.forEach(p=>{
    doc.text(`${p.qty} x ${p.name} $${(p.qty*p.price).toFixed(2)}`,110,y,{align:"center"});
    y+=12;
  });
  y+=6; doc.line(10,y,210,y); y+=14;
  doc.setFontSize(12);
  doc.text(`TOTAL: $${facturaActual.total.toFixed(2)}`,110,y,{align:"center"}); y+=18;

  if(facturaActual.pago==="credito" && facturaActual.pagos){
    doc.setFontSize(10);
    doc.text("PLAN DE PAGOS:",110,y,{align:"center"}); y+=14;
    facturaActual.pagos.forEach((p,i)=>{
      doc.text(`${i+1}. ${p.fecha} $${p.monto} ${p.pagado?"✅":""} ${p.mora>0?"+ Mora $"+p.mora:""}`,110,y,{align:"center"});
      y+=12;
    });
    y+=10;
  }
  doc.setFontSize(10);
  doc.text("Gracias por elegirnos",110,y,{align:"center"});
  doc.autoPrint();
  doc.save(`Factura_${facturaActual.id}.pdf`);
};

// Buscador
searchInput.addEventListener('input', e=>renderHistorial(e.target.value));
document.addEventListener('DOMContentLoaded', ()=>renderHistorial());
