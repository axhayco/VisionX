import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import ReportDetail from './components/ReportDetail'
import WorkflowModal from './components/WorkflowModal'
import AlertToast from './components/AlertToast'

// ─── Responsible AI principles ─────────────────────────────────────────────────
// Displayed as a compact footer strip — visible but non-intrusive.
// Each item maps to a concrete architectural decision in VisionX.
const RAI_ITEMS = [
  { icon: '👨‍⚕️', label: 'Doctor is final decision maker',           detail: 'AI output is advisory only — no autonomous clinical actions'   },
  { icon: '⚖️',  label: 'Priority via explainable clinical rules',  detail: 'Deterministic thresholds, fully auditable — no black-box ML'    },
  { icon: '🤖',  label: 'AI generates summaries only',              detail: 'LLM role is limited to plain-language explanation, not diagnosis' },
  { icon: '🔒',  label: 'Patient data processed securely',          detail: 'No data stored externally — SQLite on-premise, no cloud logging' },
  { icon: '🏗️',  label: 'Self-hosted LLM deployment ready',         detail: 'Architecture supports Ollama / vLLM to eliminate external APIs'  },
]

function ResponsibleAIFooter() {
  const [expanded, setExpanded] = useState(null)

  return (
    <footer className="rai-footer">
      <div className="rai-shield">
        <span className="rai-shield-icon">🛡️</span>
        <span className="rai-shield-label">Responsible AI</span>
      </div>

      <div className="rai-items">
        {RAI_ITEMS.map((item, i) => (
          <button
            key={i}
            className={`rai-item ${expanded === i ? 'rai-item-active' : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
            title={item.detail}
          >
            <span className="rai-item-icon">{item.icon}</span>
            <span className="rai-item-label">{item.label}</span>
            {expanded === i && (
              <span className="rai-item-detail">{item.detail}</span>
            )}
          </button>
        ))}
      </div>
    </footer>
  )
}

function App() {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState(null)

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports')
      if (res.ok) {
        const data = await res.json()
        setReports(data)
        // Preserve current selection; default to first report
        setSelectedReport(prev => {
          if (!prev && data.length > 0) return data[0]
          return data.find(r => r.id === prev?.id) || prev
        })
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  // Show critical alert banner when a Critical report is viewed
  useEffect(() => {
    if (selectedReport?.priority === 'Critical') {
      setAlertMessage(
        `CRITICAL ALERT — Triage notification sent to on-call clinician for ${selectedReport.patient_name}`
      )
    } else {
      setAlertMessage(null)
    }
  }, [selectedReport])

  // Called by WorkflowModal once the API call succeeds
  const handlePipelineComplete = async (newReport) => {
    setShowModal(false)
    await fetchReports()
    setSelectedReport(newReport)
  }

  // Delete a report by ID
  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setSelectedReport(prev => prev?.id === reportId ? null : prev)
        await fetchReports()
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div className="app-container">
      {alertMessage && (
        <AlertToast message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      <header className="app-header">
        <div className="app-title-section">
          <h1><span>🩺</span> VisionX Triage</h1>
          <p>AI-assisted clinical decision support · real-time lab report prioritization</p>
        </div>
        <button className="new-report-btn" onClick={() => setShowModal(true)}>
          <span>+</span> New Lab Report
        </button>
      </header>

      <main className="main-layout">
        <Dashboard
          reports={reports}
          selectedReportId={selectedReport?.id}
          onSelectReport={setSelectedReport}
          onDeleteReport={handleDeleteReport}
        />
        <ReportDetail report={selectedReport} />
      </main>

      <ResponsibleAIFooter />

      {showModal && (
        <WorkflowModal
          onComplete={handlePipelineComplete}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

export default App
