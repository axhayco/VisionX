import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ChevronDown,
  Info,
  Shield,
} from 'lucide-react';
import { formatReportId } from '../utils/text';

export const ReportDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const toast = useToast();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review Form State
  const [finalTriageLevel, setFinalTriageLevel] = useState('Routine');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selected Evidence Highlight State
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);

  const fetchAuditLogs = async () => {
    try {
      const res = await apiFetch(`/audit/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/reports/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Report #${id} not found.`);
      }
      setReport(data);
      setFinalTriageLevel(data.final_triage_level || data.triage_level || 'Routine');
      setDoctorNotes(data.doctor_notes || '');
      if (data.evidence && data.evidence.length > 0) {
        setSelectedEvidence(data.evidence[0]);
      }
      fetchAuditLogs();
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await apiFetch(`/reports/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_triage_level: finalTriageLevel,
          doctor_notes: doctorNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Review submission failed');
      }

      setReport(data);
      toast.success('Clinical review recorded');
      fetchAuditLogs();
    } catch (err) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const getBadgeClass = (level) => {
    const normalized = (level || '').toLowerCase();
    switch (normalized) {
      case 'critical':
        return 'badge-critical';
      case 'urgent':
        return 'badge-urgent';
      case 'priority':
        return 'badge-priority';
      case 'routine':
      default:
        return 'badge-routine';
    }
  };

  // Helper to render extracted_text with highlighted evidence value_text matches
  const renderHighlightedExtractedText = (text, evidenceList) => {
    if (!text) return 'No text content available.';
    if (!evidenceList || !Array.isArray(evidenceList) || evidenceList.length === 0) {
      return text;
    }

    const matches = [];
    const lowerText = text.toLowerCase();

    evidenceList.forEach((item, itemIdx) => {
      if (!item || !item.value_text || typeof item.value_text !== 'string') return;
      const cleanVal = item.value_text.trim();
      if (!cleanVal) return;

      const lowerVal = cleanVal.toLowerCase();
      let searchPos = 0;

      while (searchPos < text.length) {
        const foundIdx = lowerText.indexOf(lowerVal, searchPos);
        if (foundIdx === -1) break;

        matches.push({
          start: foundIdx,
          end: foundIdx + cleanVal.length,
          item,
          itemIdx,
          matchedText: text.substring(foundIdx, foundIdx + cleanVal.length),
        });

        searchPos = foundIdx + cleanVal.length;
      }
    });

    if (matches.length === 0) {
      return text;
    }

    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const nonOverlapping = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        nonOverlapping.push(m);
        lastEnd = m.end;
      }
    }

    const segments = [];
    let currentIdx = 0;

    nonOverlapping.forEach((m, idx) => {
      if (m.start > currentIdx) {
        segments.push(text.substring(currentIdx, m.start));
      }

      const isSelected = selectedEvidence && selectedEvidence.value_text === m.item.value_text;

      segments.push(
        <mark
          key={`evidence-${idx}`}
          className={`evidence-mark ${isSelected ? 'selected' : ''}`}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEvidence(m.item);
          }}
        >
          {m.matchedText}
          <span className="evidence-tooltip">
            <span className="tooltip-header">Triage rationale</span>
            <span className="tooltip-reason">{m.item.reason}</span>
          </span>
        </mark>
      );

      currentIdx = m.end;
    });

    if (currentIdx < text.length) {
      segments.push(text.substring(currentIdx));
    }

    return segments;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="detail-nav-bar">
          <button onClick={() => navigate('/queue')} className="btn-outline">
            <ArrowLeft size={14} />
            <span>Back to queue</span>
          </button>
        </div>
        <div className="skeleton-rows" style={{ marginTop: '20px' }}>
          <div className="skeleton-row shimmer" style={{ height: '140px' }}></div>
          <div className="skeleton-row shimmer" style={{ height: '240px' }}></div>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3 className="empty-state-title">Report not found</h3>
          <p className="empty-state-text">{error}</p>
          <button onClick={() => navigate('/queue')} className="btn-outline">
            <ArrowLeft size={14} />
            <span>Back to queue</span>
          </button>
        </div>
      </div>
    );
  }

  const isReviewed = report.status === 'reviewed';
  const evidenceList = report.evidence || [];

  return (
    <div className="page-container">
      {/* Top Breadcrumb / Action Row */}
      <div className="detail-nav-bar">
        <button
          type="button"
          onClick={() => navigate('/queue')}
          className="btn-outline"
          id="back-to-queue-btn"
        >
          <ArrowLeft size={14} />
          <span>Back to queue</span>
        </button>

        <div className="detail-nav-meta">
          <span className="status-badge">
            {report.status === 'reviewed' ? 'Reviewed' : 'Pending review'}
          </span>
          <span className="report-id-label">{formatReportId(report.id)}</span>
        </div>
      </div>

      {/* Main Grid: Left Clinical Findings, Right Sign-Off Panel */}
      <div className="detail-layout-grid">
        <div className="detail-main-column">
          {/* Hero Triage Card: Visual Hierarchy #1 */}
          <div className="panel-card hero-assessment-card">
            <div className="hero-assessment-header">
              <div>
                <div className="meta-label">Automated screening assessment</div>
                <div className="hero-badges-row">
                  <span
                    className={`triage-badge-hero ${getBadgeClass(
                      report.triage_level
                    )}`}
                  >
                    {report.triage_level}
                  </span>
                  {report.final_triage_level && (
                    <div className="physician-final-pill">
                      <span className="physician-pill-label">
                        Final decision:
                      </span>
                      <span
                        className={`triage-badge ${getBadgeClass(
                          report.final_triage_level
                        )}`}
                      >
                        {report.final_triage_level}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="hero-file-meta">
                <div className="file-title">{report.filename}</div>
                <div className="file-date">
                  {report.created_at
                    ? new Date(report.created_at).toLocaleString()
                    : 'N/A'}
                </div>
              </div>
            </div>

            <div className="hero-reasoning-block">
              <div className="reasoning-heading">Clinical reasoning</div>
              <p className="reasoning-paragraph">{report.reasoning}</p>
            </div>
          </div>

          {/* Flagged Values Table */}
          <div className="panel-card">
            <div className="panel-header">
              <h2 className="panel-title">
                Abnormal biomarkers ({report.flagged_values?.length || 0})
              </h2>
            </div>

            {report.flagged_values && report.flagged_values.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Biomarker</th>
                      <th>Observed value</th>
                      <th>Reference range</th>
                      <th>Flag status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.flagged_values.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold">
                          {typeof item === 'object' ? item.test : item}
                        </td>
                        <td>
                          {typeof item === 'object' ? item.value : 'Abnormal'}
                        </td>
                        <td className="text-muted">
                          {typeof item === 'object'
                            ? item.reference_range || '—'
                            : '—'}
                        </td>
                        <td>
                          <span className="flag-tag">
                            {typeof item === 'object'
                              ? item.flag || 'High'
                              : 'Abnormal'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-empty-text">
                All extracted laboratory biomarkers are within normal reference
                ranges.
              </div>
            )}
          </div>

          {/* Extracted Text with Highlighted Evidence Substrings */}
          <div className="panel-card">
            <details className="raw-text-accordion" open>
              <summary className="accordion-summary">
                <div className="accordion-title-group">
                  <span className="panel-title">Document text & evidence</span>
                  {evidenceList.length > 0 && (
                    <span className="badge-ghost">
                      {evidenceList.length} highlighted
                    </span>
                  )}
                </div>
                <span className="accordion-hint">Click to collapse</span>
              </summary>

              <div className="accordion-body">
                {/* Evidence Selectors */}
                {evidenceList.length > 0 && (
                  <div className="evidence-toolbar">
                    <span className="toolbar-label">Evidence snippets:</span>
                    <div className="evidence-buttons">
                      {evidenceList.map((ev, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`btn-chip ${
                            selectedEvidence?.value_text === ev.value_text
                              ? 'active'
                              : ''
                          }`}
                          onClick={() => setSelectedEvidence(ev)}
                        >
                          "{ev.value_text}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Evidence Highlight Note Panel */}
                {selectedEvidence && (
                  <div className="evidence-detail-panel">
                    <div className="evidence-panel-header">
                      <span className="evidence-panel-title">
                        Triage driver rationale
                      </span>
                      <code className="evidence-quote">
                        "{selectedEvidence.value_text}"
                      </code>
                    </div>
                    <p className="evidence-panel-text">
                      {selectedEvidence.reason}
                    </p>
                  </div>
                )}

                {/* Document Preformatted Text */}
                <div className="document-text-container">
                  <pre className="document-pre">
                    {renderHighlightedExtractedText(
                      report.extracted_text,
                      evidenceList
                    )}
                  </pre>
                </div>
              </div>
            </details>
          </div>

          {/* Access Audit Trail */}
          <div className="panel-card">
            <div className="panel-header">
              <h2 className="panel-title">
                Access audit trail ({auditLogs.length})
              </h2>
              <span className="text-muted text-xs">HIPAA compliance</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="panel-empty-text">
                No access events recorded yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }}>Timestamp</th>
                      <th>User</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-muted text-xs whitespace-nowrap">
                          {log.timestamp
                            ? new Date(log.timestamp).toLocaleDateString(
                                undefined,
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )
                            : '—'}
                        </td>
                        <td className="font-semibold">{log.username}</td>
                        <td className="text-muted text-xs capitalize">
                          {log.user_role}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="audit-tag">
                            {log.action === 'uploaded_report' && 'Uploaded'}
                            {log.action === 'viewed_report' && 'Viewed'}
                            {log.action === 'reviewed_report' && 'Signed off'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Sign-Off Side Panel */}
        <div className="detail-sidebar-column">
          <div className="panel-card review-sidebar-panel">
            <div className="sidebar-header">
              <h3 className="sidebar-title">Clinical sign-off</h3>
              <p className="sidebar-subtitle">
                {isReviewed
                  ? 'Clinical review is complete.'
                  : 'Confirm or modify urgency level and attach notes.'}
              </p>
            </div>

            {isReviewed ? (
              <div className="reviewed-complete-box">
                <div className="reviewed-complete-badge">
                  <CheckCircle2 size={16} />
                  <span>Review recorded</span>
                </div>

                <div className="review-meta-item">
                  <div className="meta-label">Final triage level</div>
                  <div>
                    <span
                      className={`triage-badge ${getBadgeClass(
                        report.final_triage_level
                      )}`}
                    >
                      {report.final_triage_level}
                    </span>
                  </div>
                </div>

                <div className="review-meta-item">
                  <div className="meta-label">AI suggestion</div>
                  <div>
                    <span
                      className={`triage-badge ${getBadgeClass(
                        report.triage_level
                      )}`}
                    >
                      {report.triage_level}
                    </span>
                  </div>
                </div>

                <div className="review-meta-item">
                  <div className="meta-label">Physician notes</div>
                  <div className="notes-box">
                    {report.doctor_notes || 'No notes provided.'}
                  </div>
                </div>

                <div className="review-meta-item">
                  <div className="meta-label">Reviewed at</div>
                  <div className="text-muted text-xs">
                    {report.reviewed_at
                      ? new Date(report.reviewed_at).toLocaleString()
                      : '—'}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-outline full-width"
                  onClick={() => navigate('/queue')}
                >
                  Return to queue
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="signoff-form">
                <div className="form-group">
                  <label htmlFor="review-final-level">
                    Physician urgency decision
                  </label>
                  <select
                    id="review-final-level"
                    value={finalTriageLevel}
                    onChange={(e) => setFinalTriageLevel(e.target.value)}
                    disabled={submitting}
                    className="form-select"
                  >
                    <option value="Critical">Critical (Immediate action)</option>
                    <option value="Urgent">Urgent (Within 24 hours)</option>
                    <option value="Priority">Priority (48-72 hours)</option>
                    <option value="Routine">Routine (Standard follow-up)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="review-notes">Clinical notes</label>
                  <textarea
                    id="review-notes"
                    rows="4"
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Enter clinical assessment or next-step orders..."
                    disabled={submitting}
                    className="form-textarea"
                  />
                </div>

                <button
                  type="submit"
                  id="submit-review-btn"
                  className="btn-primary full-width"
                  disabled={submitting}
                >
                  {submitting ? 'Recording...' : 'Complete review'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
