import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db';

export default function InspectorDashboard() {
  const [inspections, setInspections] = useState([]);

  useEffect(() => {
    const load = async () => {
      const all = await db.inspections.toArray();
      setInspections(all);
    };
    load();
  }, []);

  return (
    <div className="inspector-dashboard">
      <section className="hero">
        <div>
          <p className="eyebrow">INSPECTOR WORKSPACE</p>
          <h1>My Inspections</h1>
        </div>
      </section>
      
      <div className="grid">
        {inspections.map(ins => (
          <Link to={`/inspections/${ins.id}`} key={ins.id} className="card" style={{textDecoration: 'none', color: 'inherit'}}>
            <h2>{ins.title}</h2>
            <p className="muted">{ins.site}</p>
            <div style={{marginTop: '1rem', display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: '#7C3AED'}}>{ins.status}</span>
              <span style={{color: '#B1A8C2', fontSize: '12px'}}>v{ins.version}</span>
            </div>
          </Link>
        ))}
        {inspections.length === 0 && <p>No inspections found.</p>}
      </div>
    </div>
  );
}
