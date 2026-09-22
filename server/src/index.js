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

// Load Gemini API key from environment (server-only, never exposed to client)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

let store = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : { inspections: {}, conflicts: {}, analyses: {} };

// Ensure analyses map exists for stores created before this feature
if (!store.analyses) store.analyses = {};

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

// Evidence handling
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

// =====================================================
// Gemini Media Analysis Integration
// =====================================================

// Validate Gemini analysis response structure before persisting
function validateGeminiResult(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  // Extract findings — must be an array of strings
  let findings = [];
  if (Array.isArray(parsed.findings)) {
    findings = parsed.findings
      .filter(f => typeof f === 'string' && f.trim().length > 0)
      .map(f => f.trim());
  }

  // Extract confidenceScore — must be a number between 0 and 1
  let confidenceScore = 0;
  if (typeof parsed.confidenceScore === 'number' && isFinite(parsed.confidenceScore)) {
    confidenceScore = Math.max(0, Math.min(1, parsed.confidenceScore));
  } else if (typeof parsed.confidence === 'number' && isFinite(parsed.confidence)) {
    // Accept alternate field name
    confidenceScore = Math.max(0, Math.min(1, parsed.confidence));
  }

  // Extract optional summary
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

  return { findings, confidenceScore, summary };
}

// Call Gemini API to analyze an image file
async function callGeminiAnalysis(filePath, mimeType) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  // Read the file and convert to base64
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  const requestBody = {
    contents: [{
      parts: [
        {
          text: `You are an expert field inspection analyst. Analyze this inspection evidence image and provide:
1. A list of findings (defects, safety issues, observations, compliance status)
2. A confidence score from 0.0 to 1.0 indicating how confident you are in the analysis
3. A brief summary

Respond ONLY with valid JSON in this exact format:
{
  "findings": ["finding 1", "finding 2"],
  "confidenceScore": 0.85,
  "summary": "Brief analysis summary"
}

Do not include any text outside the JSON object.`
        },
        {
          inline_data: {
            mime_type: mimeType || 'image/jpeg',
            data: base64Data
          }
        }
      ]
    }]
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  // Extract text from Gemini response
  const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('Gemini returned no text content');
  }

  // Parse JSON from the response (handle potential markdown code fences)
  let jsonStr = textContent.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse Gemini response as JSON: ${jsonStr.substring(0, 200)}`);
  }

  // Validate the parsed result
  const validated = validateGeminiResult(parsed);
  if (!validated) {
    throw new Error('Gemini response did not contain valid analysis data');
  }

  return validated;
}

// POST /api/evidence/:id/analyze — Trigger analysis
app.post('/api/evidence/:id/analyze', async (req, res) => {
  const { id } = req.params;

  // Check if GEMINI_API_KEY is available
  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Set the GEMINI_API_KEY environment variable on the server.',
      status: 'failed'
    });
  }

  // Check if the evidence file exists on disk
  const files = fs.readdirSync(evidenceDir);
  const matchingFile = files.find(f => f === id || f.startsWith(id.split('.')[0]));
  if (!matchingFile) {
    return res.status(404).json({ error: 'Evidence file not found on server', status: 'failed' });
  }

  const filePath = path.join(evidenceDir, matchingFile);
  const ext = path.extname(matchingFile).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  const mimeType = mimeMap[ext] || 'image/jpeg';

  // Verify it's an image type Gemini can process
  if (!mimeMap[ext]) {
    return res.status(400).json({
      error: `Unsupported file type for analysis: ${ext}. Supported: jpg, jpeg, png, gif, webp`,
      status: 'failed'
    });
  }

  // Create or update analysis record to 'analyzing'
  const analysisId = id;
  store.analyses[analysisId] = {
    evidenceId: id,
    status: 'analyzing',
    findings: [],
    confidenceScore: 0,
    summary: '',
    requestedAt: Date.now(),
    completedAt: null,
    error: null
  };
  persist();

  // Return 202 immediately, then process asynchronously
  res.status(202).json({
    status: 'analyzing',
    evidenceId: id,
    message: 'Analysis started'
  });

  // Run analysis in the background
  try {
    const result = await callGeminiAnalysis(filePath, mimeType);
    store.analyses[analysisId] = {
      ...store.analyses[analysisId],
      status: 'complete',
      findings: result.findings,
      confidenceScore: result.confidenceScore,
      summary: result.summary,
      completedAt: Date.now(),
      error: null
    };
    persist();
    console.log(`[Gemini] Analysis complete for evidence ${id}: ${result.findings.length} findings, confidence ${result.confidenceScore}`);
  } catch (err) {
    store.analyses[analysisId] = {
      ...store.analyses[analysisId],
      status: 'failed',
      completedAt: Date.now(),
      error: err.message
    };
    persist();
    // Log error without exposing API key
    const safeMessage = err.message.replace(GEMINI_API_KEY, '[REDACTED]');
    console.error(`[Gemini] Analysis failed for evidence ${id}: ${safeMessage}`);
  }
});

// GET /api/evidence/:id/analysis — Retrieve analysis result
app.get('/api/evidence/:id/analysis', (req, res) => {
  const { id } = req.params;
  const analysis = store.analyses[id];

  if (!analysis) {
    return res.status(404).json({
      error: 'No analysis found for this evidence',
      status: 'pending'
    });
  }

  // Never expose internal error details that might contain sensitive info
  const safeAnalysis = {
    evidenceId: analysis.evidenceId,
    status: analysis.status,
    findings: analysis.findings || [],
    confidenceScore: analysis.confidenceScore || 0,
    summary: analysis.summary || '',
    requestedAt: analysis.requestedAt,
    completedAt: analysis.completedAt,
    error: analysis.status === 'failed'
      ? (analysis.error || 'Analysis failed').replace(GEMINI_API_KEY || 'NOKEY', '[REDACTED]')
      : null
  };

  res.json(safeAnalysis);
});

// GET /api/evidence/analyses — List all analyses (for dashboard)
app.get('/api/evidence/analyses', (req, res) => {
  const analyses = Object.values(store.analyses).map(a => ({
    evidenceId: a.evidenceId,
    status: a.status,
    findings: a.findings || [],
    confidenceScore: a.confidenceScore || 0,
    summary: a.summary || '',
    requestedAt: a.requestedAt,
    completedAt: a.completedAt
  }));
  res.json(analyses);
});

app.listen(4000, () => {
  console.log('ReSync API running on http://localhost:4000');
  if (GEMINI_API_KEY) {
    console.log('[Gemini] API key configured — media analysis is available');
  } else {
    console.log('[Gemini] No API key configured — POST /api/evidence/:id/analyze will return 503');
  }
});
