// inventario.js (module)
// Inventario con Firestore + Storage (sin autenticación).
// Requiere Firebase v9 (se importa desde CDN).

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, orderBy, query, where, getDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

/* ====== CONFIG de Firebase (usa la que me diste) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyAvUePNjiKhiFePN5PY4yOqwgIHy8F_few",
  authDomain: "sistema-cristo-felix-2.firebaseapp.com",
  projectId: "sistema-cristo-felix-2",
  storageBucket: "sistema-cristo-felix-2.firebasestorage.app",
  messagingSenderId: "897774362587",
  appId: "1:897774362587:web:2221e7a21148d3cf3711fe",
  measurementId: "G-L8PPVC98S6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/* ====== Utilidades locales ====== */
function genCode(){
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random()*900 + 100);
  return `P-${t}-${r}`;
}
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}
function formatMoney(n){
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

/* ====== Elementos DOM ====== */
const form = document.getElementById('productForm');
const nameInput = document.getElementById('name');
const costInput = document.getElementById('cost');
const priceInput = document.getElementById('price');
const stockInput = document.getElementById('stock');
const descInput = document.getElementById('description');
const imageInput = document.getElementById('image');
const imagePreviewWrap = document.getElementById('imagePreviewWrap');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImage');

const listEl = document.getElementById('list');
const searchInput = document.getElementById('search');
const filterStock = document.getElementById('filterStock');
const orderByEl = document.getElementById('orderBy');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEdit');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

let editingId = null;
let currentImageFile = null; // File para subir
let unsubscribeSnapshot = null;

/* ====== Firestore collection ref ====== */
const productosCol = collection(db, 'productos');

/* ====== Preview de imagen ====== */
imageInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) { currentImageFile = null; imagePreviewWrap.style.display = 'none'; return; }
  currentImageFile = f;
  const url = URL.createObjectURL(f);
  imagePreview.src = url;
  imagePreviewWrap.style.display = 'block';
});
removeImageBtn.addEventListener('click', () => {
  imageInput.value = '';
  currentImageFile = null;
  imagePreview.src = '';
  imagePreviewWrap.style.display = 'none';
});

