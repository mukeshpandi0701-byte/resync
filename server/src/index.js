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

let store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { inspections: {}, conflicts: {} };

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

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'ReSync', time: new Date().toISOString() }));

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

// Evidence
const evidenceDir = path.join(dataDir, 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, evidenceDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  }
});
const upload = multer({ storage });

app.use('/api/evidence/files', express.static(evidenceDir));

app.post('/api/evidence/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const { inspectionId, itemId, actorId } = req.body;
  const serverUrl = `/api/evidence/files/${req.file.filename}`;
  const evidenceRecord = {
    id: req.file.filename,
    inspectionId,
    itemId,
    actorId,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: serverUrl,
    uploadedAt: Date.now()
  };
  
  res.json({ ok: true, evidence: evidenceRecord });
});

app.listen(4000, () => console.log('ReSync API running on http://localhost:4000'));
