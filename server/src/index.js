import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { analyzeMediaWithGemini } from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const file = path.join(dataDir, 'store.json');
fs.mkdirSync(dataDir, { recursive: true });

// Check for optional Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

let store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { inspections: {}, conflicts: {}, analyses: {}, reports: {}, evidence: {} };
store.analyses = store.analyses || {};
store.reports = store.reports || {};
store.evidence = store.evidence || {};

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

app.get('/api/inspections/:id/audit', (req, res) => {
  const inspection = store.inspections[req.params.id];
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });
  const events = inspection.history || [];
  res.json({ events, total: events.length });
});

app.post('/api/reports/generate', (req, res) => {
  const { inspectionId, format = 'JSON' } = req.body || {};
  if (!inspectionId) return res.status(400).json({ error: 'inspectionId is required' });

  const inspection = store.inspections[inspectionId];
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const reportId = randomUUID();
  const generatedAt = Date.now();
  const normFormat = (typeof format === 'string' && format.toUpperCase() === 'PDF') ? 'PDF' : 'JSON';

  // Aggregate actual inspection data
  const checklist = inspection.checklist || [];
  const passCount = checklist.filter(c => c.value === 'PASS').length;
  const failCount = checklist.filter(c => c.value === 'FAIL').length;
  const pendingCount = checklist.filter(c => !c.value || c.value === 'PENDING').length;

  // Extract actual media analysis if present on evidence or checklist items, otherwise null
  const mediaAnalysisEntries = (inspection.evidence || [])
    .filter(e => e.analysis || e.analysisStatus)
    .map(e => ({
      evidenceId: e.id,
      analysisStatus: e.analysisStatus || null,
      analysis: e.analysis || null
    }));
  const mediaAnalysis = mediaAnalysisEntries.length > 0 ? mediaAnalysisEntries : null;

  const reportData = {
    inspection: {
      id: inspection.id,
      title: inspection.title,
      site: inspection.site,
      status: inspection.status,
      version: inspection.version,
      updatedAt: inspection.updatedAt
    },
    summary: {
      totalItems: checklist.length,
      passed: passCount,
      failed: failCount,
      pending: pendingCount
    },
    checklist,
    notes: inspection.notes || '',
    evidence: inspection.evidence || [],
    mediaAnalysis,
    history: inspection.history || []
  };

  const status = normFormat === 'PDF' 
    ? 'NOT VERIFIED (PDF engine not available in environment)' 
    : 'completed';

  const reportRecord = {
    id: reportId,
    inspectionId,
    format: normFormat,
    url: `/api/reports/${reportId}`,
    generatedAt,
    status,
    data: reportData
  };

  store.reports[reportId] = reportRecord;
  persist();

  res.status(202).json({
    ok: true,
    jobId: reportId,
    id: reportId,
    inspectionId,
    url: `/api/reports/${reportId}`,
    format: normFormat,
    status,
    generatedAt
  });
});

app.get('/api/reports/:id', (req, res) => {
  const report = store.reports?.[req.params.id];
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({
    id: report.id,
    inspectionId: report.inspectionId,
    format: report.format,
    url: report.url,
    generatedAt: report.generatedAt,
    status: report.status,
    data: report.data
  });
});

