const LS_INVOICES = 'facturacion_invoices_v1';
const LS_PRODUCTS = 'facturacion_products_v1';

function load(key){ try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch{ return []; } }
function save(key,data){ localStorage.setItem(key, JSON.stringify(data)); }

const lista = document.getElementById('listaPendientes');
const searchInput = document.getElementById('searchCuentas');

let facturaActual = null;

// Render facturas pendientes
function renderPendientes(filtro=""){
  const facturas = load(LS_INVOICES).filter(f => f.pago==="credito" && f.estado==="pendiente");
  const q = filtro.toLowerCase();
  const filtradas = facturas.filter(f =>
    f.cliente.name.toLowerCase().includes(q) || String(f.id).includes(q)
  );

  if(filtradas.length===0){
    lista.innerHTML = "<li>No hay facturas pendientes</li>";
    return;
  }

  lista.innerHTML = filtradas.map(f => `
    <li>
      <div>
        <b>Factura #${f.id}</b><br>
        Cliente: ${f.cliente.name}<br>
        Total: $${f.total.toFixed(2)}<br>
        Estado: ${f.estado}<br>
        Fecha: ${new Date(f.fecha).toLocaleDateString()}
      </div>
      <button onclick="abrirFactura(${f.id})">🔍 Ver</button>
    </li>
  `).join("");
}

// Abrir detalle de factura
window.abrirFactura = (id)=>{
  const facturas = load(LS_INVOICES);
  facturaActual = facturas.find(f=>f.id===id);
  if(!facturaActual) return;

  const detalle = document.getElementById('detalleFactura');
  detalle.innerHTML = `
    <p><b>Cliente:</b> ${facturaActual.cliente.name}</p>
    <p><b>Total:</b> $${facturaActual.total.toFixed(2)}</p>
    <p><b>Plan:</b> ${facturaActual.plan || "No definido"}</p>
  `;

  renderPagos();
  document.getElementById('modalFactura').classList.remove('hidden');
};

document.getElementById('cerrarFactura').onclick = ()=>{
  document.getElementById('modalFactura').classList.add('hidden');
  facturaActual=null;
};

// Render pagos de la factura
function renderPagos(){
  const ul = document.getElementById('listaPagos');
  if(!facturaActual || !facturaActual.pagos){ ul.innerHTML="Sin pagos programados"; return; }

  // revisar moras por vencimiento
  facturaActual.pagos.forEach(p=>{
    const hoy = new Date();
    const fechaPago = new Date(p.fecha);
    if(!p.pagado && fechaPago < hoy){
      p.mora = 300;
    }
  });

  ul.innerHTML = facturaActual.pagos.map((p,i)=>`
    <li>
      <input type="date" value="${p.fecha}" onchange="editarFecha(${i}, this.value)">
      <input type="number" value="${p.monto}" style="width:80px" onchange="editarMonto(${i}, this.value)">
      ${p.pagado ? "✅ Pagado" : ""}
      ${p.mora>0 ? `<span style="color:red">+ Mora $${p.mora}</span>`:""}
      ${!p.pagado ? `
        <button onclick="marcarPago(${i})">Pagar</button>
        <button onclick="agregarMora(${i})">Mora +300</button>
      `:""}
    </li>
  `).join("");

  saveFactura();
}

// Marcar un pago
window.marcarPago = (i)=>{
  facturaActual.pagos[i].pagado=true;
  saveFactura();
  renderPagos();
};

// Editar fecha
window.editarFecha = (i, nuevaFecha)=>{
  facturaActual.pagos[i].fecha = nuevaFecha;
  saveFactura();
};

// Editar monto
window.editarMonto = (i, nuevoMonto)=>{
  facturaActual.pagos[i].monto = parseFloat(nuevoMonto) || 0;
  saveFactura();
};

// Agregar mora manualmente
window.agregarMora = (i)=>{
  facturaActual.pagos[i].mora += 300;
  saveFactura();
  renderPagos();
};

// Modal productos
const modalProducts = document.getElementById('modalProducts');
document.getElementById('btnAgregarProducto').onclick = ()=>{
  renderProducts();
  modalProducts.classList.remove('hidden');
};
document.getElementById('closeProducts').onclick = ()=> modalProducts.classList.add('hidden');

function renderProducts(filter=""){
  const prods = load(LS_PRODUCTS);
  const list = document.getElementById('listProducts');
  list.innerHTML="";
  prods
    .filter(p=>p.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(p=>{
      const li=document.createElement('li');
      li.textContent=`${p.code} - ${p.name} ($${p.price})`;
      li.onclick=()=>{
        facturaActual.productos.push({...p, qty:1});
        facturaActual.total+=p.price;
        // recalcular cuotas
        facturaActual = recalcularCuotas(facturaActual);
        saveFactura();
        alert("Producto agregado a factura ✅");
        modalProducts.classList.add('hidden');
        abrirFactura(facturaActual.id);
      };
      list.appendChild(li);
    });
}
document.getElementById('searchProduct').addEventListener('input', e=>renderProducts(e.target.value));

function saveFactura(){
  const facturas = load(LS_INVOICES);
  const idx = facturas.findIndex(f=>f.id===facturaActual.id);
  if(idx>=0){ facturas[idx]=facturaActual; save(LS_INVOICES,facturas); }
}

// Reusar la función de facturación
function recalcularCuotas(factura){
  if(factura.pago !== "credito" || !factura.plan) return factura;

  const cuotas = factura.plan==="semanal" ? 4 : 2;
  const monto = Math.ceil(factura.total / cuotas);
  const hoy = new Date();

  factura.pagos = [];
  for(let i=1;i<=cuotas;i++){
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + (factura.plan==="semanal" ? i*7 : i*15));
    factura.pagos.push({
      fecha: fecha.toISOString().split("T")[0],
      monto,
      pagado: false,
      mora: 0
    });
  }
  return factura;
}

searchInput.addEventListener('input', e=>renderPendientes(e.target.value));
document.addEventListener('DOMContentLoaded', ()=>renderPendientes());
