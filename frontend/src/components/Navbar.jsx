import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogoutClick = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar-card">
      <div className="nav-brand" onClick={() => navigate(user?.role === 'doctor' ? '/queue' : '/assistant')} style={{ cursor: 'pointer' }}>
        <div className="brand-icon">🔬</div>
        <div>
          <div className="brand-title">LabReport Triage AI</div>
          <div className="brand-sub">Clinical Decision Support</div>
        </div>
      </div>

      <div className="nav-auth-section">
        {isAuthenticated && user ? (
          <div className="nav-logged-in-group">
            {user.role === 'doctor' && (
              <Link to="/queue" className={`nav-link ${location.pathname.startsWith('/queue') ? 'active' : ''}`}>
                📋 Triage Queue
              </Link>
            )}
            {user.role === 'lab_assistant' && (
              <Link to="/assistant" className={`nav-link ${location.pathname === '/assistant' ? 'active' : ''}`}>
                📄 Upload & Reports
              </Link>
            )}

            <div className="user-profile-badge">
              <div className="user-avatar">{user.role === 'doctor' ? '👨‍⚕️' : '🧑‍🔬'}</div>
              <div className="user-details">
                <span className="user-name">{user.username}</span>
                <span className={`user-role-tag role-${user.role}`}>
                  {user.role === 'doctor' ? 'Doctor' : 'Lab Assistant'}
                </span>
              </div>
              <button onClick={handleLogoutClick} className="btn-logout" id="logout-btn">
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="quick-demo-logins">
            <span className="demo-hint">AI Clinical Workflow</span>
          </div>
        )}
      </div>
    </nav>
  );
};
