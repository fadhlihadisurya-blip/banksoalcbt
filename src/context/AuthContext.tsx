import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/cbt';
import { api } from '../lib/api';
import { auth, loginWithGoogle, logoutFirebase } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => void;
  quickSwitch: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // If Google user is authenticated, create or map local user
        const isAdmin = fbUser.email === 'Fadhlihadisurya@gmail.com';
        const mappedUser: User = {
          id: fbUser.uid,
          username: fbUser.email?.split('@')[0] || 'google_user',
          name: fbUser.displayName || 'Google User',
          email: fbUser.email || '',
          role: isAdmin ? 'admin' : 'teacher',
          isActive: true,
          lastLogin: new Date().toISOString(),
        };
        setUser(mappedUser);
        localStorage.setItem('cbt_user_session', JSON.stringify(mappedUser));
        setLoading(false);
      } else {
        // Check local saved session
        const saved = localStorage.getItem('cbt_user_session');
        if (saved) {
          try {
            setUser(JSON.parse(saved));
          } catch {
            localStorage.removeItem('cbt_user_session');
          }
          setLoading(false);
        } else {
          // Default initial login as teacher for convenient first exploration
          api.login('guru', 'guru123')
            .then((res) => {
              setUser(res.user);
              localStorage.setItem('cbt_user_session', JSON.stringify(res.user));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    setUser(res.user);
    localStorage.setItem('cbt_user_session', JSON.stringify(res.user));
  };

  const loginGoogle = async () => {
    setLoading(true);
    try {
      const fbUser = await loginWithGoogle();
      const isAdmin = fbUser.email === 'Fadhlihadisurya@gmail.com';
      const mappedUser: User = {
        id: fbUser.uid,
        username: fbUser.email?.split('@')[0] || 'google_user',
        name: fbUser.displayName || 'Google User',
        email: fbUser.email || '',
        role: isAdmin ? 'admin' : 'teacher',
        isActive: true,
        lastLogin: new Date().toISOString(),
      };
      setUser(mappedUser);
      localStorage.setItem('cbt_user_session', JSON.stringify(mappedUser));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutFirebase();
    setUser(null);
    localStorage.removeItem('cbt_user_session');
  };

  const quickSwitch = async (role: UserRole) => {
    let username = 'guru';
    let pass = 'guru123';
    if (role === 'admin') {
      username = 'admin';
      pass = 'admin123';
    } else if (role === 'student') {
      username = 'siswa1';
      pass = 'siswa123';
    }
    await login(username, pass);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginGoogle, logout, quickSwitch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
