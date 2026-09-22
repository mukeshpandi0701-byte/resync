import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Wifi, WifiOff } from 'lucide-react';
import IdentitySelector from './components/IdentitySelector';
import InspectorDashboard from './pages/InspectorDashboard';
import InspectionDetail from './pages/InspectionDetail';
import SupervisorDashboard from './pages/SupervisorDashboard';
import ConflictDetail from './pages/ConflictDetail';
import { db, seed } from './db';
import './styles.css';

export const AppContext = React.createContext();

export default function App() {
  const [online, setOnline] = useState(navigator.onLine);
  const [actor, setActor] = useState(localStorage.getItem('resync_actor') || 'Inspector A');
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    localStorage.setItem('resync_actor', actor);
  }, [actor]);

  useEffect(() => {
    const initDb = async () => {
      let x = await db.inspections.get(seed.id);
      if (!x) {
        await db.inspections.put(seed);
      }
    };
    initDb();

    const updatePending = async () => {
      const count = await db.changes.where('status').equals('pending').count();
      setPendingSync(count);
    };
    
    // Poll or hook into Dexie for simplicity in this demo
    updatePending();
    const interval = setInterval(updatePending, 2000);

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(interval);
    };
  }, []);

  return (
    <AppContext.Provider value={{ online, actor, setActor, pendingSync }}>
      <BrowserRouter>
        <div className="app">
          <header>
            <div className="brand">
              <div className="logo">↻</div>
              <div><b>ReSync</b><span>Field Inspection Platform</span></div>
            </div>
            
            <IdentitySelector />

            <div className="nav-links">
              {actor === 'Supervisor' ? (
                <Link to="/supervisor">Dashboard</Link>
              ) : (
                <Link to="/inspections">My Inspections</Link>
              )}
            </div>

            <div className={'net ' + (online ? 'online' : 'offline')}>
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              {online ? 'Online' : 'Offline'}
              {pendingSync > 0 && <span className="sync-badge">{pendingSync}</span>}
            </div>
          </header>
          
          <main>
            <Routes>
              <Route path="/" element={<Navigate to={actor === 'Supervisor' ? '/supervisor' : '/inspections'} />} />
              <Route path="/inspections" element={<InspectorDashboard />} />
              <Route path="/inspections/:id" element={<InspectionDetail />} />
              <Route path="/supervisor" element={<SupervisorDashboard />} />
              <Route path="/conflicts/:id" element={<ConflictDetail />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  );
}
