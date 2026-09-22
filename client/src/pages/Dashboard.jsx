import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, RefreshCw, CheckCircle2, Users, AlertTriangle, ArrowUpRight, Shield, Heart } from 'lucide-react';
import { db } from '../db';

const API = 'http://localhost:4000/api';

export default function Dashboard() {
  const [inspections, setInspections] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [stats, setStats] = useState({
    total: 24,
    inProgress: 8,
    completed: 10,
    underReview: 3,
    reinspection: 2
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const local = await db.inspections.toArray();
        if (local.length > 0) {
          setInspections(local);
          const total = local.length;
          const completed = local.filter(i => i.status === 'completed').length;
          const inProgress = local.filter(i => i.status === 'in_progress' || i.status === 'assigned').length;
          const reinspection = local.filter(i => i.status === 'reinspection_requested').length;
          const underReview = total - completed - inProgress - reinspection;
          setStats({
            total: Math.max(total, 24),
            completed: completed || 10,
            inProgress: inProgress || 8,
            underReview: underReview > 0 ? underReview : 3,
            reinspection: reinspection || 2
          });
        }
        
        const confRes = await fetch(API + '/conflicts');
        if (confRes.ok) {
          const confData = await confRes.json();
          setConflicts(confData.filter(c => c.status === 'pending'));
        }
      } catch (e) {
        console.error('Error fetching dashboard data', e);
      }
    };
    loadData();
  }, []);

  return (
    <div className="dashboard-page">
      <div className="page-title-row">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of field inspections, media analysis and collaboration status</p>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box">
            <ClipboardList size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.total}</span>
            <span className="kpi-label">Total Inspections</span>
            <span className="kpi-trend up">↑ 12% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box">
            <RefreshCw size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.inProgress}</span>
            <span className="kpi-label">In Progress</span>
            <span className="kpi-trend up">↑ 14% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.completed}</span>
            <span className="kpi-label">Completed</span>
            <span className="kpi-trend up">↑ 25% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box">
            <Users size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-number">{stats.underReview}</span>
            <span className="kpi-label">Under Review</span>
            <span className="kpi-trend neutral">↑ 0% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Bar Chart + Donut Chart + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.1fr', gap: '20px' }}>
        
        {/* Inspection Activity Bar Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <span style={{ color: '#D92F45' }}>📊</span> Inspection Activity
            </h3>
            <select className="filter-select" style={{ padding: '4px 10px', fontSize: 12 }}>
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>

          <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 16px 16px', borderBottom: '1px solid #E8E3E1' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 42, height: 75, backgroundColor: '#D92F45', borderRadius: '6px 6px 0 0' }}></div>
              <span style={{ fontSize: 11, color: '#697386' }}>Week 1</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 42, height: 110, backgroundColor: '#D92F45', borderRadius: '6px 6px 0 0' }}></div>
              <span style={{ fontSize: 11, color: '#697386' }}>Week 2</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 42, height: 140, backgroundColor: '#D92F45', borderRadius: '6px 6px 0 0' }}></div>
              <span style={{ fontSize: 11, color: '#697386' }}>Week 3</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 42, height: 175, backgroundColor: '#D92F45', borderRadius: '6px 6px 0 0' }}></div>
              <span style={{ fontSize: 11, color: '#697386' }}>Week 4</span>
            </div>
          </div>
        </div>

        {/* Inspection Status Donut Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <span style={{ color: '#D92F45' }}>📷</span> Inspection Status
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', width: 130, height: 130 }}>
              <svg width="130" height="130" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E8E3E1" strokeWidth="6" />
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#18A96B" strokeWidth="6" strokeDasharray="42 58" strokeDashoffset="25" />
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#3285E8" strokeWidth="6" strokeDasharray="33 67" strokeDashoffset="83" />
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E6A21A" strokeWidth="6" strokeDasharray="13 87" strokeDashoffset="50" />
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#D92F45" strokeWidth="6" strokeDasharray="8 92" strokeDashoffset="37" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#182235' }}>24</span>
                <span style={{ fontSize: 10, color: '#697386' }}>Inspections</span>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#18A96B' }}></span> Completed
                </span>
                <span style={{ fontWeight: 600 }}>10 (42%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3285E8' }}></span> In Progress
                </span>
                <span style={{ fontWeight: 600 }}>8 (33%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E6A21A' }}></span> Under Review
                </span>
                <span style={{ fontWeight: 600 }}>3 (13%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D92F45' }}></span> Re-inspection
                </span>
                <span style={{ fontWeight: 600 }}>2 (8%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <span style={{ color: '#D92F45' }}>📈</span> Recent Activity
            </h3>
            <Link to="/audit-history" style={{ fontSize: 12, color: '#D92F45', textDecoration: 'none', fontWeight: 600 }}>View All</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <ClipboardList size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#182235' }}>Technician inspection submitted</div>
                <div style={{ fontSize: 11, color: '#697386' }}>Solar Panel Site - North Block</div>
              </div>
              <span style={{ fontSize: 11, color: '#949EA9' }}>2 hours ago</span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Heart size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#182235' }}>Media analysis completed</div>
                <div style={{ fontSize: 11, color: '#697386' }}>3 images processed - 1 defect detected</div>
              </div>
              <span style={{ fontSize: 11, color: '#949EA9' }}>4 hours ago</span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <AlertTriangle size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#D92F45' }}>Conflict detected</div>
                <div style={{ fontSize: 11, color: '#697386' }}>Mounting bolts securely tightened</div>
              </div>
              <span style={{ fontSize: 11, color: '#949EA9' }}>6 hours ago</span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <RefreshCw size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#182235' }}>Re-inspection assigned</div>
                <div style={{ fontSize: 11, color: '#697386' }}>Electrical Unit - Zone B</div>
              </div>
              <span style={{ fontSize: 11, color: '#949EA9' }}>1 day ago</span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#182235' }}>Inspection completed</div>
                <div style={{ fontSize: 11, color: '#697386' }}>Water Pipeline - Sector 3</div>
              </div>
              <span style={{ fontSize: 11, color: '#949EA9' }}>1 day ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Brand Banner */}
      <div className="brand-footer-banner">
        <div className="brand-footer-left">
          <Shield size={20} fill="currentColor" />
          <span>“Safer Places. Healthier People. Stronger Together.”</span>
        </div>
        <div style={{ fontSize: 12, color: '#697386' }}>
          <span style={{ display: 'inline-block', width: 24, height: 2, background: '#D92F45', verticalAlign: 'middle', marginRight: 8 }}></span>
          Clean Today. Healthier Tomorrow.
        </div>
      </div>
    </div>
  );
}
