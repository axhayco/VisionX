import React from 'react'

function formatRelative(dateString) {
  try {
    const d = new Date(dateString)
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return dateString
  }
}

export default function DashboardPage({ reports, currentRole, onNavigate }) {
  // Stats
  const total = reports.length
  const critical = reports.filter(r => r.priority === 'Critical').length
  const urgent = reports.filter(r => r.priority === 'Urgent').length
  const normal = reports.filter(r => r.priority === 'Normal').length
  const pending = critical + urgent

  // Get recent 5 reports
  const recentReports = [...reports]
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .slice(0, 5)

  return (
    <div className="dashboard-page-container">
      {/* ─── GREETING HEADER ─── */}
      <div className="dashboard-welcome-banner">
        <div className="welcome-text-side">
          <h2>Welcome back, Clinician 👋</h2>
          <p>Here's a summary of the hospital's lab specimen and triage activity today.</p>
        </div>
        <div className="welcome-role-pill">
          <span className="pulse-dot" />
          <span>Active Role: {currentRole === 'doctor' ? 'On-Call Physician' : 'Lab Assistant'}</span>
        </div>
      </div>

      {/* ─── KPI STATISTICS GRID ─── */}
      <div className="dashboard-kpi-grid">
        <div className="kpi-card-light total-card">
          <div className="kpi-icon-wrap">📋</div>
          <div className="kpi-info">
            <span className="kpi-num">{total}</span>
            <span className="kpi-label">Total Reports</span>
          </div>
        </div>

        <div className={`kpi-card-light critical-card ${critical > 0 ? 'active-critical' : ''}`}>
          <div className="kpi-icon-wrap">🚨</div>
          <div className="kpi-info">
            <span className="kpi-num">{critical}</span>
            <span className="kpi-label">Critical Alerts</span>
          </div>
        </div>

        <div className="kpi-card-light urgent-card">
          <div className="kpi-icon-wrap">🟠</div>
          <div className="kpi-info">
            <span className="kpi-num">{urgent}</span>
            <span className="kpi-label">Urgent Queue</span>
          </div>
        </div>

        <div className="kpi-card-light normal-card">
          <div className="kpi-icon-wrap">✅</div>
          <div className="kpi-info">
            <span className="kpi-num">{normal}</span>
            <span className="kpi-label">Healthy Panels</span>
          </div>
        </div>
      </div>

      {/* ─── DASHBOARD SECONDARY CONTENT ─── */}
      <div className="dashboard-content-split">
        {/* Recent Ingestion Activity */}
        <div className="dashboard-activity-panel card-panel">
          <div className="panel-header-row">
            <h3>Recent Specimen Activity</h3>
            <button className="text-link-btn" onClick={() => onNavigate('reports')}>
              View All Queue ➔
            </button>
          </div>

          {recentReports.length === 0 ? (
            <div className="empty-activity">
              <span>No recent activities. Upload a file to get started.</span>
            </div>
          ) : (
            <div className="activity-list">
              {recentReports.map(report => (
                <div key={report.id} className="activity-item-row" onClick={() => onNavigate('reports')}>
                  <div className={`activity-avatar badge-dot-${report.priority.toLowerCase()}`}>
                    {report.patient_name.charAt(0)}
                  </div>
                  <div className="activity-details">
                    <span className="activity-patient-name">{report.patient_name}</span>
                    <span className="activity-time">{formatRelative(report.submitted_at)}</span>
                  </div>
                  <div className="activity-status-column">
                    <span className={`badge ${report.priority}`}>{report.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Operations & RAI Hub */}
        <div className="dashboard-operations-panel card-panel">
          <h3>System Analytics & Parameters</h3>
          <div className="ops-metrics">
            <div className="ops-tile">
              <span className="ops-label">AI Extraction Engine</span>
              <span className="ops-val online-txt">ACTIVE</span>
            </div>
            <div className="ops-tile">
              <span className="ops-label">Avg Extraction Time</span>
              <span className="ops-val">0.85s</span>
            </div>
            <div className="ops-tile">
              <span className="ops-label">Extraction Accuracy</span>
              <span className="ops-val">98.2%</span>
            </div>
          </div>

          <div className="quick-actions-box">
            <h4>Quick Shortcuts</h4>
            <div className="shortcut-buttons">
              {currentRole === 'lab_assistant' ? (
                <button className="shortcut-btn primary-btn" onClick={() => onNavigate('analyzer')}>
                  🔬 Ingest New Specimen
                </button>
              ) : (
                <button className="shortcut-btn primary-btn" onClick={() => onNavigate('reports')}>
                  🩺 View Triage Queue
                </button>
              )}
              <button className="shortcut-btn secondary-btn" onClick={() => onNavigate('settings')}>
                ⚙️ Threshold Config
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
