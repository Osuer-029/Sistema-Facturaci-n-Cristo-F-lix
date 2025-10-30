// facturacion.js — Facturación con Firebase Firestore
import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// --- Configuración Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyAvUePNjiKhiFePN5PY4yOqwgIHy8F_few",
  authDomain: "sistema-cristo-felix-2.firebaseapp.com",
  projectId: "sistema-cristo-felix-2",
  storageBucket: "sistema-cristo-felix-2.appspot.com",
  messagingSenderId: "897774362587",
  appId: "1:897774362587:web:2221e7a21148d3cf3711fe",
  measurementId: "G-L8PPVC98S6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Variables ---
let selectedClient = null;
let selectedProducts = [];

// --- CLIENTES MODAL ---
const modalClients = document.getElementById('modalClients');
document.getElementById('btnSelectClient').onclick = async () => {
  await renderClients();
  modalClients.classList.remove('hidden');
};
document.getElementById('closeClients').onclick = () =>
  modalClients.classList.add('hidden');

async function renderClients(filter = "") {
  const list = document.getElementById('listClients');
  list.innerHTML = "<p>Cargando clientes...</p>";
  const querySnap = await getDocs(collection(db, "clientes"));
  const clients = querySnap.docs.map(d => ({ id: d.id, ...d.data() }));

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
document.getElementById('btnSelectProduct').onclick = async () => {
  await renderProducts();
  modalProducts.classList.remove('hidden');
};
document.getElementById('closeProducts').onclick = () =>
  modalProducts.classList.add('hidden');

async function renderProducts(filter = "") {
  const list = document.getElementById('listProducts');
  list.innerHTML = "<p>Cargando productos...</p>";
  const querySnap = await getDocs(collection(db, "productos"));
  const prods = querySnap.docs.map(d => ({ id: d.id, ...d.data() }));

  list.innerHTML = "";
  prods
    .filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
    .forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.code} - ${p.name} ($${p.price}) - Stock: ${p.stock}`;
      li.onclick = () => {
        if (p.stock <= 0) {
          alert(`⚠️ El producto "${p.name}" no tiene stock disponible.`);
          return;
        }
        const existing = selectedProducts.find(sp => sp.code === p.code);
        if (existing) {
          if (existing.qty + 1 > p.stock) {
            alert(`⚠️ Stock insuficiente para ${p.name}. Máximo ${p.stock}`);
            return;
          }
          existing.qty++;
        } else {
          selectedProducts.push({ ...p, qty: 1 });
        }
        updateProductList();
        modalProducts.classList.add('hidden');
      };
      list.appendChild(li);
    });
}
document.getElementById('searchProduct').addEventListener('input', e => renderProducts(e.target.value));

// --- PRODUCTOS SELECCIONADOS ---
function updateProductList() {
  const ul = document.getElementById('selectedProducts');
  ul.innerHTML = "";
  let total = 0;
  selectedProducts.forEach((p, i) => {
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
  if (qty > selectedProducts[i].stock) {
    alert(`⚠️ Stock insuficiente para ${selectedProducts[i].name}. Máximo: ${selectedProducts[i].stock}`);
    qty = selectedProducts[i].stock;
  }
  selectedProducts[i].qty = qty;
  updateProductList();
};
window.removeProduct = (i) => {
  selectedProducts.splice(i, 1);
  updateProductList();
};

// --- GUARDAR FACTURA ---
document.getElementById('facturaForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!selectedClient) { alert("Seleccione un cliente"); return; }
  if (selectedProducts.length === 0) { alert("Agregue al menos un producto"); return; }

  const pago = document.querySelector('input[name="pago"]:checked').value;
  const total = selectedProducts.reduce((sum, p) => sum + p.price * p.qty, 0);

  let factura = {
    cliente: selectedClient,
    productos: selectedProducts,
    pago,
    total,
    fecha: new Date().toISOString(),
    estado: pago === "credito" ? "pendiente" : "pagada",
    pagosRealizados: [],
    mora: 0
  };

  // Guardar factura
  await addDoc(collection(db, "facturas"), factura);

  // Actualizar stock
  for (const sp of selectedProducts) {
    const ref = doc(db, "productos", sp.id);
    await updateDoc(ref, { stock: sp.stock - sp.qty });
  }

  alert("Factura guardada correctamente ✅");
  location.href = "index.html";
};