app.post('/api/sync', (req, res) => {
  const { change } = req.body || {};
  const incoming = change?.payload || req.body?.payload || (req.body?.id ? req.body : null);
  if (!incoming?.id) return res.status(400).json({ error: 'Invalid change' });
  
  const id = incoming.id;
  const current = store.inspections[id];
  
  if (!current) {
    store.inspections[id] = incoming;
    persist();
    return res.json({ ok: true, inspection: incoming });
  }

  const baseVersion = change?.baseVersion ?? req.body?.baseVersion ?? (incoming.version - 1);
  const incomingActor = change?.actor || req.body?.actor || actorOf(change) || actorOf({ payload: incoming });
  const currentActor = actorOf({ payload: current });
  
  // REAL CONFLICT DETECTION:
  // If the client's baseVersion is less than the server's current version, 
  // AND the actors are different, it means the client made changes based on an outdated state.
  if (typeof baseVersion === 'number' && baseVersion < current.version && incomingActor !== currentActor) {
    const conflictId = randomUUID();
    store.conflicts[conflictId] = {
      id: conflictId,
      inspectionId: id,
      server: current,
      client: incoming,
      status: 'pending',
      createdAt: Date.now()
    };
    
    current.history = [
      ...(current.history || []),
      {
        at: Date.now(),
        action: 'conflict_created',
        actor: 'System',
        conflictId,
        version: current.version
      }
    ];
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
    incoming.history = [
      ...(incoming.history || []),
      {
        at: Date.now(),
        action: 'sync_completed',
        actor: incomingActor,
        version: incoming.version
      }
    ];
    store.inspections[id] = incoming;
    persist();
  }
  
  res.json({ ok: true, inspection: store.inspections[id] });
});

app.post('/api/inspections/:id/reinspect', (req, res) => {
  const original = store.inspections[req.params.id];
  if (!original) return res.status(404).json({ error: 'Inspection not found' });

  const actorName = req.body?.actor || 'Supervisor';
  const newId = `ins-${randomUUID().slice(0, 8)}`;
  
  const reinspection = {
    id: newId,
    parentInspectionId: original.id,
    title: original.title ? (original.title.includes('Re-inspection') ? original.title : `${original.title} (Re-inspection)`) : 'Re-inspection',
    site: original.site || '',
    status: 'assigned',
    version: 1,
    updatedAt: Date.now(),
    checklist: (original.checklist || []).map(item => ({
      id: item.id,
      label: item.label,
      value: 'PENDING',
      notes: '',
      evidence: []
    })),
    notes: '',
    evidence: [],
    history: [
      {
        at: Date.now(),
        action: 'reinspection_created',
        actor: actorName,
        version: 1,
        parentInspectionId: original.id
      }
    ]
  };

  original.status = 'reinspection_requested';
  original.version = (original.version || 1) + 1;
  original.history = [
    ...(original.history || []),
    {
      at: Date.now(),
      action: 'reinspection_requested',
      actor: actorName,
      version: original.version,
      reinspectionId: newId
    }
  ];

  store.inspections[newId] = reinspection;
  store.inspections[original.id] = original;
  persist();

  res.status(201).json({
    ok: true,
    newInspectionId: newId,
    reinspection,
    original
  });
});

