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

  // Function to load purchase history and backfill recommendations
  const loadPurchaseHistory = async (userId: string) => {
    try {
      const parsedUserId = Number(userId);
      if (!parsedUserId) return;

      // First, get the user's purchase stats
      const statsResponse = await fetch('https://cosc-4353-smart-queue-6ixj.vercel.app/api/user/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userID: parsedUserId }),
      });

      const statsData = await statsResponse.json();
      if (!statsData.success || !statsData.spendingByConcert) {
        return;
      }

      // For each concert they've spent money on, fetch concert details and track as purchase
      for (const purchase of statsData.spendingByConcert) {
        try {
          // Fetch full concert details
          const concertResponse = await fetch(`https://cosc-4353-smart-queue-6ixj.vercel.app/api/concerts/${purchase.concertID}`);
          const concertData = await concertResponse.json();
          
          if (concertData.success && concertData.concert) {
            // Map the concert data to match our Concert interface
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
            
            // Track as purchase (weight: 3 points)
            RecommendationEngine.trackInteraction(userId, concert, 'purchase');
            console.log(`Backfilled purchase for concert: ${concert.name}`);
          }
        } catch (error) {
          console.error(`Failed to load concert ${purchase.concertID}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load purchase history:', error);
    }
  };

  // Function to load queue history as additional signals
  const loadQueueHistory = async (userId: string) => {
    try {
      const parsedUserId = Number(userId);
      if (!parsedUserId) return;

      const response = await fetch('https://cosc-4353-smart-queue-6ixj.vercel.app/api/user/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userID: parsedUserId }),
      });

      const data = await response.json();
      if (!data.success || !data.concerts) return;

      // Track each queue join (weight: 2 points)
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
        
        // Track as queue join (weight: 2 points)
        RecommendationEngine.trackInteraction(userId, mappedConcert, 'queue_join');
      }
      console.log(`Backfilled ${data.concerts?.length || 0} queue interactions`);
    } catch (error) {
      console.error('Failed to load queue history:', error);
    }
  };

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('smartqueue_user');
    if (savedUser) {
      const parsedUser = normalizeMembership(JSON.parse(savedUser));
      setUser(parsedUser);
      
      // Backfill purchase and queue history for logged-in user
      if (parsedUser.accountType === 'user') {
        loadPurchaseHistory(parsedUser.id);
        loadQueueHistory(parsedUser.id);
      }
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
      
      // Backfill purchase and queue history after successful login
      if (normalizedUser.accountType === 'user') {
        await loadPurchaseHistory(normalizedUser.id);
        await loadQueueHistory(normalizedUser.id);
      }
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
      
      // New users won't have history, so no need to backfill
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
    // Note: We keep the recommendation data in localStorage for next login
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