import React, { useState } from 'react'


// ─── Reference data (mirrors backend reference_ranges.py) ─────────────────────
const REF = {
  'Hemoglobin':                { unit: 'g/dL',      min: 12.0,   max: 17.5,   critLow: 8.0,    critHigh: 20.0,    desc: 'Oxygen-carrying protein in red blood cells' },
  'WBC Count':                 { unit: 'cells/mcL', min: 4500,   max: 11000,  critLow: 2000,   critHigh: 30000,   desc: 'White blood cells — primary infection fighters' },
  'Platelet Count':            { unit: 'cells/mcL', min: 150000, max: 450000, critLow: 50000,  critHigh: 1000000, desc: 'Cells that stop bleeding by forming clots' },
  'Glucose (fasting)':         { unit: 'mg/dL',     min: 70,     max: 99,     critLow: 50,     critHigh: 250,     desc: 'Blood sugar level measured after fasting' },
  'Creatinine':                { unit: 'mg/dL',     min: 0.6,    max: 1.2,    critLow: null,   critHigh: 3.0,     desc: 'Kidney filtration efficiency marker' },
  'Potassium':                 { unit: 'mEq/L',     min: 3.5,    max: 5.0,    critLow: 3.0,    critHigh: 6.0,     desc: 'Electrolyte critical for heart rhythm' },
  'Sodium':                    { unit: 'mEq/L',     min: 135,    max: 145,    critLow: 125,    critHigh: 150,     desc: 'Electrolyte regulating fluid balance' },
  'Blood Pressure (systolic)': { unit: 'mmHg',      min: 90,     max: 120,    critLow: 70,     critHigh: 180,     desc: 'Arterial pressure when the heart contracts' },
}
const ALL_PARAMS = Object.keys(REF)

