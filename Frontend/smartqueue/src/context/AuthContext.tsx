import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  passStatus: 'Gold' | 'Silver' | 'None';
  passExpiresAt: string | null;
  accountType: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  updatePassStatus: (passStatus: 'Gold' | 'Silver' | 'None') => void;
  updateMembership: (passStatus: 'Gold' | 'Silver' | 'None', passExpiresAt: string | null) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeMembership = (u: User): User => {
    if (u.accountType !== 'user') return { ...u, passStatus: 'None', passExpiresAt: null };
    const exp = u.passExpiresAt ? Date.parse(u.passExpiresAt) : NaN;
    const active = (u.passStatus === 'Gold' || u.passStatus === 'Silver') && Number.isFinite(exp) && exp > Date.now();
    return active ? u : { ...u, passStatus: 'None' as const };
  };

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('smartqueue_user');
    if (savedUser) {
      setUser(normalizeMembership(JSON.parse(savedUser)));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('https://cosc-4353-smart-queue-6ixj.vercel.app/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const userData = {
        id: String(data.userId ?? `admin:${data.userName ?? email}`),
        email: data.email ?? email,
        name: data.userName ?? email.split('@')[0],
        passStatus: data.passStatus === 'Gold' || data.passStatus === 'Silver' ? data.passStatus : 'None',
        passExpiresAt: typeof data.passExpiresAt === 'string' ? data.passExpiresAt : null,
        accountType: data.accountType || (data.userId ? 'user' : 'admin'),
      };
      
      const normalizedUser = normalizeMembership(userData);
      setUser(normalizedUser);
      localStorage.setItem('smartqueue_user', JSON.stringify(normalizedUser));
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }

      throw new Error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string) => {
    setIsLoading(true);
    try {
      // Replace with your actual signup API call
      const response = await fetch('https://cosc-4353-smart-queue-6ixj.vercel.app/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Signup failed');
      }

      const userData = {
        id: String(data.userId),
        email: data.email,
        name: `${firstName} ${lastName}`,
        passStatus: 'None' as const,
        passExpiresAt: null,
        accountType: 'user' as const,
      };
      
      setUser(userData);
      localStorage.setItem('smartqueue_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Signup error:', error);
      throw new Error('Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('smartqueue_user');
  };

  const updatePassStatus = (passStatus: 'Gold' | 'Silver' | 'None') => {
    if (user) {
      const updatedUser = normalizeMembership({ ...user, passStatus });
      setUser(updatedUser);
      localStorage.setItem('smartqueue_user', JSON.stringify(updatedUser));
    }
  };

  const updateMembership = (passStatus: 'Gold' | 'Silver' | 'None', passExpiresAt: string | null) => {
    if (!user) return;
    const updatedUser = normalizeMembership({ ...user, passStatus, passExpiresAt });
    setUser(updatedUser);
    localStorage.setItem('smartqueue_user', JSON.stringify(updatedUser));
  };

  const isAdmin = user?.accountType === 'admin';
  const isUser = user?.accountType === 'user';

  const value = {
    user,
    login,
    signup,
    logout,
    updatePassStatus,
    updateMembership,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    isUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};