import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import RecommendationEngine from '../utils/recommendationEngine';

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
  isHistoryLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc4353-smartqueue.onrender.com').replace(/\/$/, '');
const AUTH_STORAGE_KEY = 'smartqueue_user';

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
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const readStoredUser = (): User | null => {
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  };

  const writeStoredUser = (value: User) => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  };

  const clearStoredUser = () => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const normalizeMembership = (u: User): User => {
    if (u.accountType !== 'user') return { ...u, passStatus: 'None', passExpiresAt: null };
    const exp = u.passExpiresAt ? Date.parse(u.passExpiresAt) : NaN;
    const active = (u.passStatus === 'Gold' || u.passStatus === 'Silver') && Number.isFinite(exp) && exp > Date.now();
    return active ? u : { ...u, passStatus: 'None' as const };
  };

  const loadPurchaseHistory = async (userId: string) => {
    try {
      const parsedUserId = Number(userId);
      if (!parsedUserId) return;

      const statsResponse = await fetch(`${API_BASE}/api/user/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: parsedUserId }),
      });

      const statsData = await statsResponse.json();
      if (!statsData.success || !statsData.spendingByConcert) return;

      for (const purchase of statsData.spendingByConcert) {
        // 🔥 CRITICAL FIX: Skip purchases with $0 spent
        if (purchase.totalSpent <= 0) {
          console.log(`⏭️ Skipping ${purchase.concertName} - no actual spend ($${purchase.totalSpent})`);
          continue;
        }

        console.log(`✅ Processing real purchase: ${purchase.concertName} ($${purchase.totalSpent})`);

        try {
          const concertResponse = await fetch(`${API_BASE}/api/concerts/${purchase.concertID}`);
          const concertData = await concertResponse.json();
          
          if (concertData.success && concertData.concert) {
            const concert = {
              id: String(concertData.concert.id),
              name: concertData.concert.name,
              artist: concertData.concert.artist,
              date: concertData.concert.date,
              venue: concertData.concert.venue,
              image: concertData.concert.image,
              price: concertData.concert.price,
              status: concertData.concert.status,
              availableTickets: concertData.concert.availableTickets,
              totalTickets: concertData.concert.totalTickets,
              genre: concertData.concert.genre,
            };
            
            RecommendationEngine.trackInteraction(userId, concert, 'purchase');
            console.log(`✅ Backfilled purchase: ${concert.name} (${concert.genre})`);
          }
        } catch (error) {
          console.error(`Failed to load concert ${purchase.concertID}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load purchase history:', error);
    }
  };

  const loadQueueHistory = async (userId: string) => {
    try {
      const parsedUserId = Number(userId);
      if (!parsedUserId) return;

      const response = await fetch(`${API_BASE}/api/user/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: parsedUserId }),
      });

      const data = await response.json();
      if (!data.success || !data.concerts) return;

      for (const concert of data.concerts) {
        const mappedConcert = {
          id: String(concert.concertID ?? concert.concert_id),
          name: concert.concertName ?? concert.concert_name,
          artist: concert.artistName ?? concert.artist_name,
          date: concert.date,
          venue: concert.venue,
          image: concert.concertImage ?? concert.concert_image,
          price: concert.price,
          status: concert.status,
          availableTickets: concert.availableTickets,
          totalTickets: concert.totalTickets,
          genre: concert.genre,
        };
        
        RecommendationEngine.trackInteraction(userId, mappedConcert, 'queue_join');
      }
      console.log(`✅ Backfilled ${data.concerts?.length || 0} queue interactions`);
    } catch (error) {
      console.error('Failed to load queue history:', error);
    }
  };

  useEffect(() => {
    const savedUser = readStoredUser();
    if (savedUser) {
      const parsedUser = normalizeMembership(savedUser);
      setUser(parsedUser);
      
      if (parsedUser.accountType === 'user') {
        setIsHistoryLoading(true);
        Promise.all([
          loadPurchaseHistory(parsedUser.id),
          loadQueueHistory(parsedUser.id)
        ]).finally(() => {
          setIsHistoryLoading(false);
        });
      } else {
        setIsHistoryLoading(false);
      }
    } else {
      setIsHistoryLoading(false);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setIsHistoryLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      writeStoredUser(normalizedUser);
      
      if (normalizedUser.accountType === 'user') {
        await Promise.all([
          loadPurchaseHistory(normalizedUser.id),
          loadQueueHistory(normalizedUser.id)
        ]);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Login failed');
    } finally {
      setIsHistoryLoading(false);
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      writeStoredUser(userData);
    } catch (error) {
      console.error('Signup error:', error);
      throw new Error('Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    clearStoredUser();
  };

  const updatePassStatus = (passStatus: 'Gold' | 'Silver' | 'None') => {
    if (user) {
      const updatedUser = normalizeMembership({ ...user, passStatus });
      setUser(updatedUser);
      writeStoredUser(updatedUser);
    }
  };

  const updateMembership = (passStatus: 'Gold' | 'Silver' | 'None', passExpiresAt: string | null) => {
    if (!user) return;
    const updatedUser = normalizeMembership({ ...user, passStatus, passExpiresAt });
    setUser(updatedUser);
    writeStoredUser(updatedUser);
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
    isHistoryLoading,
    isAuthenticated: !!user,
    isAdmin,
    isUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};