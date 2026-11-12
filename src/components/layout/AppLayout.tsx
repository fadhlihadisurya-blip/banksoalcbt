import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import {
  GraduationCap,
  LayoutDashboard,
  Database,
  FileQuestion,
  KeyRound,
  Activity,
  Award,
  Sparkles,
  Users,
  School,
  LogOut,
  ChevronRight,
  Menu,
  X,
  UserCheck,
  Layers,
  Settings,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'bank'
  | 'taxonomy'
  | 'exams'
  | 'monitoring'
  | 'results'
  | 'analytics'
  | 'classes'
  | 'users'
  | 'settings';

interface AppLayoutProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { user, logout, quickSwitch } = useAuth();
  const { settings } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  const getNavItems = () => {
    if (!user) return [];

    if (user.role === 'admin') {
      return [
        { id: 'dashboard' as NavTab, label: 'Dashboard Admin', icon: LayoutDashboard },
        { id: 'classes' as NavTab, label: 'Manajemen Kelas', icon: School },
        { id: 'users' as NavTab, label: 'Manajemen Akun', icon: Users },
        { id: 'bank' as NavTab, label: 'Bank Soal Pusat', icon: Database },
        { id: 'taxonomy' as NavTab, label: 'Taksonomi Soal', icon: Layers },
        { id: 'exams' as NavTab, label: 'Daftar Ujian', icon: FileQuestion },
        { id: 'monitoring' as NavTab, label: 'Monitoring Ujian', icon: Activity },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
      ];
    }

    if (user.role === 'teacher') {
      return [
        { id: 'dashboard' as NavTab, label: 'Dashboard Guru', icon: LayoutDashboard },
        { id: 'bank' as NavTab, label: 'Bank Soal & IPK', icon: Database },
        { id: 'exams' as NavTab, label: 'Generator Ujian', icon: FileQuestion },
        { id: 'monitoring' as NavTab, label: 'Live Monitoring', icon: Activity },
        { id: 'results' as NavTab, label: 'Hasil & Penilaian', icon: Award },
        { id: 'analytics' as NavTab, label: 'AI Learning Analytics', icon: Sparkles },
      ];
    }

    // Student
    return [
      { id: 'dashboard' as NavTab, label: 'Ujian Tersedia', icon: LayoutDashboard },
      { id: 'results' as NavTab, label: 'Riwayat & Nilai', icon: Award },
    ];
  };

  const navItems = getNavItems();

  const getBreadcrumbTitle = () => {
    const item = navItems.find((n) => n.id === currentTab);
    return item ? item.label : settings.schoolName || 'CBT SMA Pro';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Header - Zone 1: Brand, Zone 2: Navigation / Info, Zone 3: Profile & Role Switch */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs overflow-hidden">
              {settings.schoolLogoUrl ? (
                <img src={settings.schoolLogoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <GraduationCap className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight truncate max-w-[240px] sm:max-w-xs">
                {settings.schoolName || 'SMAN 1 PRESTASI BANGSA'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {settings.appSubtitle || 'CBT Portal · TP 2024/2025 Genap'}
              </span>
            </div>
          </div>
        </div>

        {/* Current Context Breadcrumb */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-slate-600">
          <span className="text-slate-400">Portal {user?.role.toUpperCase()}</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-900">{getBreadcrumbTitle()}</span>
        </div>

        {/* User Profile & Demo Switcher */}
        <div className="flex items-center gap-3">
          {/* Quick Perspective Switcher for evaluation */}
          <div className="relative">
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap"
              title="Ganti sudut pandang akun demo"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Role:</span>
              <span className="font-semibold text-indigo-700 uppercase">{user?.role}</span>
            </button>

            {showRoleSwitcher && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">
                  Uji Coba Multi-Role:
                </div>
                <button
                  onClick={async () => {
                    setShowRoleSwitcher(false);
                    try {
                      await quickSwitch('admin');
                    } catch (e: any) {
                      console.error('Role switch error:', e);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 ${user?.role === 'admin' ? 'bg-indigo-50/70 text-indigo-700 font-semibold' : 'text-slate-700'}`}
                >
                  <span>Administrator</span>
                  <span className="text-[10px] text-slate-400">Drs. Hendro</span>
                </button>
                <button
                  onClick={async () => {
                    setShowRoleSwitcher(false);
                    try {
                      await quickSwitch('teacher');
                    } catch (e: any) {
                      console.error('Role switch error:', e);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 ${user?.role === 'teacher' ? 'bg-indigo-50/70 text-indigo-700 font-semibold' : 'text-slate-700'}`}
                >
                  <span>Guru (Fisika)</span>
                  <span className="text-[10px] text-slate-400">Ahmad Fauzi</span>
                </button>
                <button
                  onClick={async () => {
                    setShowRoleSwitcher(false);
                    try {
                      await quickSwitch('student');
                    } catch (e: any) {
                      console.error('Role switch error:', e);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 ${user?.role === 'student' ? 'bg-indigo-50/70 text-indigo-700 font-semibold' : 'text-slate-700'}`}
                >
                  <span>Siswa (XII MIPA 1)</span>
                  <span className="text-[10px] text-slate-400">Ahmad Rifai</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
              {user?.name.charAt(0)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[140px]">
                {user?.name}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {user?.role === 'student' ? `NIS: ${user.nis}` : user?.role.toUpperCase()}
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 shrink-0 justify-between">
          <div className="space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Menu Navigasi
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-900/40 md:hidden flex">
            <div className="w-64 bg-white h-full p-4 flex flex-col justify-between shadow-xl">
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase">Menu Navigasi</span>
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
