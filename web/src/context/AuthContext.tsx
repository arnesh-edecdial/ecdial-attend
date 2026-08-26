import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, setActiveEmployeeId } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  employees: User[];
  switchUser: (userId: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  employees: [],
  switchUser: () => {},
  isLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [userRes, empRes] = await Promise.all([
        api.getCurrentUser(),
        api.listEmployees(),
      ]);
      if (userRes.success) setCurrentUser(userRes.data);
      if (empRes.success) setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load auth state', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const switchUser = (userId: string) => {
    setActiveEmployeeId(userId);
    const targetUser = employees.find((e) => e.id === userId);
    if (targetUser) {
      setCurrentUser(targetUser);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, employees, switchUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
