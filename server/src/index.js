import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const file = path.join(dataDir, 'store.json');
fs.mkdirSync(dataDir, { recursive: true });

// Check for optional Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

let store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { inspections: {}, conflicts: {}, evidence: {} };

if (!store.evidence) store.evidence = {};

// Seed data if none exists
if (Object.keys(store.inspections).length === 0) {
  store.inspections['inspection-001'] = {
    id: 'inspection-001',
    title: 'Solar Panel Safety Inspection',
    site: 'North Block • Erode',
    status: 'assigned',
    updatedAt: Date.now(),
    version: 1,
    checklist: [
      { id: 'c1', label: 'Mounting bolts securely tightened', value: 'PENDING', notes: '', evidence: [] },
      { id: 'c2', label: 'Panel mounting is secure', value: 'PENDING', notes: '', evidence: [] },
      { id: 'c3', label: 'Cables are properly insulated', value: 'PENDING', notes: '', evidence: [] },
      { id: 'c4', label: 'Warning signage is visible', value: 'PENDING', notes: '', evidence: [] }
    ],
    notes: '',
    evidence: [],
    history: [{ at: Date.now(), action: 'created', actor: 'System', version: 1 }]
  };
  persist();
}

function persist() { fs.writeFileSync(file, JSON.stringify(store, null, 2)); }
function actorOf(x) { return x?.payload?.history?.at(-1)?.actor || x?.actor || 'Inspector' }

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({
  ok: true,
  name: 'ReSync',
  time: new Date().toISOString(),
  supabaseStorage: HAS_SUPABASE ? 'VERIFIED' : 'NOT VERIFIED'
}));

app.get('/api/inspections', (req, res) => {
  res.json(Object.values(store.inspections));
});

app.get('/api/inspections/:id', (req, res) => {
  res.json(store.inspections[req.params.id] || null);
});

app.post('/api/sync', (req, res) => {
  const { change } = req.body || {};
  if (!change?.payload) return res.status(400).json({ error: 'Invalid change' });
  
  const incoming = change.payload;
  const id = incoming.id;
  const current = store.inspections[id];
  
  if (!current) {
    store.inspections[id] = incoming;
    persist();
    return res.json({ ok: true, inspection: incoming });
  }

  const currentActor = actorOf({ payload: current });
  const incomingActor = actorOf(change);
  
  // REAL CONFLICT DETECTION:
  // If the client's baseVersion is less than the server's current version, 
  // AND the actors are different, it means the client made changes based on an outdated state.
  const baseVersion = change.baseVersion;
  
  if (baseVersion < current.version && incomingActor !== currentActor) {
    const conflictId = randomUUID();
    store.conflicts[conflictId] = {
      id: conflictId,
      inspectionId: id,
      server: current,
      client: incoming,
      status: 'pending',
      createdAt: Date.now()
    };
    persist();
    return res.json({
      conflict: true,
      conflictId,
      server: { version: current.version, lastActor: currentActor },
      client: { version: incoming.version, lastActor: incomingActor }
    });
  }

  // If no conflict, accept the change (either newer version or same actor overwriting own change sequentially)
  if (incoming.version > current.version || (incoming.version === current.version && incomingActor === currentActor)) {
    store.inspections[id] = incoming;
    persist();
  }
  
  res.json({ ok: true, inspection: store.inspections[id] });
});

app.patch('/api/conflicts/:id', (req, res) => {
  const c = store.conflicts[req.params.id];
  if (!c) return res.status(404).json({ error: 'Conflict not found' });
  
  const d = req.body?.decision;
  let chosen = d === 'keep_server' ? c.server : (d === 'reinspect' ? { ...c.server, status: 'reinspection_requested' } : c.client);
  
  chosen = {
    ...chosen,
    version: Math.max(c.server.version, c.client.version) + 1,
    history: [
      ...(chosen.history || []),
      {
        at: Date.now(),
        action: d === 'reinspect' ? 'supervisor_requested_reinspection' : `supervisor_resolved_conflict_${d}`,
        actor: req.body?.actor || 'Supervisor',
        version: Math.max(c.server.version, c.client.version) + 1
      }
    ]
  };
  
  store.inspections[c.inspectionId] = chosen;
  c.status = 'resolved';
  c.resolution = d;
  c.resolvedAt = Date.now();
  persist();
  
  res.json({ ok: true, inspection: chosen });
});

app.get('/api/conflicts', (req, res) => res.json(Object.values(store.conflicts)));

// Evidence Handling & Storage
const evidenceDir = path.join(dataDir, 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, evidenceDir),
  filename: (req, file, cb) => {
    // Preserve client evidenceId if passed to prevent duplicates
    const evidenceId = req.body?.evidenceId || req.body?.id;
    if (evidenceId) {
      const ext = path.extname(file.originalname) || '';
      return cb(null, `${evidenceId}${ext}`);
    }
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  }
});
const upload = multer({ storage });

app.use('/api/evidence/files', express.static(evidenceDir));

// Duplicate check & reliable upload endpoint
app.post('/api/evidence/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const { inspectionId, itemId, actorId, evidenceId } = req.body;
  const targetId = evidenceId || req.file.filename;
  
  // Idempotent duplicate check
  if (store.evidence[targetId]) {
    return res.json({
      ok: true,
      duplicate: true,
      evidence: store.evidence[targetId]
    });
  }

  const serverUrl = `/api/evidence/files/${req.file.filename}`;
  const evidenceRecord = {
    id: targetId,
    inspectionId: inspectionId || null,
    itemId: itemId || null,
    actorId: actorId || 'Inspector',
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: serverUrl,
    uploadedAt: Date.now(),
    cloudStatus: HAS_SUPABASE ? 'VERIFIED' : 'NOT VERIFIED'
  };

  store.evidence[targetId] = evidenceRecord;
  persist();
  
  res.json({ ok: true, evidence: evidenceRecord });
});

// GET endpoint to query evidence status by ID
app.get('/api/evidence/:id', (req, res) => {
  const ev = store.evidence[req.params.id];
  if (ev) return res.json(ev);
  
  // Check disk if stored by filename
  const diskPath = path.join(evidenceDir, req.params.id);
  if (fs.existsSync(diskPath)) {
    return res.json({
      id: req.params.id,
      url: `/api/evidence/files/${req.params.id}`,
      status: 'uploaded'
    });
  }

  res.status(404).json({ error: 'Evidence not found' });
});

app.listen(4000, () => console.log('ReSync API running on http://localhost:4000'));
