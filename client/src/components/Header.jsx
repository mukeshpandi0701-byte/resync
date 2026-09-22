import React, { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { AppContext } from '../App';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { online, actor, pendingSync } = useContext(AppContext);

  const getPlaceholder = () => {
    const path = location.pathname;
    if (path.includes('/inspections')) return 'Search inspections, technicians, locations...';
    if (path.includes('/media-analysis')) return 'Search media, inspections, locations...';
    if (path.includes('/audit-history')) return 'Search audits, users, inspections...';
    return 'Search inspections, technicians, locations, media...';
  };

  return (
    <header className="top-header">
      <div className="search-container">
        <Search size={16} />
        <input type="text" placeholder={getPlaceholder()} />
      </div>

      <div className="header-right">
        <div className="tagline-badges">
          INSPECT • COLLABORATE • RESOLVE
        </div>

        <div className={`net-badge ${online ? 'online' : 'offline'}`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{online ? 'Online' : 'Offline'}</span>
          {pendingSync > 0 && <span style={{ background: '#D92F45', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>{pendingSync}</span>}
        </div>

        <button className="notification-btn" title="Notifications">
          <Bell size={18} />
          <span className="notification-badge"></span>
        </button>

        <div className="user-profile" onClick={() => navigate('/settings')}>
          <div className="avatar-circle">
            {actor.charAt(0).toUpperCase()}
          </div>
          <span className="user-name">{actor}</span>
          <ChevronDown size={14} color="#697386" />
        </div>
      </div>
    </header>
  );
}
