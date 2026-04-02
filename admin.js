/**
 * UECS – Admin Portal Logic v2.0
 * Handles: Auth, Tab switching, Incidents CRUD, Helplines CRUD, Drawer, Filters, Toast
 */

const API = '';

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let allIncidents    = [];
let allHelplines    = [];
let editingId       = null;
let editingMode     = 'incident'; // 'incident' | 'helpline'
let pendingDeleteId = null;
let pendingDeleteMode = 'incident';
let activeTab       = 'incidents';

/* ══════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Always log out on page load so it requires a password every time.
  await fetch(`${API}/api/admin/logout`, { method: 'POST' }).catch(() => {});
  
  // Do NOT show app by default


  bindLoginEvents();
  bindNavEvents();
  bindTabEvents();
  bindDrawerEvents();
  bindDeleteEvents();
  bindFilterEvents();
});

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
function bindLoginEvents() {
  const loginBtn = document.getElementById('login-btn');
  const pwdInput = document.getElementById('pwd-input');
  const errorEl  = document.getElementById('login-error');

  async function attemptLogin() {
    const password = pwdInput.value.trim();
    if (!password) return;
    errorEl.textContent = '';
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">progress_activity</span> Authenticating…';

    try {
      const res  = await fetch(`${API}/api/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        showApp();
      } else {
        errorEl.textContent = data.message || 'Authentication failed.';
        loginBtn.disabled  = false;
        loginBtn.innerHTML = '<span class="material-symbols-outlined">verified_user</span> Authenticate &amp; Enter';
        pwdInput.value = ''; pwdInput.focus();
      }
    } catch {
      errorEl.textContent = 'Server unreachable. Ensure UECS server is running.';
      loginBtn.disabled  = false;
      loginBtn.innerHTML = '<span class="material-symbols-outlined">verified_user</span> Authenticate &amp; Enter';
    }
  }

  loginBtn.addEventListener('click', attemptLogin);
  pwdInput.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  loadIncidents();
  loadHelplines();
}

/* ══════════════════════════════════════════════
   NAV
══════════════════════════════════════════════ */
function bindNavEvents() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch(`${API}/api/admin/logout`, { method: 'POST' });
    location.reload();
  });
  document.getElementById('add-incident-btn').addEventListener('click', () => openDrawer(null, 'incident'));
}

/* ══════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════ */
function bindTabEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const incContent  = document.getElementById('incidents-tab-content');
      const hlContent   = document.getElementById('helplines-tab-content');
      const addBtn      = document.getElementById('add-incident-btn');
      const addHlBtn    = document.getElementById('add-helpline-btn');
      const sumBar      = document.getElementById('summary-bar');
      const filterBar   = document.querySelector('.filter-bar');
      const pageTitle   = document.getElementById('page-title');
      const pageSubtitle= document.getElementById('page-subtitle');

      if (activeTab === 'incidents') {
        incContent.style.display  = '';
        hlContent.style.display   = 'none';
        addBtn.style.display      = '';
        if (addHlBtn) addHlBtn.style.display = 'none';
        if (sumBar) sumBar.style.display    = '';
        if (filterBar) filterBar.style.display = '';
        pageTitle.textContent    = 'Incident Management';
        pageSubtitle.textContent = 'Create, edit and delete active incidents. Changes reflect on the public portal in real-time.';
      } else {
        incContent.style.display  = 'none';
        hlContent.style.display   = '';
        addBtn.style.display      = 'none';
        if (sumBar) sumBar.style.display    = 'none';
        if (filterBar) filterBar.style.display = 'none';
        pageTitle.textContent    = 'Emergency Helplines';
        pageSubtitle.textContent = 'Manage the emergency contact numbers shown on the public user portal.';
      }
    });
  });

  // Add Helpline button (inside helplines tab)
  setTimeout(() => {
    const addHlBtn = document.getElementById('add-helpline-btn');
    if (addHlBtn) addHlBtn.addEventListener('click', () => openDrawer(null, 'helpline'));
  }, 200);
}

/* ══════════════════════════════════════════════
   LOAD & RENDER – INCIDENTS
══════════════════════════════════════════════ */
async function loadIncidents() {
  try {
    const res = await fetch(`${API}/api/incidents`);
    allIncidents = await res.json();
    renderIncidentTable(allIncidents);
    updateSummary(allIncidents);
  } catch {
    showToast('Failed to load incidents.', 'error');
  }
}

