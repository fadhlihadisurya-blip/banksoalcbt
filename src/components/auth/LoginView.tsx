import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  GraduationCap,
  ShieldCheck,
  KeyRound,
  User,
  AlertCircle,
  ArrowRight,
  Mail,
  Shield,
  HelpCircle,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, loginAdminEmail } = useAuth();

  // Mode: 'cbt' (Siswa/Guru) | 'admin_email' (Firebase Provider Email/Password)
  const [authMode, setAuthMode] = useState<'cbt' | 'admin_email'>('admin_email');

  // CBT credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Firebase Email/Password credentials for Admin
  const [adminEmail, setAdminEmail] = useState('Fadhlihadisurya@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');

  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Submit standard CBT login (student/teacher)
  const handleSubmitCBT = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Mohon masukkan username dan password.');
      return;
    }
    setError('');
    setInfoNotice('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa kembali akun Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Firebase Provider Email/Password login (Administrator)
  const handleSubmitAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      setError('Email dan kata sandi admin wajib diisi.');
      return;
    }
    setError('');
    setInfoNotice('');
    setLoading(true);
    try {
      await loginAdminEmail(adminEmail, adminPassword);
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Provider Email/Password belum diaktifkan di Firebase Console. Buka Firebase Console > Authentication > Sign-in method, lalu aktifkan Email/Password.'
        );
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Kata sandi salah atau kredensial Firebase tidak valid.');
      } else if (code === 'auth/user-not-found') {
        setError('Pengguna dengan email ini belum terdaftar di Firebase Authentication.');
      } else if (code === 'auth/invalid-email') {
        setError('Format alamat email tidak valid.');
      } else {
        setError(err.message || 'Gagal masuk dengan Firebase Email/Password.');
      }
    } finally {
      setLoading(false);
    }
  };


  const handleDemoLogin = async (u: string, p: string) => {
    setError('');
    setInfoNotice('');
    setLoading(true);
    try {
      await login(u, p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Subtle Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <GraduationCap className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">
          CBT SMA PRESTASI BANGSA
        </h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          Sistem Ujian Berbasis Komputer & AI Learning Analytics
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/90 border border-slate-700/80 py-8 px-6 sm:px-10 rounded-2xl shadow-xl backdrop-blur-md">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/80 rounded-xl mb-5 border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setAuthMode('admin_email');
                setError('');
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'admin_email'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin (Email/Pass)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('cbt');
                setError('');
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'cbt'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Siswa & Guru</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: ADMIN FIREBASE EMAIL / PASSWORD PROVIDER */}
          {authMode === 'admin_email' && (
            <form className="space-y-4" onSubmit={handleSubmitAdminEmail}>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Administrator
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan kata sandi email..."
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              >
                {loading ? 'Memverifikasi Firebase...' : 'Masuk Admin (Email/Password)'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 2: PORTAL CBT SISWA & GURU */}
          {authMode === 'cbt' && (
            <form className="space-y-4" onSubmit={handleSubmitCBT}>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username / NIS
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username atau NIS..."
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Kata Sandi (Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              >
                {loading ? 'Memverifikasi...' : 'Masuk ke Portal Ujian'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Quick Demo Access Bar */}
          <div className="mt-5 pt-4 border-t border-slate-700/60">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Akses Cepat Pengujian (1-Click Login):
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('admin', 'admin123')}
                className="py-1.5 px-2 bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600/60 rounded-md text-xs font-medium transition-colors text-center"
              >
                Admin (Local)
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('guru', 'guru123')}
                className="py-1.5 px-2 bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-200 border border-indigo-700/60 rounded-md text-xs font-medium transition-colors text-center"
              >
                Guru Fisika
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('siswa1', 'siswa123')}
                className="py-1.5 px-2 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-700/60 rounded-md text-xs font-medium transition-colors text-center"
              >
                Siswa Aktif
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Firebase Authentication (Provider Email/Password)</span>
        </div>
      </div>
    </div>
  );
};
