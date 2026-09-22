import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ClipboardCheck, CloudOff, Camera, History, Upload, CheckCircle2, ShieldCheck, RotateCcw, AlertTriangle } from 'lucide-react';
import { db } from '../db';
import { AppContext } from '../App';

const API = 'http://localhost:4000/api';

export default function InspectionDetail() {
  const { id } = useParams();
  const { online, actor } = useContext(AppContext);
  const fileInputRef = useRef(null);
  const [inspection, setInspection] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [reportFormat, setReportFormat] = useState('JSON');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState('');
  const [latestReport, setLatestReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  async function handleGenerateReport() {
    if (!inspection) return;
    setGeneratingReport(true);
    setReportStatus('Requesting report generation…');
    try {
      const res = await fetch(API + '/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: inspection.id, format: reportFormat })
      });
      const data = await res.json();
      if ((res.status === 202 || res.status === 200) && data.ok) {
        const reportRes = await fetch(API + '/reports/' + (data.jobId || data.id));
        if (reportRes.ok) {
          const reportDetails = await reportRes.json();
          setLatestReport(reportDetails);
          setReportStatus(
            reportDetails.status?.includes('NOT VERIFIED')
              ? 'PDF format: NOT VERIFIED (PDF engine not available in environment)'
              : 'Report generated successfully'
          );
        } else {
          setLatestReport(data);
          setReportStatus('Report job created (' + data.status + ')');
        }
      } else {
        setReportStatus(data.error || 'Failed to generate report');
      }
    } catch (err) {
      setReportStatus('Report request failed (server unreachable)');
    } finally {
      setGeneratingReport(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      const ins = await db.inspections.get(id);
      setInspection(ins);
    };
    load();
  }, [id]);

  useEffect(() => {
    if (online) sync();
  }, [online]);

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const evId = crypto.randomUUID();
    
    // Store raw Blob safely in local Dexie database first (offline-first persistence)
    await db.evidence.put({
      id: evId,
      inspectionId: inspection.id,
      actorId: actor,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      blob: file,
      status: 'pending',
      createdAt: Date.now()
    });
    
    const newEv = { id: evId, filename: file.name, status: 'pending' };
    await save({ ...inspection, evidence: [...(inspection.evidence || []), newEv] }, 'attached evidence');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function retryEvidence(evId) {
    // Reset status to pending in local Dexie store without losing local Blob
    await db.evidence.update(evId, { status: 'pending' });
    setInspection(prev => {
      if (!prev) return prev;
      const updatedEvidence = (prev.evidence || []).map(e => e.id === evId ? { ...e, status: 'pending' } : e);
      const next = { ...prev, evidence: updatedEvidence };
      db.inspections.put(next);
      return next;
    });
    setMessage('Retrying evidence upload…');
    if (online) sync();
  }

  async function syncEvidence() {
    try {
      // Fetch evidence items queued for upload (status: pending)
      const pendingEv = await db.evidence.where('status').equals('pending').toArray();
      for (const ev of pendingEv) {
        if (!ev.blob) continue; // Safety check
        
        const formData = new FormData();
        formData.append('file', ev.blob, ev.filename);
        formData.append('inspectionId', ev.inspectionId);
        formData.append('actorId', ev.actorId);
        formData.append('evidenceId', ev.id); // Prevent duplicate generation on server
        
        try {
          const r = await fetch(API + '/evidence/upload', { method: 'POST', body: formData });
          const data = await r.json();
          
          if (r.ok && data.ok) {
            await db.evidence.update(ev.id, { status: 'uploaded', serverUrl: data.evidence.url });
            
            // Update local inspection evidence reference status to uploaded
            setInspection(prev => {
              if (!prev) return prev;
              const updatedEvidence = (prev.evidence || []).map(e => e.id === ev.id ? { ...e, status: 'uploaded' } : e);
              const next = { ...prev, evidence: updatedEvidence };
              db.inspections.put(next);
              return next;
            });
          } else {
            // Server error — mark failed in Dexie (Blob remains preserved)
            await db.evidence.update(ev.id, { status: 'failed' });
            setInspection(prev => {
              if (!prev) return prev;
              const updatedEvidence = (prev.evidence || []).map(e => e.id === ev.id ? { ...e, status: 'failed' } : e);
              const next = { ...prev, evidence: updatedEvidence };
              db.inspections.put(next);
              return next;
            });
          }
        } catch (uploadErr) {
          // Network error — mark status failed without dropping local Blob
          await db.evidence.update(ev.id, { status: 'failed' });
          setInspection(prev => {
            if (!prev) return prev;
            const updatedEvidence = (prev.evidence || []).map(e => e.id === ev.id ? { ...e, status: 'failed' } : e);
            const next = { ...prev, evidence: updatedEvidence };
            db.inspections.put(next);
            return next;
          });
        }
      }
    } catch (e) {
      console.error('Evidence sync queue error', e);
    }
  }

  async function save(next, action = 'update') {
    const withHistory = {
      ...next,
      updatedAt: Date.now(),
      version: (next.version || 0) + 1,
      history: [
        ...(next.history || []),
        { at: Date.now(), action, actor, version: (next.version || 0) + 1 }
      ]
    };
    
    setInspection(withHistory);
    await db.inspections.put(withHistory);
    
    // Create change record. Base version is original version before edit (for conflict detection)
    await db.changes.add({
      id: crypto.randomUUID(),
      inspectionId: withHistory.id,
      payload: withHistory,
      baseVersion: next.version,
      status: 'pending',
      createdAt: Date.now(),
      actor
    });
    
    setMessage(online ? 'Change queued for sync' : 'Saved locally — offline');
    if (online) sync();
  }

  async function updateCheck(itemId, value) {
    await save({
      ...inspection,
      checklist: inspection.checklist.map(c => c.id === itemId ? { ...c, value } : c)
    }, `checklist item ${itemId} updated to ${value}`);
  }

  async function updateNotes(e) {
    await save({ ...inspection, notes: e.target.value }, 'note update');
  }

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncEvidence();
      
      const changes = await db.changes.where('status').equals('pending').toArray();
      for (const c of changes) {
        const r = await fetch(API + '/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: actor, change: c })
        });
        const data = await r.json();
        
        if (data.conflict) {
          await db.changes.update(c.id, { status: 'conflict' });
          setMessage('Conflict detected — review required on Dashboard');
        } else {
          await db.changes.update(c.id, { status: 'synced' });
          if (data.inspection) {
            await db.inspections.put(data.inspection);
            if (inspection && inspection.id === data.inspection.id) {
              setInspection(data.inspection);
            }
          }
        }
      }
    } catch (e) {
      setMessage('Sync unavailable — changes remain safely offline');
    } finally {
      setSyncing(false);
    }
  }

  if (!inspection) return <div className="loading">Loading ReSync…</div>;

  return (
    <div className="inspection-detail">
      <section className="hero">
        <div>
          <p className="eyebrow">INSPECTION</p>
          <h1>{inspection.title}</h1>
          <p className="muted">{inspection.site}</p>
        </div>
        <button className="sync" onClick={sync}>
          <RefreshCw size={17} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </section>

      {message && <div className="notice"><ShieldCheck size={17} />{message}</div>}

      <div className="grid">
        <section className="card checklist">
          <div className="cardhead">
            <div>
              <h2><ClipboardCheck /> Safety checklist</h2>
              <p>Changes are stored locally first.</p>
            </div>
            <span className="local"><CloudOff size={14} /> Local-first</span>
          </div>
          {inspection.checklist.map(c => (
            <div className="check" key={c.id}>
              <span>{c.label}</span>
              <div>
                <button 
                  className={c.value === 'PASS' ? 'yes active' : 'yes'} 
                  onClick={() => updateCheck(c.id, 'PASS')}>PASS</button>
                <button 
                  className={c.value === 'FAIL' ? 'no active' : 'no'} 
                  onClick={() => updateCheck(c.id, 'FAIL')}>FAIL</button>
              </div>
            </div>
          ))}
        </section>

        <aside className="side">
          <section className="card">
            <h2><History /> Inspection state</h2>
            <div className="metric"><b>{inspection.version}</b><span>Local version</span></div>
            <div className="metric"><b>{inspection.history?.length || 0}</b><span>Audit events</span></div>
            <div className="metric"><b>{inspection.evidence?.length || 0}</b><span>Evidence items</span></div>

            {/* Audit History Timeline */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #292031', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>Audit History</span>
                <span className="tiny muted">{inspection.history?.length || 0} events</span>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(inspection.history || [])
                  .slice()
                  .sort((a, b) => a.at - b.at)
                  .map((evt, idx) => {
                    const isConflict = evt.action?.includes('conflict') || evt.action?.includes('reinspection');
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: isConflict ? '#291519' : '#100a17',
                          border: isConflict ? '1px solid #EF4444' : '1px solid #292031',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold', color: isConflict ? '#fca5a5' : '#f8fafc' }}>
                            {evt.actor || 'Inspector'}
                          </span>
                          <span style={{ fontSize: '10px', color: isConflict ? '#F59E0B' : '#B1A8C2', border: '1px solid #3a2b4e', borderRadius: '4px', padding: '1px 5px' }}>
                            v{evt.version}
                          </span>
                        </div>
                        <div style={{ color: '#f8fafc', marginBottom: '4px', wordBreak: 'break-word' }}>
                          {evt.action}
                        </div>
                        <div style={{ fontSize: '10px', color: '#a99db9' }}>
                          {new Date(evt.at).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Report Request Controls */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #292031', paddingTop: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', display: 'block', marginBottom: '8px' }}>
                Inspection Report
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <select
                  value={reportFormat}
                  onChange={e => setReportFormat(e.target.value)}
                  style={{
                    background: '#0d0814',
                    color: '#f8fafc',
                    border: '1px solid #30243d',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    outline: 'none',
                    flex: '1'
                  }}
                >
                  <option value="JSON">JSON (Supported)</option>
                  <option value="PDF">PDF (NOT VERIFIED)</option>
                </select>
                <button
                  className="upload"
                  style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }}
                  disabled={generatingReport}
                  onClick={handleGenerateReport}
                >
                  {generatingReport ? 'Generating…' : 'Generate'}
                </button>
              </div>

              {reportStatus && (
                <div style={{ fontSize: '11px', color: reportStatus.includes('NOT VERIFIED') ? '#F59E0B' : '#86efac', marginBottom: '6px' }}>
                  {reportStatus}
                </div>
              )}

              {latestReport && (
                <div style={{ padding: '8px 10px', background: '#100a17', border: '1px solid #292031', borderRadius: '8px', fontSize: '12px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>Report #{latestReport.id.slice(0, 8)}</span>
                    <span style={{ color: latestReport.status?.includes('NOT VERIFIED') ? '#F59E0B' : '#86efac', fontSize: '11px' }}>
                      {latestReport.format}
                    </span>
                  </div>
                  <div style={{ color: '#a99db9', fontSize: '10px', marginBottom: '6px' }}>
                    {new Date(latestReport.generatedAt).toLocaleString()}
                  </div>
                  <button
                    style={{
                      background: '#241537',
                      border: '1px solid #4b3565',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                    onClick={() => setShowReportModal(true)}
                  >
                    View Report Metadata & Data
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <h2><Camera /> Evidence</h2>
            <input 
              type="file" 
              accept="image/*,video/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{display:'none'}} 
              onChange={handleFileSelect} 
            />
            <button className="upload" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Add photo evidence
            </button>
            <p className="tiny">Photos are stored offline in local storage and synced automatically.</p>
            {inspection.evidence?.map(e => (
              <div key={e.id} style={{ fontSize: '12px', marginTop: '6px', color: '#B1A8C2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📎 {e.filename} <small style={{ color: e.status === 'uploaded' ? '#86efac' : (e.status === 'failed' ? '#fca5a5' : '#fde047') }}>({e.status})</small></span>
                {e.status === 'failed' && (
                  <button 
                    onClick={() => retryEvidence(e.id)} 
                    style={{ border: '0', background: '#291519', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <RotateCcw size={10} /> Retry
                  </button>
                )}
              </div>
            ))}
          </section>
        </aside>
      </div>

      <section className="card notes">
        <h2>Inspector notes</h2>
        <textarea 
          value={inspection.notes} 
          onChange={updateNotes} 
          placeholder="Record observations, measurements, or follow-up notes…" 
        />
        <div className="bottom">
          <span>{online ? 'Connected — sync is available' : 'No connection — safely working offline'}</span>
          <button onClick={() => save({ ...inspection }, 'manual checkpoint')}>
            <CheckCircle2 size={16} /> Save checkpoint
          </button>
        </div>
      </section>

      {showReportModal && latestReport && (
        <div className="overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2>Inspection Report ({latestReport.format})</h2>
              <button
                style={{ background: 'transparent', border: 0, color: '#f8fafc', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setShowReportModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="tiny" style={{ color: latestReport.status?.includes('NOT VERIFIED') ? '#F59E0B' : '#86efac' }}>
              Status: {latestReport.status}
            </p>
            <p className="tiny muted">
              Generated: {new Date(latestReport.generatedAt).toLocaleString()} • Inspection ID: {latestReport.inspectionId}
            </p>
            <pre style={{
              background: '#0d0814',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #30243d',
              color: '#f8fafc',
              fontSize: '11px',
              overflowX: 'auto',
              maxHeight: '350px'
            }}>
              {JSON.stringify(latestReport.data || latestReport, null, 2)}
            </pre>
            <div className="actions" style={{ marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReportModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