// ─── Score computation (deterministic, same logic as backend rule engine) ─────
function computeScore(flaggedValues = []) {
  if (!flaggedValues?.length) return 8
  let s = 5
  flaggedValues.forEach(fv => {
    s += fv.reason.toLowerCase().includes('critical') ? 30 : 15
  })
  return Math.min(100, s)
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function parseTs(str) {
  try {
    const d = new Date(str)
    const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const diffMs  = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const relative = diffMin < 1 ? 'just now'
      : diffMin < 60  ? `${diffMin}m ago`
      : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago`
      : `${Math.floor(diffMin / 1440)}d ago`
    return { date, time, relative }
  } catch { return { date: str, time: '', relative: '' } }
}

// ─── Value bar showing color zones + current-value needle ─────────────────────
function ValueBar({ param, value }) {
  const r = REF[param]
  if (!r || value == null) return null
  const v = parseFloat(value)
  if (isNaN(v)) return null

  // Display scale: start 30% below critLow (or min if no critLow), end 15% above critHigh
  const lo  = r.critLow  != null ? r.critLow  * 0.70 : r.min * 0.50
  const hi  = r.critHigh != null ? r.critHigh * 1.15 : r.max * 1.50
  const span = hi - lo
  const pct  = (val) => `${Math.max(0, Math.min(100, ((val - lo) / span) * 100)).toFixed(1)}%`

  // Build CSS linear-gradient stops for the 5 zones
  const clLo  = r.critLow  != null ? pct(r.critLow)  : null
  const urgLo = pct(r.min)
  const urgHi = pct(r.max)
  const clHi  = r.critHigh != null ? pct(r.critHigh) : null

  let stops = ''
  if (clLo) {
    stops = `rgba(239,68,68,0.55) 0%, rgba(239,68,68,0.55) ${clLo},
             rgba(249,115,22,0.55) ${clLo}, rgba(249,115,22,0.55) ${urgLo},`
  } else {
    stops = `rgba(249,115,22,0.55) 0%, rgba(249,115,22,0.55) ${urgLo},`
  }
  stops += `rgba(16,185,129,0.55) ${urgLo}, rgba(16,185,129,0.55) ${urgHi},`
  if (clHi) {
    stops += `rgba(249,115,22,0.55) ${urgHi}, rgba(249,115,22,0.55) ${clHi},
              rgba(239,68,68,0.55) ${clHi}, rgba(239,68,68,0.55) 100%`
  } else {
    stops += `rgba(249,115,22,0.55) ${urgHi}, rgba(249,115,22,0.55) 100%`
  }

  const markerLeft = pct(v)

  return (
    <div className="vbar-wrap">
      <div className="vbar-outer">
        <div className="vbar-track" style={{ background: `linear-gradient(90deg, ${stops})` }}>
          <div className="vbar-needle" style={{ left: markerLeft }} title={`${v} ${r.unit}`} />
        </div>
      </div>
      <div className="vbar-scale">
        {r.critLow  != null && <span className="vbar-scale-crit">{r.critLow.toLocaleString()}</span>}
        <span className="vbar-scale-mid">{r.min.toLocaleString()} – {r.max.toLocaleString()} {r.unit}</span>
        {r.critHigh != null && <span className="vbar-scale-crit">{r.critHigh.toLocaleString()}</span>}
      </div>
      <div className="vbar-scale-desc">
        {r.critLow != null && <span style={{ color: '#ef4444' }}>Crit. Low</span>}
        <span style={{ color: '#10b981' }}>Normal Range</span>
        {r.critHigh != null && <span style={{ color: '#ef4444' }}>Crit. High</span>}
      </div>
    </div>
  )
}

// ─── Per-parameter explanation card ──────────────────────────────────────────
function ExplainCard({ flag }) {
  const isCritical = flag.reason.toLowerCase().includes('critical')
  const isLow      = flag.reason.toLowerCase().includes('low')
  const severity   = isCritical ? 'critical' : 'urgent'
  const r = REF[flag.test_name]

  const thresholdLabel = r
    ? (isLow
        ? (r.critLow  != null ? `< ${r.critLow} ${r.unit}` : '—')
        : (r.critHigh != null ? `> ${r.critHigh} ${r.unit}` : '—'))
    : '—'

  return (
    <div className={`explain-card explain-${severity}`}>
      {/* Header */}
      <div className="explain-hdr">
        <div className="explain-hdr-left">
          <span className={`explain-dot explain-dot-${severity}`} />
          <div>
            <div className="explain-param-name">{flag.test_name}</div>
            {r && <div className="explain-param-desc">{r.desc}</div>}
          </div>
        </div>
        <div className="explain-hdr-right">
          <span className={`explain-current-val explain-current-val-${severity}`}>
            {typeof flag.value === 'number' ? flag.value.toLocaleString() : flag.value}
            <span className="explain-unit"> {r?.unit}</span>
          </span>
          <span className={`badge ${isCritical ? 'Critical' : 'Urgent'}`}>
            {isCritical ? 'CRITICAL' : 'ABNORMAL'}
          </span>
        </div>
      </div>

      {/* Visual value bar */}
      <ValueBar param={flag.test_name} value={flag.value} />

      {/* 4-cell data grid */}
      <div className="explain-grid">
        <div className="explain-cell">
          <span className="ec-label">Current Value</span>
          <span className={`ec-val ec-val-${severity}`}>
            {typeof flag.value === 'number' ? flag.value.toLocaleString() : flag.value} {r?.unit}
          </span>
        </div>
        <div className="explain-cell">
          <span className="ec-label">Normal Range</span>
          <span className="ec-val">
            {r ? `${r.min.toLocaleString()} – ${r.max.toLocaleString()} ${r.unit}` : '—'}
          </span>
        </div>
        <div className="explain-cell">
          <span className="ec-label">Clinical Threshold</span>
          <span className={`ec-val ec-val-${severity}`}>{thresholdLabel}</span>
        </div>
        <div className="explain-cell">
          <span className="ec-label">Priority Impact</span>
          <span className={`ec-val ec-val-${severity}`}>
            {isCritical ? '+30 pts (Critical)' : '+15 pts (Urgent)'}
          </span>
        </div>
      </div>

      {/* Plain-language reason */}
      <div className="explain-reason">
        <span className="explain-reason-icon">💡</span>
        <p>{flag.reason}</p>
      </div>
    </div>
  )
}


// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="empty-detail-state">
        <div className="empty-detail-icon">🔬</div>
        <h3>No Report Selected</h3>
        <p>Select a patient from the Triage Feed to view the full<br />explainable clinical decision support analysis.</p>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ReportDetail({ report }) {
  if (!report) return <EmptyState />

  const flaggedValues  = report.flagged_values ?? []
  const flagCount      = flaggedValues.length
  const normalCount    = ALL_PARAMS.length - flagCount
  const score          = report.priority_score != null ? report.priority_score : computeScore(flaggedValues)
  const ts             = parseTs(report.submitted_at)
  const prio           = report.priority                  // 'Critical' | 'Urgent' | 'Normal'
  const prioLower      = prio.toLowerCase()

  return (
    <div className="panel detail-view">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="detail-header">
        <div className="detail-patient-info">
          <h2>{report.patient_name}</h2>
          <span>{ts.date} · {ts.time} · {ts.relative}</span>
        </div>
        <span className={`badge ${prio}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}>
          {prio} Priority
        </span>
      </div>

      {/* ── Triage Scorecard ─────────────────────────────────────────────────── */}
      <div className="triage-scorecard">
        <div className="ts-metric">
          <span className="ts-label">Priority Score</span>
          <span className={`ts-value ts-val-${prioLower}`}>{score}<span className="ts-denom">/100</span></span>
        </div>
        <div className="ts-divider" />
        <div className="ts-metric">
          <span className="ts-label">Classification</span>
          <span className={`badge ${prio}`} style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>{prio}</span>
        </div>
        <div className="ts-divider" />
        <div className="ts-metric">
          <span className="ts-label">Flagged Parameters</span>
          <span className={`ts-value ${flagCount > 0 ? `ts-val-${prioLower}` : 'ts-val-normal'}`}>{flagCount}</span>
        </div>
        <div className="ts-divider" />
        <div className="ts-metric">
          <span className="ts-label">Normal Parameters</span>
          <span className="ts-value ts-val-normal">{normalCount}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="score-bar-section">
        <div className="score-bar-row">
          <span className="score-bar-label">Triage Priority Score</span>
          <span className={`score-bar-num score-num-${prioLower}`}>{score} / 100</span>
        </div>
        <div className="score-bar-bg">
          <div className="score-bar-fill" style={{
            width: `${score}%`,
            backgroundColor: `var(--priority-${prioLower})`
          }} />
        </div>
        <div className="score-bar-row" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
          <span>0 — Normal</span>
          <span>30 — Urgent threshold</span>
          <span>60 — Critical threshold</span>
          <span>100</span>
        </div>
      </div>

      {/* ── Triggered Rules & Abnormal Parameters ────────────────────────────── */}
      {flagCount > 0 ? (
        <div className="explain-section">
          <div className="explain-section-hdr">
            <div className="explain-section-title">
              <span>⚠️</span>
              <span>Triggered Rules & Abnormal Parameters</span>
              <span className="explain-badge-count">{flagCount}</span>
            </div>
            <p className="explain-section-sub">
              Each card below explains exactly why this parameter elevated the priority score.
              The doctor always makes the final decision.
            </p>
          </div>
          <div className="explain-cards-list">
            {flaggedValues.map((fv, i) => (
              <ExplainCard key={i} flag={fv} />
            ))}
          </div>
        </div>
      ) : (
        <div className="all-clear-banner">
          <span>✅</span>
          <span>All parameters within normal reference ranges — no clinical rules triggered.</span>
        </div>
      )}

      {/* ── All Lab Parameters grid ───────────────────────────────────────────── */}
      <div className="all-params-section">
        <h3 className="section-label">All Lab Parameters</h3>
        <div className="values-grid">
          {ALL_PARAMS.map(name => {
            const val  = report.test_values?.[name]
            const flag = flaggedValues.find(fv => fv.test_name === name)
            let cls = ''
            if (flag) cls = flag.reason.toLowerCase().includes('critical') ? 'flagged-Critical' : 'flagged-Urgent'
            const displayVal = val != null ? Number(val).toLocaleString() : '—'
            return (
              <div key={name} className={`value-tile ${cls}`}>
                <span className="value-tile-label">{name}</span>
                <span className="value-tile-num">{displayVal}</span>
                <span className="value-tile-unit">{REF[name]?.unit} · {REF[name]?.min.toLocaleString()}–{REF[name]?.max.toLocaleString()}</span>
                {!flag && val != null && <span className="value-tile-ok">✓ Normal</span>}
                {flag && (
                  <span className={`value-tile-flag ${flag.reason.toLowerCase().includes('critical') ? 'flag-crit' : 'flag-urg'}`}>
                    {flag.reason.toLowerCase().includes('critical') ? '⚠ Critical' : '⚠ Abnormal'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Report Timeline ───────────────────────────────────────────────────── */}
      <div className="cdss-timeline">
        <h3 className="section-label">Report Timeline</h3>
        <div className="timeline-track">
          <div className="timeline-item">
            <div className="tl-left">
              <div className="tl-dot tl-dot-done" />
              <div className="tl-line" />
            </div>
            <div className="tl-content">
              <div className="tl-label">Report Received</div>
              <div className="tl-sub">{ts.date} · {ts.time}</div>
            </div>
          </div>
          <div className="timeline-item">
            <div className="tl-left">
              <div className="tl-dot tl-dot-done" />
              <div className="tl-line" />
            </div>
            <div className="tl-content">
              <div className="tl-label">PDF Parsing & Value Extraction</div>
              <div className="tl-sub">PyMuPDF + LLM extraction completed</div>
            </div>
          </div>
          <div className="timeline-item">
            <div className="tl-left">
              <div className="tl-dot tl-dot-done" />
              <div className="tl-line" />
            </div>
            <div className="tl-content">
              <div className="tl-label">Clinical Rule Engine Applied</div>
              <div className="tl-sub">
                {flagCount} rule{flagCount !== 1 ? 's' : ''} triggered · Score: {score}/100 · Classification: {prio}
              </div>
            </div>
          </div>
          <div className="timeline-item">
            <div className="tl-left">
              <div className="tl-dot tl-dot-done" />
              <div className="tl-line" />
            </div>
            <div className="tl-content">
              <div className="tl-label">AI Summary Generated</div>
              <div className="tl-sub">Clinician & patient summaries created via LLM</div>
            </div>
          </div>
          <div className="timeline-item">
            <div className="tl-left">
              <div className={`tl-dot ${prio === 'Critical' ? 'tl-dot-critical' : 'tl-dot-pending'}`} />
            </div>
            <div className="tl-content">
              <div className={`tl-label ${prio === 'Critical' ? 'tl-label-critical' : ''}`}>
                {prio === 'Critical' ? '🚨 IMMEDIATE Physician Review Required' : 'Awaiting Physician Review'}
              </div>
              <div className="tl-sub">
                {prio === 'Critical'
                  ? 'Report escalated — on-call clinician notified'
                  : prio === 'Urgent'
                    ? 'Prioritised in doctor queue'
                    : 'Standard queue — routine review'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Summaries ──────────────────────────────────────────────────────── */}
      <div className="summaries-container-vertical">
        <div className="summary-card clinician-card">
          <div className="summary-card-header clinician-card-header">
            <span>🩺</span>
            <span>Clinician Summary</span>
            <span className="summary-ai-tag">AI · Groq Llama</span>
          </div>
          <div className="summary-card-body">
            {report.clinician_summary || 'No summary available.'}
          </div>
        </div>
        <div className="summary-card patient-card">
          <div className="summary-card-header patient-card-header">
            <span>❤️</span>
            <span>Patient Summary</span>
            <span className="summary-ai-tag">Plain Language</span>
          </div>
          <div className="summary-card-body">
            {report.patient_summary || 'No summary available.'}
          </div>
        </div>
      </div>

    </div>
  )
}
