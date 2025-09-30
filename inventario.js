// inventario.js
// Inventario con localStorage, CRUD, búsqueda, edición, eliminación y "vender" (rebajar stock).

const LS_KEY = 'facturacion_products_v1';

// --- Helpers DB ---
function readDB(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  }catch(e){
    console.error('DB parse error', e);
    return [];
  }
}
function writeDB(arr){
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

// Genera código único: P + fecha(ms) + 3 dígitos aleatorios
function genCode(){
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random()*900 + 100);
  return `P-${t}-${r}`;
}

// --- CRUD ---
function addProduct(prod){
  const db = readDB();
  db.unshift(prod); // mostrar recientes arriba
  writeDB(db);
}
function updateProduct(code, updates){
  const db = readDB();
  const idx = db.findIndex(p => p.code === code);
  if (idx === -1) return false;
  db[idx] = {...db[idx], ...updates, updatedAt: new Date().toISOString()};
  writeDB(db);
  return true;
}
function deleteProduct(code){
  let db = readDB();
  db = db.filter(p => p.code !== code);
  writeDB(db);
}
function getProduct(code){
  return readDB().find(p => p.code === code);
}

// Venta — reduce stock. Devuelve objeto {ok, message}
function sellProduct(code, qty){
  qty = Number(qty);
  if (qty <= 0) return {ok:false, message:'Cantidad inválida'};
  const p = getProduct(code);
  if (!p) return {ok:false, message:'Producto no encontrado'};
  if (p.stock < qty) return {ok:false, message:'Stock insuficiente'};
  updateProduct(code, {stock: p.stock - qty});
  return {ok:true, message:'Venta registrada'};
}

// --- UI ---
const form = document.getElementById('productForm');
const nameInput = document.getElementById('name');
const costInput = document.getElementById('cost');
const priceInput = document.getElementById('price');
const stockInput = document.getElementById('stock');
const descInput = document.getElementById('description');
const listEl = document.getElementById('list');
const searchInput = document.getElementById('search');
const filterStock = document.getElementById('filterStock');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEdit');

let editingCode = null;

function resetForm(){
  form.reset();
  stockInput.value = 0;
  editingCode = null;
  formTitle.textContent = 'Agregar producto';
  cancelEditBtn.style.display = 'none';
}