function renderIncidentTable(incidents) {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  if (!incidents.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No incidents match your filters.</td></tr>';
    return;
  }

  incidents.forEach(inc => {
    const typeIcon = inc.type === 'Fire' ? 'local_fire_department'
      : inc.type === 'Police' ? 'local_police' : 'medical_services';
    const typeClass   = `type-${inc.type.toLowerCase()}`;
    const statusClass = 's-' + inc.status.toLowerCase().replace(' ', '-');
    const sevClass    = 'sev-' + (inc.severity || 'moderate').toLowerCase();
    const etaDone     = inc.eta === 0 || inc.status === 'Resolved';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${inc.id}</strong></td>
      <td><span class="type-badge ${typeClass}"><span class="material-symbols-outlined" style="font-size:.9rem">${typeIcon}</span>${inc.type}</span></td>
      <td><span class="status-badge ${statusClass}">${inc.status}</span></td>
      <td><span class="severity-dot ${sevClass}"></span>${inc.severity || '–'}</td>
      <td class="location-cell" title="${inc.location}">${trunc(inc.location, 40)}</td>
      <td style="font-size:.82rem;color:#c0c0d0">${trunc(inc.units, 28)}</td>
      <td class="eta-cell ${etaDone ? 'resolved' : ''}">${etaDone ? '✓ Done' : inc.eta + ' min'}</td>
      <td style="font-size:.82rem;color:var(--muted)">${inc.time}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit"   onclick="openDrawer(${inc.id},'incident')"><span class="material-symbols-outlined" style="font-size:.9rem">edit</span>Edit</button>
          <button class="btn-delete" onclick="confirmDelete(${inc.id},'incident')"><span class="material-symbols-outlined" style="font-size:.9rem">delete</span></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function updateSummary(incidents) {
  document.getElementById('cnt-total').textContent    = incidents.length;
  document.getElementById('cnt-ongoing').textContent  = incidents.filter(i => i.status === 'Ongoing').length;
  document.getElementById('cnt-pending').textContent  = incidents.filter(i => i.status === 'Pending').length;
  document.getElementById('cnt-resolved').textContent = incidents.filter(i => i.status === 'Resolved').length;
}

/* ══════════════════════════════════════════════
   LOAD & RENDER – HELPLINES
══════════════════════════════════════════════ */
async function loadHelplines() {
  try {
    const res = await fetch(`${API}/api/helplines`);
    allHelplines = await res.json();
    renderHelplinesTable(allHelplines);
  } catch {
    showToast('Failed to load helplines.', 'error');
  }
}

function renderHelplinesTable(helplines) {
  const tbody = document.getElementById('helplines-body');
  tbody.innerHTML = '';
  if (!helplines.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No helplines found.</td></tr>';
    return;
  }

  helplines.forEach(h => {
    const activeLabel = h.active !== false
      ? '<span class="status-badge s-resolved" style="font-size:.7rem">Visible</span>'
      : '<span class="status-badge s-pending"  style="font-size:.7rem">Hidden</span>';

    const colorDot = { red:'var(--red)', blue:'var(--blue)', green:'var(--green)',
                       yellow:'var(--yellow)', orange:'#f97316' };
    const dotColor = colorDot[h.color] || 'var(--blue)';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${h.id}</strong></td>
      <td><span class="material-symbols-outlined" style="font-size:1.2rem;color:${dotColor}">${h.icon || 'call'}</span></td>
      <td style="font-weight:600">${h.name}</td>
      <td style="font-family:var(--font-h);font-size:1rem;font-weight:700;color:${dotColor}">${h.number}</td>
      <td>${h.category}</td>
      <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${dotColor};margin-right:.4rem;vertical-align:middle"></span>${h.color}</td>
      <td>${activeLabel}</td>
      <td style="font-size:.82rem;color:#c0c0d0;max-width:200px">${trunc(h.description, 50)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit"   onclick="openDrawer(${h.id},'helpline')"><span class="material-symbols-outlined" style="font-size:.9rem">edit</span>Edit</button>
          <button class="btn-delete" onclick="confirmDelete(${h.id},'helpline')"><span class="material-symbols-outlined" style="font-size:.9rem">delete</span></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ══════════════════════════════════════════════
   FILTERS – INCIDENTS
══════════════════════════════════════════════ */
function bindFilterEvents() {
  const searchInput  = document.getElementById('search-input');
  const filterType   = document.getElementById('filter-type');
  const filterStatus = document.getElementById('filter-status');

  function applyFilters() {
    const q = searchInput.value.toLowerCase();
    const t = filterType.value;
    const s = filterStatus.value;
    const filtered = allIncidents.filter(inc => {
      const matchQ = !q || [inc.location, inc.units, inc.description, inc.id.toString()]
        .some(f => f && f.toLowerCase().includes(q));
      return matchQ && (!t || inc.type === t) && (!s || inc.status === s);
    });
    renderIncidentTable(filtered);
    updateSummary(filtered);
  }

  searchInput.addEventListener('input',  applyFilters);
  filterType.addEventListener('change',  applyFilters);
  filterStatus.addEventListener('change', applyFilters);
}

/* ══════════════════════════════════════════════
   DRAWER – OPEN / CLOSE / SWITCH MODE
══════════════════════════════════════════════ */
function bindDrawerEvents() {
  document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
  document.getElementById('cancel-btn').addEventListener('click', closeDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
  document.getElementById('save-btn').addEventListener('click', saveItem);

  // ETA slider
  const slider     = document.getElementById('f-eta');
  const etaDisplay = document.getElementById('eta-display');
  slider.addEventListener('input', () => {
    const val = parseInt(slider.value);
    etaDisplay.textContent = val === 0 ? 'Resolved' : val + ' min';
    slider.style.setProperty('--eta-pct', ((val / 30) * 100) + '%');
  });
}

window.openDrawer = function(id, mode = 'incident') {
  editingId  = id;
  editingMode = mode;

  const incForm  = document.getElementById('incident-form');
  const hlForm   = document.getElementById('helpline-form');
  const saveBtn  = document.getElementById('save-btn');
  const drawerTitle    = document.getElementById('drawer-title');
  const drawerSubtitle = document.getElementById('drawer-subtitle');

  if (mode === 'helpline') {
    incForm.style.display = 'none';
    hlForm.style.display  = '';
    saveBtn.style.background = 'var(--green)';
    saveBtn.style.boxShadow  = '0 4px 15px rgba(16,185,129,.4)';

    if (id === null) {
      drawerTitle.textContent    = 'Add New Helpline';
      drawerSubtitle.textContent = 'Fill in details to add an emergency number to the public portal.';
      setHelplineValues({ id:'', name:'', number:'', category:'Medical', icon:'call', color:'green', description:'', active:true });
    } else {
      const h = allHelplines.find(x => x.id === id);
      if (!h) return;
      drawerTitle.textContent    = `Edit Helpline #${h.id}`;
      drawerSubtitle.textContent = 'Edit any field. Changes reflect on public portal instantly.';
      setHelplineValues(h);
    }
  } else {
    incForm.style.display = '';
    hlForm.style.display  = 'none';
    saveBtn.style.background = '';
    saveBtn.style.boxShadow  = '';

    if (id === null) {
      drawerTitle.textContent    = 'Add New Incident';
      drawerSubtitle.textContent = 'Fill in the details to add a new incident to the system.';
      setIncidentValues({ id:'', type:'Fire', status:'Pending', severity:'High', time:'Just Now', location:'', units:'', description:'', eta:20 });
    } else {
      const inc = allIncidents.find(x => x.id === id);
      if (!inc) return;
      drawerTitle.textContent    = `Edit Incident #${inc.id}`;
      drawerSubtitle.textContent = 'All fields are editable. Changes save immediately.';
      setIncidentValues(inc);
    }
  }

  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
};

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  editingId = null;
}

/* ── Set form values ── */
function setIncidentValues(inc) {
  document.getElementById('f-id').value          = inc.id || '';
  document.getElementById('f-type').value        = inc.type || 'Fire';
  document.getElementById('f-status').value      = inc.status || 'Pending';
  document.getElementById('f-severity').value    = inc.severity || 'High';
  document.getElementById('f-time').value        = inc.time || '';
  document.getElementById('f-location').value    = inc.location || '';
  document.getElementById('f-units').value       = inc.units || '';
  document.getElementById('f-description').value = inc.description || '';
  const eta = Math.min(30, Math.max(0, parseInt(inc.eta) || 20));
  const slider = document.getElementById('f-eta');
  slider.value = eta;
  document.getElementById('eta-display').textContent = eta === 0 ? 'Resolved' : eta + ' min';
  slider.style.setProperty('--eta-pct', ((eta / 30) * 100) + '%');
}

function setHelplineValues(h) {
  document.getElementById('hf-id').value          = h.id || '';
  document.getElementById('hf-name').value        = h.name || '';
  document.getElementById('hf-number').value      = h.number || '';
  document.getElementById('hf-category').value    = h.category || 'Medical';
  document.getElementById('hf-color').value       = h.color || 'green';
  document.getElementById('hf-icon').value        = h.icon || 'call';
  document.getElementById('hf-description').value = h.description || '';
  document.getElementById('hf-active').value      = String(h.active !== false);
}

/* ══════════════════════════════════════════════
   SAVE (handles both modes)
══════════════════════════════════════════════ */
async function saveItem() {
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="material-symbols-outlined">progress_activity</span> Saving…';

  try {
    if (editingMode === 'helpline') {
      await saveHelpline();
    } else {
      await saveIncident();
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Changes';
  }
}

async function saveIncident() {
  const payload = {
    type:        document.getElementById('f-type').value,
    status:      document.getElementById('f-status').value,
    severity:    document.getElementById('f-severity').value,
    time:        document.getElementById('f-time').value,
    location:    document.getElementById('f-location').value.trim(),
    units:       document.getElementById('f-units').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    eta:         parseInt(document.getElementById('f-eta').value) || 0
  };
  if (!payload.location) { showToast('Location is required.', 'error'); return; }

  const res = editingId === null
    ? await fetch(`${API}/api/incidents`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
    : await fetch(`${API}/api/incidents/${editingId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });

  if (res.ok) {
    closeDrawer();
    await loadIncidents();
    showToast(editingId === null ? 'Incident created.' : 'Incident updated.', 'success');
  } else {
    const err = await res.json();
    showToast(err.error || 'Failed to save.', 'error');
  }
}

async function saveHelpline() {
  const payload = {
    name:        document.getElementById('hf-name').value.trim(),
    number:      document.getElementById('hf-number').value.trim(),
    category:    document.getElementById('hf-category').value,
    color:       document.getElementById('hf-color').value,
    icon:        document.getElementById('hf-icon').value.trim() || 'call',
    description: document.getElementById('hf-description').value.trim(),
    active:      document.getElementById('hf-active').value === 'true'
  };
  if (!payload.name || !payload.number) { showToast('Name and Number are required.', 'error'); return; }

  const res = editingId === null
    ? await fetch(`${API}/api/helplines`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
    : await fetch(`${API}/api/helplines/${editingId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });

  if (res.ok) {
    closeDrawer();
    await loadHelplines();
    showToast(editingId === null ? 'Helpline created.' : 'Helpline updated.', 'success');
  } else {
    const err = await res.json();
    showToast(err.error || 'Failed to save helpline.', 'error');
  }
}

/* ══════════════════════════════════════════════
   DELETE CONFIRM
══════════════════════════════════════════════ */
function bindDeleteEvents() {
  document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.remove('open');
    pendingDeleteId = null;
  });

  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (pendingDeleteId === null) return;
    const id   = pendingDeleteId;
    const mode = pendingDeleteMode;
    pendingDeleteId = null;
    document.getElementById('confirm-overlay').classList.remove('open');

    const url = mode === 'helpline' ? `/api/helplines/${id}` : `/api/incidents/${id}`;
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        mode === 'helpline' ? await loadHelplines() : await loadIncidents();
        showToast(`#${id} deleted successfully.`, 'success');
      } else {
        showToast('Failed to delete.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  });
}

window.confirmDelete = function(id, mode = 'incident') {
  pendingDeleteId   = id;
  pendingDeleteMode = mode;
  document.getElementById('confirm-overlay').classList.add('open');
};

/* ══════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, type = 'success') {
  const toast  = document.getElementById('toast');
  const msgEl  = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');
  toast.className = `toast toast-${type}`;
  msgEl.textContent  = msg;
  iconEl.textContent = type === 'success' ? 'check_circle' : 'error';
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ══════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════ */
function trunc(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : (str || '–');
}
