import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // In-memory token and user state only (NOT stored in localStorage / sessionStorage for PHI security)
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silently check active session via httpOnly cookie on startup
  useEffect(() => {
    let isMounted = true;

    const checkActiveSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          credentials: 'include', // Sends httpOnly access_token cookie
        });

        if (res.ok && isMounted) {
          const userData = await res.json();
          setUser(userData);
        } else if (isMounted) {
          setUser(null);
          setToken('');
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
          setToken('');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkActiveSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear in-memory credentials
      setToken('');
      setUser(null);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Sets secure httpOnly cookie
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Login failed');
    }

    // Keep token in memory only
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (username, password, role) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Sets secure httpOnly cookie
      body: JSON.stringify({ username, password, role }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Registration failed');
    }

    // Keep token in memory only
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  // Helper to make authenticated requests with httpOnly cookie / Bearer fallback & automatic 401 handling
  const apiFetch = useCallback(
    async (endpoint, options = {}) => {
      const headers = {
        ...(options.headers || {}),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include', // Always send httpOnly cookie
        headers,
      });

      if (res.status === 401) {
        await logout();
        window.location.href = '/login';
        throw new Error('Session expired or unauthorized. Please sign in again.');
      }

      return res;
    },
    [token, logout]
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
