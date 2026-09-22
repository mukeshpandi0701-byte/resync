import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import { AppContext } from '../App';
import { db } from '../db';

const API = 'http://localhost:4000/api';

export default function ConflictDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { actor } = useContext(AppContext);
  const [conflict, setConflict] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchConflict = async () => {
      try {
        const res = await fetch(API + '/conflicts');
        if (res.ok) {
          const data = await res.json();
          const c = data.find(x => x.id === id);
          setConflict(c);
        }
      } catch (e) {
        setMessage('Error loading conflict');
      }
    };
    fetchConflict();
  }, [id]);

  async function resolve(decision) {
    if (!conflict) return;
    try {
      const res = await fetch(API + '/conflicts/' + conflict.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, actor })
      });
      const data = await res.json();
      if (res.ok && data.inspection) {
        await db.inspections.put(data.inspection);
        if (data.reinspection) {
          await db.inspections.put(data.reinspection);
          setMessage('Re-inspection created and conflict resolved');
          setTimeout(() => navigate(`/inspections/${data.reinspection.id}`), 1500);
        } else {
          setMessage('Conflict resolved and audit trail updated');
          setTimeout(() => navigate('/inspections'), 1500);
        }
      } else {
        setMessage(data.error || 'Failed to resolve conflict');
      }
    } catch (e) {
      setMessage('Network error during resolution');
    }
  }

  if (!conflict) return <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: '#697386' }}>Loading Conflict…</div>;

  const serverActor = conflict.server?.history?.at(-1)?.actor || 'Inspector A';
  const clientActor = conflict.client?.history?.at(-1)?.actor || 'Inspector B';

  return (
    <div className="conflict-detail-page">
      <div className="page-title-row" style={{ borderLeft: '4px solid #D92F45', paddingLeft: 16 }}>
        <div>
          <div style={{ color: '#D92F45', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={16} /> CONFLICT DETECTED
          </div>
          <h1>{conflict.server.title}</h1>
          <p>Two inspectors modified this inspection from base version ({conflict.server.version - 1}).</p>
        </div>
      </div>

      {message && (
        <div className="notice-banner">
          <ShieldCheck size={16} /> {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        <div className="card" style={{ borderTop: '4px solid #3285E8' }}>
          <div style={{ borderBottom: '1px solid #E8E3E1', paddingBottom: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, color: '#182235' }}>SERVER VERSION</h3>
            <p style={{ fontSize: 12, color: '#697386' }}>Actor: {serverActor}</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 13, color: '#182235' }}>Checklist Values</h4>
            {conflict.server.checklist?.map(c => (
              <div key={c.id} style={{ padding: '8px 12px', background: '#FFF7F5', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span>{c.label}</span>
                <span style={{ fontWeight: 700, color: c.value === 'PASS' ? '#18A96B' : (c.value === 'FAIL' ? '#D92F45' : '#182235') }}>
                  {c.value || 'PENDING'}
                </span>
              </div>
            ))}
            
            <h4 style={{ fontSize: 13, color: '#182235', marginTop: 12 }}>Notes</h4>
            <div style={{ background: '#FFF7F5', padding: 12, borderRadius: 6, fontStyle: 'italic', fontSize: 13, color: '#697386' }}>
              {conflict.server.notes || 'No notes provided.'}
            </div>
            
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E8E3E1', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#697386' }}>Version</span>
              <span style={{ fontWeight: 800 }}>v{conflict.server.version}</span>
            </div>
          </div>
          
          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }} onClick={() => resolve('keep_server')}>
            KEEP {serverActor.toUpperCase()} VERSION
          </button>
        </div>

        <div className="card" style={{ borderTop: '4px solid #D92F45' }}>
          <div style={{ borderBottom: '1px solid #E8E3E1', paddingBottom: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, color: '#182235' }}>YOUR VERSION</h3>
            <p style={{ fontSize: 12, color: '#697386' }}>Actor: {clientActor}</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 13, color: '#182235' }}>Checklist Values</h4>
            {conflict.client.checklist?.map(c => (
              <div key={c.id} style={{ padding: '8px 12px', background: '#FFF7F5', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span>{c.label}</span>
                <span style={{ fontWeight: 700, color: c.value === 'PASS' ? '#18A96B' : (c.value === 'FAIL' ? '#D92F45' : '#182235') }}>
                  {c.value || 'PENDING'}
                </span>
              </div>
            ))}
            
            <h4 style={{ fontSize: 13, color: '#182235', marginTop: 12 }}>Notes</h4>
            <div style={{ background: '#FFF7F5', padding: 12, borderRadius: 6, fontStyle: 'italic', fontSize: 13, color: '#697386' }}>
              {conflict.client.notes || 'No notes provided.'}
            </div>
            
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E8E3E1', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#697386' }}>Version</span>
              <span style={{ fontWeight: 800 }}>v{conflict.client.version}</span>
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }} onClick={() => resolve('keep_client')}>
            KEEP {clientActor.toUpperCase()} VERSION
          </button>
        </div>
      </div>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#697386', marginBottom: 12 }}>Or you can require the site to be inspected again.</p>
        <button className="btn-outline" onClick={() => resolve('reinspect')}>
          <RotateCcw size={14} /> REQUEST RE-INSPECTION
        </button>
      </div>
    </div>
  );
}
