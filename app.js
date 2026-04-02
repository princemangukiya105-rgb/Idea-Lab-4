/**
 * UECS – Public Portal Logic v2.1
 * - Emergency Helplines grid with filter
 * - Submit emergency → save to sessionStorage → live status tracker
 * - Only YOUR report is shown in the tracker widget
 */

const API_BASE = '';
const MY_REPORT_KEY = 'uecs_my_report_id';

let myReportPollTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initDashboardSimulation();
  loadHelplines();
  initHelplinesFilter();
  initModalLogic();
  initMyReportTracker();   // restore tracker if user refreshes page
});

/* ══════════════════════ MAP ══════════════════════ */
function initMap() {
  const map = L.map('map', {
    center: [22.9734, 78.6569],
    zoom: 4,
    zoomControl: false,
    attributionControl: false
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

  fetch(`${API_BASE}/api/incidents`)
    .then(r => r.json())
    .then(incidents => {
      incidents.forEach(inc => {
        if (!inc.lat || !inc.lng) return;
        const typeKey  = inc.type.toLowerCase();
        const iconHtml = `<div class="custom-marker marker-${typeKey}"></div>`;
        const icon     = L.divIcon({ className: 'clear-div-icon', html: iconHtml, iconSize: [20,20], iconAnchor: [10,10] });
        L.marker([inc.lat, inc.lng], { icon })
          .bindPopup(`<strong>#${inc.id} – ${inc.type}</strong><br/>${inc.location}<br/><em>Status: ${inc.status}</em>`)
          .addTo(map);
      });
    })
    .catch(() => {});
}

/* ══════════════════════ DASHBOARD STATS ══════════════════════ */
function initDashboardSimulation() {
  let active = 142, units = 384, resolved = 1024;
  const aEl = document.getElementById('stat-active');
  const uEl = document.getElementById('stat-units');
  const rEl = document.getElementById('stat-resolved');
  setInterval(() => {
    active   = Math.max(100, active + (Math.random() > .5 ? 1 : -1));
    units    = active * 2 + Math.floor(Math.random() * 20);
    if (Math.random() > .7) resolved++;
    updateCounter(aEl, active);
    updateCounter(uEl, units);
    updateCounter(rEl, resolved.toLocaleString('en-IN'));
  }, 4000);
}
function updateCounter(el, val) {
  if (!el || el.innerText == val) return;
  el.style.opacity = '0.4';
  setTimeout(() => { el.innerText = val; el.style.opacity = '1'; }, 200);
}

/* ══════════════════════ HELPLINES ══════════════════════ */
let allHelplines = [];

async function loadHelplines() {
  try {
    const res = await fetch(`${API_BASE}/api/helplines`);
    allHelplines = await res.json();
    renderHelplines(allHelplines);
  } catch {
    document.getElementById('helplines-grid').innerHTML =
      `<p style="color:#64748b;text-align:center;padding:2rem;grid-column:1/-1">
        Could not load helplines — ensure the UECS server is running.
      </p>`;
  }
}

function renderHelplines(list) {
  const grid = document.getElementById('helplines-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!list || list.length === 0) {
    grid.innerHTML = `<p style="color:#64748b;grid-column:1/-1;text-align:center;padding:2rem">No helplines found for this category.</p>`;
    return;
  }
  list.forEach(h => {
    const col  = h.color || 'blue';
    const icon = h.icon  || 'call';
    const card = document.createElement('div');
    card.className = `helpline-card color-${col}`;
    card.innerHTML = `
      <div class="helpline-icon-wrap color-${col}">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div class="helpline-body">
        <div class="helpline-cat">${h.category}</div>
        <div class="helpline-name">${h.name}</div>
        <div class="helpline-number color-${col}">${h.number}</div>
        <div class="helpline-desc">${h.description || ''}</div>
        <a class="helpline-call-btn" href="tel:${h.number.replace(/[^0-9]/g, '')}">
          <span class="material-symbols-outlined" style="font-size:.9rem">call</span>
          Dial Now
        </a>
      </div>`;
    grid.appendChild(card);
  });
}

function initHelplinesFilter() {
  document.querySelectorAll('.hf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      const filtered = cat === 'All' ? allHelplines : allHelplines.filter(h => h.category === cat);
      renderHelplines(filtered);
    });
  });
}