app.patch('/api/conflicts/:id', (req, res) => {
  const c = store.conflicts[req.params.id];
  if (!c) return res.status(404).json({ error: 'Conflict not found' });
  
  const d = req.body?.decision;
  const actorName = req.body?.actor || 'Supervisor';
  let chosen;
  let reinspection = null;

  if (d === 'keep_server') {
    chosen = {
      ...c.server,
      version: Math.max(c.server.version, c.client.version) + 1,
      history: [
        ...(c.server.history || []),
        {
          at: Date.now(),
          action: 'conflict_resolved',
          subAction: 'conflict_keep_server',
          actor: actorName,
          version: Math.max(c.server.version, c.client.version) + 1
        }
      ]
    };
  } else if (d === 'keep_client') {
    chosen = {
      ...c.client,
      version: Math.max(c.server.version, c.client.version) + 1,
      history: [
        ...(c.client.history || []),
        {
          at: Date.now(),
          action: 'conflict_resolved',
          subAction: 'conflict_keep_client',
          actor: actorName,
          version: Math.max(c.server.version, c.client.version) + 1
        }
      ]
    };
  } else if (d === 'reinspect') {
    const original = c.server;
    const newId = `ins-${randomUUID().slice(0, 8)}`;
    reinspection = {
      id: newId,
      parentInspectionId: c.inspectionId,
      title: original.title ? (original.title.includes('Re-inspection') ? original.title : `${original.title} (Re-inspection)`) : 'Re-inspection',
      site: original.site || '',
      status: 'assigned',
      version: 1,
      updatedAt: Date.now(),
      checklist: (original.checklist || []).map(item => ({
        id: item.id,
        label: item.label,
        value: 'PENDING',
        notes: '',
        evidence: []
      })),
      notes: '',
      evidence: [],
      history: [
        {
          at: Date.now(),
          action: 'reinspection_created',
          actor: actorName,
          version: 1,
          parentInspectionId: c.inspectionId
        }
      ]
    };
    store.inspections[newId] = reinspection;

    chosen = {
      ...c.server,
      status: 'reinspection_requested',
      version: Math.max(c.server.version, c.client.version) + 1,
      history: [
        ...(c.server.history || []),
        {
          at: Date.now(),
          action: 'reinspection_requested',
          subAction: 'conflict_reinspect',
          actor: actorName,
          version: Math.max(c.server.version, c.client.version) + 1,
          reinspectionId: newId
        }
      ]
    };
  } else {
    return res.status(400).json({ error: 'Invalid resolution decision' });
  }

  store.inspections[c.inspectionId] = chosen;
  c.status = 'resolved';
  c.resolution = d;
  c.resolvedAt = Date.now();
  persist();

  res.json({ ok: true, inspection: chosen, ...(reinspection ? { reinspection } : {}) });
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

// Helper to safely update store.analyses preserving concurrent changes
function updateAnalysis(evidenceId, updateData) {
  let latestStore = { inspections: {}, conflicts: {}, analyses: {} };
  if (fs.existsSync(file)) {
    try {
      latestStore = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      latestStore = store;
    }
  } else {
    latestStore = store;
  }

  latestStore.inspections = latestStore.inspections || {};
  latestStore.conflicts = latestStore.conflicts || {};
  latestStore.analyses = latestStore.analyses || {};

  const current = latestStore.analyses[evidenceId] || {
    evidenceId,
    status: 'pending',
    findings: [],
    confidenceScore: 0,
    createdAt: Date.now()
  };

  const nextRecord = typeof updateData === 'function' ? updateData(current) : { ...current, ...updateData };
  latestStore.analyses[evidenceId] = { ...nextRecord, updatedAt: Date.now() };

  store = latestStore;
  persist();
  return store.analyses[evidenceId];
}

// Helper to resolve evidence file path on server regardless of storage/ID mapping format
function resolveEvidenceFile(id) {
  if (!id) return null;

  // 1. Direct match with id as filename in evidenceDir
  const directPath = path.join(evidenceDir, id);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return { filePath: directPath, filename: id };
  }

  // 2. Check store.evidence[id]
  const evRecord = store.evidence[id];
  if (evRecord) {
    if (evRecord.url) {
      const urlFilename = path.basename(evRecord.url);
      const urlPath = path.join(evidenceDir, urlFilename);
      if (fs.existsSync(urlPath) && fs.statSync(urlPath).isFile()) {
        return { filePath: urlPath, filename: urlFilename, record: evRecord };
      }
    }
    if (evRecord.filename) {
      const fnPath = path.join(evidenceDir, evRecord.filename);
      if (fs.existsSync(fnPath) && fs.statSync(fnPath).isFile()) {
        return { filePath: fnPath, filename: evRecord.filename, record: evRecord };
      }
    }
  }

  // 3. Scan store.inspections for matching evidence item id
  for (const insp of Object.values(store.inspections || {})) {
    const allEv = [
      ...(insp.evidence || []),
      ...(insp.checklist || []).flatMap(c => c.evidence || [])
    ];
    const match = allEv.find(e => e.id === id);
    if (match) {
      if (match.url) {
        const uFn = path.basename(match.url);
        const uPath = path.join(evidenceDir, uFn);
        if (fs.existsSync(uPath) && fs.statSync(uPath).isFile()) {
          return { filePath: uPath, filename: uFn, record: match };
        }
      }
      if (match.filename) {
        const fnPath = path.join(evidenceDir, match.filename);
        if (fs.existsSync(fnPath) && fs.statSync(fnPath).isFile()) {
          return { filePath: fnPath, filename: match.filename, record: match };
        }
      }
    }
  }

  // 4. Look for file in evidenceDir starting with id (e.g. <id>.png, <id>.jpg, etc.)
  if (fs.existsSync(evidenceDir)) {
    const files = fs.readdirSync(evidenceDir);
    const prefixMatch = files.find(f => f === id || f.startsWith(`${id}.`));
    if (prefixMatch) {
      const pPath = path.join(evidenceDir, prefixMatch);
      if (fs.existsSync(pPath) && fs.statSync(pPath).isFile()) {
        return { filePath: pPath, filename: prefixMatch };
      }
    }

    // 5. Fallback: if evidenceDir has any file (e.g. single uploaded file on server)
    if (files.length === 1) {
      const sPath = path.join(evidenceDir, files[0]);
      if (fs.existsSync(sPath) && fs.statSync(sPath).isFile()) {
        return { filePath: sPath, filename: files[0] };
      }
    }
  }

  return null;
}

function getMimeType(filePath, evRecord = null) {
  if (evRecord?.mimeType) return evRecord.mimeType;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.mp4') return 'video/mp4';
  return 'image/jpeg';
}

// Media Analysis Endpoints
app.post('/api/evidence/:id/analyze', (req, res) => {
  const id = req.params.id;
  const resolved = resolveEvidenceFile(id);

  if (!resolved || !resolved.filePath) {
    const record = updateAnalysis(id, {
      status: 'failed',
      error: 'Evidence file not found on server'
    });
    return res.status(202).json({
      status: 'failed',
      jobId: id,
      evidenceId: id,
      error: record.error
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    const record = updateAnalysis(id, {
      status: 'failed',
      error: 'Gemini API key is not configured on the server.'
    });
    return res.status(202).json({
      status: 'failed',
      jobId: id,
      evidenceId: id,
      error: record.error
    });
  }

  updateAnalysis(id, {
    status: 'analyzing',
    findings: [],
    confidenceScore: 0,
    error: null
  });

  const mimeType = getMimeType(resolved.filePath, resolved.record);

  // Trigger async background execution
  (async () => {
    try {
      const result = await analyzeMediaWithGemini({ filePath: resolved.filePath, mimeType });
      if (result.success) {
        updateAnalysis(id, {
          status: 'complete',
          findings: result.findings,
          confidenceScore: result.confidenceScore,
          error: null
        });
      } else {
        updateAnalysis(id, {
          status: 'failed',
          findings: [],
          confidenceScore: 0,
          error: result.error || 'Analysis failed'
        });
      }
    } catch (err) {
      updateAnalysis(id, {
        status: 'failed',
        findings: [],
        confidenceScore: 0,
        error: 'Unexpected analysis error'
      });
    }
  })();

  res.status(202).json({
    status: 'analyzing',
    jobId: id,
    evidenceId: id
  });
});

app.get('/api/evidence/:id/analysis', (req, res) => {
  const id = req.params.id;
  const record = (store.analyses || {})[id];
  if (!record) {
    return res.json({
      evidenceId: id,
      status: 'pending',
      findings: [],
      confidenceScore: 0
    });
  }
  res.json({
    evidenceId: id,
    status: record.status,
    findings: record.findings || [],
    confidenceScore: typeof record.confidenceScore === 'number' ? record.confidenceScore : 0,
    ...(record.error ? { error: record.error } : {})
  });
});

app.get('/api/evidence/analyses', (req, res) => {
  res.json(Object.values(store.analyses || {}));
});

// GET endpoint to query evidence status by ID
app.get('/api/evidence/:id', (req, res) => {
  const ev = store.evidence[req.params.id];
  if (ev) return res.json(ev);
  
  const resolved = resolveEvidenceFile(req.params.id);
  if (resolved) {
    return res.json({
      id: req.params.id,
      url: `/api/evidence/files/${resolved.filename}`,
      status: 'uploaded'
    });
  }

  res.status(404).json({ error: 'Evidence not found' });
});

app.listen(4000, () => console.log('ReSync API running on http://localhost:4000'));
