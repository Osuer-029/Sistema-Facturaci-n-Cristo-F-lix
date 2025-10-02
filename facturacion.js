const LS_PRODUCTS = 'facturacion_products_v1';
const LS_CLIENTS = 'facturacion_clients_v1';
const LS_INVOICES = 'facturacion_invoices_v1';

let selectedClient = null;
let selectedProducts = [];
let fechasSeleccionadas = []; // 🔹 Fechas de pago

function load(key){
  try{
    return JSON.parse(localStorage.getItem(key) || '[]');
  }catch{ return []; }
}
function save(key, data){
  localStorage.setItem(key, JSON.stringify(data));
}

// --- CLIENTES MODAL ---
const modalClients = document.getElementById('modalClients');
document.getElementById('btnSelectClient').onclick = () => {
  renderClients();
  modalClients.classList.remove('hidden');
};
document.getElementById('closeClients').onclick = () => modalClients.classList.add('hidden');

function renderClients(filter=""){
  const clients = load(LS_CLIENTS);
  const list = document.getElementById('listClients');
  list.innerHTML = "";
  clients
    .filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.code} - ${c.name} (${c.phone})`;
      li.onclick = () => {
        selectedClient = c;
        document.getElementById('selectedClient').textContent = `${c.name} (${c.phone})`;
        modalClients.classList.add('hidden');
      };
      list.appendChild(li);
    });
}
document.getElementById('searchClient').addEventListener('input', e => renderClients(e.target.value));

// --- PRODUCTOS MODAL ---
const modalProducts = document.getElementById('modalProducts');
document.getElementById('btnSelectProduct').onclick = () => {
  renderProducts();
  modalProducts.classList.remove('hidden');
};
document.getElementById('closeProducts').onclick = () => modalProducts.classList.add('hidden');

function renderProducts(filter=""){
  const prods = load(LS_PRODUCTS);
  const list = document.getElementById('listProducts');
  list.innerHTML = "";
  prods
    .filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.code} - ${p.name} ($${p.price}) - Stock: ${p.stock}`;
      li.onclick = () => {
        if(p.stock <= 0){
          alert(`⚠️ El producto "${p.name}" no tiene stock disponible.`);
          return;
        }
        const existing = selectedProducts.find(sp=>sp.code===p.code);
        if(existing){
          if(existing.qty+1 > p.stock){
            alert(`⚠️ Stock insuficiente para ${p.name}. Máximo ${p.stock}`);
            return;
          }
          existing.qty++;
        }else{
          selectedProducts.push({...p, qty:1});
        }
        updateProductList();
        modalProducts.classList.add('hidden');
      };
      list.appendChild(li);
    });
}
document.getElementById('searchProduct').addEventListener('input', e => renderProducts(e.target.value));

// --- PRODUCTOS SELECCIONADOS ---
function updateProductList(){
  const ul = document.getElementById('selectedProducts');
  ul.innerHTML = "";
  let total = 0;
  selectedProducts.forEach((p,i) => {
    total += p.price * p.qty;
    const li = document.createElement('li');
    li.innerHTML = `
      ${p.name} - $${p.price} x 
      <input type="number" min="1" max="${p.stock}" value="${p.qty}" style="width:50px" 
             onchange="updateQty(${i}, this.value)">
      <button onclick="removeProduct(${i})">❌</button>
    `;
    ul.appendChild(li);
  });
  document.getElementById('totalFactura').textContent = total.toFixed(2);
}
window.updateQty = (i, val) => {
  let qty = parseInt(val) || 1;
  if(qty > selectedProducts[i].stock){
    alert(`⚠️ Stock insuficiente para ${selectedProducts[i].name}. Máximo: ${selectedProducts[i].stock}`);
    qty = selectedProducts[i].stock;
  }
  selectedProducts[i].qty = qty;
  updateProductList();
};
window.removeProduct = (i) => {
  selectedProducts.splice(i,1);
  updateProductList();
};

// --- MOSTRAR / OCULTAR CALENDARIO ---
document.querySelectorAll('input[name="pago"]').forEach(radio=>{
  radio.addEventListener('change', e=>{
    document.getElementById('calendarBox').style.display = 
      e.target.value==="credito" ? "block" : "none";
  });
});

// --- CALENDARIO DE PAGOS ---
flatpickr("#calendarPagos", {
  mode: "multiple",
  dateFormat: "Y-m-d",
  onChange: (selectedDates) => {
    fechasSeleccionadas = selectedDates;
    renderPagos();
  }
});

