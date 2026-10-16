import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { api, getAuthToken, setAuthToken, setActiveEmployeeId } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  employees: User[];
  isLoading: boolean;
  login: (credentials: { identifier: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  employees: [],
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    try {
      const response = await api.listEmployees();
      if (response?.success && Array.isArray(response.data)) setEmployees(response.data);
    } catch (error) {
      // Employee listing is role-restricted; failure must not invalidate a valid login.
      console.info('[ECDIAL Auth] Employee list is not available for this account.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      const token = getAuthToken();
      if (!token) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const response = await api.getCurrentUser();
        if (!response?.success || !response?.data?.id) throw new Error('Session response was invalid.');
        if (!mounted) return;
        const user = response.data as User;
        setCurrentUser(user);
        setActiveEmployeeId(user.id);
        await loadEmployees();
      } catch (error) {
        setAuthToken(null);
        setActiveEmployeeId('');
        if (mounted) {
          setCurrentUser(null);
          setEmployees([]);
        }
        console.info('[ECDIAL Auth] Saved session is invalid; please sign in again.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void restoreSession();
    return () => { mounted = false; };
  }, [loadEmployees]);

  const login = useCallback(async ({ identifier, password }: { identifier: string; password: string }) => {
    const value = identifier.trim();
    if (!value || !password) throw new Error('Enter your email or employee code and password.');

    // Backend accepts either email or employeeCode. Pick the matching field.
    const isEmail = value.includes('@');
    const response = await api.login({
      ...(isEmail ? { email: value } : { employeeCode: value }),
      password,
    });

    const token = response?.data?.token;
    const user = response?.data?.user as User | undefined;
    if (!response?.success || typeof token !== 'string' || !token || !user?.id) {
      throw new Error(response?.message || 'The server did not return a valid login session.');
    }

    setAuthToken(token);
    setActiveEmployeeId(user.id);
    setCurrentUser(user);
    setEmployees([]);
    await loadEmployees();
  }, [loadEmployees]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setActiveEmployeeId('');
    setCurrentUser(null);
    setEmployees([]);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, employees, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