function renderList(){
  const q = (searchInput.value || '').trim().toLowerCase();
  const filter = filterStock.value;
  let prods = readDB();

  if (q){
    prods = prods.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }
  if (filter === 'low') prods = prods.filter(p => p.stock > 0 && p.stock <= 5);
  if (filter === 'out') prods = prods.filter(p => p.stock <= 0);

  if (prods.length === 0){
    listEl.innerHTML = `<p style="color:#6b7280;margin:6px 0">No hay productos que coincidan.</p>`;
    return;
  }

  listEl.innerHTML = prods.map(p => {
    return `
      <div class="product-item" data-code="${p.code}">
        <div class="product-meta">
          <div class="prod-name">${escapeHtml(p.name)} <span class="prod-code">(${p.code})</span></div>
          <div>Precio: ${formatMoney(p.price)} · Costo: ${formatMoney(p.cost)}</div>
          <div class="prod-stock">Stock: <strong>${p.stock}</strong></div>
          <div style="font-size:13px;color:#6b7280;margin-top:6px">${p.description ? escapeHtml(p.description) : ''}</div>
        </div>
        <div class="actions">
          <button class="action-btn action-sell" data-action="sell">Vender</button>
          <button class="action-btn action-edit" data-action="edit">Editar</button>
          <button class="action-btn action-delete" data-action="delete">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

// seguridad simple al renderizar texto
function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}
function formatMoney(n){
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// Event: submit (create / update)
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const cost = parseFloat(costInput.value) || 0;
  const price = parseFloat(priceInput.value) || 0;
  const stock = parseInt(stockInput.value) || 0;
  const description = descInput.value.trim();

  if (!name) { alert('Nombre requerido'); return; }
  if (cost < 0 || price < 0 || stock < 0) { alert('Valores numéricos inválidos'); return; }

  if (editingCode){
    updateProduct(editingCode, { name, cost, price, stock, description });
  } else {
    const newProd = {
      code: genCode(),
      name,
      cost,
      price,
      stock,
      description,
      createdAt: new Date().toISOString()
    };
    addProduct(newProd);
  }

  resetForm();
  renderList();
});

// Cancelar edición
cancelEditBtn.addEventListener('click', () => {
  resetForm();
});

// Delegación en lista (vender, editar, eliminar)
listEl.addEventListener('click', (ev) => {
  const actionBtn = ev.target.closest('button[data-action]');
  if (!actionBtn) return;
  const item = ev.target.closest('.product-item');
  const code = item?.dataset.code;
  if (!code) return;

  const action = actionBtn.dataset.action;
  if (action === 'edit'){
    const p = getProduct(code);
    if (!p) return alert('Producto no encontrado');
    editingCode = code;
    nameInput.value = p.name;
    costInput.value = p.cost;
    priceInput.value = p.price;
    stockInput.value = p.stock;
    descInput.value = p.description;
    formTitle.textContent = `Editar: ${p.code}`;
    cancelEditBtn.style.display = 'inline-block';
    window.scrollTo({top:0,behavior:'smooth'});
  } else if (action === 'delete'){
    if (!confirm('Eliminar producto? Esta acción no se puede deshacer.')) return;
    deleteProduct(code);
    renderList();
  } else if (action === 'sell'){
    // Pedir cantidad a vender
    const qty = prompt('Cantidad a vender (enter para cancelar):', '1');
    if (qty === null) return;
    const n = parseInt(qty);
    if (isNaN(n) || n <= 0) return alert('Cantidad inválida');
    const res = sellProduct(code, n);
    if (!res.ok) return alert(res.message);
    alert('Venta registrada. Stock actualizado.');
    renderList();
  }
});

// Buscador / filtro
searchInput.addEventListener('input', () => renderList());
filterStock.addEventListener('change', () => renderList());

// Inicialización demo (si vacio, dejamos vacío — si quieres datos de prueba descomenta initDemo())
function initDemoIfEmpty(){
  const db = readDB();
  if (db.length === 0){
    // Dejar vacío para que el usuario agregue sus propios productos.
    // Si deseas datos de ejemplo, descomenta la línea siguiente:
    // initDemo();
  }
}
function initDemo(){
  const sample = [
    { code: genCode(), name: 'Papel A4 80g', cost: 2.5, price: 5.0, stock: 30, description: 'Caja de 500 hojas', createdAt: new Date().toISOString() },
    { code: genCode(), name: 'Tinta Negra', cost: 10, price: 20, stock: 8, description: 'Cartucho para impresora', createdAt: new Date().toISOString() },
  ];
  writeDB(sample);
}

const LS_PRODUCTS = 'facturacion_products_v1';

function load(key){ try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch{ return []; } }
function save(key,data){ localStorage.setItem(key, JSON.stringify(data)); }

const lista = document.getElementById('listaInventario');

function renderInventario(){
  const productos = load(LS_PRODUCTS);
  if(productos.length===0){
    lista.innerHTML = "<li>No hay productos</li>";
    return;
  }

  lista.innerHTML = productos.map(p => `
    <li>
      <b>${p.code} - ${p.name}</b><br>
      Precio: $${p.price} | Costo: $${p.cost}<br>
      Stock: ${p.stock}<br>
      ${p.image ? `<img src="${p.image}" width="50">` : ""}
    </li>
  `).join("");
}

document.addEventListener('DOMContentLoaded', renderInventario);


// init
document.addEventListener('DOMContentLoaded', () => {
  initDemoIfEmpty();
  renderList();
});
