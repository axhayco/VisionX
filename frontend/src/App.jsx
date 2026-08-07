import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import ReportDetail from './components/ReportDetail'
import WorkflowModal from './components/WorkflowModal'
import AlertToast from './components/AlertToast'
import LabAssistantPanel from './components/LabAssistantPanel'
import DashboardPage from './components/DashboardPage'
import SettingsPage from './components/SettingsPage'

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
  const [currentRole, setCurrentRole] = useState('doctor')
  const [newlyUploadedReport, setNewlyUploadedReport] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard | reports | analyzer | settings

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
    if (selectedReport?.priority === 'Critical' && currentRole === 'doctor' && activeTab === 'reports') {
      setAlertMessage(
        `CRITICAL ALERT — Triage notification sent to on-call clinician for ${selectedReport.patient_name}`
      )
    } else {
      setAlertMessage(null)
    }
  }, [selectedReport, currentRole, activeTab])

  // Called by WorkflowModal once the API call succeeds
  const handlePipelineComplete = async (newReport) => {
    setShowModal(false)
    await fetchReports()
    
    if (currentRole === 'lab_assistant') {
      setNewlyUploadedReport(newReport)
      setActiveTab('reports') // Route to reports log
    } else {
      setSelectedReport(newReport)
      setActiveTab('reports') // Route to triage feed
    }
  }

  const handleRoleChange = (role) => {
    setCurrentRole(role)
    if (role === 'doctor' && newlyUploadedReport) {
      setAlertMessage(
        `NEW SPECIMEN INGESTED — Lab assistant uploaded a new report for ${newlyUploadedReport.patient_name} (Priority: ${newlyUploadedReport.priority})`
      )
      setSelectedReport(newlyUploadedReport)
      setNewlyUploadedReport(null)
      setActiveTab('reports') // Route to triage feed
    }
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
    <div className="app-layout-wrapper">
      {/* ─── LEFT SIDEBAR NAVIGATION ─── */}
      <aside className="app-sidebar">
        <div className="sidebar-brand-section">
          <div className="brand-logo">🩺</div>
          <div className="brand-text">
            <h2>VisionX</h2>
            <span>LAB ANALYZER</span>
          </div>
        </div>

        <nav className="sidebar-nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Dashboard</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-label">{currentRole === 'doctor' ? 'Triage Queue' : 'Specimen Logs'}</span>
            {newlyUploadedReport && <span className="nav-badge-alert" />}
          </button>

          <button 
            className={`nav-item ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('analyzer');
              if (currentRole === 'lab_assistant') setShowModal(true);
            }}
          >
            <span className="nav-icon">🔬</span>
            <span className="nav-label">Analyzer</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Settings</span>
          </button>
        </nav>

        {/* Sidebar Footer (Role Switcher + Profile) */}
        <div className="sidebar-footer">
          <div className="sidebar-role-toggle">
            <span className="toggle-label">Workspace Access</span>
            <div className="segmented-toggle">
              <button 
                className={`toggle-btn ${currentRole === 'doctor' ? 'active-doctor' : ''}`}
                onClick={() => handleRoleChange('doctor')}
                title="Switch to Physician Triage Queue"
              >
                MD
              </button>
              <button 
                className={`toggle-btn ${currentRole === 'lab_assistant' ? 'active-lab' : ''}`}
                onClick={() => handleRoleChange('lab_assistant')}
                title="Switch to Specimen Ingestion"
              >
                Lab
              </button>
            </div>
          </div>

          <div className="user-profile-card">
            <div className="user-avatar">AV</div>
            <div className="user-info">
              <h4>Andy Verma</h4>
              <span>General Manager</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <div className="app-main-content">
        {alertMessage && (
          <AlertToast message={alertMessage} onClose={() => setAlertMessage(null)} />
        )}

        {/* Header Strip */}
        <header className="content-header-strip">
          <div className="header-breadcrumbs">
            <span className="breadcrumb-parent">VisionX CDSS</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current capitalize">{activeTab}</span>
          </div>
          <div className="header-meta-pills">
            <div className="status-pill-green">
              <span className="status-dot" />
              <span>System Online</span>
            </div>
          </div>
        </header>

        {/* Route Renderings */}
        <main className="content-view-viewport">
          {activeTab === 'dashboard' && (
            <DashboardPage 
              reports={reports} 
              currentRole={currentRole} 
              onNavigate={setActiveTab} 
            />
          )}

          {activeTab === 'reports' && (
            currentRole === 'doctor' ? (
              <div className="main-layout">
                <Dashboard
                  reports={reports}
                  selectedReportId={selectedReport?.id}
                  onSelectReport={setSelectedReport}
                  onDeleteReport={handleDeleteReport}
                />
                <ReportDetail report={selectedReport} />
              </div>
            ) : (
              <div className="main-layout-single">
                <LabAssistantPanel
                  reports={reports}
                  onUploadClick={() => setShowModal(true)}
                  onDeleteReport={handleDeleteReport}
                />
              </div>
            )
          )}

          {activeTab === 'analyzer' && (
            currentRole === 'lab_assistant' ? (
              <div className="analyzer-view-page card-panel">
                <div className="analyzer-hero">
                  <div className="hero-icon">📁</div>
                  <h3>Analyzer digitisation Portal</h3>
                  <p>Upload a patient specimen report (PDF or Image) to parse raw values and initiate explainable triage summaries.</p>
                  <button className="primary-upload-btn" onClick={() => setShowModal(true)}>
                    + Select Specimen File
                  </button>
                </div>
              </div>
            ) : (
              <div className="analyzer-view-page card-panel">
                <div className="analyzer-hero">
                  <div className="hero-icon warning-icon">🔒</div>
                  <h3>Ingestion Restricted</h3>
                  <p>File uploading and raw OCR digitisation is restricted to the Laboratory Department.</p>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Please toggle your active workspace to <strong>Lab Assistant</strong> in the left sidebar to proceed.
                  </span>
                </div>
              </div>
            )
          )}

          {activeTab === 'settings' && (
            <SettingsPage />
          )}
        </main>

        <ResponsibleAIFooter />
      </div>

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
