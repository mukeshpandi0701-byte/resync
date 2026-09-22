import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Calendar, MoreHorizontal, History, RefreshCw, AlertTriangle, Users, FileText, Download, BarChart2, Link as LinkIcon, Filter } from 'lucide-react';
import { db } from '../db';

const API = 'http://localhost:4000/api';

export default function AuditHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalInspections: 256, reinspections: 32, conflicts: 14, activeUsers: 18 });

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const res = await fetch(API + '/inspections');
        if (res.ok) {
          const data = await res.json();
          let extracted = [];
          data.forEach(ins => {
            if (ins.history) {
              ins.history.forEach(h => {
                extracted.push({
                  id: `${ins.id}-${h.at}`,
                  user: h.actor || 'Inspector',
                  action: h.action || 'Updated',
                  details: `Action on ${ins.title}`,
                  relatedInspection: ins.id,
                  timestamp: new Date(h.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                });
              });
            }
          });
          if (extracted.length > 0) setLogs(extracted);
        }
      } catch (e) {
        console.error('Error fetching audit logs', e);
      }
    };
    fetchAudits();
  }, []);

  const defaultAuditRows = [
    { id: 1, user: 'Ravi Kumar', initials: 'RK', action: 'Created', actionColor: '#E8F8F0', actionTextColor: '#18A96B', details: 'New inspection created', relatedInspection: 'INS-2026-001', timestamp: '22 Sep 2026 10:30 AM' },
    { id: 2, user: 'Arun S', initials: 'AS', action: 'Updated', actionColor: '#EBF3FC', actionTextColor: '#3285E8', details: 'Inspection details updated', relatedInspection: 'INS-2026-002', timestamp: '22 Sep 2026 09:15 AM' },
    { id: 3, user: 'Manoj P', initials: 'MP', action: 'Media Sync', actionColor: '#F3E8FF', actionTextColor: '#9333EA', details: 'Uploaded 3 images', relatedInspection: 'INS-2026-003', timestamp: '21 Sep 2026 04:20 PM' },
    { id: 4, user: 'Suresh K', initials: 'SK', action: 'Resolved', actionColor: '#E8F8F0', actionTextColor: '#18A96B', details: 'Conflict resolved', relatedInspection: 'INS-2026-004', timestamp: '21 Sep 2026 11:05 AM' },
    { id: 5, user: 'Lokesh D', initials: 'LD', action: 'Assigned', actionColor: '#FEF6E7', actionTextColor: '#E6A21A', details: 'Re-inspection assigned', relatedInspection: 'INS-2026-005', timestamp: '20 Sep 2026 02:18 PM' },
    { id: 6, user: 'Priya R', initials: 'PR', action: 'Deleted', actionColor: '#FCEBEC', actionTextColor: '#D92F45', details: 'Media removed', relatedInspection: 'INS-2026-006', timestamp: '20 Sep 2026 11:40 AM' },
    { id: 7, user: 'Vignesh S', initials: 'VS', action: 'Viewed', actionColor: '#F1F5F9', actionTextColor: '#64748B', details: 'Viewed inspection', relatedInspection: 'INS-2026-003', timestamp: '19 Sep 2026 09:12 AM' },
    { id: 8, user: 'Karthik A', initials: 'KA', action: 'Sync', actionColor: '#F3E8FF', actionTextColor: '#9333EA', details: 'Data synced from field', relatedInspection: 'INS-2026-002', timestamp: '19 Sep 2026 05:26 PM' },
  ];

  const displayRows = logs.length >= 5 ? logs : defaultAuditRows;

  return (
    <div className="audit-history-page">
      <div className="page-title-row">
        <div>
          <h1>Audit History</h1>
          <p>Track all activities and maintain transparency.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box"><FileText size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.totalInspections}</span>
            <span className="kpi-label">Total Inspections</span>
            <span className="kpi-trend up">↑ 12% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><RefreshCw size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.reinspections}</span>
            <span className="kpi-label">Re-inspections</span>
            <span className="kpi-trend up">↑ 8% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><AlertTriangle size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.conflicts}</span>
            <span className="kpi-label">Conflicts</span>
            <span className="kpi-trend neutral">↑ 5% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><Users size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.activeUsers}</span>
            <span className="kpi-label">Active Users</span>
            <span className="kpi-trend up">↑ 20% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="filter-bar">
        <div className="filter-input">
          <Search size={14} />
          <input type="text" placeholder="Search audit logs..." />
        </div>
        
        <select className="filter-select">
          <option>All Inspections</option>
        </select>

        <select className="filter-select">
          <option>All Users</option>
        </select>

        <select className="filter-select">
          <option>All Action Types</option>
        </select>

        <div className="filter-input" style={{ minWidth: 180 }}>
          <Calendar size={14} />
          <input type="text" placeholder="Start Date - End Date" />
        </div>

        <button className="btn-primary" style={{ padding: '8px 16px' }}>Apply</button>
      </div>

      {/* Main Grid: Activity Timeline + Right Side Visuals */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: 20 }}>
        <div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8E3E1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color="#D92F45" />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Activity Timeline</h3>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Related Inspection</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => {
                  const uInit = row.initials || row.user?.substring(0, 2).toUpperCase() || 'RK';
                  return (
                    <tr key={row.id || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="user-col">
                          <div className="user-avatar-sm">{uInit}</div>
                          <span style={{ fontWeight: 600 }}>{row.user}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          background: row.actionColor || '#E8F8F0', 
                          color: row.actionTextColor || '#18A96B', 
                          padding: '3px 10px', 
                          borderRadius: 12, 
                          fontSize: 11, 
                          fontWeight: 700 
                        }}>
                          {row.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{row.details}</td>
                      <td style={{ color: '#D92F45', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/inspections/inspection-001')}>
                        {row.relatedInspection}
                      </td>
                      <td style={{ fontSize: 11, color: '#697386' }}>{row.timestamp}</td>
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
              <span>Showing 1 to 8 of 256 audit logs</span>
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

        {/* Right Side Visual Panels */}
        <div>
          {/* Actions by Type Bar Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: 14 }}>Actions by Type</h3>
              <select className="filter-select" style={{ padding: '2px 6px', fontSize: 11 }}>
                <option>This Month</option>
              </select>
            </div>

            <div style={{ height: 130, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 8px 8px', borderBottom: '1px solid #E8E3E1' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>45</span>
                <div style={{ width: 20, height: 50, background: '#FCA5A5', borderRadius: '4px 4px 0 0' }}></div>
                <span style={{ fontSize: 9, color: '#697386' }}>Create</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>68</span>
                <div style={{ width: 20, height: 75, background: '#3285E8', borderRadius: '4px 4px 0 0' }}></div>
                <span style={{ fontSize: 9, color: '#697386' }}>Update</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>32</span>
                <div style={{ width: 20, height: 35, background: '#A855F7', borderRadius: '4px 4px 0 0' }}></div>
                <span style={{ fontSize: 9, color: '#697386' }}>Sync</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>28</span>
                <div style={{ width: 20, height: 30, background: '#18A96B', borderRadius: '4px 4px 0 0' }}></div>
                <span style={{ fontSize: 9, color: '#697386' }}>Resolve</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>12</span>
                <div style={{ width: 20, height: 15, background: '#E6A21A', borderRadius: '4px 4px 0 0' }}></div>
                <span style={{ fontSize: 9, color: '#697386' }}>Delete</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>71</span>
                <div style={{ width: 20, height: 80, background: '#64748B', borderRadius: '4px 4px 0 0' }}></div>
                <span style={{ fontSize: 9, color: '#697386' }}>View</span>
              </div>
            </div>
          </div>

          {/* Top Users by Activity */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: 14 }}>Top Users by Activity</h3>
              <select className="filter-select" style={{ padding: '2px 6px', fontSize: 11 }}>
                <option>This Month</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, width: 20 }}>RK</span>
                <span style={{ width: 70 }}>Ravi Kumar</span>
                <div style={{ flex: 1, background: '#E8E3E1', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: '90%', height: '100%', background: '#D92F45' }}></div>
                </div>
                <span style={{ fontWeight: 700, width: 20, textAlign: 'right' }}>72</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, width: 20 }}>AS</span>
                <span style={{ width: 70 }}>Arun S</span>
                <div style={{ flex: 1, background: '#E8E3E1', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: '70%', height: '100%', background: '#3285E8' }}></div>
                </div>
                <span style={{ fontWeight: 700, width: 20, textAlign: 'right' }}>56</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, width: 20 }}>MP</span>
                <span style={{ width: 70 }}>Manoj P</span>
                <div style={{ flex: 1, background: '#E8E3E1', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: '50%', height: '100%', background: '#A855F7' }}></div>
                </div>
                <span style={{ fontWeight: 700, width: 20, textAlign: 'right' }}>38</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, width: 20 }}>SK</span>
                <span style={{ width: 70 }}>Suresh K</span>
                <div style={{ flex: 1, background: '#E8E3E1', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: '38%', height: '100%', background: '#18A96B' }}></div>
                </div>
                <span style={{ fontWeight: 700, width: 20, textAlign: 'right' }}>28</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, width: 20 }}>LD</span>
                <span style={{ width: 70 }}>Lokesh D</span>
                <div style={{ flex: 1, background: '#E8E3E1', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: '30%', height: '100%', background: '#E6A21A' }}></div>
                </div>
                <span style={{ fontWeight: 700, width: 20, textAlign: 'right' }}>24</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Shortcuts */}
      <div className="shortcuts-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="shortcut-card">
          <div className="shortcut-icon"><FileText size={16} /></div>
          <div className="shortcut-title">View Detailed Logs</div>
          <div className="shortcut-desc">Full activity records</div>
        </div>
        <div className="shortcut-card" onClick={() => navigate('/inspections/inspection-001')}>
          <div className="shortcut-icon"><LinkIcon size={16} /></div>
          <div className="shortcut-title">View Related Inspection</div>
          <div className="shortcut-desc">Open inspection from log</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><Download size={16} /></div>
          <div className="shortcut-title">Export Report</div>
          <div className="shortcut-desc">PDF / Excel</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><BarChart2 size={16} /></div>
          <div className="shortcut-title">Summary Charts</div>
          <div className="shortcut-desc">Actions by type, by user</div>
        </div>
      </div>
    </div>
  );
}