/* ══════════════════════ EMERGENCY MODAL ══════════════════════ */
const modal       = document.getElementById('emergency-modal');
const stepGps     = document.getElementById('step-gps');
const stepType    = document.getElementById('step-type');
const stepSuccess = document.getElementById('step-success');

function initModalLogic() {
  document.querySelectorAll('.emergency-trigger').forEach(btn =>
    btn.addEventListener('click', openEmergencyModal)
  );
  // Both close paths (X button and green button) trigger the tracker
  document.getElementById('close-modal-btn').addEventListener('click', () => {
    closeModal();
  });
}

let currentEmergencyLocation = 'Evaluating location...';
let currentEmergencyCoords = { lat: 19.0760, lng: 72.8777 }; // Default Mumbai center

async function openEmergencyModal() {
  stepGps.classList.remove('hidden');
  stepType.classList.add('hidden');
  stepSuccess.classList.add('hidden');
  document.getElementById('loc-text').innerText = 'Establishing secure GPS link…';
  modal.classList.remove('hidden');

  const finalizeLocation = (lat, lng, label) => {
    currentEmergencyCoords = { lat, lng };
    currentEmergencyLocation = label;
    document.getElementById('loc-text').innerText = label;
    setTimeout(() => {
      stepGps.classList.add('hidden');
      stepType.classList.remove('hidden');
    }, 1000);
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      if (res.ok) {
        const data = await res.json();
        return data.display_name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
      }
    } catch(e) {}
    return `GPS Pinned (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const label = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        finalizeLocation(position.coords.latitude, position.coords.longitude, label);
      },
      async (error) => {
        // Fallback to randomized Mumbai coordinates
        const flat = 19.0760 + (Math.random() * .1 - .05);
        const flng = 72.8777 + (Math.random() * .1 - .05);
        const label = await reverseGeocode(flat, flng);
        finalizeLocation(flat, flng, label);
      },
      { timeout: 6000 }
    );
  } else {
    const flat = 19.0760 + (Math.random() * .1 - .05);
    const flng = 72.8777 + (Math.random() * .1 - .05);
    const label = await reverseGeocode(flat, flng);
    finalizeLocation(flat, flng, label);
  }
}

window.submitEmergency = async function(type) {
  const eta = Math.floor(Math.random() * 16) + 15;   // 15–30 min
  document.getElementById('dispatched-type').innerText = `${type} / Rescue`;
  document.getElementById('random-eta').innerText = eta;

  stepType.classList.add('hidden');
  stepSuccess.classList.remove('hidden');

  // ── Save IMMEDIATELY (before API) so tracker shows even if fetch is slow ──
  const preliminary = {
    id:       null,   // filled in after API responds
    type,
    eta,
    time:     new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    status:   'Pending',
    location: currentEmergencyLocation
  };
  sessionStorage.setItem(MY_REPORT_KEY, JSON.stringify(preliminary));

  try {
    const res = await fetch(`${API_BASE}/api/incidents`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        location:    currentEmergencyLocation,
        description: `Emergency reported via UECS Fast Report. Type: ${type}.`,
        severity:    'High',
        lat: currentEmergencyCoords.lat,
        lng: currentEmergencyCoords.lng
      })
    });

    if (res.ok) {
      const newReport = await res.json();
      // Update sessionStorage with the real ID from server
      sessionStorage.setItem(MY_REPORT_KEY, JSON.stringify({
        id:     newReport.id,
        type:   newReport.type,
        eta:    newReport.eta,
        time:   newReport.time,
        status: newReport.status,
        location: newReport.location || currentEmergencyLocation
      }));
    }
  } catch {}

  // Pre-activate tracker after 1.2s so it shows regardless of how modal is closed
  setTimeout(() => {
    const s = sessionStorage.getItem(MY_REPORT_KEY);
    if (s) { try { showMyReportTracker(JSON.parse(s)); } catch {} }
  }, 1200);
};

window.closeModal = function() {
  modal.classList.add('hidden');
  // Also show tracker immediately on close if data exists
  const saved = sessionStorage.getItem(MY_REPORT_KEY);
  if (saved) { try { showMyReportTracker(JSON.parse(saved)); } catch {} }
};

/* ══════════════════════ MY REPORT TRACKER ══════════════════════ */
const tracker       = document.getElementById('my-report-tracker');
const mrtId         = document.getElementById('mrt-id');
const mrtType       = document.getElementById('mrt-type');
const mrtStatus     = document.getElementById('mrt-status');
const mrtEta        = document.getElementById('mrt-eta');
const mrtLocation   = document.getElementById('mrt-location');
const mrtLastUpd    = document.getElementById('mrt-last-updated');

function initMyReportTracker() {
  // Tracker is now inline and persistent.


  // Restore across page refreshes
  const saved = sessionStorage.getItem(MY_REPORT_KEY);
  if (saved) {
    try { showMyReportTracker(JSON.parse(saved)); } catch {}
  }
}

function showMyReportTracker(rep) {
  // Populate values
  mrtId.textContent       = rep.id ? `Report #${rep.id}` : 'Submitting…';
  mrtType.textContent     = rep.type + ' / Rescue';
  mrtEta.textContent      = rep.eta ? `${rep.eta} min` : '…';
  mrtLocation.textContent = rep.location || currentEmergencyLocation || 'GPS Pinned';

  const statusEl = document.getElementById('mrt-status');
  statusEl.textContent = rep.status || 'Pending';
  statusEl.className   = `mrt-status-pill mrt-status-${(rep.status || 'pending').toLowerCase()}`;

  // Add 'open' class on next frame so CSS transition fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      tracker.classList.add('open');
    });
  });

  // Poll every 12 seconds for live status of THIS report only
  if (rep.id) {
    clearInterval(myReportPollTimer);
    pollMyReport(rep.id);
    myReportPollTimer = setInterval(() => pollMyReport(rep.id), 12000);
  } else {
    // Retry polling once ID arrives in sessionStorage
    const waitForId = setInterval(() => {
      const s = sessionStorage.getItem(MY_REPORT_KEY);
      if (s) {
        const r = JSON.parse(s);
        if (r.id) {
          clearInterval(waitForId);
          mrtId.textContent = `Report #${r.id}`;
          pollMyReport(r.id);
          myReportPollTimer = setInterval(() => pollMyReport(r.id), 12000);
        }
      }
    }, 1500);
  }
}

