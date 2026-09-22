import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inspections from './pages/Inspections';
import InspectionDetail from './pages/InspectionDetail';
import MediaAnalysis from './pages/MediaAnalysis';
import AuditHistory from './pages/AuditHistory';
import ConflictDetail from './pages/ConflictDetail';
import Settings from './pages/Settings';
import { db, seed } from './db';
import './styles.css';

export const AppContext = React.createContext();

function AppShell({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [online, setOnline] = useState(navigator.onLine);
  const [actor, setActor] = useState(localStorage.getItem('resync_actor') || 'Supervisor');
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
      try {
        const count = await db.changes.where('status').equals('pending').count();
        setPendingSync(count);
      } catch (e) {
        // Safe catch
      }
    };
    
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
        <Routes>
          {/* Standalone Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Authenticated Application Shell Routes */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/supervisor" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
          <Route path="/inspections" element={<AppShell><Inspections /></AppShell>} />
          <Route path="/inspections/:id" element={<AppShell><InspectionDetail /></AppShell>} />
          <Route path="/media-analysis" element={<AppShell><MediaAnalysis /></AppShell>} />
          <Route path="/audit-history" element={<AppShell><AuditHistory /></AppShell>} />
          <Route path="/conflicts/:id" element={<AppShell><ConflictDetail /></AppShell>} />
          <Route path="/settings" element={<AppShell><Settings /></AppShell>} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}
