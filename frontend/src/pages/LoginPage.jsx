import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Stethoscope, FlaskConical, ArrowLeft, Activity, RefreshCw } from 'lucide-react';

export const LoginPage = () => {
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Step 1: role selection  |  Step 2: credentials
  const [step, setStep] = useState('role'); // 'role' | 'credentials'
  const [selectedRole, setSelectedRole] = useState(null); // 'doctor' | 'lab_assistant'
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRoleRedirect = (userObj) => {
    toast.success(`Signed in as ${userObj.username}`);
    if (userObj.role === 'doctor') navigate('/queue');
    else navigate('/assistant');
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setStep('credentials');
    setError(null);
  };

  const handleBack = () => {
    setStep('role');
    setError(null);
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let userObj;
      if (mode === 'register') {
        userObj = await register(username, password, selectedRole);
      } else {
        userObj = await login(username, password);
      }
      handleRoleRedirect(userObj);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    const demoCreds =
      selectedRole === 'doctor'
        ? { u: 'doctor', p: 'doctor123' }
        : { u: 'lab_assistant', p: 'assistant123' };
    try {
      const userObj = await login(demoCreds.u, demoCreds.p);
      handleRoleRedirect(userObj);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = selectedRole === 'doctor' ? 'Doctor' : 'Lab Assistant';
  const demoUser = selectedRole === 'doctor' ? 'doctor' : 'lab_assistant';

  return (
    <div className="role-gateway-wrapper">
      {/* ── STEP 1: Role Selection ── */}
      {step === 'role' && (
        <main className="role-gateway-main">
          {/* Header */}
          <div className="role-gateway-header">
            <h1 className="role-gateway-title">Select your role</h1>
            <p className="role-gateway-sub">Choose your access point to the portal.</p>
          </div>

          {/* Two role cards */}
          <div className="role-cards-grid">
            {/* Doctor card */}
            <button
              type="button"
              id="select-doctor-btn"
              className="role-card"
              onClick={() => handleRoleSelect('doctor')}
            >
              <div className="role-card-icon-wrap">
                <Stethoscope size={28} strokeWidth={1.6} />
              </div>
              <h2 className="role-card-title">Doctor</h2>
              <p className="role-card-desc">Access medical records and report queue.</p>
              <span className="role-card-cta">Sign in as Doctor</span>
            </button>

            {/* Lab Assistant card */}
            <button
              type="button"
              id="select-lab-assistant-btn"
              className="role-card"
              onClick={() => handleRoleSelect('lab_assistant')}
            >
              <div className="role-card-icon-wrap">
                <FlaskConical size={28} strokeWidth={1.6} />
              </div>
              <h2 className="role-card-title">Lab Assistant</h2>
              <p className="role-card-desc">Manage uploads and processing status.</p>
              <span className="role-card-cta">Sign in as Lab Assistant</span>
            </button>
          </div>

          <div className="role-gateway-help-link">
            <a href="#" className="help-link">Need help accessing your account?</a>
          </div>
        </main>
      )}

      {/* ── STEP 2: Credentials (matches Stitch Doctor Login card) ── */}
      {step === 'credentials' && (
        <main className="role-gateway-main">
          <div className="credentials-card">
            {/* Circular role icon — top-center */}
            <div className="creds-icon-header">
              <div className="creds-icon-circle">
                {selectedRole === 'doctor' ? (
                  <Stethoscope size={26} strokeWidth={1.7} />
                ) : (
                  <FlaskConical size={26} strokeWidth={1.7} />
                )}
              </div>
              <h1 className="creds-title">
                {selectedRole === 'doctor' ? 'Doctor Login' : 'Lab Assistant Login'}
              </h1>
              <p className="creds-subtitle">
                {selectedRole === 'doctor'
                  ? 'Secure access to clinical records'
                  : 'Enter your credentials to access the Clinical Portal.'}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="auth-toggle-bar">
              <button
                type="button"
                className={`auth-toggle-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => { setMode('login'); setError(null); }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-toggle-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => { setMode('register'); setError(null); }}
              >
                Register
              </button>
            </div>

            {/* Credentials form */}
            <form onSubmit={handleSubmit} className="login-form">
              {error && <div className="form-error-banner">{error}</div>}

              <div className="form-group">
                <label htmlFor="auth-username">
                  {selectedRole === 'doctor' ? 'Medical ID or Email' : 'Employee ID or Email'}
                </label>
                <input
                  type="text"
                  id="auth-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={selectedRole === 'doctor' ? 'Enter your ID' : 'Enter ID or email'}
                  required
                  disabled={loading}
                  className="form-input"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div className="creds-password-label-row">
                  <label htmlFor="auth-password">Password</label>
                  {mode === 'login' && (
                    <a href="#" className="creds-forgot-link">Forgot password?</a>
                  )}
                </div>
                <input
                  type="password"
                  id="auth-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="form-input"
                />
              </div>

              {mode === 'register' && (
                <input type="hidden" name="role" value={selectedRole} />
              )}

              <button
                type="submit"
                id="auth-submit-btn"
                className="btn-primary full-width"
                disabled={loading}
              >
                {loading ? (
                  <><RefreshCw size={14} className="animate-spin" /><span>Authenticating...</span></>
                ) : mode === 'register' ? (
                  'Create account'
                ) : (
                  'Sign in to Portal'
                )}
              </button>
            </form>

            {/* Compliance note + demo link */}
            <div className="creds-compliance-block">
              {mode === 'login' && (
                <button
                  type="button"
                  id="demo-login-btn"
                  className="btn-link"
                  onClick={handleDemoLogin}
                  disabled={loading}
                >
                  Sign in with demo {roleLabel.toLowerCase()} account
                </button>
              )}
              <p className="creds-compliance-note">
                {selectedRole === 'doctor'
                  ? 'Authorized personnel only. All access is logged and monitored for clinical compliance.'
                  : 'Need access? Contact IT Support'}
              </p>
              <button
                type="button"
                className="creds-back-text-btn"
                onClick={handleBack}
              >
                <ArrowLeft size={13} />
                <span>Choose a different role</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Footer — Stitch: copyright left, 4 links right */}
      <footer className="role-gateway-footer">
        <span className="footer-copy footer-copy-left">
          © 2024 Clinical Lab Systems. Precision in diagnostics.
        </span>
        <div className="footer-links">
          <a href="#" className="footer-link">Privacy Policy</a>
          <a href="#" className="footer-link">Terms of Service</a>
          <a href="#" className="footer-link">Security</a>
          <a href="#" className="footer-link">Support</a>
        </div>
      </footer>
    </div>
  );
};
