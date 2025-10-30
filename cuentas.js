// cuentas.js
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  updateDoc,
  deleteDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import { app } from "./firebaseConfig.js";
const db = getFirestore(app);

/* ====== DOM ====== */
const lista = document.getElementById('listaPendientes');
const searchInput = document.getElementById('searchCuentas');

const modalFacturaEl = document.getElementById('modalFactura');
const detalleEl = document.getElementById('detalleFactura');
const listaPagosEl = document.getElementById('listaPagos');
const btnEliminarFactura = document.getElementById('btnEliminarFactura');
const cerrarFacturaBtn = document.getElementById('cerrarFactura');

const modalProductos = document.getElementById('modalProductos');
const listProductsModal = document.getElementById('listProductsModal');
const searchProductModal = document.getElementById('searchProductModal');
const closeProductsModal = document.getElementById('closeProductsModal');

let facturaActual = null;
let lastSnapshotDocs = [];

/* ====== Escuchar facturas en tiempo real ====== */
let unsubscribe = null;
function startListeningFacturas() {
  if (unsubscribe) unsubscribe();
  const col = collection(db, "facturas");
  unsubscribe = onSnapshot(col, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lastSnapshotDocs = docs;
    renderPendientesFromDocs(docs, searchInput.value || "");
  }, err => {
    console.error("Error escuchando facturas:", err);
    lista.innerHTML = "<li>Error al cargar facturas</li>";
  });
}

/* ====== Render facturas pendientes ====== */
function renderPendientesFromDocs(docs, filtro = "") {
  const facturas = docs.filter(f => f.pago === "credito" && f.estado !== "eliminada");
  const q = (filtro || "").toLowerCase();
  const filtradas = facturas.filter(f =>
    (f.cliente?.name || "").toLowerCase().includes(q) || String(f.id).toLowerCase().includes(q)
  );

  if (filtradas.length === 0) {
    lista.innerHTML = "<li>No hay facturas pendientes</li>";
    return;
  }

  lista.innerHTML = filtradas.map(f => `
    <li>
      <div>
        <b>Factura #${escapeHtml(String(f.id))}</b><br>
        Cliente: ${escapeHtml(f.cliente?.name || '---')}<br>
        Total: $${Number(f.total || 0).toFixed(2)}<br>
        Estado: ${escapeHtml(f.estado || '---')}
      </div>
      <button onclick="abrirFactura('${f.id}')">🔍 Ver</button>
    </li>
  `).join("");
}

