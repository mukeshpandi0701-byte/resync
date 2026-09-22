import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Activity } from 'lucide-react';

const API = 'http://localhost:4000/api';

export default function SupervisorDashboard() {
  const [conflicts, setConflicts] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const confRes = await fetch(API + '/conflicts');
        if (confRes.ok) {
          const confData = await confRes.json();
          setConflicts(confData.filter(c => c.status === 'pending'));
        }
        
        const insRes = await fetch(API + '/inspections');
        if (insRes.ok) {
          const insData = await insRes.json();
          setInspections(insData);
          setStats({
            total: insData.length,
            completed: insData.filter(i => i.status === 'completed').length,
            inProgress: insData.filter(i => i.status === 'assigned' || i.status === 'in_progress').length,
          });
        }
      } catch (e) {
        console.error('Error fetching dashboard', e);
      }
    };
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="supervisor-dashboard">
      <section className="hero">
        <div>
          <p className="eyebrow">SUPERVISOR WORKSPACE</p>
          <h1>Overview Dashboard</h1>
        </div>
      </section>
      
      <div className="grid">
        <section className="card metric-card">
          <h2><Activity /> Total Inspections</h2>
          <div className="metric"><b>{stats.total}</b><span>Total</span></div>
        </section>
        <section className="card metric-card">
          <h2>In Progress</h2>
          <div className="metric"><b>{stats.inProgress}</b><span>Active</span></div>
        </section>
        <section className="card metric-card">
          <h2>Conflicts</h2>
          <div className="metric"><b style={{color: '#EF4444'}}>{conflicts.length}</b><span>Requires Action</span></div>
        </section>
      </div>

      <section className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle /> Conflicts Requiring Attention
        </h2>
        {conflicts.length === 0 ? (
          <p className="muted">No pending conflicts.</p>
        ) : (
          <div className="conflicts-list">
            {conflicts.map(c => (
              <div key={c.id} style={{
                background: '#1E1B29', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                borderLeft: '4px solid #EF4444'
              }}>
                <h3>{c.server?.title || 'Inspection'}</h3>
                <p className="muted">Conflict between {c.server?.history?.at(-1)?.actor || 'Server'} and {c.client?.history?.at(-1)?.actor || 'Client'}</p>
                <div style={{ marginTop: '1rem' }}>
                  <Link to={`/conflicts/${c.id}`}>
                    <button className="primary">Review Conflict</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
