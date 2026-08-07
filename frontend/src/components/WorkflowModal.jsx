import React, { useState, useRef } from 'react'

// ─── Reference ranges (mirrors backend reference_ranges.py) ──────────────────
const REF_RANGES = {
  'Hemoglobin':                { unit: 'g/dL',      min: 12.0,   max: 17.5,   critLow: 8.0,    critHigh: 20.0   },
  'WBC Count':                 { unit: 'cells/mcL', min: 4500,   max: 11000,  critLow: 2000,   critHigh: 30000  },
  'Platelet Count':            { unit: 'cells/mcL', min: 150000, max: 450000, critLow: 50000,  critHigh: 1000000},
  'Glucose (fasting)':         { unit: 'mg/dL',     min: 70,     max: 99,     critLow: 50,     critHigh: 250    },
  'Creatinine':                { unit: 'mg/dL',     min: 0.6,    max: 1.2,    critLow: null,   critHigh: 3.0    },
  'Potassium':                 { unit: 'mEq/L',     min: 3.5,    max: 5.0,    critLow: 3.0,    critHigh: 6.0    },
  'Sodium':                    { unit: 'mEq/L',     min: 135,    max: 145,    critLow: 125,    critHigh: 150    },
  'Blood Pressure (systolic)': { unit: 'mmHg',      min: 90,     max: 120,    critLow: 70,     critHigh: 180    },
}

const PARAMS = Object.keys(REF_RANGES)

function getValueStatus(param, value) {
  if (value === null || value === undefined || value === '') return 'empty'
  const v = parseFloat(value)
  if (isNaN(v)) return 'empty'
  const r = REF_RANGES[param]
  if ((r.critLow !== null && v < r.critLow) || (r.critHigh !== null && v >= r.critHigh)) return 'critical'
  if (v < r.min || v > r.max) return 'urgent'
  return 'normal'
}

// ─── 5 built-in demo scenarios ───────────────────────────────────────────────
const DEMO_REPORTS = [
  {
    icon: '🟢',
    label: 'Healthy Patient',
    description: 'All values within normal reference ranges',
    patient_name: 'Sarah Chen',
    test_values: {
      'Hemoglobin': 13.8, 'WBC Count': 7200, 'Platelet Count': 285000,
      'Glucose (fasting)': 88, 'Creatinine': 0.9, 'Potassium': 4.1,
      'Sodium': 140, 'Blood Pressure (systolic)': 118
    }
  },
  {
    icon: '🔴',
    label: 'Critical Anemia',
    description: 'Severe hemoglobin deficit requiring immediate transfusion',
    patient_name: 'Marcus Thompson',
    test_values: {
      'Hemoglobin': 5.8, 'WBC Count': 9000, 'Platelet Count': 210000,
      'Glucose (fasting)': 82, 'Creatinine': 1.0, 'Potassium': 4.3,
      'Sodium': 138, 'Blood Pressure (systolic)': 85
    }
  },
  {
    icon: '🔴',
    label: 'Acute Kidney Failure',
    description: 'Critical creatinine and potassium — possible dialysis needed',
    patient_name: 'Robert Patel',
    test_values: {
      'Hemoglobin': 10.2, 'WBC Count': 8500, 'Platelet Count': 175000,
      'Glucose (fasting)': 105, 'Creatinine': 4.8, 'Potassium': 6.5,
      'Sodium': 128, 'Blood Pressure (systolic)': 145
    }
  },
  {
    icon: '🔴',
    label: 'Diabetic Emergency',
    description: 'Hyperglycaemic crisis with critical glucose and acidosis markers',
    patient_name: 'Linda Morrison',
    test_values: {
      'Hemoglobin': 12.1, 'WBC Count': 11500, 'Platelet Count': 230000,
      'Glucose (fasting)': 480, 'Creatinine': 2.1, 'Potassium': 3.1,
      'Sodium': 130, 'Blood Pressure (systolic)': 105
    }
  },
  {
    icon: '🔴',
    label: 'Sepsis',
    description: 'Multi-organ failure pattern — critical WBC, platelets, and BP',
    patient_name: "James O'Brien",
    test_values: {
      'Hemoglobin': 9.5, 'WBC Count': 28500, 'Platelet Count': 48000,
      'Glucose (fasting)': 195, 'Creatinine': 2.8, 'Potassium': 5.7,
      'Sodium': 132, 'Blood Pressure (systolic)': 68
    }
  },
]

