import React, { useState } from 'react'

function formatRelative(dateString) {
  try {
    const d = new Date(dateString)
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}

export default function LabAssistantPanel({ reports, onUploadClick, onDeleteReport }) {
  const [selectedReport, setSelectedReport] = useState(null)

  const getConfidenceClass = (score) => {
    if (!score) return 'conf-high'
    if (score >= 90) return 'conf-high'
    if (score >= 70) return 'conf-mid'
    return 'conf-low'
  }

  return (
    <div className="lab-assistant-panel panel">
      {/* ─── LAB HEADER ─── */}
      <div className="lab-header">
        <div className="lab-title-row">
          <span className="lab-beacon" />
          <div>
            <h2 className="lab-title">LABORATORY DEPARTMENT</h2>
            <span className="lab-subtitle">Specimen Ingestion & Digitization Portal</span>
          </div>
        </div>
        <div className="lab-meta">
          <div className="lab-badge">
            <span className="lab-online-dot" />
            <span>AI EXTRACTION ENGINE ACTIVE</span>
          </div>
        </div>
      </div>

      {/* ─── ACTION HUB ─── */}
      <div className="lab-action-hub">
        <div className="lab-upload-promo-card">
          <div className="promo-icon">🔬</div>
          <div className="promo-text-section">
            <h3>Ingest New Specimen</h3>
            <p>Upload patient laboratory PDFs or input values manually to trigger the automated triage pipeline.</p>
          </div>
          <button className="lab-upload-btn" onClick={onUploadClick}>
            <span>+</span> Upload & Process Report
          </button>
        </div>
      </div>

      {/* ─── SUBMISSION LOG ─── */}
      <div className="lab-log-section">
        <div className="lab-log-header">
          <h3>Recent Submissions Log</h3>
          <span className="log-count-badge">{reports.length} Reports</span>
        </div>

        {reports.length === 0 ? (
          <div className="lab-empty-state">
            <div className="empty-icon">📁</div>
            <p>No specimens ingested today.</p>
            <span>Click the "+ Upload & Process Report" button above to get started.</span>
          </div>
        ) : (
          <div className="lab-table-container">
            <table className="lab-log-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Ingested At</th>
                  <th>AI Extraction Confidence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const conf = report.confidence_score != null ? Math.round(report.confidence_score) : 95
                  return (
                    <tr key={report.id} className={selectedReport?.id === report.id ? 'active-row' : ''}>
                      <td className="patient-cell">
                        <span className="patient-avatar">👤</span>
                        <span className="patient-name">{report.patient_name}</span>
                      </td>
                      <td className="time-cell">{formatRelative(report.submitted_at)}</td>
                      <td className="conf-cell">
                        <div className="conf-bar-wrapper">
                          <div className="conf-bar-bg">
                            <div 
                              className={`conf-bar-fill ${getConfidenceClass(conf)}`}
                              style={{ width: `${conf}%` }}
                            />
                          </div>
                          <span className={`conf-score-num ${getConfidenceClass(conf)}`}>{conf}%</span>
                        </div>
                      </td>

                      <td className="actions-cell">
                        <div className="action-button-group">
                          <button 
                            className="btn-action-view" 
                            title="Verify extracted values"
                            onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                          >
                            👁️ Verify
                          </button>
                          <button 
                            className="btn-action-delete" 
                            title="Remove report"
                            onClick={() => onDeleteReport(report.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── DATA VERIFICATION DRAWER (HIPAA Compliance Check) ─── */}
      {selectedReport && (
        <div className="lab-verification-drawer">
          <div className="drawer-header">
            <h4>
              <span>📋</span> Extraction Verification: <strong>{selectedReport.patient_name}</strong>
            </h4>
            <button className="close-drawer-btn" onClick={() => setSelectedReport(null)}>×</button>
          </div>
          <div className="drawer-body">
            <p className="drawer-instruction">
              Verify that the AI-extracted values below match the physical laboratory sheet. 
              If errors are found, delete this record and re-upload.
            </p>
            <div className="values-grid">
              {Object.entries(selectedReport.test_values).map(([param, val]) => {
                const isFlagged = selectedReport.flagged_values?.some(fv => fv.test_name === param)
                return (
                  <div key={param} className={`value-tile ${isFlagged ? 'tile-flagged' : ''}`}>
                    <span className="tile-label">{param}</span>
                    <span className="tile-value">
                      {val !== null ? val : <span className="empty-indicator">N/A</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
