// clientes.js — CRUD clientes con Firebase Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyAvUePNjiKhiFePN5PY4yOqwgIHy8F_few",
  authDomain: "sistema-cristo-felix-2.firebaseapp.com",
  projectId: "sistema-cristo-felix-2",
  storageBucket: "sistema-cristo-felix-2.firebasestorage.app",
  messagingSenderId: "897774362587",
  appId: "1:897774362587:web:2221e7a21148d3cf3711fe",
  measurementId: "G-L8PPVC98S6"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Referencia a la colección ---
const colRef = collection(db, "clientes");

// --- Generador de código ---
function genCode() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random() * 900 + 100);
  return `C-${t}-${r}`;
}

// --- Elementos del DOM ---
const form = document.getElementById("clientForm");
const cname = document.getElementById("cname");
const cphone = document.getElementById("cphone");
const caddress = document.getElementById("caddress");
const clocation = document.getElementById("clocation");
const listEl = document.getElementById("list");
const searchInput = document.getElementById("search");
const formTitle = document.getElementById("formTitle");
const cancelEditBtn = document.getElementById("cancelEdit");

let editingId = null;

// --- Funciones ---
function resetForm() {
  form.reset();
  editingId = null;
  formTitle.textContent = "Agregar cliente";
  cancelEditBtn.style.display = "none";
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// --- Renderizado en tiempo real ---
function listenClients() {
  onSnapshot(colRef, snapshot => {
    let clients = [];
    snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));

    const q = (searchInput.value || "").toLowerCase();
    if (q) {
      clients = clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }

    if (clients.length === 0) {
      listEl.innerHTML = `<p style="color:#6b7280;margin:6px 0">No hay clientes.</p>`;
      return;
    }

    listEl.innerHTML = clients.map(c => `
      <div class="client-item" data-id="${c.id}">
        <div class="client-meta">
          <div class="client-name">${escapeHtml(c.name)} <span class="client-code">(${c.code})</span></div>
          <div>Tel: ${escapeHtml(c.phone)}</div>
          <div>Dir: ${escapeHtml(c.address || "")}</div>
        </div>
        <div class="client-actions">
          <button class="action-btn action-whatsapp" data-action="whatsapp">WhatsApp</button>
          <button class="action-btn action-map" data-action="map">Mapa</button>
          <button class="action-btn action-edit" data-action="edit">Editar</button>
          <button class="action-btn action-delete" data-action="delete">Eliminar</button>
        </div>
      </div>
    `).join("");
  });
}

// --- Eventos ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = cname.value.trim();
  const phone = cphone.value.trim();
  const address = caddress.value.trim();
  const location = clocation.value.trim();

  if (!name || !phone) {
    alert("Nombre y teléfono requeridos");
    return;
  }

  if (editingId) {
    const docRef = doc(db, "clientes", editingId);
    await updateDoc(docRef, { name, phone, address, location });
  } else {
    await addDoc(colRef, {
      code: genCode(),
      name,
      phone,
      address,
      location,
      createdAt: new Date().toISOString()
    });
  }

  resetForm();
});

cancelEditBtn.addEventListener("click", () => resetForm());

listEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const item = e.target.closest(".client-item");
  const id = item?.dataset.id;
  if (!id) return;
  const action = btn.dataset.action;

  // Buscar documento actual
  const snapshot = await getDocs(colRef);
  const client = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).find(c => c.id === id);
  if (!client) return alert("Cliente no encontrado");

  if (action === "edit") {
    editingId = id;
    cname.value = client.name;
    cphone.value = client.phone;
    caddress.value = client.address;
    clocation.value = client.location;
    formTitle.textContent = `Editar: ${client.code}`;
    cancelEditBtn.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (action === "delete") {
    if (confirm("¿Eliminar cliente?")) {
      await deleteDoc(doc(db, "clientes", id));
    }
  } else if (action === "whatsapp") {
    const num = client.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  } else if (action === "map") {
    if (!client.location) return alert("Cliente sin ubicación");
    window.open(client.location, "_blank");
  }
});

searchInput.addEventListener("input", () => listenClients());

// --- Inicialización ---
document.addEventListener("DOMContentLoaded", listenClients);
