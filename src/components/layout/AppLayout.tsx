import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { normalizeTeacherMenus, TeacherMenuKey } from '../../types/cbt';
import {
  GraduationCap,
  LayoutDashboard,
  Database,
  FileQuestion,
  KeyRound,
  Activity,
  Award,
  Users,
  School,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Layers,
  Settings,
  ClipboardCheck,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'bank'
  | 'taxonomy'
  | 'exams'
  | 'monitoring'
  | 'results'
  | 'anbuso'
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
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        { id: 'results' as NavTab, label: 'Hasil & Penilaian', icon: Award },
        { id: 'anbuso' as NavTab, label: 'Anbuso', icon: ClipboardCheck },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
      ];
    }

    if (user.role === 'teacher') {
      const teacherMenus = normalizeTeacherMenus(settings.teacherMenus);
      const configurableTeacherItems: Array<{
        id: TeacherMenuKey;
        label: string;
        icon: typeof School;
      }> = [
        { id: 'classes', label: 'Manajemen Kelas', icon: School },
        { id: 'users', label: 'Manajemen Akun', icon: Users },
        { id: 'bank', label: 'Bank Soal Pusat', icon: Database },
        { id: 'taxonomy', label: 'Taksonomi Soal', icon: Layers },
        { id: 'exams', label: 'Daftar Ujian', icon: FileQuestion },
        { id: 'monitoring', label: 'Monitoring Ujian', icon: Activity },
        { id: 'results', label: 'Hasil & Penilaian', icon: Award },
        { id: 'anbuso', label: 'Anbuso', icon: ClipboardCheck },
      ];

      return [
        { id: 'dashboard' as NavTab, label: 'Dashboard Guru', icon: LayoutDashboard },
        ...configurableTeacherItems.filter((item) => teacherMenus[item.id]),
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
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-xs">
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
                {settings.schoolName || 'Portal CBT Sekolah'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {settings.appSubtitle || 'Portal Ujian Berbasis Komputer'}
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

        {/* User Profile */}
        <div className="flex items-center gap-3">
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

      <div className="flex-1 flex overflow-hidden print:overflow-visible">
        {/* Desktop Sidebar */}
        <aside className="no-print hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 shrink-0 justify-between">
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
          <div className="no-print fixed inset-0 z-40 bg-slate-900/40 md:hidden flex">
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
        <main className="flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6 lg:p-8 print:overflow-visible print:p-0 print:bg-white">
          <div className="max-w-7xl mx-auto print:max-w-none print:m-0">{children}</div>
        </main>
      </div>
    </div>
  );
};