// ─── Pipeline stages ──────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'upload',         icon: '📁', label: 'Upload',                    sublabel: 'Document received from lab technician' },
  { id: 'parsing',        icon: '📄', label: 'Parsing PDF',              sublabel: 'Extracting raw text layout' },
  { id: 'extraction',     icon: '🔬', label: 'Extracting Values',        sublabel: 'Identifying laboratory parameters' },
  { id: 'rules',          icon: '⚙️', label: 'Applying Clinical Rules',   sublabel: 'Evaluating deterministic rule thresholds' },
  { id: 'doctor_summary', icon: '🩺', label: 'Generating Doctor Summary', sublabel: 'Synthesizing clinician summary report' },
  { id: 'patient_summary',icon: '❤️', label: 'Generating Patient Summary',sublabel: 'Drafting plain-language summary' },
  { id: 'priority',       icon: '📊', label: 'Priority Assigned',        sublabel: 'Calculating clinical triage score' },
  { id: 'queue',          icon: '🏥', label: 'Added to Clinical Queue',   sublabel: 'Added to physician dashboard queue' },
]
const STAGE_DURATION_MS = 400


// ─── Component ────────────────────────────────────────────────────────────────
export default function WorkflowModal({ onComplete, onClose }) {
  const [phase, setPhase] = useState('choose')   // choose | extracting | verify | pipeline | done
  const [patientName, setPatientName] = useState('')
  const [testValues, setTestValues] = useState(
    Object.fromEntries(PARAMS.map(p => [p, null]))
  )
  const [activeStage, setActiveStage]         = useState(0)
  const [completedStages, setCompletedStages] = useState([])
  const [pipelineError, setPipelineError]     = useState(null)
  const [extractError, setExtractError]       = useState(null)
  const [dragActive, setDragActive]           = useState(false)
  const fileInputRef = useRef(null)

  // ── helpers ─────────────────────────────────────────────────────────────────
  const loadValues = (name, values) => {
    setPatientName(name)
    setTestValues({ ...Object.fromEntries(PARAMS.map(p => [p, null])), ...values })
    setPhase('verify')
  }

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelected(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelected(file)
  }

  const handleFileSelected = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
      alert('Unsupported format. Please upload a PDF, PNG, JPG, or JPEG.')
      return
    }
    setExtractError(null)
    setPhase('extracting')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/extract', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Extraction failed')
      loadValues(data.patient_name, data.test_values)
    } catch (err) {
      setExtractError(err.message)
      setPhase('choose')
    }
  }

  // ── verify form ──────────────────────────────────────────────────────────────
  const updateValue = (param, raw) => {
    setTestValues(prev => ({ ...prev, [param]: raw === '' ? null : raw }))
  }

  // ── submit to pipeline ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!patientName.trim()) { alert('Please enter the patient name.'); return }

    // Count how many params have a real numeric value
    const filledParams = PARAMS.filter(p => {
      const v = testValues[p]
      return v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v))
    })
    if (filledParams.length === 0) {
      alert('Please enter at least one laboratory value before proceeding.')
      return
    }

    // Build parsed values — null for any unfilled param (backend handles nulls correctly)
    const parsedValues = {}
    PARAMS.forEach(p => {
      const v = testValues[p]
      parsedValues[p] = (v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v)))
        ? parseFloat(v)
        : null
    })

    // 1. Switch to processing flight phase
    setPhase('processing')
    setPipelineError(null)

    let apiResult = null
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_name: patientName.trim(), test_values: parsedValues }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Server error')
      }
      apiResult = await res.json()
    } catch (err) {
      setPipelineError(err.message)
      setPhase('choose')
      return
    }

    // 2. Playback animation phase
    setPhase('pipeline')
    setActiveStage(0)
    setCompletedStages([])

    // Animate through all 8 stages sequentially
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      setActiveStage(i)
      await new Promise(r => setTimeout(r, STAGE_DURATION_MS))
      setCompletedStages(prev => [...prev, i])
    }

    // Brief delay so user sees final completed state
    await new Promise(r => setTimeout(r, 450))

    setPhase('done')
    setTimeout(() => onComplete(apiResult), 300)
  }


  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget && (phase === 'choose' || phase === 'verify')) onClose() }}>
      <div className="wf-modal">

        {/* ══ PHASE: CHOOSE ══════════════════════════════════════════════════ */}
        {phase === 'choose' && (
          <>
            <div className="modal-header">
              <div>
                <h2>Submit Lab Report</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Upload a report file or choose a demo scenario to begin triage
                </p>
              </div>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>

            <div className="form-body">
              {extractError && (
                <div className="pipeline-error-box" style={{ marginBottom: '0' }}>
                  <span>⚠️</span>
                  <span>{extractError}</span>
                </div>
              )}

              {/* Upload zone */}
              <div
                className={`file-upload-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag} onDragOver={handleDrag}
                onDragLeave={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                  accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileInput} />
                <span className="upload-icon">📁</span>
                <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                  Upload Lab Report
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Text PDF · Scanned PDF · PNG · JPG — values extracted automatically
                </p>
                <button type="button" className="btn-submit" style={{ fontSize: '0.9rem', padding: '0.6rem 1.4rem' }}>
                  Browse Files
                </button>
              </div>

              {/* Divider */}
              <div className="wf-divider"><span>or choose a demo scenario</span></div>

              {/* Demo report cards */}
              <div className="demo-grid">
                {DEMO_REPORTS.map((demo, i) => (
                  <button
                    key={i}
                    type="button"
                    className="demo-card"
                    onClick={() => loadValues(demo.patient_name, demo.test_values)}
                  >
                    <span className="demo-icon">{demo.icon}</span>
                    <div className="demo-text">
                      <div className="demo-label">{demo.label}</div>
                      <div className="demo-desc">{demo.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══ PHASE: EXTRACTING ══════════════════════════════════════════════ */}
        {phase === 'extracting' && (
          <div className="pipeline-view" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <div className="spinner" style={{ width: 56, height: 56, borderWidth: 5 }} />
            <h3 style={{ marginTop: '1rem' }}>Extracting Laboratory Values…</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              Running PyMuPDF + AI extraction on your document
            </p>
          </div>
        )}

        {/* ══ PHASE: PROCESSING ══════════════════════════════════════════════ */}
        {phase === 'processing' && (
          <div className="pipeline-view" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <div className="spinner" style={{ width: 56, height: 56, borderWidth: 5, borderColor: '#6366f1 rgba(99, 102, 241, 0.2) rgba(99, 102, 241, 0.2) rgba(99, 102, 241, 0.2)' }} />
            <h3 style={{ marginTop: '1rem' }}>AI Triage Engine Processing…</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              Executing rules, calculating priority, and synthesizing summaries
            </p>
          </div>
        )}


        {/* ══ PHASE: VERIFY ══════════════════════════════════════════════════ */}
        {phase === 'verify' && (
          <>
            <div className="modal-header">
              <div>
                <h2>Verify Extracted Values</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Review and correct values if needed before running triage
                </p>
              </div>
              <button className="modal-close" onClick={() => setPhase('choose')}>×</button>
            </div>

            <div className="form-body">
              {/* Patient name */}
              <div className="form-group">
                <label htmlFor="patient_name_verify">Patient Name</label>
                <input
                  id="patient_name_verify"
                  type="text"
                  className="form-input"
                  placeholder="Enter patient full name…"
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                />
              </div>

              {/* Verify table */}
              <div className="verify-table-wrap">
                <table className="verify-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Extracted Value</th>
                      <th>Unit</th>
                      <th>Reference Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARAMS.map(param => {
                      const ref  = REF_RANGES[param]
                      const val  = testValues[param]
                      const stat = getValueStatus(param, val)
                      return (
                        <tr key={param} className={`verify-row verify-row-${stat}`}>
                          <td className="verify-param">{param}</td>
                          <td className="verify-input-cell">
                            <input
                              type="number"
                              step="any"
                              className={`verify-input verify-input-${stat}`}
                              value={val ?? ''}
                              onChange={e => updateValue(param, e.target.value)}
                              placeholder="—"
                            />
                          </td>
                          <td className="verify-unit">{ref.unit}</td>
                          <td className="verify-range">
                            {ref.min.toLocaleString()} – {ref.max.toLocaleString()}
                          </td>
                          <td className="verify-status">
                            {stat === 'critical' && <span className="vstatus vstatus-critical">CRITICAL</span>}
                            {stat === 'urgent'   && <span className="vstatus vstatus-urgent">ABNORMAL</span>}
                            {stat === 'normal'   && <span className="vstatus vstatus-normal">Normal</span>}
                            {stat === 'empty'    && <span className="vstatus vstatus-empty">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Values highlighted in red/orange are outside the reference range.
                Edit any cell to correct extraction errors.
              </p>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setPhase('choose')}>
                ← Back
              </button>
              <button 
                type="button" 
                className="btn-submit" 
                onClick={handleConfirm}
                disabled={!patientName || patientName.trim() === ''}
                title={!patientName || patientName.trim() === '' ? "Patient name is required" : ""}
              >
                Confirm & Analyse →
              </button>
            </div>
          </>
        )}

        {/* ══ PHASE: PIPELINE ════════════════════════════════════════════════ */}
        {(phase === 'pipeline' || phase === 'done') && (
          <div className="pipeline-view">
            <div className="pipeline-header">
              <div className="pipeline-header-icon">
                {phase === 'done' ? '✅' : '⚡'}
              </div>
              <div>
                <h2>{phase === 'done' ? 'Triage Complete' : 'Processing Report'}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {phase === 'done'
                    ? 'Report has been added to the doctor queue.'
                    : 'VisionX clinical pipeline is running…'}
                </p>
              </div>
            </div>

            <div className="pipeline-track">
              {PIPELINE_STAGES.map((stage, i) => {
                const isDone   = completedStages.includes(i)
                const isActive = activeStage === i && !isDone && phase !== 'done'
                return (
                  <React.Fragment key={stage.id}>
                    <div className={`pipeline-node ${isDone || phase === 'done' ? 'node-done' : isActive ? 'node-active' : 'node-pending'}`}>
                      <div className="node-circle">
                        {isDone || phase === 'done'
                          ? <span className="node-check">✓</span>
                          : isActive
                            ? <span className="node-spinner" />
                            : <span className="node-icon">{stage.icon}</span>
                        }
                      </div>
                      <div className="node-label">{stage.label}</div>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div className={`pipeline-connector ${completedStages.includes(i) || phase === 'done' ? 'connector-done' : ''}`} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            {phase === 'pipeline' && (
              <div className="pipeline-detail-card">
                <div className="pipeline-detail-icon">{PIPELINE_STAGES[activeStage]?.icon}</div>
                <div>
                  <div className="pipeline-detail-label">{PIPELINE_STAGES[activeStage]?.label}</div>
                  <div className="pipeline-detail-sub">{PIPELINE_STAGES[activeStage]?.sublabel}</div>
                </div>
                <div className="pipeline-pulse" />
              </div>
            )}

            {pipelineError && (
              <div className="pipeline-error-box">
                <span>⚠️</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Processing Failed</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {pipelineError}
                  </div>
                </div>
                <button className="btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
