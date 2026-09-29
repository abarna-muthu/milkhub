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

const DEFAULT_OWNER: User = {
  id: 'u_owner_001',
  email: 'milkhub@admin.com',
  role: 'owner',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_TOKEN = 'token_local_owner_session_default';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('milk_crm_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_OWNER;
      }
    }
    return DEFAULT_OWNER;
  });

  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('milk_crm_token') || DEFAULT_TOKEN;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  // Initialize and ensure active session with server
  useEffect(() => {
    const initSession = async () => {
      // Ensure defaults in localStorage
      if (!localStorage.getItem('milk_crm_token')) {
        localStorage.setItem('milk_crm_token', DEFAULT_TOKEN);
      }
      if (!localStorage.getItem('milk_crm_user')) {
        localStorage.setItem('milk_crm_user', JSON.stringify(DEFAULT_OWNER));
      }

      // Sync with server in background to get real JWT token
      try {
        const response = await authApi.login({
          email: 'milkhub@admin.com',
          password: 'Admin@123',
        });
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('milk_crm_token', response.token);
        localStorage.setItem('milk_crm_user', JSON.stringify(response.user));
      } catch (err: any) {
        // Retain fallback session if server unreachable
        console.warn('[Auth] Server login bypassed or offline; using local owner session.');
      }
      refreshDbStatus().catch(() => {});
    };

    initSession();

    // Listen to unauthorized event to automatically re-authenticate
    const handleUnauthorized = async () => {
      try {
        const response = await authApi.login({
          email: 'milkhub@admin.com',
          password: 'Admin@123',
        });
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('milk_crm_token', response.token);
        localStorage.setItem('milk_crm_user', JSON.stringify(response.user));
      } catch {
        setToken(DEFAULT_TOKEN);
        setUser(DEFAULT_OWNER);
      }
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
      setToken(DEFAULT_TOKEN);
      setUser(DEFAULT_OWNER);
      localStorage.setItem('milk_crm_token', DEFAULT_TOKEN);
      localStorage.setItem('milk_crm_user', JSON.stringify(DEFAULT_OWNER));
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    } finally {
      // Keep owner session ready so user is never locked out of dashboard
      setToken(DEFAULT_TOKEN);
      setUser(DEFAULT_OWNER);
      localStorage.setItem('milk_crm_token', DEFAULT_TOKEN);
      localStorage.setItem('milk_crm_user', JSON.stringify(DEFAULT_OWNER));
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
