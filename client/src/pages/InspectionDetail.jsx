import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ClipboardCheck, CloudOff, Camera, History, Upload, CheckCircle2, ShieldCheck, RotateCcw, AlertTriangle, FileText, Download, Eye } from 'lucide-react';
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
      const pendingEv = await db.evidence.where('status').equals('pending').toArray();
      for (const ev of pendingEv) {
        if (!ev.blob) continue;
        
        const formData = new FormData();
        formData.append('file', ev.blob, ev.filename);
        formData.append('inspectionId', ev.inspectionId);
        formData.append('actorId', ev.actorId);
        formData.append('evidenceId', ev.id);
        
        try {
          const r = await fetch(API + '/evidence/upload', { method: 'POST', body: formData });
          const data = await r.json();
          
          if (r.ok && data.ok) {
            await db.evidence.update(ev.id, { status: 'uploaded', serverUrl: data.evidence.url });
            
            setInspection(prev => {
              if (!prev) return prev;
              const updatedEvidence = (prev.evidence || []).map(e => e.id === ev.id ? { ...e, status: 'uploaded' } : e);
              const next = { ...prev, evidence: updatedEvidence };
              db.inspections.put(next);
              return next;
            });
          } else {
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
          setMessage('Conflict detected — review required');
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

  if (!inspection) return <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: '#697386' }}>Loading Inspection…</div>;

  return (
    <div className="inspection-detail-page">
      <div className="page-title-row">
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#D92F45', letterSpacing: '0.05em', marginBottom: 4 }}>INSPECTION DETAIL</div>
          <h1>{inspection.title}</h1>
          <p style={{ fontSize: 13, color: '#697386' }}>{inspection.site}</p>
        </div>
        <button className="btn-primary" onClick={sync}>
          <RefreshCw size={16} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {message && (
        <div className="notice-banner">
          <ShieldCheck size={16} /> {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: 20 }}>
        {/* Left Column: Safety Checklist */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <ClipboardCheck size={18} /> Safety Checklist
              </h3>
              <p style={{ fontSize: 12, color: '#697386', marginTop: 2 }}>Changes are saved locally first.</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3285E8', background: '#EBF3FC', padding: '4px 10px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CloudOff size={12} /> Local-first
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {inspection.checklist?.map(c => (
              <div key={c.id} style={{ padding: '14px 16px', background: '#FFF7F5', border: '1px solid #E8E3E1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => updateCheck(c.id, 'PASS')}
                    style={{
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: c.value === 'PASS' ? '#18A96B' : '#E8F8F0',
                      color: c.value === 'PASS' ? '#FFFFFF' : '#18A96B'
                    }}
                  >
                    PASS
                  </button>
                  <button 
                    onClick={() => updateCheck(c.id, 'FAIL')}
                    style={{
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: c.value === 'FAIL' ? '#D92F45' : '#FCEBEC',
                      color: c.value === 'FAIL' ? '#FFFFFF' : '#D92F45'
                    }}
                  >
                    FAIL
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Inspector Notes Section */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #E8E3E1' }}>
            <h3 className="card-title" style={{ fontSize: 15, marginBottom: 12 }}>Inspector Notes</h3>
            <textarea 
              value={inspection.notes || ''} 
              onChange={updateNotes} 
              placeholder="Record observations, measurements, or follow-up notes…" 
              style={{
                width: '100%',
                height: 100,
                padding: 12,
                borderRadius: 8,
                border: '1px solid #E8E3E1',
                background: '#FCFAF8',
                fontSize: 13,
                outline: 'none',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: '#697386' }}>
              <span>{online ? 'Connected — sync is available' : 'No connection — safely working offline'}</span>
              <button className="btn-secondary" onClick={() => save({ ...inspection }, 'manual checkpoint')}>
                <CheckCircle2 size={14} /> Save checkpoint
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 className="card-title" style={{ fontSize: 14, marginBottom: 14 }}>
              <History size={16} /> Inspection State
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #E8E3E1' }}>
                <span style={{ color: '#697386' }}>Local version</span>
                <span style={{ fontWeight: 800 }}>v{inspection.version}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #E8E3E1' }}>
                <span style={{ color: '#697386' }}>Audit events</span>
                <span style={{ fontWeight: 800 }}>{inspection.history?.length || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                <span style={{ color: '#697386' }}>Evidence items</span>
                <span style={{ fontWeight: 800 }}>{inspection.evidence?.length || 0}</span>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div style={{ marginTop: 16, borderTop: '1px solid #E8E3E1', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#182235' }}>Audit Trail</span>
                <span style={{ fontSize: 11, color: '#697386' }}>{inspection.history?.length || 0} events</span>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(inspection.history || [])
                  .slice()
                  .sort((a, b) => a.at - b.at)
                  .map((evt, idx) => {
                    const isConflict = evt.action?.includes('conflict') || evt.action?.includes('reinspection');
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: isConflict ? '#FCEBEC' : '#FFF7F5',
                          border: '1px solid #E8E3E1',
                          fontSize: 11
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: isConflict ? '#D92F45' : '#182235' }}>
                            {evt.actor || 'Inspector'}
                          </span>
                          <span style={{ fontSize: 10, color: '#697386' }}>
                            v{evt.version}
                          </span>
                        </div>
                        <div style={{ color: '#182235' }}>{evt.action}</div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Report Request Controls */}
            <div style={{ marginTop: 16, borderTop: '1px solid #E8E3E1', paddingTop: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#182235', display: 'block', marginBottom: 8 }}>
                Inspection Report
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select
                  value={reportFormat}
                  onChange={e => setReportFormat(e.target.value)}
                  style={{
                    background: '#FCFAF8',
                    color: '#182235',
                    border: '1px solid #E8E3E1',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: 12,
                    outline: 'none',
                    flex: 1
                  }}
                >
                  <option value="JSON">JSON (Supported)</option>
                  <option value="PDF">PDF (NOT VERIFIED)</option>
                </select>
                <button
                  className="btn-outline"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  disabled={generatingReport}
                  onClick={handleGenerateReport}
                >
                  {generatingReport ? 'Generating…' : 'Generate'}
                </button>
              </div>

              {reportStatus && (
                <div style={{ fontSize: 11, color: reportStatus.includes('NOT VERIFIED') ? '#E6A21A' : '#18A96B', marginBottom: 6 }}>
                  {reportStatus}
                </div>
              )}

              {latestReport && (
                <button
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '6px' }}
                  onClick={() => setShowReportModal(true)}
                >
                  View Report Metadata ({latestReport.format})
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ fontSize: 14, marginBottom: 14 }}>
              <Camera size={16} /> Photo Evidence
            </h3>
            <input 
              type="file" 
              accept="image/*,video/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileSelect} 
            />
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Add photo evidence
            </button>
            <p style={{ fontSize: 11, color: '#697386', marginTop: 8, marginBottom: 12 }}>
              Photos are stored offline in local storage and synced automatically.
            </p>
            {inspection.evidence?.map(e => (
              <div key={e.id} style={{ fontSize: 12, marginTop: 6, color: '#182235', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#FFF7F5', border: '1px solid #E8E3E1', borderRadius: 6 }}>
                <span>📎 {e.filename} <small style={{ color: e.status === 'uploaded' ? '#18A96B' : (e.status === 'failed' ? '#D92F45' : '#E6A21A') }}>({e.status})</small></span>
                {e.status === 'failed' && (
                  <button 
                    onClick={() => retryEvidence(e.id)} 
                    style={{ border: 0, background: '#FCEBEC', color: '#D92F45', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}
                  >
                    <RotateCcw size={10} /> Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {showReportModal && latestReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(24, 34, 53, 0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }} onClick={() => setShowReportModal(false)}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(580px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Inspection Report ({latestReport.format})</h2>
              <button style={{ background: 'none', border: 0, fontSize: 18, cursor: 'pointer', color: '#182235' }} onClick={() => setShowReportModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: latestReport.status?.includes('NOT VERIFIED') ? '#E6A21A' : '#18A96B', marginBottom: 6 }}>
              Status: {latestReport.status}
            </p>
            <pre style={{ background: '#FCFAF8', padding: 12, borderRadius: 8, border: '1px solid #E8E3E1', fontSize: 11, overflowX: 'auto', maxHeight: 350 }}>
              {JSON.stringify(latestReport.data || latestReport, null, 2)}
            </pre>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowReportModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