async function pollMyReport(id) {
  try {
    const res = await fetch(`${API_BASE}/api/incidents`);
    const all = await res.json();
    const myReport = all.find(r => r.id === id);

    if (!myReport) {
      mrtLastUpd.textContent = 'Report resolved & archived.';
      clearInterval(myReportPollTimer);
      return;
    }

    // Update status pill
    const statusEl = document.getElementById('mrt-status');
    statusEl.textContent  = myReport.status;
    statusEl.className    = `mrt-status-pill mrt-status-${myReport.status.toLowerCase()}`;

    // Update ETA
    const etaDone = myReport.eta === 0 || myReport.status === 'Resolved';
    mrtEta.textContent    = etaDone ? '✓ Arrived' : `${myReport.eta} min`;
    mrtEta.style.color    = etaDone ? '#10b981' : '';

    // Calm strip color
    const calmStrip = document.querySelector('.mrt-calm-strip');
    if (myReport.status === 'Resolved') {
      calmStrip.style.background = 'rgba(16,185,129,.15)';
      calmStrip.style.color      = '#10b981';
      calmStrip.innerHTML        = '<span class="material-symbols-outlined" style="font-size:.9rem">check_circle</span> Situation Resolved — Stay Safe';
    }

    // Last updated timestamp
    const now = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    mrtLastUpd.textContent = `Updated at ${now}`;

  } catch {
    mrtLastUpd.textContent = 'Reconnecting…';
  }
}