/* ====== Render listado ====== */
function renderProducts(snapshotDocs){
  if (!snapshotDocs || snapshotDocs.length === 0){
    listEl.innerHTML = `<p class="small">No hay productos.</p>`;
    return;
  }

  const nodes = snapshotDocs.map(docSnap => {
    const p = docSnap.data();
    const id = docSnap.id;
    return `
      <div class="product-item" data-id="${id}">
        <div class="product-meta">
          <div class="prod-name" style="font-weight:700">${escapeHtml(p.name)} <span class="prod-code small">(${id})</span></div>
          <div class="small">Precio: ${formatMoney(p.price)} · Costo: ${formatMoney(p.cost)}</div>
          <div class="prod-stock">Stock: <strong>${p.stock ?? 0}</strong></div>
          <div style="font-size:13px;color:#6b7280;margin-top:6px">${p.description ? escapeHtml(p.description) : ''}</div>
          ${p.imageURL ? `<div style="margin-top:6px"><img src="${escapeHtml(p.imageURL)}" class="img-preview" width="60" height="60"></div>` : ''}
        </div>
        <div class="actions">
          <button class="action-btn action-sell" data-action="sell">Vender</button>
          <button class="action-btn action-edit" data-action="edit">Editar</button>
          <button class="action-btn action-delete" data-action="delete">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.innerHTML = nodes;
}

/* ====== Listen (real-time) ====== */
function startListening(){
  // Construir query base (orden por createdAt desc por defecto)
  // NOTA: para filtros complejos podemos re-consultar. Aquí usamos una escucha simple y filtramos en cliente.
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  const q = query(productosCol, orderBy('createdAt', 'desc'));
  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    // snapshot.docs es una lista de docSnapshots
    // Aplicar búsqueda y filtros en cliente para mantener onSnapshot simple
    let docs = snapshot.docs;

    // Search filter text
    const qtext = (searchInput.value || '').trim().toLowerCase();
    if (qtext) {
      docs = docs.filter(ds => {
        const p = ds.data();
        return (p.name || '').toLowerCase().includes(qtext) || ds.id.toLowerCase().includes(qtext);
      });
    }

    // Stock filter
    const f = filterStock.value;
    if (f === 'low') docs = docs.filter(ds => {
      const s = ds.data().stock ?? 0; return s > 0 && s <= 5;
    });
    if (f === 'out') docs = docs.filter(ds => (ds.data().stock ?? 0) <= 0);

    // Ordering client-side (si se pide distinto)
    const order = orderByEl.value;
    if (order === 'name_asc') {
      docs.sort((a,b)=> (a.data().name||'').localeCompare(b.data().name||''));
    } else if (order === 'stock_asc') {
      docs.sort((a,b)=> (a.data().stock||0) - (b.data().stock||0));
    } // else createdAt_desc ya viene del servidor

    renderProducts(docs);
  }, (err) => {
    console.error('Snapshot error', err);
    listEl.innerHTML = `<p class="small" style="color:#ef4444">Error al cargar productos.</p>`;
  });
}

/* ====== CRUD: Add / Update ====== */
async function uploadImageAndGetURL(productId, file, previousPath = null){
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const filename = `productos/${productId}/${Date.now()}.${ext}`;
  const r = storageRef(storage, filename);
  const snap = await uploadBytes(r, file);
  const url = await getDownloadURL(snap.ref);
  // Eliminar imagen anterior si existe
  if (previousPath) {
    try { await deleteObject(storageRef(storage, previousPath)); } catch(e){ /*ignore*/ }
  }
  // Devolver objeto con url y storagePath (para borrar después)
  return { url, path: filename };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  statusEl.textContent = 'Guardando...';

  const name = (nameInput.value || '').trim();
  const cost = parseFloat(costInput.value) || 0;
  const price = parseFloat(priceInput.value) || 0;
  const stock = parseInt(stockInput.value) || 0;
  const description = (descInput.value || '').trim();

  if (!name) { alert('Nombre requerido'); saveBtn.disabled = false; statusEl.textContent=''; return; }
  if (cost < 0 || price < 0 || stock < 0) { alert('Valores numéricos inválidos'); saveBtn.disabled = false; statusEl.textContent=''; return; }

  try {
    if (editingId) {
      // UPDATE
      const productDocRef = doc(db, 'productos', editingId);
      const prodSnap = await getDoc(productDocRef);
      if (!prodSnap.exists()) { alert('Producto no encontrado'); resetForm(); saveBtn.disabled = false; statusEl.textContent=''; return; }
      const prev = prodSnap.data() || {};

      let imageInfo = { url: prev.imageURL || null, path: prev.imagePath || null };
      if (currentImageFile) {
        // subir nueva imagen y borrar anterior
        const up = await uploadImageAndGetURL(editingId, currentImageFile, prev.imagePath || null);
        if (up) imageInfo = { url: up.url, path: up.path };
      } else if (imageInput.value === '' && prev.imagePath) {
        // Si el usuario quitó la imagen (borró input) -> borrar imagen anterior
        try { await deleteObject(storageRef(storage, prev.imagePath)); } catch(e){ /*ignore*/ }
        imageInfo = { url: null, path: null };
      }

      await updateDoc(productDocRef, {
        name, cost, price, stock, description,
        imageURL: imageInfo.url || null,
        imagePath: imageInfo.path || null,
        updatedAt: serverTimestamp()
      });

    } else {
      // CREATE
      const newId = genCode();
      const productDocRef = doc(db, 'productos', newId); // usar nuestro código como ID
      let imageInfo = { url: null, path: null };
      if (currentImageFile) {
        const up = await uploadImageAndGetURL(newId, currentImageFile, null);
        if (up) imageInfo = { url: up.url, path: up.path };
      }
      await addDoc(productosCol, {
        // aunque usamos addDoc (genera id), queremos preservar el código en el documento; para consistencia
        // la alternativa es setDoc con doc(db,'productos',newId) pero addDoc + guardar code en campo también ok
        code: newId,
        name, cost, price, stock,
        description,
        imageURL: imageInfo.url || null,
        imagePath: imageInfo.path || null,
        createdAt: serverTimestamp()
      });
    }

    resetForm();
    statusEl.textContent = 'Guardado';
    setTimeout(()=> statusEl.textContent = '', 1500);
  } catch (err) {
    console.error(err);
    alert('Error al guardar producto: ' + (err.message || err));
    statusEl.textContent = '';
  } finally {
    saveBtn.disabled = false;
  }
});

/* ====== Reset form ====== */
function resetForm(){
  form.reset();
  currentImageFile = null;
  imagePreview.src = '';
  imagePreviewWrap.style.display = 'none';
  editingId = null;
  formTitle.textContent = 'Agregar producto';
  cancelEditBtn.style.display = 'none';
}

/* ====== Delegación de acciones en la lista ====== */
listEl.addEventListener('click', async (ev) => {
  const actionBtn = ev.target.closest('button[data-action]');
  if (!actionBtn) return;
  const item = ev.target.closest('.product-item');
  const id = item?.dataset.id;
  if (!id) return;
  const action = actionBtn.dataset.action;

  if (action === 'edit') {
    // Cargar datos en formulario
    try {
      const pd = await getDoc(doc(db, 'productos', id));
      if (!pd.exists()) { alert('Producto no encontrado'); return; }
      const p = pd.data();
      editingId = id;
      nameInput.value = p.name || '';
      costInput.value = p.cost ?? 0;
      priceInput.value = p.price ?? 0;
      stockInput.value = p.stock ?? 0;
      descInput.value = p.description || '';
      formTitle.textContent = `Editar: ${id}`;
      cancelEditBtn.style.display = 'inline-block';

      // Previsualizar imagen si existe
      if (p.imageURL) {
        imagePreview.src = p.imageURL;
        imagePreviewWrap.style.display = 'block';
        currentImageFile = null;
        imageInput.value = ''; // vacío para indicar que no se cargará nuevo
      } else {
        imagePreview.src = '';
        imagePreviewWrap.style.display = 'none';
      }

      window.scrollTo({top:0,behavior:'smooth'});
    } catch(e){
      console.error(e);
      alert('Error cargando producto');
    }
  } else if (action === 'delete') {
    if (!confirm('Eliminar producto? Esta acción no se puede deshacer.')) return;
    try {
      const pd = await getDoc(doc(db, 'productos', id));
      if (pd.exists()) {
        const p = pd.data();
        // Borrar imagen del storage si existe
        if (p.imagePath) {
          try { await deleteObject(storageRef(storage, p.imagePath)); } catch(e){ /*ignore*/ }
        }
      }
      // Borrar doc
      await deleteDoc(doc(db, 'productos', id));
    } catch(err){
      console.error(err);
      alert('Error al eliminar');
    }
  } else if (action === 'sell') {
    const qtyStr = prompt('Cantidad a vender (enter para cancelar):', '1');
    if (qtyStr === null) return;
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) return alert('Cantidad inválida');

    // Usar transaction para evitar race conditions
    try {
      const prodRef = doc(db, 'productos', id);
      await runTransaction(db, async (t)=>{
        const snap = await t.get(prodRef);
        if (!snap.exists()) throw new Error('Producto no encontrado');
        const currentStock = snap.data().stock ?? 0;
        if (currentStock < qty) throw new Error('Stock insuficiente');
        t.update(prodRef, { stock: currentStock - qty, updatedAt: serverTimestamp() });
      });
      alert('Venta registrada. Stock actualizado.');
    } catch(err){
      console.error(err);
      alert('Error al vender: ' + (err.message || err));
    }
  }
});

/* ====== Cancel edit ====== */
cancelEditBtn.addEventListener('click', () => {
  resetForm();
});

/* ====== Buscador / filtros ====== */
searchInput.addEventListener('input', () => {
  // restartListening se encarga de filtrar en cliente; solo re-render via snapshot
  // para forzar re-render, no hacemos nada: onSnapshot ya escucha y aplicamos filtros sobre snapshot docs.
  startListening();
});
filterStock.addEventListener('change', () => startListening());
orderByEl.addEventListener('change', () => startListening());

/* ====== Inicialización ====== */
function init(){
  // Si quieres datos de prueba, crea manualmente desde la consola de Firebase
  startListening();
}

document.addEventListener('DOMContentLoaded', init);
