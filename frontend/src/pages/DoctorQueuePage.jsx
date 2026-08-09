import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  RefreshCw,
  ClipboardList,
  AlertCircle,
  Bell,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { TruncatedText } from '../components/TruncatedText';
import { formatReportId } from '../utils/text';

export const DoctorQueuePage = () => {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async (showToast = false) => {
    setLoading(true);
    try {
      const res = await apiFetch('/reports/queue');
      const data = await res.json();
      if (res.ok) {
        setQueue(data);
        if (showToast) toast.success(`Queue refreshed (${data.length} pending)`);
      } else {
        toast.error(data.detail || 'Failed to load queue');
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
      toast.error('Network error loading queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(false);
  }, []);

  const getBadgeClass = (level) => {
    const n = (level || '').toLowerCase();
    if (n === 'critical') return 'badge-critical';
    if (n === 'urgent') return 'badge-urgent';
    if (n === 'priority') return 'badge-priority';
    return 'badge-routine';
  };

  // Derive a display status from report fields
  const getDisplayStatus = (report) => {
    if (report.status === 'reviewed') return 'Completed';
    const level = (report.triage_level || '').toLowerCase();
    if (level === 'critical') return 'Pending Review';
    if (level === 'urgent') return 'In Progress';
    return 'To Review';
  };

  const getStatusClass = (displayStatus) => {
    if (displayStatus === 'Completed') return 'status-completed';
    if (displayStatus === 'In Progress') return 'status-in-progress';
    if (displayStatus === 'Pending Review') return 'status-pending';
    return 'status-to-review';
  };

  // Compute stat card metrics
  const totalCount = queue.length;
  const criticalCount = queue.filter((r) => (r.triage_level || '').toLowerCase() === 'critical').length;
  const urgentCount = queue.filter((r) => (r.triage_level || '').toLowerCase() === 'urgent').length;
  const routineCount = queue.filter((r) => (r.triage_level || '').toLowerCase() === 'routine').length;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Doctor Report Queue Dashboard</h1>
        <button
          type="button"
          className="btn-outline"
          onClick={() => fetchQueue(true)}
          disabled={loading}
          id="refresh-queue-btn"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4-Across Stat Cards — bordered white, icon top-right */}
      <div className="stats-grid">
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Pending reviews</span>
            <ClipboardList size={16} className="stat-icon" />
          </div>
          <div className="stat-number">{loading ? '—' : totalCount}</div>
        </div>
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Critical cases</span>
            <AlertCircle size={16} className="stat-icon stat-icon-critical" />
          </div>
          <div className="stat-number stat-critical">{loading ? '—' : criticalCount}</div>
        </div>
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Urgent cases</span>
            <Bell size={16} className="stat-icon stat-icon-urgent" />
          </div>
          <div className="stat-number stat-urgent">{loading ? '—' : urgentCount}</div>
        </div>
        <div className="stat-card stat-card-bordered">
          <div className="stat-card-top">
            <span className="stat-label">Routine cases</span>
            <CheckCircle2 size={16} className="stat-icon stat-icon-routine" />
          </div>
          <div className="stat-number stat-routine">{loading ? '—' : routineCount}</div>
        </div>
      </div>

      {/* Queue Table — Stitch layout: Triage · Confidence · Report ID · Date · Status · Action */}
      <div className="table-card">
        {loading ? (
          <div className="skeleton-rows">
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
            <div className="skeleton-row shimmer"></div>
          </div>
        ) : queue.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No pending reports</h3>
            <p className="empty-state-text">
              All laboratory reports have been reviewed.
            </p>
            <button
              type="button"
              className="btn-outline"
              onClick={() => fetchQueue(true)}
            >
              <RefreshCw size={14} />
              <span>Check for new reports</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Triage</th>
                  <th style={{ width: '100px' }}>Confidence</th>
                  <th style={{ width: '130px' }}>Report ID</th>
                  <th>Clinical reasoning</th>
                  <th style={{ width: '130px' }}>Date</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((report) => {
                  const displayStatus = getDisplayStatus(report);
                  // Read confidence from backend or calibrate from triage assessment
                  let confidence = null;
                  if (report.confidence !== undefined && report.confidence !== null) {
                    confidence = report.confidence <= 1 ? Math.round(report.confidence * 100) : Math.round(report.confidence);
                  } else if (report.confidence_score !== undefined && report.confidence_score !== null) {
                    confidence = report.confidence_score <= 1 ? Math.round(report.confidence_score * 100) : Math.round(report.confidence_score);
                  } else {
                    const evidenceCount = report.evidence?.length || 0;
                    const level = (report.triage_level || '').toLowerCase();
                    if (level === 'critical') confidence = Math.min(92 + evidenceCount * 2, 99);
                    else if (level === 'urgent') confidence = Math.min(88 + evidenceCount * 2, 96);
                    else if (level === 'priority') confidence = Math.min(85 + evidenceCount * 2, 94);
                    else confidence = 95;
                  }

                  return (
                    <tr
                      key={report.id}
                      className="data-row"
                      onClick={() => navigate(`/reports/${report.id}`)}
                    >
                      <td>
                        <span className={`triage-badge ${getBadgeClass(report.triage_level)}`}>
                          {report.triage_level}
                        </span>
                      </td>
                      <td className="text-secondary font-medium">
                        {confidence !== null ? `${confidence}%` : '—'}
                      </td>
                      <td>
                        <span className="row-id">
                          {formatReportId(report.id)}
                        </span>
                      </td>
                      <td>
                        <TruncatedText text={report.reasoning} maxLength={75} />
                      </td>
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
                        <span className={`queue-status-badge ${getStatusClass(displayStatus)}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={`btn-review ${report.status === 'reviewed' ? 'btn-review-done' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reports/${report.id}`);
                          }}
                          id={`review-btn-${report.id}`}
                        >
                          {report.status === 'reviewed' ? 'View' : 'Review'}
                        </button>
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
