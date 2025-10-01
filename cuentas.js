const LS_INVOICES = 'facturacion_invoices_v1';
const LS_PRODUCTS = 'facturacion_products_v1';

function load(key){ try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch{ return []; } }
function save(key,data){ localStorage.setItem(key, JSON.stringify(data)); }

const lista = document.getElementById('listaPendientes');
const searchInput = document.getElementById('searchCuentas');

let facturaActual = null;
let productoPendiente = null;

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
  `;

  renderPagos();
  document.getElementById('modalFactura').classList.remove('hidden');
};

document.getElementById('cerrarFactura').onclick = ()=>{
  document.getElementById('modalFactura').classList.add('hidden');
  facturaActual=null;
};

// Render pagos
function renderPagos(){
  const ul = document.getElementById('listaPagos');
  if(!facturaActual || !facturaActual.pagos){ ul.innerHTML="Sin pagos programados"; return; }

  ul.innerHTML = facturaActual.pagos.map((p,i)=>`
    <li>
      ${new Date(p.fecha).toLocaleDateString()} - $${p.monto} 
      ${p.pagado ? "✅ Pagado" : "⏳ Pendiente"} 
      ${p.mora>0 ? `<span style="color:red">+ Mora $${p.mora}</span>`:""}
      ${!p.pagado ? `
        <button onclick="marcarPago(${i})">Pagar</button>
        <button onclick="agregarMora(${i})">Mora +300</button>
      `:""}
    </li>
  `).join("");

  saveFactura();
}

// Marcar pago
window.marcarPago = (i)=>{
  facturaActual.pagos[i].pagado=true;
  saveFactura();
  renderPagos();
};

// Agregar mora
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
        productoPendiente = p;
        document.getElementById('productoNuevo').textContent = `${p.name} ($${p.price})`;
        modalProducts.classList.add('hidden');
        document.getElementById('modalOpciones').classList.remove('hidden');
      };
      list.appendChild(li);
    });
}
document.getElementById('searchProduct').addEventListener('input', e=>renderProducts(e.target.value));

// Modal opciones
const modalOpciones = document.getElementById('modalOpciones');
document.getElementById('cerrarOpciones').onclick = ()=> modalOpciones.classList.add('hidden');

// Opción A: sumar al saldo existente
document.getElementById('opcionSumar').onclick = ()=>{
  if(!productoPendiente) return;
  facturaActual.productos.push({...productoPendiente, qty:1});
  facturaActual.total += productoPendiente.price;

  if(facturaActual.pagos && facturaActual.pagos.length>0){
    const extra = productoPendiente.price / facturaActual.pagos.length;
    facturaActual.pagos.forEach(pg=>{
      pg.monto = (parseFloat(pg.monto) + extra).toFixed(2);
    });
  }

  saveFactura();
  alert("Producto agregado y sumado al saldo ✅");
  modalOpciones.classList.add('hidden');
  abrirFactura(facturaActual.id);
};

// Opción B: nueva fecha de pago con calendario
document.getElementById('opcionNuevaFecha').onclick = ()=>{
  document.getElementById('calendarBox').classList.remove('hidden');

  flatpickr("#fechaFlatpickr", {
    dateFormat: "Y-m-d",
    minDate: "today",
    defaultDate: new Date(),
    onChange: (selectedDates) => {
      const fecha = selectedDates[0];
      if(!productoPendiente || !fecha) return;

      facturaActual.productos.push({...productoPendiente, qty:1});
      facturaActual.total += productoPendiente.price;
      facturaActual.pagos.push({
        fecha: fecha.toISOString().split("T")[0],
        monto: productoPendiente.price,
        pagado: false,
        mora: 0
      });

      saveFactura();
      alert("Producto agregado con nueva fecha de pago ✅");
      document.getElementById('calendarBox').classList.add('hidden');
      modalOpciones.classList.add('hidden');
      abrirFactura(facturaActual.id);
    }
  });
};

// Eliminar factura solo si está pagada
document.getElementById('btnEliminarFactura').onclick = ()=>{
  if(!facturaActual) return;

  let pendiente = 0;
  if(facturaActual.pagos && facturaActual.pagos.length > 0){
    pendiente = facturaActual.pagos
      .filter(p=>!p.pagado)
      .reduce((sum,p)=> sum + parseFloat(p.monto) + parseFloat(p.mora||0), 0);
  }

  if(pendiente > 0){
    alert("❌ No se puede eliminar la factura: aún tiene pagos pendientes.");
    return;
  }

  if(confirm("¿Seguro que deseas eliminar esta factura?")){
    let facturas = load(LS_INVOICES);
    facturas = facturas.filter(f=>f.id !== facturaActual.id);
    save(LS_INVOICES, facturas);

    alert("✅ Factura eliminada correctamente");
    document.getElementById('modalFactura').classList.add('hidden');
    facturaActual = null;
    renderPendientes();
  }
};

function saveFactura(){
  const facturas = load(LS_INVOICES);
  const idx = facturas.findIndex(f=>f.id===facturaActual.id);
  if(idx>=0){ facturas[idx]=facturaActual; save(LS_INVOICES,facturas); }
}

// Inicializar
searchInput.addEventListener('input', e=>renderPendientes(e.target.value));
document.addEventListener('DOMContentLoaded', ()=>renderPendientes());
