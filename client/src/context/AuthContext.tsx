import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials, DBStatus } from '../types';
import { authApi, systemApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  dbStatus: DBStatus | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshDbStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('milk_crm_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('milk_crm_token') || null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);

  const refreshDbStatus = useCallback(async () => {
    try {
      const status = await systemApi.getDbStatus();
      setDbStatus(status);
    } catch (err: any) {
      console.warn('[TiDB Diagnostic] Unable to fetch status:', err.message);
    }
  }, []);

  // Validate existing session on application boot
  useEffect(() => {
    const initSession = async () => {
      const savedToken = localStorage.getItem('milk_crm_token');
      if (savedToken) {
        try {
          const freshUser = await authApi.me();
          setUser(freshUser);
          localStorage.setItem('milk_crm_user', JSON.stringify(freshUser));
        } catch (err: any) {
          // Only clear if 401 Unauthorized, preserve on temporary network unreachable
          if (err.response?.status === 401) {
            localStorage.removeItem('milk_crm_token');
            localStorage.removeItem('milk_crm_user');
            setUser(null);
            setToken(null);
          } else {
            console.warn('[Auth] Server unreachable during session init:', err.message);
          }
        }
      }
      setIsLoading(false);
      refreshDbStatus().catch(() => {});
    };

    initSession();

    // Listen to unauthorized event
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [refreshDbStatus]);

  const login = async (credentials: LoginCredentials) => {
    setLoginError(null);
    try {
      const response = await authApi.login(credentials);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem('milk_crm_token', response.token);
      localStorage.setItem('milk_crm_user', JSON.stringify(response.user));
      refreshDbStatus().catch(() => {});
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Login failed. Please check credentials.';
      setLoginError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('milk_crm_token');
      localStorage.removeItem('milk_crm_user');
      setUser(null);
      setToken(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        loginError,
        dbStatus,
        login,
        logout,
        refreshDbStatus,
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
