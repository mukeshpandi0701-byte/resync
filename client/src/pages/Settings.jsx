import React, { useContext } from 'react';
import IdentitySelector from '../components/IdentitySelector';
import { AppContext } from '../App';
import { Shield, Server, User, Wifi } from 'lucide-react';

export default function Settings() {
  const { actor, online } = useContext(AppContext);

  return (
    <div className="settings-page">
      <div className="page-title-row">
        <div>
          <h1>Settings</h1>
          <p>Manage application preferences, demo user role identity, and server status.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            <User size={18} color="#D92F45" /> User Identity Switching
          </h3>
          <p style={{ fontSize: 13, color: '#697386', marginBottom: 16 }}>
            Switch between demo user identities to test inspector data isolation and supervisor resolution workflows.
          </p>
          <div style={{ padding: 16, background: '#FFF7F5', borderRadius: 10, border: '1px solid #E8E3E1' }}>
            <IdentitySelector />
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            <Server size={18} color="#D92F45" /> Platform Health & Storage
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #E8E3E1' }}>
              <span style={{ color: '#697386' }}>Backend Server</span>
              <span style={{ fontWeight: 700, color: '#18A96B' }}>http://localhost:4000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #E8E3E1' }}>
              <span style={{ color: '#697386' }}>Network State</span>
              <span style={{ fontWeight: 700, color: online ? '#18A96B' : '#D92F45' }}>{online ? 'Online' : 'Offline'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #E8E3E1' }}>
              <span style={{ color: '#697386' }}>Local Persistence Engine</span>
              <span style={{ fontWeight: 700, color: '#182235' }}>Dexie (IndexedDB)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ color: '#697386' }}>Active Role</span>
              <span style={{ fontWeight: 700, color: '#D92F45' }}>{actor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
