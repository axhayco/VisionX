import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  User,
  Shield,
  Bell,
  CheckCircle2,
  Lock,
  Server,
  FileCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';

export const SettingsPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const isDoctor = user?.role === 'doctor';

  // Notification Preferences State
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [criticalTriageAlerts, setCriticalTriageAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);

  const handleToggle = (setter, currentValue, label) => {
    setter(!currentValue);
    toast.success(`${label} ${!currentValue ? 'enabled' : 'disabled'}`);
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">System &amp; User Settings</h1>
          <p className="page-subtitle text-muted text-sm" style={{ marginTop: '2px' }}>
            Manage clinical account information, security policies, and notification preferences
          </p>
        </div>
      </div>

      <div className="settings-container">
        {/* =================================================================
            1. Account Section
            ================================================================= */}
        <section className="settings-section-card">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <User size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="settings-section-title">Account Information</h2>
              <p className="settings-section-desc">
                Current clinical portal profile and authentication identity
              </p>
            </div>
          </div>

          <div className="settings-section-body">
            <div className="settings-grid-cols-3">
              <div className="settings-field-block">
                <span className="settings-field-label">Username / ID</span>
                <span className="settings-field-value">{user?.username || '—'}</span>
              </div>

              <div className="settings-field-block">
                <span className="settings-field-label">System Role</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="settings-field-value">
                    {isDoctor ? 'Reviewing Physician' : 'Lab Assistant'}
                  </span>
                  <span className="user-role-tag role-doctor" style={{ textTransform: 'capitalize' }}>
                    {user?.role || 'User'}
                  </span>
                </div>
              </div>

              <div className="settings-field-block">
                <span className="settings-field-label">Access Level</span>
                <span className="settings-field-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="settings-badge-ok">
                    <CheckCircle2 size={12} />
                    <span>{isDoctor ? 'Full Clinical Review' : 'Triage Intake Only'}</span>
                  </span>
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} />
                <span>Account permissions are managed by the hospital IT administration.</span>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            2. Security & Compliance Section
            ================================================================= */}
        <section className="settings-section-card">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <Shield size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="settings-section-title">Security &amp; HIPAA Compliance</h2>
              <p className="settings-section-desc">
                Protected Health Information (PHI) safeguards and session security status
              </p>
            </div>
          </div>

          <div className="settings-section-body">
            <div className="settings-grid-cols-2" style={{ marginBottom: '24px' }}>
              <div className="settings-field-block">
                <span className="settings-field-label">Authentication Method</span>
                <div className="settings-field-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="settings-badge-ok">
                    <Lock size={12} />
                    <span>JWT via Secure httpOnly Cookie</span>
                  </span>
                </div>
              </div>

              <div className="settings-field-block">
                <span className="settings-field-label">Data Retention (Auto-Redaction)</span>
                <div className="settings-field-value">
                  <span className="settings-badge-ok">
                    <Clock size={12} />
                    <span>24-Hour Automated PHI Redaction</span>
                  </span>
                </div>
              </div>

              <div className="settings-field-block">
                <span className="settings-field-label">Audit Trail Logging</span>
                <div className="settings-field-value">
                  <span className="settings-badge-ok">
                    <FileCheck size={12} />
                    <span>Immutable Event Logging Active</span>
                  </span>
                </div>
              </div>

              <div className="settings-field-block">
                <span className="settings-field-label">AI Inference Engine</span>
                <div className="settings-field-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                  <span>Groq Cloud (Zero Data Retention)</span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                background: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-color, #eaecf0)',
                borderRadius: 'var(--radius-md, 6px)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary, #475569)',
                lineHeight: '1.5',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Compliance Guarantee:</strong> All report
              text parsed from uploaded PDF documents is strictly de-identified in runtime memory and
              automatically sanitized per 45 CFR § 164.514 HIPAA safe harbor guidelines.
            </div>
          </div>
        </section>

        {/* =================================================================
            3. Notification Preferences Section
            ================================================================= */}
        <section className="settings-section-card">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <Bell size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="settings-section-title">Notification Preferences</h2>
              <p className="settings-section-desc">
                Configure real-time alerts for critical findings and triage updates
              </p>
            </div>
          </div>

          <div className="settings-section-body">
            <div className="settings-switch-row">
              <div className="settings-switch-info">
                <div className="settings-switch-title">Immediate Critical Triage Alerts</div>
                <div className="settings-switch-desc">
                  Receive instant high-priority alerts whenever a lab report flags critical/life-threatening values
                </div>
              </div>
              <button
                type="button"
                className={`settings-toggle-btn ${criticalTriageAlerts ? 'active' : ''}`}
                onClick={() =>
                  handleToggle(setCriticalTriageAlerts, criticalTriageAlerts, 'Critical triage alerts')
                }
                aria-label="Toggle Critical triage alerts"
              >
                <div className="settings-toggle-thumb" />
              </button>
            </div>

            <div className="settings-switch-row">
              <div className="settings-switch-info">
                <div className="settings-switch-title">In-App Workflow Notifications</div>
                <div className="settings-switch-desc">
                  Display toast notifications for new uploads, status changes, and clinical review completions
                </div>
              </div>
              <button
                type="button"
                className={`settings-toggle-btn ${emailAlerts ? 'active' : ''}`}
                onClick={() => handleToggle(setEmailAlerts, emailAlerts, 'In-app notifications')}
                aria-label="Toggle In-app notifications"
              >
                <div className="settings-toggle-thumb" />
              </button>
            </div>

            <div className="settings-switch-row">
              <div className="settings-switch-info">
                <div className="settings-switch-title">Daily Summary Digest</div>
                <div className="settings-switch-desc">
                  Receive a daily summary of completed clinical reviews and outstanding pending queue items
                </div>
              </div>
              <button
                type="button"
                className={`settings-toggle-btn ${dailyDigest ? 'active' : ''}`}
                onClick={() => handleToggle(setDailyDigest, dailyDigest, 'Daily digest')}
                aria-label="Toggle Daily digest"
              >
                <div className="settings-toggle-thumb" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
