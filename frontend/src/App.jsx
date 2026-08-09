import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Sidebar } from './components/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AssistantPage } from './pages/AssistantPage';
import { DoctorQueuePage } from './pages/DoctorQueuePage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { SettingsPage } from './pages/SettingsPage';

function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user.role === 'doctor' ? '/queue' : '/assistant'} replace />;
}

function AppShell() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className={`app-shell ${!isAuthenticated || isLoginPage ? 'auth-layout' : ''}`}>
      {isAuthenticated && !isLoginPage && <Sidebar />}
      <main className="app-main-content">
        <div className="main-content-inner">
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/assistant"
              element={
                <ProtectedRoute allowedRole="lab_assistant">
                  <AssistantPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/queue"
              element={
                <ProtectedRoute allowedRole="doctor">
                  <DoctorQueuePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports/:id"
              element={
                <ProtectedRoute allowedRole="doctor">
                  <ReportDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports-list"
              element={
                <ProtectedRoute>
                  <ReportsListPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRole="doctor">
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
