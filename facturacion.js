const LS_PRODUCTS = 'facturacion_products_v1';
const LS_CLIENTS = 'facturacion_clients_v1';
const LS_INVOICES = 'facturacion_invoices_v1';

let selectedClient = null;
let selectedProducts = [];

// Helpers
function load(key){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
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
        selectedProducts.push({...p, qty:1});
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

// --- MOSTRAR / OCULTAR PLAN DE PAGOS ---
document.querySelectorAll('input[name="pago"]').forEach(radio=>{
  radio.addEventListener('change', e=>{
    document.getElementById('planPagosBox').style.display = 
      e.target.value==="credito" ? "block" : "none";
  });
});

// --- GENERAR Y RECALCULAR CUOTAS ---
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

// --- GUARDAR FACTURA ---
document.getElementById('facturaForm').onsubmit = e => {
  e.preventDefault();
  if(!selectedClient){ alert("Seleccione un cliente"); return; }
  if(selectedProducts.length===0){ alert("Agregue al menos un producto"); return; }

  // 🔹 Verificar stock antes de guardar
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

  let plan = null;
  let pagos = [];
  if(pago==="credito"){
    plan = document.querySelector('input[name="plan"]:checked').value;
    pagos = [];
  }

  let factura = {
    id: Date.now(),
    cliente: selectedClient,
    productos: selectedProducts,
    pago,
    total,
    fecha: new Date().toISOString(),
    estado: pago==="credito" ? "pendiente" : "pagada",
    plan,
    pagos
  };

  factura = recalcularCuotas(factura);

  const invoices = load(LS_INVOICES);
  invoices.push(factura);
  save(LS_INVOICES, invoices);

  // 🔹 Rebajar stock del inventario
  factura.productos.forEach(fp => {
    const idx = productos.findIndex(p => p.code === fp.code);
    if(idx >= 0){
      productos[idx].stock -= fp.qty;
      if(productos[idx].stock < 0) productos[idx].stock = 0;
    }
  });
  save(LS_PRODUCTS, productos);

  alert("Factura guardada correctamente ✅");
  location.href = "index.html"; // volver al inicio
};
