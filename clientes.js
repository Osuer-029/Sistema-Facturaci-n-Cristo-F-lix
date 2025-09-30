// clientes.js — CRUD clientes con localStorage

const LS_KEY = 'facturacion_clients_v1';

// --- Helpers DB ---
function readDB(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch(e){ console.error('DB parse error', e); return []; }
}
function writeDB(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); }

// Genera código único: C + fecha(ms) + aleatorio
function genCode(){
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random()*900 + 100);
  return `C-${t}-${r}`;
}

function addClient(c){ const db = readDB(); db.unshift(c); writeDB(db); }
function updateClient(code, updates){
  const db = readDB();
  const i = db.findIndex(c=>c.code===code);
  if(i===-1) return;
  db[i] = {...db[i],...updates,updatedAt:new Date().toISOString()};
  writeDB(db);
}
function deleteClient(code){
  let db = readDB();
  db = db.filter(c=>c.code!==code);
  writeDB(db);
}
function getClient(code){ return readDB().find(c=>c.code===code); }

// --- UI ---
const form = document.getElementById('clientForm');
const cname = document.getElementById('cname');
const cphone = document.getElementById('cphone');
const caddress = document.getElementById('caddress');
const clocation = document.getElementById('clocation');
const listEl = document.getElementById('list');
const searchInput = document.getElementById('search');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEdit');

let editingCode = null;

function resetForm(){
  form.reset();
  editingCode=null;
  formTitle.textContent="Agregar cliente";
  cancelEditBtn.style.display="none";
}

function renderList(){
  const q = (searchInput.value||"").toLowerCase();
  let clients = readDB();
  if(q){
    clients = clients.filter(c=>c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }
  if(clients.length===0){
    listEl.innerHTML=`<p style="color:#6b7280;margin:6px 0">No hay clientes.</p>`;
    return;
  }

  listEl.innerHTML = clients.map(c=>`
    <div class="client-item" data-code="${c.code}">
      <div class="client-meta">
        <div class="client-name">${escapeHtml(c.name)} <span class="client-code">(${c.code})</span></div>
        <div>Tel: ${escapeHtml(c.phone)}</div>
        <div>Dir: ${escapeHtml(c.address||"")}</div>
      </div>
      <div class="client-actions">
        <button class="action-btn action-whatsapp" data-action="whatsapp">WhatsApp</button>
        <button class="action-btn action-map" data-action="map">Mapa</button>
        <button class="action-btn action-edit" data-action="edit">Editar</button>
        <button class="action-btn action-delete" data-action="delete">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(s=""){
  return s.replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// --- Eventos ---
form.addEventListener('submit',(e)=>{
  e.preventDefault();
  const name=cname.value.trim();
  const phone=cphone.value.trim();
  const address=caddress.value.trim();
  const location=clocation.value.trim();
  if(!name || !phone){ alert("Nombre y teléfono requeridos"); return; }

  if(editingCode){
    updateClient(editingCode,{name,phone,address,location});
  }else{
    addClient({code:genCode(),name,phone,address,location,createdAt:new Date().toISOString()});
  }
  resetForm();
  renderList();
});
cancelEditBtn.addEventListener('click',()=>resetForm());

listEl.addEventListener('click',(e)=>{
  const btn=e.target.closest('button[data-action]');
  if(!btn) return;
  const code=e.target.closest('.client-item').dataset.code;
  const c=getClient(code);
  if(!c) return;
  const act=btn.dataset.action;
  if(act==="edit"){
    editingCode=code;
    cname.value=c.name;
    cphone.value=c.phone;
    caddress.value=c.address;
    clocation.value=c.location;
    formTitle.textContent=`Editar: ${c.code}`;
    cancelEditBtn.style.display="inline-block";
    window.scrollTo({top:0,behavior:"smooth"});
  }else if(act==="delete"){
    if(confirm("¿Eliminar cliente?")){ deleteClient(code); renderList(); }
  }else if(act==="whatsapp"){
    const num=c.phone.replace(/\D/g,''); // limpiar
    window.open(`https://wa.me/${num}`,"_blank");
  }else if(act==="map"){
    if(!c.location) return alert("Cliente sin ubicación");
    window.open(c.location,"_blank");
  }
});

searchInput.addEventListener('input',()=>renderList());

// init
document.addEventListener('DOMContentLoaded',renderList);