function renderPagos(){
  const lista = document.getElementById("listaPagos");
  lista.innerHTML = "";
  if(fechasSeleccionadas.length === 0) return;

  const total = parseFloat(document.getElementById("totalFactura").textContent);
  const monto = (total / fechasSeleccionadas.length).toFixed(2);

  fechasSeleccionadas.forEach((fecha,i)=>{
    const li = document.createElement("li");
    li.textContent = `${i+1}. ${fecha.toLocaleDateString()} → $${monto} (pendiente)`;
    lista.appendChild(li);
  });
}

// --- GUARDAR FACTURA ---
document.getElementById('facturaForm').onsubmit = e => {
  e.preventDefault();
  if(!selectedClient){ alert("Seleccione un cliente"); return; }
  if(selectedProducts.length===0){ alert("Agregue al menos un producto"); return; }

  let productos = load(LS_PRODUCTS);
  for(const sp of selectedProducts){
    const inv = productos.find(p => p.code === sp.code);
    if(!inv || inv.stock < sp.qty){
      alert(`⚠️ Stock insuficiente para "${sp.name}". Disponible: ${inv ? inv.stock : 0}`);
      return;
    }
  }

  const pago = document.querySelector('input[name="pago"]:checked').value;
  const total = selectedProducts.reduce((sum,p) => sum + p.price*p.qty, 0);

  let pagos = [];
  if(pago==="credito"){
    if(fechasSeleccionadas.length === 0){
      alert("Seleccione al menos una fecha de pago en el calendario");
      return;
    }

    // Detectar si todas las fechas son quincenales (15 o 30)
    let tipoPlan = "semanal";
    if(fechasSeleccionadas.every(d => [15,30].includes(d.getDate()))){
      tipoPlan = "quincenal";
    }

    pagos = fechasSeleccionadas.map(f => ({
      fecha: f.toISOString().split("T")[0],
      monto: (total / fechasSeleccionadas.length).toFixed(2),
      pagado: false,
      mora: 0, // siempre empieza en 0
      tipoPlan // guardamos el tipo de plan, para luego aplicar la mora correcta
    }));
  }

  let factura = {
    id: Date.now(),
    cliente: selectedClient,
    productos: selectedProducts,
    pago,
    total,
    fecha: new Date().toISOString(),
    estado: pago==="credito" ? "pendiente" : "pagada",
    pagos
  };

  const invoices = load(LS_INVOICES);
  invoices.push(factura);
  save(LS_INVOICES, invoices);

  factura.productos.forEach(fp => {
    const idx = productos.findIndex(p => p.code === fp.code);
    if(idx >= 0){
      productos[idx].stock -= fp.qty;
      if(productos[idx].stock < 0) productos[idx].stock = 0;
    }
  });
  save(LS_PRODUCTS, productos);

  imprimirFacturaPDF(factura);

  alert("Factura guardada correctamente ✅");
  location.href = "index.html"; 
};



// --- IMPRIMIR FACTURA EN PDF ---
function imprimirFacturaPDF(factura){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:"portrait",unit:"pt",format:[220,600]});
  let y=20;
  doc.setFont("courier","normal");
  doc.setFontSize(12);
  doc.text("Cristo Felix",110,y,{align:"center"}); y+=16;
  doc.setFontSize(10);
  doc.text("San de arroz y aceite y mas",110,y,{align:"center"}); y+=14;
  doc.text("Pagos Semanal y Quincenal",110,y,{align:"center"}); y+=14;
  doc.text("Tel: 829-444-1880",110,y,{align:"center"}); y+=20;
  doc.line(10,y,210,y); y+=14;

  doc.text(`Factura: ${factura.id}`,110,y,{align:"center"}); y+=12;
  doc.text(`Cliente: ${factura.cliente.name}`,110,y,{align:"center"}); y+=14;

  factura.productos.forEach(p=>{
    doc.text(`${p.qty} x ${p.name} $${(p.qty*p.price).toFixed(2)}`,110,y,{align:"center"});
    y+=12;
  });
  y+=6; doc.line(10,y,210,y); y+=14;
  doc.setFontSize(12);
  doc.text(`TOTAL: $${factura.total.toFixed(2)}`,110,y,{align:"center"}); y+=18;

  if(factura.pago==="credito" && factura.pagos){
    doc.setFontSize(10);
    doc.text("PLAN DE PAGOS:",110,y,{align:"center"}); y+=14;
    factura.pagos.forEach((p,i)=>{
      doc.text(`${i+1}. ${p.fecha} $${p.monto}`,110,y,{align:"center"});
      y+=12;
    });
    y+=10;
  }
  doc.setFontSize(10);
  doc.text("Gracias por elegirnos",110,y,{align:"center"});
  doc.autoPrint();
  doc.save(`Factura_${factura.id}.pdf`);

}
