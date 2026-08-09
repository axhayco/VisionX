import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  Eye,
  SlidersHorizontal,
  ArrowRightLeft,
  UserCheck,
} from 'lucide-react';
import { TruncatedText } from '../components/TruncatedText';
import { formatReportId } from '../utils/text';

const ITEMS_PER_PAGE = 10;

export const ReportsListPage = () => {
  const { user, apiFetch } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'reviewed'
  const [triageFilter, setTriageFilter] = useState('all'); // 'all' | 'critical' | 'urgent' | 'priority' | 'routine'
  const [currentPage, setCurrentPage] = useState(1);

  const isDoctor = user?.role === 'doctor';

  const fetchReports = async (showToast = false) => {
    setLoading(true);
    try {
      const res = await apiFetch('/reports');
      const data = await res.json();
      if (res.ok) {
        setReports(data);
        if (showToast) toast.success(`Reports refreshed (${data.length} total)`);
      } else {
        toast.error(data.detail || 'Failed to load reports');
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      toast.error('Network error loading reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(false);
  }, []);

  // Filtered reports calculation
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Status filter
      if (statusFilter !== 'all') {
        const reportStatus = (report.status || '').toLowerCase();
        if (reportStatus !== statusFilter) return false;
      }

      // Triage filter
      if (triageFilter !== 'all') {
        const reportTriage = (report.triage_level || '').toLowerCase();
        if (reportTriage !== triageFilter) return false;
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const idMatch = formatReportId(report.id).toLowerCase().includes(term) || String(report.id).includes(term);
        const filenameMatch = (report.filename || '').toLowerCase().includes(term);
        const reasoningMatch = (report.reasoning || '').toLowerCase().includes(term);
        const notesMatch = (report.doctor_notes || '').toLowerCase().includes(term);
        const reviewerMatch = (report.reviewed_by_name || '').toLowerCase().includes(term);
        const finalTriageMatch = (report.final_triage_level || '').toLowerCase().includes(term);
        if (!idMatch && !filenameMatch && !reasoningMatch && !notesMatch && !reviewerMatch && !finalTriageMatch) {
          return false;
        }
      }

      return true;
    });
  }, [reports, statusFilter, triageFilter, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / ITEMS_PER_PAGE));
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, triageFilter]);

  const getBadgeClass = (level) => {
    const n = (level || '').toLowerCase();
    if (n === 'critical') return 'badge-critical';
    if (n === 'urgent') return 'badge-urgent';
    if (n === 'priority') return 'badge-priority';
    return 'badge-routine';
  };

  const getConfidenceScore = (report) => {
    if (report.confidence !== undefined && report.confidence !== null) {
      return report.confidence <= 1 ? Math.round(report.confidence * 100) : Math.round(report.confidence);
    }
    const evidenceCount = report.evidence?.length || 0;
    const level = (report.triage_level || '').toLowerCase();
    if (level === 'critical') return Math.min(92 + evidenceCount * 2, 99);
    if (level === 'urgent') return Math.min(88 + evidenceCount * 2, 96);
    if (level === 'priority') return Math.min(85 + evidenceCount * 2, 94);
    return 95;
  };

  // Metrics for stats row
  const totalCount = reports.length;
  const pendingCount = reports.filter((r) => (r.status || '').toLowerCase() === 'pending').length;
  const reviewedCount = reports.filter((r) => (r.status || '').toLowerCase() === 'reviewed').length;
  const criticalCount = reports.filter((r) => (r.triage_level || '').toLowerCase() === 'critical').length;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isDoctor ? 'All Laboratory Reports' : 'My Uploaded Reports'}
          </h1>
          <p className="page-subtitle text-muted text-sm" style={{ marginTop: '2px' }}>
            {isDoctor
              ? 'Complete database of pending and reviewed laboratory triage records'
              : 'Detailed history of all lab report documents you have submitted for screening'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-outline"
            onClick={() => fetchReports(true)}
            disabled={loading}
            id="refresh-reports-btn"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">{isDoctor ? 'Total Reports' : 'Total Uploads'}</span>
            <FileText size={16} className="stat-icon" />
          </div>
          <div className="stat-number">{loading ? '—' : totalCount}</div>
        </div>

        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Pending Review</span>
            <Clock size={16} className="stat-icon stat-icon-urgent" />
          </div>
          <div className="stat-number stat-urgent">{loading ? '—' : pendingCount}</div>
        </div>

        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Reviewed</span>
            <CheckCircle2 size={16} className="stat-icon stat-icon-routine" />
          </div>
          <div className="stat-number stat-routine">{loading ? '—' : reviewedCount}</div>
        </div>

        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Critical Flagged</span>
            <AlertCircle size={16} className="stat-icon stat-icon-critical" />
          </div>
          <div className="stat-number stat-critical">{loading ? '—' : criticalCount}</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div
        className="table-card"
        style={{
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search Box */}
        <div style={{ position: 'relative', minWidth: '240px', flex: '1' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #94a3b8)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', height: '36px', fontSize: '0.86rem' }}
            placeholder="Search by Report ID, filename, findings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Dropdowns / Groups */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="text-xs text-muted font-medium">Status:</span>
            <select
              className="form-input"
              style={{ height: '36px', fontSize: '0.84rem', padding: '4px 28px 4px 10px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="text-xs text-muted font-medium">Triage:</span>
            <select
              className="form-input"
              style={{ height: '36px', fontSize: '0.84rem', padding: '4px 28px 4px 10px' }}
              value={triageFilter}
              onChange={(e) => setTriageFilter(e.target.value)}
            >
              <option value="all">All Urgency Levels</option>
              <option value="critical">Critical</option>
              <option value="urgent">Urgent</option>
              <option value="priority">Priority</option>
              <option value="routine">Routine</option>
            </select>
          </div>

          {(searchTerm || statusFilter !== 'all' || triageFilter !== 'all') && (
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.82rem', height: '36px', padding: '0 8px' }}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTriageFilter('all');
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Reports Table */}
      <div className="table-card">
        {loading ? (
          <div className="skeleton-rows">
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No reports matching filters</h3>
            <p className="empty-state-text">
              {reports.length === 0
                ? 'No laboratory reports have been recorded yet.'
                : 'Try adjusting your search query or filter settings.'}
            </p>
            {reports.length > 0 && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setTriageFilter('all');
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '105px' }}>AI Triage</th>
                    {isDoctor && <th style={{ width: '130px' }}>Final Triage</th>}
                    {isDoctor && <th style={{ width: '90px' }}>Confidence</th>}
                    <th style={{ width: '115px' }}>Report ID</th>
                    <th style={{ width: '160px' }}>Document</th>
                    <th>{isDoctor ? 'Clinical reasoning & findings' : 'AI Screening Reasoning'}</th>
                    {isDoctor && <th style={{ width: '120px' }}>Reviewed by</th>}
                    <th style={{ width: '105px' }}>Date</th>
                    <th style={{ width: '100px' }}>Status</th>
                    {isDoctor && (
                      <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.map((report) => {
                    const isReviewed = (report.status || '').toLowerCase() === 'reviewed';
                    const confidence = getConfidenceScore(report);
                    const isOverridden =
                      isReviewed &&
                      report.final_triage_level &&
                      report.triage_level &&
                      report.final_triage_level.toLowerCase() !== report.triage_level.toLowerCase();

                    return (
                      <tr
                        key={report.id}
                        className="data-row"
                        style={{ cursor: isDoctor ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (isDoctor) navigate(`/reports/${report.id}`);
                        }}
                      >
                        {/* AI Triage */}
                        <td>
                          <span className={`triage-badge ${getBadgeClass(report.triage_level)}`}>
                            {report.triage_level}
                          </span>
                        </td>

                        {/* Final Triage (Doctor only) */}
                        {isDoctor && (
                          <td>
                            {isReviewed && report.final_triage_level ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                <span className={`triage-badge ${getBadgeClass(report.final_triage_level)}`}>
                                  {report.final_triage_level}
                                </span>
                                {isOverridden && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      color: 'var(--urgent-text, #d97706)',
                                      backgroundColor: 'var(--urgent-bg, #fffbeb)',
                                      border: '1px solid var(--urgent-border, #fde68a)',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      lineHeight: '1.2',
                                    }}
                                    title={`AI suggested ${report.triage_level}, overridden by physician to ${report.final_triage_level}`}
                                  >
                                    <ArrowRightLeft size={9} />
                                    <span>Overridden</span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        )}

                        {isDoctor && (
                          <td className="text-secondary font-medium text-xs">
                            {confidence}%
                          </td>
                        )}

                        <td>
                          <span className="row-id">
                            {formatReportId(report.id)}
                          </span>
                        </td>

                        <td>
                          <span
                            className="row-filename"
                            title={report.filename}
                            style={{
                              maxWidth: '150px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                            }}
                          >
                            {report.filename}
                          </span>
                        </td>

                        <td>
                          <TruncatedText text={report.reasoning} maxLength={70} />
                        </td>

                        {/* Reviewed by */}
                        {isDoctor && (
                          <td>
                            {isReviewed ? (
                              <span
                                className="text-xs font-medium text-secondary"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <UserCheck size={13} style={{ color: 'var(--routine-text, #16a34a)' }} />
                                <span>{report.reviewed_by_name || 'Physician'}</span>
                              </span>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        )}

                        <td className="text-muted text-xs whitespace-nowrap">
                          {report.created_at
                            ? new Date(report.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Recent'}
                        </td>

                        <td>
                          <span
                            className={`queue-status-badge ${
                              isReviewed ? 'status-completed' : 'status-pending'
                            }`}
                          >
                            {isReviewed ? 'Reviewed' : 'Pending'}
                          </span>
                        </td>

                        {isDoctor && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className={`btn-review ${isReviewed ? 'btn-review-done' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/reports/${report.id}`);
                              }}
                              id={`action-report-btn-${report.id}`}
                              title={isReviewed ? 'View clinical review record' : 'Perform clinical review'}
                            >
                              {isReviewed ? 'View' : 'Review'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Toolbar */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                }}
              >
                <span className="text-xs text-muted">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredReports.length)} of{' '}
                  {filteredReports.length} reports
                </span>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '4px 8px', height: '30px' }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>

                  <span className="text-xs text-secondary font-medium" style={{ padding: '0 8px' }}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '4px 8px', height: '30px' }}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
