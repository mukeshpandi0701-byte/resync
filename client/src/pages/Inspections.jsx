import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, MoreHorizontal, CheckCircle2, Clock, AlertTriangle, RefreshCw, Eye, ListFilter, Users, FileText, Camera, History } from 'lucide-react';
import { db, seed } from '../db';

export default function Inspections() {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const loadInspections = async () => {
      let list = await db.inspections.toArray();
      if (list.length === 0) {
        await db.inspections.put(seed);
        list = [seed];
      }
      setInspections(list);
    };
    loadInspections();
  }, []);

  const getStatusPill = (status) => {
    switch (status) {
      case 'completed':
        return <span className="status-pill completed"><span className="status-dot"></span> Completed</span>;
      case 'in_progress':
      case 'assigned':
        return <span className="status-pill in-progress"><span className="status-dot"></span> In Progress</span>;
      case 'under_review':
        return <span className="status-pill under-review"><span className="status-dot"></span> Under Review</span>;
      case 'reinspection_requested':
      case 'reinspection':
        return <span className="status-pill reinspection"><span className="status-dot"></span> Re-inspection</span>;
      default:
        return <span className="status-pill in-progress"><span className="status-dot"></span> In Progress</span>;
    }
  };

  // Mock demo rows if list is small to visually match Screenshot 4 perfectly
  const displayRows = inspections.length >= 5 ? inspections : [
    ...inspections,
    { id: 'ins-2', title: 'Water Pipeline', site: 'Sector 3', status: 'in_progress', version: 2, updatedAt: Date.now() - 3600000, technician: 'Arun S', dateStr: '22 Sep 2026 09:15 AM' },
    { id: 'ins-3', title: 'Electrical Unit', site: 'Zone B', status: 'under_review', version: 1, updatedAt: Date.now() - 7200000, technician: 'Manoj P', dateStr: '21 Sep 2026 04:20 PM' },
    { id: 'ins-4', title: 'Public Park Safety', site: 'Ward 12', status: 'reinspection_requested', version: 3, updatedAt: Date.now() - 10800000, technician: 'Suresh K', dateStr: '21 Sep 2026 11:05 AM' },
    { id: 'ins-5', title: 'Street Light Inspection', site: 'Zone A', status: 'completed', version: 1, updatedAt: Date.now() - 14400000, technician: 'Lokesh D', dateStr: '20 Sep 2026 02:18 PM' },
  ];

  const filtered = displayRows.filter(i => {
    const matchesSearch = i.title?.toLowerCase().includes(searchTerm.toLowerCase()) || i.site?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="inspections-page">
      <div className="page-title-row">
        <div>
          <h1>Inspections</h1>
          <p>View technician inspections and manage workflow.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/inspections/inspection-001')}>
          <Plus size={16} /> New Inspection
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-icon-box"><ListFilter size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-number">24</span>
            <span className="kpi-label">Total Inspections</span>
            <span className="kpi-trend up">↑ 12% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><RefreshCw size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-number">8</span>
            <span className="kpi-label">In Progress</span>
            <span className="kpi-trend up">↑ 14% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><CheckCircle2 size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-number">10</span>
            <span className="kpi-label">Completed</span>
            <span className="kpi-trend up">↑ 25% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><AlertTriangle size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-number">3</span>
            <span className="kpi-label">Under Review</span>
            <span className="kpi-trend neutral">↑ 0% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><RefreshCw size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-number">3</span>
            <span className="kpi-label">Re-inspection</span>
            <span className="kpi-trend up">↑ 8% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Filtered Table + Right Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: 20 }}>
        <div>
          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-input">
              <Search size={14} />
              <input 
                type="text" 
                placeholder="Search inspections..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            
            <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="under_review">Under Review</option>
              <option value="reinspection_requested">Re-inspection</option>
            </select>

            <select className="filter-select">
              <option>All Technicians</option>
              <option>Ravi Kumar</option>
              <option>Arun S</option>
              <option>Manoj P</option>
            </select>

            <div className="filter-input" style={{ minWidth: 160 }}>
              <Calendar size={14} />
              <input type="text" placeholder="Start Date - End Date" />
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Technician</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Media</th>
                  <th style={{ width: 40 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const techName = item.technician || (item.history?.at(-1)?.actor) || 'Ravi Kumar';
                  const initials = techName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  return (
                    <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/inspections/${item.id}`)}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="user-col">
                          <div className="user-avatar-sm">{initials}</div>
                          <span style={{ fontWeight: 600 }}>{techName}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#697386' }}>{item.site}</div>
                      </td>
                      <td style={{ fontSize: 12, color: '#697386' }}>{item.dateStr || '22 Sep 2026 10:30 AM'}</td>
                      <td>{getStatusPill(item.status)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 14 }}>📷📷</span>
                          <span style={{ fontSize: 11, background: '#FFF7F5', border: '1px solid #E8E3E1', padding: '1px 5px', borderRadius: 4, color: '#697386', fontWeight: 600 }}>+2</span>
                        </div>
                      </td>
                      <td>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#697386' }}>
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="table-footer">
              <span>Showing 1 to {filtered.length} of 24 inspections</span>
              <div className="pagination">
                <button className="page-btn active">1</button>
                <button className="page-btn">2</button>
                <button className="page-btn">3</button>
                <button className="page-btn">4</button>
                <button className="page-btn">5</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Panels */}
        <div>
          <div className="card">
            <h3 className="card-title" style={{ fontSize: 14, marginBottom: 14 }}>Status Indicators</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="status-dot" style={{ background: '#18A96B', marginTop: 5 }}></span>
                <div>
                  <div style={{ fontWeight: 700, color: '#182235' }}>Completed</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Inspection successfully completed</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="status-dot" style={{ background: '#3285E8', marginTop: 5 }}></span>
                <div>
                  <div style={{ fontWeight: 700, color: '#182235' }}>In Progress</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Inspection is in progress</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="status-dot" style={{ background: '#E6A21A', marginTop: 5 }}></span>
                <div>
                  <div style={{ fontWeight: 700, color: '#182235' }}>Under Review</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Awaiting verification / review</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="status-dot" style={{ background: '#D92F45', marginTop: 5 }}></span>
                <div>
                  <div style={{ fontWeight: 700, color: '#182235' }}>Re-inspection</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Needs re-inspection</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: 14 }}>Recent Activity</h3>
              <Link to="/audit-history" style={{ fontSize: 11, color: '#D92F45', textDecoration: 'none', fontWeight: 600 }}>View All</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#E8F8F0', color: '#18A96B', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={12} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#182235' }}>Inspection completed</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Ravi Kumar - Solar Panel Site</div>
                  <span style={{ fontSize: 10, color: '#949EA9' }}>2 hours ago</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EBF3FC', color: '#3285E8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Camera size={12} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#182235' }}>Media added</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Arun S - Water Pipeline</div>
                  <span style={{ fontSize: 10, color: '#949EA9' }}>4 hours ago</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FEF6E7', color: '#E6A21A', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Clock size={12} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#182235' }}>Under review</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Manoj P - Electrical Unit</div>
                  <span style={{ fontSize: 10, color: '#949EA9' }}>6 hours ago</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <RefreshCw size={12} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#D92F45' }}>Re-inspection assigned</div>
                  <div style={{ fontSize: 11, color: '#697386' }}>Suresh K - Public Park</div>
                  <span style={{ fontSize: 10, color: '#949EA9' }}>1 day ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Functional Shortcuts Row */}
      <div className="shortcuts-grid">
        <div className="shortcut-card" onClick={() => setStatusFilter('ALL')}>
          <div className="shortcut-icon"><ListFilter size={16} /></div>
          <div className="shortcut-title">All Inspections</div>
          <div className="shortcut-desc">Search, filter and view status</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><Users size={16} /></div>
          <div className="shortcut-title">Technician-wise View</div>
          <div className="shortcut-desc">View by name, location, date, status</div>
        </div>
        <div className="shortcut-card" onClick={() => navigate('/inspections/inspection-001')}>
          <div className="shortcut-icon"><FileText size={16} /></div>
          <div className="shortcut-title">Inspection Details</div>
          <div className="shortcut-desc">Checklist, notes and media</div>
        </div>
        <div className="shortcut-card" onClick={() => navigate('/conflicts/conflict-001')}>
          <div className="shortcut-icon"><AlertTriangle size={16} /></div>
          <div className="shortcut-title">Conflict Handling</div>
          <div className="shortcut-desc">Side-by-side comparison</div>
        </div>
        <div className="shortcut-card" onClick={() => setStatusFilter('under_review')}>
          <div className="shortcut-icon"><Clock size={16} /></div>
          <div className="shortcut-title">Under Review</div>
          <div className="shortcut-desc">View inspections under review</div>
        </div>
        <div className="shortcut-card" onClick={() => setStatusFilter('reinspection_requested')}>
          <div className="shortcut-icon"><RefreshCw size={16} /></div>
          <div className="shortcut-title">Re-inspection Workflow</div>
          <div className="shortcut-desc">Assign and track status</div>
        </div>
        <div className="shortcut-card" onClick={() => navigate('/media-analysis')}>
          <div className="shortcut-icon"><Camera size={16} /></div>
          <div className="shortcut-title">Media</div>
          <div className="shortcut-desc">View media attached to each inspection</div>
        </div>
        <div className="shortcut-card" onClick={() => navigate('/audit-history')}>
          <div className="shortcut-icon"><History size={16} /></div>
          <div className="shortcut-title">History / Timeline</div>
          <div className="shortcut-desc">View timeline of changes</div>
        </div>
      </div>
    </div>
  );
}
