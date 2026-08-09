import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutList,
  FileText,
  UploadCloud,
  Settings,
  Activity,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

export const Sidebar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return null;
  }

  const isDoctor = user.role === 'doctor';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NavItem = ({ to, icon: Icon, label, matchPrefix }) => {
    const isActive =
      location.pathname === to ||
      (matchPrefix && location.pathname.startsWith(matchPrefix));

    return (
      <NavLink
        to={to}
        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
      >
        <Icon size={17} strokeWidth={1.8} />
        <span>{label}</span>
        {isActive && <span className="sidebar-active-dot" aria-hidden="true" />}
      </NavLink>
    );
  };

  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Activity size={18} strokeWidth={2.2} />
        </div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">Triage AI</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {isDoctor ? (
          <>
            <NavItem
              to="/queue"
              icon={LayoutList}
              label="Queue"
              matchPrefix="/reports"
            />
            <NavItem to="/reports-list" icon={FileText} label="Reports" />
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </>
        ) : (
          <>
            <NavItem to="/assistant" icon={UploadCloud} label="Upload" />
            <NavItem to="/reports-list" icon={FileText} label="My reports" />
          </>
        )}
      </nav>

      {/* Bottom User Profile */}
      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            <UserIcon size={14} />
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-username">{user.username}</div>
            <div className="sidebar-user-role">
              {isDoctor ? 'Physician' : 'Lab Assistant'}
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};
