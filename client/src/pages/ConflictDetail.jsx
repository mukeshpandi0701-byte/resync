import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
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
        // Update local DB if supervisor is also looking at it
        await db.inspections.put(data.inspection);
        setMessage('Conflict resolved and audit trail updated');
        setTimeout(() => navigate('/supervisor'), 1500);
      } else {
        setMessage(data.error || 'Failed to resolve conflict');
      }
    } catch (e) {
      setMessage('Network error during resolution');
    }
  }

  if (!conflict) return <div className="loading">Loading Conflict…</div>;

  const serverActor = conflict.server?.history?.at(-1)?.actor || 'Inspector A';
  const clientActor = conflict.client?.history?.at(-1)?.actor || 'Inspector B';

  return (
    <div className="conflict-detail">
      <section className="hero" style={{ borderLeft: '4px solid #EF4444', paddingLeft: '1rem' }}>
        <div>
          <p className="eyebrow" style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} /> CONFLICT DETECTED
          </p>
          <h1>{conflict.server.title}</h1>
          <p className="muted">Two inspectors modified this inspection from the same base version ({conflict.server.version - 1}).</p>
        </div>
      </section>

      {message && <div className="notice"><ShieldCheck size={17} />{message}</div>}

      <div className="compare-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        <div className="card side-panel">
          <div className="cardhead" style={{ borderBottom: '1px solid #7C3AED', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <h2>VERSION 1</h2>
            <p className="muted">{serverActor}</p>
          </div>
          
          <div className="diff-content">
            <h3>Checklist</h3>
            {conflict.server.checklist.map(c => (
              <div key={c.id} style={{ padding: '0.5rem', background: '#1E1B29', marginBottom: '0.5rem', borderRadius: '4px' }}>
                <div>{c.label}</div>
                <div style={{ color: c.value === 'PASS' ? '#22C55E' : (c.value === 'FAIL' ? '#EF4444' : '#F8FAFC'), fontWeight: 'bold' }}>
                  {c.value || 'PENDING'}
                </div>
              </div>
            ))}
            
            <h3 style={{ marginTop: '1rem' }}>Notes</h3>
            <div style={{ background: '#1E1B29', padding: '1rem', borderRadius: '4px', fontStyle: 'italic' }}>
              {conflict.server.notes || 'No notes provided.'}
            </div>
            
            <div className="metric" style={{ marginTop: '1rem' }}>
              <b>v{conflict.server.version}</b>
              <span>Version</span>
            </div>
          </div>
          
          <button style={{ width: '100%', marginTop: '2rem' }} onClick={() => resolve('keep_server')}>
            KEEP {serverActor.toUpperCase()} VERSION
          </button>
        </div>

        <div className="card side-panel" style={{ border: '1px solid #F59E0B' }}>
          <div className="cardhead" style={{ borderBottom: '1px solid #F59E0B', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <h2>VERSION 2</h2>
            <p className="muted">{clientActor}</p>
          </div>
          
          <div className="diff-content">
            <h3>Checklist</h3>
            {conflict.client.checklist.map(c => (
              <div key={c.id} style={{ padding: '0.5rem', background: '#1E1B29', marginBottom: '0.5rem', borderRadius: '4px' }}>
                <div>{c.label}</div>
                <div style={{ color: c.value === 'PASS' ? '#22C55E' : (c.value === 'FAIL' ? '#EF4444' : '#F8FAFC'), fontWeight: 'bold' }}>
                  {c.value || 'PENDING'}
                </div>
              </div>
            ))}
            
            <h3 style={{ marginTop: '1rem' }}>Notes</h3>
            <div style={{ background: '#1E1B29', padding: '1rem', borderRadius: '4px', fontStyle: 'italic' }}>
              {conflict.client.notes || 'No notes provided.'}
            </div>
            
            <div className="metric" style={{ marginTop: '1rem' }}>
              <b>v{conflict.client.version}</b>
              <span>Version (from base {conflict.client.baseVersion || conflict.server.version - 1})</span>
            </div>
          </div>

          <button style={{ width: '100%', marginTop: '2rem' }} className="primary" onClick={() => resolve('keep_client')}>
            KEEP {clientActor.toUpperCase()} VERSION
          </button>
        </div>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p className="muted" style={{ marginBottom: '1rem' }}>Or you can require the site to be inspected again.</p>
        <button onClick={() => resolve('reinspect')} style={{ background: 'transparent', border: '1px solid #B1A8C2' }}>
          REQUEST RE-INSPECTION
        </button>
      </div>
    </div>
  );
}
