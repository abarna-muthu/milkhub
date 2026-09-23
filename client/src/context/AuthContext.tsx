import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const defaultAdminUser: User = {
  id: 'u1',
  name: 'Admin',
  mobile: '9842100001',
  email: 'admin@MilkHub',
  role: 'admin',
  collection_center_id: 'c1',
  collection_center_name: 'Srivilliputtur Center',
  status: 'active',
};

const defaultStaffUser: User = {
  id: 'u2',
  name: 'Murugan S (Staff)',
  mobile: '9842100002',
  email: 'staff@milkhub.com',
  role: 'staff',
  collection_center_id: 'c1',
  collection_center_name: 'Srivilliputtur Center',
  status: 'active',
};

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

  const login = (newToken: string, newUser: User) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('milk_crm_token', newToken);
    localStorage.setItem('milk_crm_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('milk_crm_token');
    localStorage.removeItem('milk_crm_user');
  };

  const switchRole = (newRole: UserRole) => {
    const targetUser = newRole === 'admin' ? defaultAdminUser : defaultStaffUser;
    login(targetUser.id, targetUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isStaff: user?.role === 'staff',
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
