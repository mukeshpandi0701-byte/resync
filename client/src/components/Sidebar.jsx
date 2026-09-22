import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Camera, History, Settings, Shield } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-header">
          <div className="brand-icon-shield">
            <Shield size={22} fill="currentColor" />
          </div>
          <div className="brand-text">
            <h1>ReSync</h1>
            <span>Offline Inspections<br />Stronger Together</span>
          </div>
        </div>

        <nav className="nav-menu">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/inspections" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ClipboardList size={18} />
            <span>Inspections</span>
          </NavLink>
          <NavLink to="/media-analysis" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Camera size={18} />
            <span>Media Analysis</span>
          </NavLink>
          <NavLink to="/audit-history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <History size={18} />
            <span>Audit History</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-quote">Field Work Never Stops</div>
        <div className="sidebar-subquote">ReSync Keeps You Aligned</div>
        <div className="sidebar-accent-line"></div>
      </div>
    </aside>
  );
}
