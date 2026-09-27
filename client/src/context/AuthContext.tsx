import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isInitializing: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('milk_crm_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('milk_crm_token') || null;
  });

  const [isInitializing, setIsInitializing] = useState(true);

  // Verify authentication with backend on initial load / refresh
  useEffect(() => {
    const verifySession = async () => {
      const savedToken = localStorage.getItem('milk_crm_token');
      if (savedToken) {
        try {
          const freshUser = await authApi.me();
          if (freshUser && freshUser.id) {
            setUser(freshUser);
            localStorage.setItem('milk_crm_user', JSON.stringify(freshUser));
          } else {
            // Invalid response
            clearSession();
          }
        } catch (err: any) {
          console.warn('[Auth] Session validation failed, resetting session to login:', err);
          clearSession();
        }
      } else {
        clearSession();
      }
      setIsInitializing(false);
    };

    verifySession();
  }, []);

  const clearSession = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('milk_crm_token');
    localStorage.removeItem('milk_crm_user');
  };

  const login = (newToken: string, newUser: User) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('milk_crm_token', newToken);
    localStorage.setItem('milk_crm_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      clearSession();
    }
  };

  const switchRole = (newRole: UserRole) => {
    if (user) {
      const updated = { ...user, role: newRole };
      setUser(updated);
      localStorage.setItem('milk_crm_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isAdmin: user?.role === 'admin' || user?.role === ('owner' as any),
        isStaff: user?.role === 'staff',
        isInitializing,
        login,
        logout,
        switchRole,
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
