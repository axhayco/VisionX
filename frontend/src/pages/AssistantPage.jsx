import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  UploadCloud,
  FileText,
  RefreshCw,
  CheckCircle2,
  X,
  Files,
  Loader,
  AlertCircle,
} from 'lucide-react';
import { formatReportId } from '../utils/text';

export const AssistantPage = () => {
  const { apiFetch } = useAuth();
  const toast = useToast();

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const fetchMyReports = async (showToast = false) => {
    setLoadingReports(true);
    try {
      const res = await apiFetch('/reports/mine');
      const data = await res.json();
      if (res.ok) {
        setMyReports(data);
        if (showToast) toast.success(`History refreshed (${data.length} reports)`);
      } else {
        toast.error(data.detail || 'Failed to load upload history');
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      toast.error('Network error loading reports');
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchMyReports(false);
  }, []);

  const handleFileSelect = (file) => {
    setResult(null);
    if (!file) return;
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a valid PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10 MB limit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLoadSampleFile = async (e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/sample_report.pdf');
      const blob = await res.blob();
      handleFileSelect(new File([blob], 'sample_report.pdf', { type: 'application/pdf' }));
    } catch {
      toast.error('Could not load sample report.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) { toast.error('Please select a PDF report.'); return; }
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const response = await apiFetch('/triage', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `Error (${response.status})`);
      setResult(data);
      toast.success(`Report #${data.id} triaged: ${data.triage_level}`);
      fetchMyReports(false);
    } catch (err) {
      toast.error(err.message || 'Triage failed.');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeClass = (level) => {
    const n = (level || '').toLowerCase();
    if (n === 'critical') return 'badge-critical';
    if (n === 'urgent') return 'badge-urgent';
    if (n === 'priority') return 'badge-priority';
    return 'badge-routine';
  };

  // Derive a Stitch-style status label for each report
  const getUploadStatus = (report) => {
    if (report.status === 'reviewed') return { label: 'Uploaded', cls: 'upload-status-uploaded' };
    const level = (report.triage_level || '').toLowerCase();
    if (level === 'critical') return { label: 'Processing', cls: 'upload-status-processing' };
    if (level === 'urgent')   return { label: 'Uploaded',   cls: 'upload-status-uploaded' };
    return { label: 'Uploaded', cls: 'upload-status-uploaded' };
  };

  const todayCount = myReports.filter((r) => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const processingCount = myReports.filter((r) => r.status !== 'reviewed' && (r.triage_level || '').toLowerCase() === 'critical').length;
  const failedCount = 0; // no failed state in current model
  const completedCount = myReports.filter((r) => r.status === 'reviewed').length;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '4px' }}>
        <h1 className="page-title">Lab report intake</h1>
      </div>

      {/* Stat Cards — Stitch: bordered white cards, icon top-left beside label */}
      <div className="stats-grid">
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Uploads today</span>
            <UploadCloud size={16} className="stat-icon" />
          </div>
          <div className="stat-number">{loadingReports ? '—' : todayCount}</div>
        </div>
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Processing</span>
            <Loader size={16} className="stat-icon stat-icon-urgent" />
          </div>
          <div className="stat-number stat-urgent">{loadingReports ? '—' : processingCount}</div>
        </div>
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Failed</span>
            <AlertCircle size={16} className="stat-icon stat-icon-critical" />
          </div>
          <div className="stat-number stat-critical">{loadingReports ? '—' : failedCount}</div>
        </div>
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Completed</span>
            <CheckCircle2 size={16} className="stat-icon stat-icon-routine" />
          </div>
          <div className="stat-number stat-routine">{loadingReports ? '—' : completedCount}</div>
        </div>
      </div>

      {/* Upload Zone — Stitch: centered dashed box, icon, heading, subtext, Upload button */}
      <div className="upload-zone-card">
        <form onSubmit={handleSubmit}>
          <div
            id="dropzone-area"
            className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            <input
              type="file"
              id="file-upload-input"
              ref={fileInputRef}
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />

            <div className="upload-dropzone-icon">
              <UploadCloud size={32} strokeWidth={1.5} />
            </div>

            {selectedFile ? (
              <>
                <div className="upload-dropzone-title">Ready to upload</div>
                <div className="upload-file-strip">
                  <FileText size={15} />
                  <span className="upload-file-name">{selectedFile.name}</span>
                  <button
                    type="button"
                    className="btn-ghost-icon"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="upload-dropzone-title">Upload lab reports</div>
                <div className="upload-dropzone-sub">
                  Drag and drop files here, or click to select from your computer.<br />
                  Supported formats: PDF
                </div>
                <button
                  type="button"
                  className="btn-link"
                  onClick={(e) => { e.stopPropagation(); handleLoadSampleFile(e); }}
                >
                  Load demo CBC report
                </button>
              </>
            )}
          </div>

          <div className="upload-action-center">
            <button
              type="submit"
              id="analyze-btn"
              className="btn-primary"
              disabled={!selectedFile || loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={14} />
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Triage Result (shown after successful upload) */}
      {result && (
        <div className="panel-card" id="triage-result-card">
          <div className="panel-header">
            <div>
              <div className="meta-label">Screening result</div>
              <h2 className="panel-title">{result.filename}</h2>
            </div>
            <span className={`triage-badge ${getBadgeClass(result.triage_level)}`} id="triage-badge-result">
              {result.triage_level}
            </span>
          </div>
          <div className="result-block">
            <div className="meta-label">Reasoning</div>
            <p className="result-reasoning-text">{result.reasoning}</p>
          </div>
          {result.flagged_values?.length > 0 && (
            <div className="result-block">
              <div className="meta-label">Flagged values</div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Biomarker</th>
                      <th>Observed value</th>
                      <th>Reference range</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.flagged_values.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold">{typeof item === 'object' ? item.test : item}</td>
                        <td>{typeof item === 'object' ? item.value : 'Abnormal'}</td>
                        <td className="text-muted">{typeof item === 'object' ? item.reference_range || '—' : '—'}</td>
                        <td><span className="flag-tag">{typeof item === 'object' ? item.flag || 'High' : 'Abnormal'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="disclaimer-text">
            Automated screening is decision support for physician review, not a formal diagnosis.
          </div>
        </div>
      )}

      {/* Recent Uploads — Stitch layout: Report ID · Status · Timestamp */}
      <div className="table-card">
        <div className="table-card-header">
          <h2 className="table-card-title">Recent uploads</h2>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => fetchMyReports(true)}
            disabled={loadingReports}
          >
            <RefreshCw size={12} className={loadingReports ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loadingReports ? (
          <div className="skeleton-rows">
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
          </div>
        ) : myReports.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No submissions yet</h3>
            <p className="empty-state-text">
              Upload a laboratory report to begin screening.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '200px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {myReports.map((report) => {
                  const { label, cls } = getUploadStatus(report);
                  return (
                    <tr key={report.id} className="data-row">
                      <td>
                        <div className="report-id-cell">
                          <FileText size={14} className="text-muted" />
                          <span className="row-id">
                            {formatReportId(report.id)}
                          </span>
                          <span className="report-filename-sub">{report.filename}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`upload-status-pill ${cls}`}>{label}</span>
                      </td>
                      <td className="text-muted text-xs whitespace-nowrap">
                        {report.created_at
                          ? new Date(report.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
