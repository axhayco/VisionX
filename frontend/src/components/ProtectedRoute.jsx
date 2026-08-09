import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        color: 'var(--color-text-secondary, #94a3b8)',
        fontSize: '0.95rem'
      }}>
        Verifying secure session...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    // Redirect to user's designated home route if role doesn't match
    const targetRoute = user.role === 'doctor' ? '/queue' : '/assistant';
    return <Navigate to={targetRoute} replace />;
  }

  return children;
};
