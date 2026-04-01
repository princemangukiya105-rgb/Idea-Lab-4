/**
 * UECS - Application Logic
 * Simulates real-time dashboard data, map integration, and emergency reporting workflows.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Map
  initMap();

  // Initialize Dashboard Simulation
  initDashboardSimulation();

  // Initialize Reports
  initReports();

  // Initialize Modal Logic
  initModalLogic();
});

/* ================== MAP LOGIC ================== */
function initMap() {
  // Center roughly on a generic city (e.g., New York layout coordinate simulation)
  const mapCenter = [40.7128, -74.0060];
  
  const map = L.map('map', {
    center: mapCenter,
    zoom: 13,
    zoomControl: false,
    attributionControl: false
  });

  // Add CartoDB Dark Matter tiles for the modern tech aesthetic
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  // Generate mock active incident markers
  const mockIncidents = [
    { type: 'fire', lat: 40.720, lng: -74.001 },
    { type: 'police', lat: 40.730, lng: -73.990 },
    { type: 'medical', lat: 40.710, lng: -74.010 },
    { type: 'fire', lat: 40.740, lng: -73.980 },
    { type: 'police', lat: 40.705, lng: -74.015 },
    { type: 'medical', lat: 40.735, lng: -74.005 },
  ];

  mockIncidents.forEach(incident => {
    // Custom icon HTML
    const iconHtml = `<div class="custom-marker marker-${incident.type}"></div>`;
    
    const customIcon = L.divIcon({
      className: 'clear-div-icon',
      html: iconHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    L.marker([incident.lat, incident.lng], { icon: customIcon }).addTo(map);
  });
}

/* ================== DASHBOARD SIMULATION ================== */
function initDashboardSimulation() {
  const activeEl = document.getElementById('stat-active');
  const unitsEl = document.getElementById('stat-units');
  const resolvedEl = document.getElementById('stat-resolved');

  let activeCount = 142;
  let unitCount = 384;
  let resolvedCount = 1024;

  // Pulse numbers randomly every 3-7 seconds to simulate real-world activity
  setInterval(() => {
    // Active incidents fluctuate slightly up or down
    const change = Math.random() > 0.5 ? 1 : -1;
    activeCount = Math.max(100, activeCount + change);
    
    // Units adjust based on active incidents + noise
    unitCount = activeCount * 2 + Math.floor(Math.random() * 20);

    // Resolved only goes up slowly
    if (Math.random() > 0.7) {
      resolvedCount++;
    }

    // Animate DOM updates
    updateCounter(activeEl, activeCount);
    updateCounter(unitsEl, unitCount);
    updateCounter(resolvedEl, resolvedCount.toLocaleString());

  }, 4000);
}

function updateCounter(element, newValue) {
  if (element.innerText != newValue) {
    element.style.opacity = '0.5';
    setTimeout(() => {
      element.innerText = newValue;
      element.style.opacity = '1';
    }, 200);
  }
}

/* ================== REPORTS LOGIC ================== */
// Global Incident Data
let incidentReports = [
  { id: 104, type: 'Fire', status: 'Ongoing', time: '10 mins ago', location: '14th St & Broadway', units: 'Engine 4, Ladder 12', description: 'Multi-vehicle collision resulting in fire. Extrication in progress.' },
  { id: 103, type: 'Police', status: 'Pending', time: '15 mins ago', location: 'Central Park West', units: 'Sector B Patrol', description: 'Suspect pursuit spanning multiple sectors. Perimeter establishing.' },
  { id: 102, type: 'Medical', status: 'Resolved', time: '45 mins ago', location: 'Penn Station', units: 'Medic 8', description: 'Patient stabilized and transported to nearest available ICU.' },
];

function initReports() {
  renderReports();
}

function renderReports() {
  const container = document.getElementById('reports-list');
  if(!container) return;

  container.innerHTML = '';

  incidentReports.forEach(report => {
    // Generate icons and classes
    let iconName = 'error';
    let iconClass = 'fire';
    if(report.type.toLowerCase() === 'police') { iconName = 'local_police'; iconClass = 'police'; }
    else if(report.type.toLowerCase() === 'fire') { iconName = 'local_fire_department'; iconClass = 'fire'; }
    else if(report.type.toLowerCase() === 'medical') { iconName = 'medical_services'; iconClass = 'medical'; }

    let statusClass = 'status-ongoing';
    if(report.status.toLowerCase() === 'pending') statusClass = 'status-pending';
    else if(report.status.toLowerCase().includes('resolve')) statusClass = 'status-resolved';

    const card = document.createElement('div');
    card.className = 'report-card';
    card.innerHTML = `
      <div class="report-header" onclick="toggleReport(this)">
        <div class="report-info-main">
          <div class="report-icon ${iconClass}">
            <span class="material-symbols-outlined">${iconName}</span>
          </div>
          <div>
            <div class="report-title">INCIDENT #${report.id} - ${report.type}</div>
            <div class="report-time">${report.time}</div>
          </div>
        </div>
        <div class="report-status-group">
          <span class="status-badge ${statusClass}">${report.status}</span>
          <span class="material-symbols-outlined expand-icon">expand_more</span>
        </div>
      </div>
      <div class="report-details">
        <div class="details-grid">
          <div class="detail-item">
            <h4>Location</h4>
            <p><span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle;">pin_drop</span> ${report.location}</p>
          </div>
          <div class="detail-item">
            <h4>Responding Units</h4>
            <p>${report.units}</p>
          </div>
          <div class="detail-item" style="grid-column: 1 / -1;">
            <h4>Details & Dispatch Notes</h4>
            <p>${report.description}</p>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Global scope for onclick
window.toggleReport = function(headerElement) {
  const card = headerElement.closest('.report-card');
  card.classList.toggle('active');
}

/* ================== MODAL & EMERGENCY FLOW ================== */
const modal = document.getElementById('emergency-modal');
const stepGps = document.getElementById('step-gps');
const stepType = document.getElementById('step-type');
const stepSuccess = document.getElementById('step-success');

function initModalLogic() {
  // Attach triggers
  const triggers = document.querySelectorAll('.emergency-trigger');
  triggers.forEach(btn => {
    btn.addEventListener('click', openEmergencyModal);
  });

  // Attach close events
  document.getElementById('close-modal-btn').addEventListener('click', closeModal);
}

function openEmergencyModal() {
  // Reset state
  stepGps.classList.remove('hidden');
  stepType.classList.add('hidden');
  stepSuccess.classList.add('hidden');
  document.getElementById('loc-text').innerText = "Establishing secure GPS link...";
  
  modal.classList.remove('hidden');

  // Simulate GPS locating (1.5 seconds)
  setTimeout(() => {
    document.getElementById('loc-text').innerText = "Location pinned safely.";
    setTimeout(() => {
      stepGps.classList.add('hidden');
      stepType.classList.remove('hidden');
    }, 800);
  }, 1500);
}

function submitEmergency(type) {
  // Update Success UI
  document.getElementById('dispatched-type').innerText = `${type} / Rescue`;
  document.getElementById('random-eta').innerText = Math.floor(Math.random() * 4) + 2; // Random 2-5 mins

  // Show Success Step
  stepType.classList.add('hidden');
  stepSuccess.classList.remove('hidden');

  // Add new report to list
  const newId = incidentReports.length > 0 ? incidentReports[0].id + 1 : 101;
  const newReport = {
    id: newId,
    type: type,
    status: 'Pending',
    time: 'Just Now',
    location: 'User GPS Coordinates (Pinned)',
    units: 'Assigning nearest responders...',
    description: `Emergency reported externally via Fast Action System. Type: ${type}. Awaiting first responder updates.`
  };
  incidentReports.unshift(newReport);
  
  // Re-render the reports list to show the new one
  renderReports();

  // In a real app, make API POST request here
  console.log(`[UECS Core] Emergency Type: ${type} dispatched to active coordinates.`);
}

function closeModal() {
  modal.classList.add('hidden');
}
