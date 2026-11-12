import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import {
  GraduationCap,
  ShieldCheck,
  KeyRound,
  User,
  AlertCircle,
  ArrowRight,
  Mail,
  Shield,
  UserCheck,
  Lock,
  School,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, loginAdminEmail } = useAuth();
  const { settings } = useSettings();

  // Primary view mode: 'student' (Default: Siswa) | 'staff' (Admin & Guru)
  const [viewMode, setViewMode] = useState<'student' | 'staff'>('student');

  // Staff sub-tab: 'admin_email' | 'teacher_cbt'
  const [staffTab, setStaffTab] = useState<'admin_email' | 'teacher_cbt'>('admin_email');

  // Student credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Teacher CBT credentials
  const [teacherUser, setTeacherUser] = useState('');
  const [teacherPass, setTeacherPass] = useState('');

  // Firebase Email/Password credentials for Admin
  const [adminEmail, setAdminEmail] = useState('Fadhlihadisurya@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Submit Student Login
  const handleSubmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Mohon masukkan NIS / Username dan Kata Sandi.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa kembali NIS / Username dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Teacher CBT Login
  const handleSubmitTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherUser || !teacherPass) {
      setError('Mohon masukkan Username Guru dan Kata Sandi.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(teacherUser.trim(), teacherPass);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk akun guru.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Admin Firebase Email/Password Login
  const handleSubmitAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      setError('Email dan kata sandi admin wajib diisi.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginAdminEmail(adminEmail.trim(), adminPassword);
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

  // 1-Click Quick Demo Access Handler
  const handleDemoLogin = async (u: string, p: string) => {
    setError('');
    setLoading(true);
    try {
      await login(u, p);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk ke akun demo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Image / Overlay */}
      {settings.loginBackgroundUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 scale-105"
            style={{ backgroundImage: `url(${settings.loginBackgroundUrl})` }}
          />
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs" />
        </>
      ) : (
        /* Background Subtle Geometric Grid */
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />
      )}

      {/* Header Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 overflow-hidden">
            {settings.schoolLogoUrl ? (
              <img src={settings.schoolLogoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-9 h-9" />
            )}
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-white drop-shadow-md">
          {settings.schoolName || 'CBT SMA PRESTASI BANGSA'}
        </h1>
        <p className="mt-1 text-center text-sm text-slate-300 drop-shadow-xs font-medium">
          {viewMode === 'student' ? 'Portal Ujian Berbasis Komputer Siswa' : 'Portal Log In Guru & Administrator'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/90 border border-slate-700/80 py-8 px-6 sm:px-10 rounded-2xl shadow-xl backdrop-blur-md">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* VIEW 1: TAMPILAN UMUM LOGIN SISWA */}
          {viewMode === 'student' && (
            <form className="space-y-4" onSubmit={handleSubmitStudent}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60 mb-1">
                <div className="flex items-center gap-2 text-indigo-400">
                  <User className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Masuk Peserta Ujian (Siswa)
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">Status: Sesi Siap</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  NIS / Username Siswa
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan NIS (cth: 20241001) atau username..."
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
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
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
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
                {loading ? 'Memverifikasi...' : 'Masuk ke Portal Ujian Siswa'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* VIEW 2: LOGIN ADMIN / GURU */}
          {viewMode === 'staff' && (
            <div>
              {/* Sub-tabs untuk Admin / Guru */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/80 rounded-xl mb-4 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setStaffTab('admin_email');
                    setError('');
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    staffTab === 'admin_email'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin (Firebase)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStaffTab('teacher_cbt');
                    setError('');
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    staffTab === 'teacher_cbt'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>Guru Mapel</span>
                </button>
              </div>

              {/* Form 1: Admin Firebase Email/Pass */}
              {staffTab === 'admin_email' && (
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
                      Kata Sandi Admin
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Masukkan password admin..."
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
                    {loading ? 'Memverifikasi Admin...' : 'Masuk Administrator'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Form 2: Guru CBT Login */}
              {staffTab === 'teacher_cbt' && (
                <form className="space-y-4" onSubmit={handleSubmitTeacher}>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Username / NIP Guru
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={teacherUser}
                        onChange={(e) => setTeacherUser(e.target.value)}
                        placeholder="Masukkan username guru (cth: guru)..."
                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Kata Sandi Guru
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={teacherPass}
                        onChange={(e) => setTeacherPass(e.target.value)}
                        placeholder="Masukkan password guru..."
                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
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
                    {loading ? 'Memverifikasi...' : 'Masuk Portal Guru'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setViewMode('student');
                  setError('');
                }}
                className="w-full mt-3 py-2 text-center text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <span>&larr; Kembali ke Login Siswa</span>
              </button>
            </div>
          )}

          {/* Quick Demo Access Bar (Akses Cepat Pengujian 1-Click Login) */}
          <div className="mt-5 pt-4 border-t border-slate-700/60">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center flex items-center justify-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Akses Cepat Pengujian (1-Click Login)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('admin', 'admin123')}
                className="py-2 px-2 bg-slate-700/60 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-600/60 hover:border-indigo-500 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center justify-center gap-0.5 shadow-2xs"
              >
                <span>Admin</span>
                <span className="text-[10px] text-slate-400 opacity-80">(Local)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('guru', 'guru123')}
                className="py-2 px-2 bg-indigo-900/40 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-700/60 hover:border-indigo-500 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center justify-center gap-0.5 shadow-2xs"
              >
                <span>Guru Fisika</span>
                <span className="text-[10px] text-indigo-300 opacity-80">(Demo)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('siswa1', 'siswa123')}
                className="py-2 px-2 bg-emerald-900/40 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-700/60 hover:border-emerald-500 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center justify-center gap-0.5 shadow-2xs"
              >
                <span>Siswa Aktif</span>
                <span className="text-[10px] text-emerald-300 opacity-80">(Demo)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Firebase Authentication & Firestore Database</span>
        </div>
      </div>

      {/* Floating Toggle Button di Pojok Kanan Bawah untuk Login Admin / Guru */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={() => {
            setViewMode(viewMode === 'student' ? 'staff' : 'student');
            setError('');
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-indigo-500/40 shadow-lg backdrop-blur-md text-xs font-semibold transition-all hover:scale-105 active:scale-95"
          title="Buka menu login Admin / Guru"
        >
          {viewMode === 'student' ? (
            <>
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Login Admin / Guru</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4 text-emerald-400" />
              <span>Login Siswa</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
