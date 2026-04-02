/**
 * UECS – Unified Emergency Coordination System
 * Backend Server: Express.js REST API v2.0
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ── Paths ─────────────────────────────────────────────────────────────────────
const DATA_FILE      = path.join(__dirname, 'incidents.json');
const HELPLINES_FILE = path.join(__dirname, 'helplines.json');

// ── Admin Config ──────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'uecs@2026';
const SESSION_TOKEN  = 'uecs_admin_session_9f3a2b';
const SESSION_COOKIE = 'uecs_session';

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
const readIncidents  = () => readJSON(DATA_FILE);
const writeIncidents = d  => writeJSON(DATA_FILE, d);
const readHelplines  = () => readJSON(HELPLINES_FILE);
const writeHelplines = d  => writeJSON(HELPLINES_FILE, d);

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.cookies[SESSION_COOKIE] === SESSION_TOKEN) return next();
  return res.status(401).json({ error: 'Unauthorized. Please login as admin.' });
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.cookie(SESSION_COOKIE, SESSION_TOKEN, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 })
       .json({ success: true, message: 'Admin authenticated successfully.' });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password. Access denied.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE).json({ success: true });
});

app.get('/api/admin/status', (req, res) => {
  res.json({ loggedIn: req.cookies[SESSION_COOKIE] === SESSION_TOKEN });
});

// ══════════════════════════════════════════════════════════════════════════════
//  INCIDENTS ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/incidents', (req, res) => {
  const incidents = readIncidents();
  incidents.sort((a, b) => b.id - a.id);
  res.json(incidents);
});

app.post('/api/incidents', (req, res) => {
  const incidents = readIncidents();
  const maxId = incidents.reduce((m, i) => Math.max(m, i.id), 1000);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const newIncident = {
    id: maxId + 1,
    type:        req.body.type     || 'Unknown',
    status:      'Pending',
    time:        `Just Now (${timeStr})`,
    location:    req.body.location || 'GPS Coordinates Pinned',
    units:       'Dispatching nearest available units...',
    description: req.body.description || `Emergency reported via UECS Fast Report. Type: ${req.body.type}.`,
    eta:         Math.floor(Math.random() * 16) + 15,
    severity:    req.body.severity || 'High',
    lat:         req.body.lat      || 19.0760,
    lng:         req.body.lng      || 72.8777
  };
  incidents.push(newIncident);
  writeIncidents(incidents);
  res.status(201).json(newIncident);
});

app.put('/api/incidents/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  let incidents = readIncidents();
  const idx = incidents.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Incident not found.' });
  incidents[idx] = { ...incidents[idx], ...req.body, id };
  writeIncidents(incidents);
  res.json(incidents[idx]);
});

app.delete('/api/incidents/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  let incidents = readIncidents();
  const idx = incidents.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Incident not found.' });
  const removed = incidents.splice(idx, 1)[0];
  writeIncidents(incidents);
  res.json({ success: true, removed });
});

// ══════════════════════════════════════════════════════════════════════════════
//  HELPLINES ROUTES  (public read, admin write)
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/helplines – public, returns only active helplines sorted by id */
app.get('/api/helplines', (req, res) => {
  const all = readHelplines();
  // Admin fetches all; public gets only active
  const isAdmin = req.cookies[SESSION_COOKIE] === SESSION_TOKEN;
  const result = isAdmin ? all : all.filter(h => h.active !== false);
  result.sort((a, b) => a.id - b.id);
  res.json(result);
});

/** POST /api/helplines – create (admin) */
app.post('/api/helplines', requireAdmin, (req, res) => {
  const helplines = readHelplines();
  const maxId = helplines.reduce((m, h) => Math.max(m, h.id), 0);
  const newH = {
    id:          maxId + 1,
    name:        req.body.name        || 'New Helpline',
    number:      req.body.number      || '000',
    category:    req.body.category    || 'General',
    icon:        req.body.icon        || 'call',
    description: req.body.description || '',
    color:       req.body.color       || 'blue',
    active:      req.body.active !== undefined ? req.body.active : true
  };
  helplines.push(newH);
  writeHelplines(helplines);
  res.status(201).json(newH);
});

/** PUT /api/helplines/:id – update (admin) */
app.put('/api/helplines/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  let helplines = readHelplines();
  const idx = helplines.findIndex(h => h.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Helpline not found.' });
  helplines[idx] = { ...helplines[idx], ...req.body, id };
  writeHelplines(helplines);
  res.json(helplines[idx]);
});

/** DELETE /api/helplines/:id – delete (admin) */
app.delete('/api/helplines/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  let helplines = readHelplines();
  const idx = helplines.findIndex(h => h.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Helpline not found.' });
  const removed = helplines.splice(idx, 1)[0];
  writeHelplines(helplines);
  res.json({ success: true, removed });
});

// ══════════════════════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║  UECS – Unified Emergency Coordination System    ║');
  console.log('  ║  Server running at http://localhost:' + PORT + '          ║');
  console.log('  ║                                                  ║');
  console.log('  ║  Public Portal : http://localhost:' + PORT + '           ║');
  console.log('  ║  Admin Portal  : http://localhost:' + PORT + '/admin.html ║');
  console.log('  ║  Admin Password: uecs@2026                       ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});
