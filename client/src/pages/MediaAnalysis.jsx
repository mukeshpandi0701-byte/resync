import React, { useState, useEffect } from 'react';
import { Upload, Search, Calendar, MoreHorizontal, Camera, CheckCircle2, Clock, AlertTriangle, FileText, Download, Filter, History, Eye, Link as LinkIcon } from 'lucide-react';

const API = 'http://localhost:4000/api';

export default function MediaAnalysis() {
  const [analyses, setAnalyses] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        const res = await fetch(API + '/evidence/analyses');
        if (res.ok) {
          const data = await res.json();
          setAnalyses(data);
        }
      } catch (e) {
        console.error('Error fetching media analyses', e);
      }
    };
    fetchAnalyses();
  }, []);

  const defaultMediaRows = [
    { id: 'm1', fileName: 'road_crack_01.jpg', type: 'image', linkedInspection: 'INS-2026-001', defectType: 'Crack', status: 'completed', confidence: '92%', addedOn: '22 Sep 2026 10:30 AM', thumbnail: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=120&q=80' },
    { id: 'm2', fileName: 'pothole_02.jpg', type: 'image', linkedInspection: 'INS-2026-002', defectType: 'Pothole', status: 'processing', confidence: '--', addedOn: '22 Sep 2026 09:15 AM', thumbnail: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=120&q=80' },
    { id: 'm3', fileName: 'corrosion_03.jpg', type: 'image', linkedInspection: 'INS-2026-003', defectType: 'Corrosion', status: 'pending', confidence: '--', addedOn: '21 Sep 2026 04:20 PM', thumbnail: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=120&q=80' },
    { id: 'm4', fileName: 'panel_damage.mp4', type: 'video', linkedInspection: 'INS-2026-004', defectType: 'Damage', status: 'completed', confidence: '88%', addedOn: '21 Sep 2026 11:05 AM', thumbnail: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=120&q=80' },
    { id: 'm5', fileName: 'leak_05.jpg', type: 'image', linkedInspection: 'INS-2026-005', defectType: 'Leakage', status: 'completed', confidence: '95%', addedOn: '20 Sep 2026 02:18 PM', thumbnail: 'https://images.unsplash.com/photo-1542013936693-884638332954?auto=format&fit=crop&w=120&q=80' },
  ];

  const currentSelection = selectedItem || defaultMediaRows[0];

  return (
    <div className="media-analysis-page">
      <div className="page-title-row">
        <div>
          <h1>Media Analysis</h1>
          <p>AI analysis of images/videos and reports.</p>
        </div>
        <button className="btn-primary">
          <Upload size={16} /> Upload Media
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box"><Camera size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">112</span>
            <span className="kpi-label">Total Media</span>
            <span className="kpi-trend up">↑ 18% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><Clock size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">16</span>
            <span className="kpi-label">Processing</span>
            <span className="kpi-trend up">↑ 6% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><CheckCircle2 size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">82</span>
            <span className="kpi-label">Completed</span>
            <span className="kpi-trend up">↑ 25% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box"><AlertTriangle size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-number">14</span>
            <span className="kpi-label">Issues Detected</span>
            <span className="kpi-trend up">↑ 12% <span style={{ color: '#697386', fontWeight: 400 }}>from last month</span></span>
          </div>
        </div>
      </div>

      {/* Main Filter Bar */}
      <div className="filter-bar">
        <div className="filter-input">
          <Search size={14} />
          <input type="text" placeholder="Search media..." />
        </div>
        
        <select className="filter-select">
          <option>All Status</option>
          <option>Completed</option>
          <option>Processing</option>
          <option>Pending</option>
        </select>

        <select className="filter-select">
          <option>All Defect Types</option>
          <option>Crack</option>
          <option>Pothole</option>
          <option>Corrosion</option>
          <option>Damage</option>
          <option>Leakage</option>
        </select>

        <select className="filter-select">
          <option>All Locations</option>
        </select>

        <div className="filter-input" style={{ minWidth: 180 }}>
          <Calendar size={14} />
          <input type="text" placeholder="Start Date - End Date" />
        </div>

        <button className="btn-primary" style={{ padding: '8px 16px' }}>Apply</button>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: 20 }}>
        <div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Preview</th>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Linked Inspection</th>
                  <th>Defect Type</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Added On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {defaultMediaRows.map((row, idx) => (
                  <tr 
                    key={row.id} 
                    style={{ cursor: 'pointer', backgroundColor: currentSelection.id === row.id ? '#FFF7F5' : 'transparent' }}
                    onClick={() => setSelectedItem(row)}
                  >
                    <td>{idx + 1}</td>
                    <td>
                      <img src={row.thumbnail} alt={row.fileName} style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover' }} />
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.fileName}</td>
                    <td><Camera size={14} color="#D92F45" /></td>
                    <td style={{ color: '#D92F45', fontWeight: 600 }}>{row.linkedInspection}</td>
                    <td>
                      <span style={{ background: '#FCEBEC', color: '#D92F45', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                        {row.defectType}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${row.status}`}>
                        <span className="status-dot"></span> {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{row.confidence}</td>
                    <td style={{ fontSize: 11, color: '#697386' }}>{row.addedOn}</td>
                    <td>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#697386' }}>
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">
              <span>Showing 1 to 5 of 112 media files</span>
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

        {/* Right Sidebar */}
        <div>
          <div className="card">
            <h3 className="card-title" style={{ fontSize: 14, marginBottom: 14 }}>Analysis Preview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <img src={currentSelection.thumbnail} alt={currentSelection.fileName} style={{ width: '100%', height: 130, borderRadius: 10, objectFit: 'cover' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{currentSelection.fileName}</div>
                <div style={{ fontSize: 12, color: '#697386' }}>{currentSelection.linkedInspection}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ background: '#FCEBEC', color: '#D92F45', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                  {currentSelection.defectType}
                </span>
                <span style={{ fontSize: 12, color: '#18A96B', fontWeight: 700 }}>
                  Confidence: {currentSelection.confidence}
                </span>
              </div>
              <button className="btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                <Eye size={14} /> View Detailed Analysis
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ fontSize: 14, marginBottom: 14 }}>Report & Export</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, background: '#FFF7F5', border: '1px solid #E8E3E1', cursor: 'pointer' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center' }}>
                  <FileText size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Generate Report</div>
                  <div style={{ fontSize: 10, color: '#697386' }}>Export analysis data (PDF/Excel)</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, background: '#FFF7F5', border: '1px solid #E8E3E1', cursor: 'pointer' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FCEBEC', color: '#D92F45', display: 'grid', placeItems: 'center' }}>
                  <Download size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Report History</div>
                  <div style={{ fontSize: 10, color: '#697386' }}>View and download previous reports</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Shortcuts */}
      <div className="shortcuts-grid">
        <div className="shortcut-card">
          <div className="shortcut-icon"><Upload size={16} /></div>
          <div className="shortcut-title">Upload Media</div>
          <div className="shortcut-desc">Image / Video</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><Camera size={16} /></div>
          <div className="shortcut-title">AI Analysis Results</div>
          <div className="shortcut-desc">Defects, issues, confidence</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><FileText size={16} /></div>
          <div className="shortcut-title">Media List</div>
          <div className="shortcut-desc">View status (pending, processing, completed)</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><Eye size={16} /></div>
          <div className="shortcut-title">Detailed Analysis</div>
          <div className="shortcut-desc">Image + AI output</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><LinkIcon size={16} /></div>
          <div className="shortcut-title">Link to Inspection</div>
          <div className="shortcut-desc">Related inspection</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><Filter size={16} /></div>
          <div className="shortcut-title">Filters</div>
          <div className="shortcut-desc">Defect type, date, location</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><Download size={16} /></div>
          <div className="shortcut-title">Generate & Export</div>
          <div className="shortcut-desc">PDF / Excel</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><Eye size={16} /></div>
          <div className="shortcut-title">Report Preview</div>
          <div className="shortcut-desc">View and download</div>
        </div>
        <div className="shortcut-card">
          <div className="shortcut-icon"><History size={16} /></div>
          <div className="shortcut-title">Analysis History</div>
          <div className="shortcut-desc">Past analysis records</div>
        </div>
      </div>
    </div>
  );
}
