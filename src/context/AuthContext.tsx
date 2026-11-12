import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/cbt';
import { api } from '../lib/api';
import {
  auth,
  loginWithGoogle,
  loginWithEmailPassword,
  logoutFirebase,
} from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginAdminEmail: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  quickSwitch: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase auth state changes (Google or Email/Password Provider)
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const emailLower = (fbUser.email || '').toLowerCase();
        // Determine role: Super admin or school admin
        const isAdmin =
          emailLower === 'fadhlihadisurya@gmail.com' ||
          emailLower === 'admin@sman1prestasi.sch.id' ||
          emailLower.includes('admin');

        const mappedUser: User = {
          id: fbUser.uid,
          username: fbUser.email?.split('@')[0] || 'admin_firebase',
          name: fbUser.displayName || (isAdmin ? 'Administrator (Firebase)' : 'Guru (Firebase)'),
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
      const emailLower = (fbUser.email || '').toLowerCase();
      const isAdmin =
        emailLower === 'fadhlihadisurya@gmail.com' ||
        emailLower === 'admin@sman1prestasi.sch.id' ||
        emailLower.includes('admin');

      const mappedUser: User = {
        id: fbUser.uid,
        username: fbUser.email?.split('@')[0] || 'google_user',
        name: fbUser.displayName || 'Google Administrator',
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

  // Firebase Email/Password Provider Login specifically for Administrator
  const loginAdminEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const fbUser = await loginWithEmailPassword(email, pass);
      const mappedUser: User = {
        id: fbUser.uid,
        username: fbUser.email?.split('@')[0] || 'admin_email',
        name: fbUser.displayName || 'Administrator (Firebase Auth)',
        email: fbUser.email || email,
        role: 'admin',
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

    try {
      await login(username, pass);
    } catch {
      try {
        await login(role, 'siswa123');
      } catch {
        const fallbackUsers: Record<UserRole, User> = {
          admin: {
            id: 'usr-admin-1',
            username: 'admin',
            name: 'Drs. Hendro Wibowo, M.Pd.',
            role: 'admin',
            email: 'admin@sman1prestasi.sch.id',
            isActive: true,
          },
          teacher: {
            id: 'usr-teacher-1',
            username: 'guru',
            name: 'Ahmad Fauzi, S.Pd., M.Si.',
            role: 'teacher',
            email: 'ahmad.fauzi@sman1prestasi.sch.id',
            nip: '198403152009021004',
            subjectSpecialty: 'Fisika & Matematika IPA',
            isActive: true,
          },
          student: {
            id: 'usr-student-1',
            username: 'siswa',
            name: 'Siswa Demo CBT',
            role: 'student',
            nis: '20241001',
            classId: 'cls-xii-mipa-1',
            isActive: true,
          },
        };
        const selectedFallback = fallbackUsers[role];
        setUser(selectedFallback);
        localStorage.setItem('cbt_user_session', JSON.stringify(selectedFallback));
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginGoogle,
        loginAdminEmail,
        logout,
        quickSwitch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