/* ====== Abrir factura ====== */
window.abrirFactura = async (id) => {
  try {
    const ref = doc(db, "facturas", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return alert("Factura no encontrada");
    facturaActual = { id, ...snap.data() };

    renderFacturaDetail();
    modalFacturaEl.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert("Error cargando factura");
  }
};

function renderFacturaDetail() {
  if (!facturaActual) return;

  // Productos
  let productosHTML = "<h4>Productos</h4><ul>";
  (facturaActual.productos || []).forEach(p => {
    productosHTML += `<li>${escapeHtml(String(p.qty))} x ${escapeHtml(p.name)} ($${Number(p.price).toFixed(2)})</li>`;
  });
  productosHTML += "</ul>";

  detalleEl.innerHTML = `
    <p><b>Cliente:</b> ${escapeHtml(facturaActual.cliente?.name || '')}</p>
    <p><b>Total:</b> $${Number(facturaActual.total || 0).toFixed(2)}</p>
    ${productosHTML}
  `;

  renderPagos();

  if (btnEliminarFactura) btnEliminarFactura.disabled = facturaActual.estado !== "Salda";
}

/* ====== Cerrar modal ====== */
if (cerrarFacturaBtn) cerrarFacturaBtn.addEventListener('click', () => {
  modalFacturaEl.classList.add('hidden');
  facturaActual = null;
});

/* ====== Render pagos y moras ====== */
function renderPagos() {
  if (!facturaActual) return;

  listaPagosEl.innerHTML = "<h4>Pagos</h4>";
  const pagos = facturaActual.pagosRealizados || [];
  if (pagos.length > 0) {
    pagos.forEach((p, i) => {
      listaPagosEl.innerHTML += `<li>${i+1}. $${Number(p.monto).toFixed(2)} ${p.fecha ? ` - ${new Date(p.fecha).toLocaleString()}` : ''}</li>`;
    });
  } else {
    listaPagosEl.innerHTML += "<p>Sin pagos</p>";
  }

  listaPagosEl.innerHTML += "<h4>Moras</h4>";
  const moras = facturaActual.moras || [];
  if (moras.length > 0) {
    moras.forEach((m, i) => {
      listaPagosEl.innerHTML += `<li>${i+1}. $${Number(m.monto).toFixed(2)} ${m.fecha ? ` - ${new Date(m.fecha).toLocaleString()}` : ''}</li>`;
    });
  } else {
    listaPagosEl.innerHTML += "<p>Sin moras</p>";
  }
}

/* ====== Guardar factura ====== */
async function saveFactura() {
  if (!facturaActual) return;
  const ref = doc(db, "facturas", facturaActual.id);
  const payload = {
    productos: facturaActual.productos || [],
    pagosRealizados: facturaActual.pagosRealizados || [],
    moras: facturaActual.moras || [],
    total: facturaActual.total || 0,
    estado: facturaActual.estado || 'Pendiente',
    updatedAt: new Date().toISOString()
  };
  await updateDoc(ref, payload);
}

/* ====== Agregar pago ====== */
window.agregarPago = async () => {
  if (!facturaActual) return;
  const monto = parseFloat(prompt("💵 Ingrese el monto del pago:"));
  if (isNaN(monto) || monto <= 0) return alert("Monto inválido");

  facturaActual.pagosRealizados = facturaActual.pagosRealizados || [];
  facturaActual.pagosRealizados.push({ monto, fecha: new Date().toISOString() });

  // Actualizar total
  const totalPagado = facturaActual.pagosRealizados.reduce((acc, p) => acc + p.monto, 0);
  const totalMoras = (facturaActual.moras || []).reduce((acc, m) => acc + m.monto, 0);
  const totalOriginal = facturaActual.productos.reduce((acc, p) => acc + p.price * p.qty, 0);
  facturaActual.total = totalOriginal + totalMoras - totalPagado;

  await saveFactura();
  abrirFactura(facturaActual.id);
};

/* ====== Agregar mora ====== */
window.agregarMora = async () => {
  if (!facturaActual) return;
  const monto = parseFloat(prompt("⚠️ Ingrese el monto de la mora:"));
  if (isNaN(monto) || monto <= 0) return alert("Monto inválido");

  facturaActual.moras = facturaActual.moras || [];
  facturaActual.moras.push({ monto, fecha: new Date().toISOString() });

  facturaActual.total += monto;

  await saveFactura();
  abrirFactura(facturaActual.id);
};

/* ====== Marcar factura como saldada ====== */
window.facturaSalda = async () => {
  if (!facturaActual) return alert("Seleccione una factura");
  try {
    const ref = doc(db, "facturas", facturaActual.id);
    await updateDoc(ref, { estado: "Salda", updatedAt: new Date().toISOString() });
    await abrirFactura(facturaActual.id);
    alert("✅ Factura marcada como Salda.");
  } catch (err) {
    console.error(err);
    alert("Error marcando factura como saldada");
  }
};

/* ====== Eliminar factura ====== */
if (btnEliminarFactura) btnEliminarFactura.addEventListener('click', async () => {
  if (!facturaActual) return alert("Seleccione una factura");
  if (facturaActual.estado !== "Salda") return alert("❌ Solo se puede eliminar una factura saldada.");
  if (!confirm("¿Desea eliminar esta factura? Se moverá a historial.")) return;

  try {
    await addDoc(collection(db, "historial"), {
      origen: "facturas",
      factura: facturaActual,
      eliminadoAt: new Date().toISOString()
    });

    await deleteDoc(doc(db, "facturas", facturaActual.id));

    alert("✅ Factura movida a historial y eliminada.");
    modalFacturaEl.classList.add('hidden');
    facturaActual = null;
  } catch (err) {
    console.error(err);
    alert("Error al eliminar factura: " + (err.message || err));
  }
});

/* ====== Modal Productos ====== */
window.abrirModalProductos = async () => {
  await renderProductsModal();
  modalProductos.classList.remove('hidden');
};
if (closeProductsModal) closeProductsModal.addEventListener('click', () => modalProductos.classList.add('hidden'));

async function renderProductsModal(filter = "") {
  listProductsModal.innerHTML = "<li>Cargando productos...</li>";
  try {
    const snaps = await getDocs(collection(db, "productos"));
    const prods = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
    const q = (filter || "").toLowerCase();
    const filtered = prods.filter(p => (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    if (filtered.length === 0) {
      listProductsModal.innerHTML = "<li>No hay productos</li>";
      return;
    }
    listProductsModal.innerHTML = "";
    filtered.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `${escapeHtml(p.code || '')} - ${escapeHtml(p.name || '')} ($${Number(p.price||0).toFixed(2)}) - Stock: ${Number(p.stock||0)}
        <button onclick="agregarProductoAFactura('${p.id}')">Agregar</button>`;
      listProductsModal.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    listProductsModal.innerHTML = "<li>Error cargando productos</li>";
  }
}
if (searchProductModal) searchProductModal.addEventListener('input', (e) => renderProductsModal(e.target.value));

/* ====== Agregar producto a factura ====== */
window.agregarProductoAFactura = async (productId) => {
  if (!facturaActual) return alert("Abra una factura primero");
  const qtyStr = prompt("Ingrese la cantidad a agregar:");
  const qty = parseInt(qtyStr);
  if (isNaN(qty) || qty <= 0) return alert("Cantidad inválida");

  const prodRef = doc(db, "productos", productId);
  const facturaRef = doc(db, "facturas", facturaActual.id);

  try {
    await runTransaction(db, async (tx) => {
      const pSnap = await tx.get(prodRef);
      if (!pSnap.exists()) throw new Error("Producto no encontrado");
      const pData = pSnap.data();
      const currentStock = Number(pData.stock || 0);
      if (currentStock < qty) throw new Error(`Stock insuficiente. Disponible: ${currentStock}`);

      tx.update(prodRef, { stock: currentStock - qty, updatedAt: new Date().toISOString() });

      const fSnap = await tx.get(facturaRef);
      if (!fSnap.exists()) throw new Error("Factura no encontrada");
      const fData = fSnap.data();
      const productos = fData.productos ? [...fData.productos] : [];

      const existingIdx = productos.findIndex(it => it.code === (pData.code || productId));
      if (existingIdx >= 0) {
        productos[existingIdx].qty = (Number(productos[existingIdx].qty || 0) + qty);
      } else {
        productos.push({
          code: pData.code || productId,
          name: pData.name || 'Producto',
          price: Number(pData.price || 0),
          qty: qty
        });
      }

      const totalPagos = (fData.pagosRealizados || []).reduce((acc, p) => acc + p.monto, 0);
      const totalMoras = (fData.moras || []).reduce((acc, m) => acc + m.monto, 0);
      const nuevoTotal = productos.reduce((acc, p) => acc + p.price * p.qty, 0) + totalMoras - totalPagos;

      tx.update(facturaRef, {
        productos,
        total: nuevoTotal,
        updatedAt: new Date().toISOString()
      });
    });

    await abrirFactura(facturaActual.id);
    modalProductos.classList.add('hidden');
  } catch (err) {
    console.error(err);
    alert("Error al agregar producto: " + (err.message || err));
  }
};

/* ====== Buscar en la lista de cuentas ====== */
if (searchInput) searchInput.addEventListener('input', (e) => {
  renderPendientesFromDocs(lastSnapshotDocs, e.target.value);
});

/* ====== Imprimir factura ====== */
window.imprimirFactura = () => {
  if (!facturaActual) return alert("Abra una factura antes de imprimir");
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [220, 600] });
    let y = 20;
    doc.setFont("courier", "normal");
    doc.setFontSize(12);
    doc.text("Cristo Felix", 110, y, { align: "center" }); y += 16;
    doc.setFontSize(10);
    doc.text("San de arroz y aceite y mas", 110, y, { align: "center" }); y += 14;
    doc.text("Pagos Semanal y Quincenal", 110, y, { align: "center" }); y += 14;
    doc.text("Tel: 829-444-1880", 110, y, { align: "center" }); y += 20;
    doc.line(10, y, 210, y); y += 14;

    doc.text(`Factura: ${facturaActual.id}`, 110, y, { align: "center" }); y += 12;
    doc.text(`Cliente: ${facturaActual.cliente?.name || ''}`, 110, y, { align: "center" }); y += 14;

    (facturaActual.productos || []).forEach(p => {
      doc.text(`${p.qty} x ${p.name} $${(p.qty * p.price).toFixed(2)}`, 110, y, { align: "center" });
      y += 12;
    });

    y += 6; doc.line(10, y, 210, y); y += 14;
    doc.setFontSize(12);
    doc.text(`TOTAL: $${Number(facturaActual.total || 0).toFixed(2)}`, 110, y, { align: "center" }); y += 18;

    if (facturaActual.pagosRealizados && facturaActual.pagosRealizados.length > 0) {
      doc.setFontSize(10);
      doc.text("PAGOS:", 110, y, { align: "center" }); y += 14;
      facturaActual.pagosRealizados.forEach((p, i) => {
        const fechaStr = p.fecha ? ` - ${new Date(p.fecha).toLocaleDateString()} ${new Date(p.fecha).toLocaleTimeString()}` : '';
        doc.text(`${i + 1}. $${Number(p.monto).toFixed(2)}${fechaStr}`, 110, y, { align: "center" });
        y += 12;
      });
      y += 10;
    }

    if (facturaActual.moras && facturaActual.moras.length > 0) {
      doc.setFontSize(10);
      doc.text("MORAS:", 110, y, { align: "center" }); y += 14;
      facturaActual.moras.forEach((m, i) => {
        const fechaStr = m.fecha ? ` - ${new Date(m.fecha).toLocaleDateString()} ${new Date(m.fecha).toLocaleTimeString()}` : '';
        doc.text(`${i + 1}. $${Number(m.monto).toFixed(2)}${fechaStr}`, 110, y, { align: "center" });
        y += 12;
      });
      y += 10;
    }

    doc.setFontSize(10);
    doc.text("Gracias por elegirnos", 110, y, { align: "center" });
    doc.autoPrint();
    doc.save(`Factura_${facturaActual.id}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Error generando PDF: " + (err.message || err));
  }
};

/* ====== Util ====== */
function escapeHtml(text) {
  const map = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/* ====== Iniciar ====== */
startListeningFacturas();
