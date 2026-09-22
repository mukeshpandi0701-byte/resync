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
            <div className="metric"><b>{inspection.history.length}</b><span>Audit events</span></div>
            <div className="metric"><b>{inspection.evidence.length}</b><span>Evidence items</span></div>
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
            {inspection.evidence.map(e => (
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
    </div>
  );
}
