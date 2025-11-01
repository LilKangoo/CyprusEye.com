import React, { createContext, useContext, useState, useEffect, PropsWithChildren, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'cyprusexplorer.user';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isGuest?: boolean;
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
};

type AuthContextValue = {
  user: User | null;
  notifications: Notification[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  startGuestSession: (name?: string) => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  unreadCount: number;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Witaj w Cyprus Explorer!',
    message: 'Rozpocznij swoją przygodę eksplorując POI na Cyprze',
    timestamp: new Date(),
    read: false,
  },
];

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState(true);

  // Wczytaj zapisanego użytkownika przy starcie
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const userData = JSON.parse(stored);
          setUser(userData);
        } else {
          // Automatycznie zaloguj jako gość jeśli nie ma użytkownika
          await startGuestSession();
        }
      } catch (error) {
        console.error('Błąd wczytywania użytkownika:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveUser = async (userData: User | null) => {
    try {
      if (userData) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Błąd zapisywania użytkownika:', error);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Symulacja logowania - w prawdziwej aplikacji tutaj byłoby API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const userData: User = {
        id: '1',
        name: 'Michael',
        email: email,
        avatarUrl: 'https://ui-avatars.com/api/?name=Michael&background=2563eb&color=fff&size=128',
      };
      
      setUser(userData);
      await saveUser(userData);
    } catch (error) {
      console.error('Błąd logowania:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startGuestSession = useCallback(async (name: string = 'Gość') => {
    const guestUser: User = {
      id: 'guest',
      name: name,
      email: 'guest@local',
      isGuest: true,
      avatarUrl: 'https://ui-avatars.com/api/?name=Guest&background=6b7280&color=fff&size=128',
    };
    
    setUser(guestUser);
    await saveUser(guestUser);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await saveUser(null);
    // Automatycznie przełącz na tryb gościa
    await startGuestSession();
  }, [startGuestSession]);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notif => (notif.id === id ? { ...notif, read: true } : notif))
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: AuthContextValue = {
    user,
    notifications,
    isLoading,
    login,
    logout,
    startGuestSession,
    markNotificationAsRead,
    clearAllNotifications,
    unreadCount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być użyte wewnątrz AuthProvider');
  }
  return context;
};
