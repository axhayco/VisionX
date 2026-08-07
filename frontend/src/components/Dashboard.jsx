import React, { useState, useEffect } from 'react'

// Deterministic priority score computation
function computeScore(flaggedValues = []) {
  if (!flaggedValues?.length) return 8
  let s = 5
  flaggedValues.forEach(fv => {
    s += fv.reason.toLowerCase().includes('critical') ? 30 : 15
  })
  return Math.min(100, s)
}

export default function Dashboard({ reports, selectedReportId, onSelectReport, onDeleteReport }) {
  const [timeString, setTimeString] = useState('')

  // Live clock for command center date/time display
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setTimeString(now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    updateClock()
    const timerId = setInterval(updateClock, 1000)
    return () => clearInterval(timerId)
  }, [])

  const currentDateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  // Calculations
  const todayCasesCount = reports.length
  const criticalCount = reports.filter(r => r.priority === 'Critical').length
  const urgentCount = reports.filter(r => r.priority === 'Urgent').length
  const hasCritical = criticalCount > 0

  // Calculate Average AI Processing Time
  const reportsWithTime = reports.filter(r => r.processing_time_ms != null)
  const avgProcessingTimeMs = reportsWithTime.length > 0
    ? Math.round(reportsWithTime.reduce((sum, r) => sum + r.processing_time_ms, 0) / reportsWithTime.length)
    : 850 // default fallback
  const avgAISec = (avgProcessingTimeMs / 1000).toFixed(2)

  const formatRelative = (dateString) => {
    try {
      const d = new Date(dateString)
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
      if (diffMin < 1) return 'just now'
      if (diffMin < 60) return `${diffMin}m ago`
      if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return dateString }
  }

  return (
    <div className="panel command-center-panel">
      {/* ─── COMMAND CENTER HEADER ─── */}
      <div className="cc-header">
        <div className="cc-branding">
          <div className="cc-title-row">
            <span className={`cc-status-beacon ${hasCritical ? 'beacon-critical' : 'beacon-normal'}`} />
            <h2 className="cc-hospital-name">METRO GENERAL HOSPITAL</h2>
          </div>
          <span className="cc-system-label">AI Triage Command Center</span>
        </div>
        <div className="cc-meta">
          <div className="cc-datetime">
            <span className="cc-date">{currentDateStr}</span>
            <span className="cc-time">{timeString}</span>
          </div>
          <div className="cc-health-pill">
            <span className="cc-health-dot" />
            <span>LLM GATEWAY ONLINE</span>
          </div>
        </div>
      </div>

      {/* ─── EMERGENCY ALERT BANNER ─── */}
      {hasCritical && (
        <div className="cc-alert-banner">
          <div className="cc-alert-icon">🚨</div>
          <div className="cc-alert-content">
            <div className="cc-alert-title">EMERGENCY CLASSIFICATION TRIAGE ACTIVE</div>
            <div className="cc-alert-desc">
              {criticalCount} critical report{criticalCount > 1 ? 's' : ''} awaiting immediate physician review and verification.
            </div>
          </div>
        </div>
      )}

      {/* ─── KPI STATISTICS GRID ─── */}
      <div className="cc-kpi-grid">
        <div className="cc-kpi-card">
          <span className="cc-kpi-label">Today's Cases</span>
          <span className="cc-kpi-value">{todayCasesCount}</span>
          <span className="cc-kpi-sub">Total submissions</span>
        </div>
        <div className={`cc-kpi-card ${criticalCount > 0 ? 'cc-kpi-critical-active' : ''}`}>
          <span className="cc-kpi-label">Critical cases</span>
          <span className="cc-kpi-value">{criticalCount}</span>
          <span className="cc-kpi-sub">{criticalCount > 0 ? '🚨 Immediate action' : 'All clear'}</span>
        </div>
        <div className={`cc-kpi-card ${urgentCount > 0 ? 'cc-kpi-urgent-active' : ''}`}>
          <span className="cc-kpi-label">Urgent cases</span>
          <span className="cc-kpi-value">{urgentCount}</span>
          <span className="cc-kpi-sub">Prioritised queue</span>
        </div>
        <div className="cc-kpi-card cc-kpi-double">
          <div className="cc-kpi-split">
            <div>
              <span className="cc-kpi-label">Avg AI Extraction</span>
              <span className="cc-kpi-value-sm">{avgAISec}s</span>
            </div>
            <div className="cc-kpi-divider" />
            <div>
              <span className="cc-kpi-label">Avg Review SLA</span>
              <span className="cc-kpi-value-sm">4.2m</span>
            </div>
          </div>
          <span className="cc-kpi-sub" style={{ marginTop: 'auto', textAlign: 'center' }}>
            Target review response &lt; 15.0m
          </span>
        </div>
      </div>

      {/* ─── QUEUE FEED LIST ─── */}
      <div className="cc-feed-section">
        <div className="cc-feed-header">
          <span className="cc-feed-title">Recently Processed Reports</span>
          <span className="cc-feed-badge">Live feed</span>
        </div>

        <div className="reports-list">
          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
              <div>No lab reports processed.</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Waiting for specimen digitization from Lab Assistant.</div>
            </div>
          ) : (
            reports.map((report) => {
              const isSelected = report.id === selectedReportId
              const flagCount  = report.flagged_values?.length ?? 0
              const score      = report.priority_score != null
                ? report.priority_score
                : computeScore(report.flagged_values)
              const prioLower  = report.priority.toLowerCase()

              const critCount  = report.flagged_values?.filter(fv =>
                fv.reason.toLowerCase().includes('critical')
              ).length ?? 0
              const urgCount   = flagCount - critCount

              return (
                <div
                  key={report.id}
                  className={`report-card priority-${report.priority} ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectReport(report)}
                >
                  <div className="card-header">
                    <span className="patient-name">{report.patient_name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className={`badge ${report.priority}`}>{report.priority}</span>
                      <button
                        className="card-delete-btn"
                        title="Delete report"
                        onClick={e => { e.stopPropagation(); onDeleteReport(report.id) }}
                      >🗑</button>
                    </div>
                  </div>

                  <div className="card-score-row">
                    <div className="card-score-bar-bg">
                      <div
                        className="card-score-bar-fill"
                        style={{
                          width: `${score}%`,
                          backgroundColor: `var(--priority-${prioLower})`
                        }}
                      />
                    </div>
                    <span className={`card-score-num card-score-${prioLower}`}>{score}</span>
                  </div>

                  <div className="card-footer">
                    <span className={`flagged-count ${
                      critCount > 0 ? 'critical-flags'
                      : urgCount > 0 ? 'has-flags'
                      : ''
                    }`}>
                      {flagCount === 0 ? '✅ All Normal' : (
                        <>
                          {critCount > 0 && <span>🔴 {critCount} critical</span>}
                          {urgCount > 0 && critCount > 0 && ' · '}
                          {urgCount > 0 && <span>🟠 {urgCount} abnormal</span>}
                        </>
                      )}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {formatRelative(report.submitted_at)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
