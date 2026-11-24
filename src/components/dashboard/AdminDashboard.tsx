import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import {
  Users,
  School,
  Database,
  FileQuestion,
  Activity,
  ArrowUpRight,
  LogIn,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { NavTab } from '../layout/AppLayout';

interface AdminDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

interface ActivityLogItem {
  id: string;
  timestamp: string;
  actorName: string;
  role: string;
  action: string;
  details: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalQuestions: 0,
    totalExams: 0,
  });
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'auth' | 'system'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const unsub = onSnapshot(
      collection(db, 'activity_logs'),
      (snap) => {
        const realtimeLogs = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLogItem, 'id'>) }))
          .sort(
            (a, b) =>
              new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
        setLogs(realtimeLogs.slice(0, 30));
      },
      (err) => {
        console.warn('[AdminDashboard] Realtime logs warning:', err);
      }
    );

    return () => unsub();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, classesRes, questionsRes, examsRes, logsRes] = await Promise.all([
        api.getUsers(),
        api.getClasses(),
        api.getQuestions(),
        api.getExams(),
        api.getActivityLogs().catch(() => ({ logs: [] })),
      ]);

      const users = usersRes.users || [];
      setStats({
        totalUsers: users.length,
        totalStudents: users.filter((u) => u.role === 'student').length,
        totalTeachers: users.filter((u) => u.role === 'teacher').length,
        totalClasses: classesRes.classes?.length || 0,
        totalQuestions: questionsRes.questions?.length || 0,
        totalExams: examsRes.exams?.length || 0,
      });
      setLogs((logsRes.logs || []).slice(0, 30));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    {
      title: 'Total Siswa Terdaftar',
      value: stats.totalStudents,
      sub: 'Peserta aktif dari kelas X, XI, XII',
      icon: Users,
      action: () => onNavigate('users'),
      actionLabel: 'Kelola Akun',
    },
    {
      title: 'Kelas & Rombel',
      value: stats.totalClasses,
      sub: 'Kurikulum Merdeka SMA',
      icon: School,
      action: () => onNavigate('classes'),
      actionLabel: 'Data Kelas',
    },
    {
      title: 'Bank Soal Terverifikasi',
      value: stats.totalQuestions,
      sub: 'Soal aktif LOTS/MOTS/HOTS',
      icon: Database,
      action: () => onNavigate('bank'),
      actionLabel: 'Lihat Soal',
    },
    {
      title: 'Ujian Terjadwal & Aktif',
      value: stats.totalExams,
      sub: 'Terintegrasi token dan anti-curang',
      icon: FileQuestion,
      action: () => onNavigate('exams'),
      actionLabel: 'Kelola Ujian',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Pusat Kendali Administrator CBT
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>{settings.schoolName || 'Portal CBT Sekolah'}</span>
            <span>·</span>
            <span>Tahun Pelajaran {settings.academicYearText || '2024/2025 Genap'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('users')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            + Tambah Pengguna
          </button>
          <button
            onClick={() => onNavigate('classes')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            + Rombongan Belajar
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{kpi.title}</span>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                  {loading ? '...' : kpi.value}
                </div>
                <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={kpi.action}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <span>{kpi.actionLabel}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity & System Logs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Aktivitas & Log Sistem Terbaru</h3>
            <p className="text-xs text-slate-500">
              Pencatatan riwayat login/logout guru & admin, pembuatan ujian, dan aktivitas sistem dari Firestore
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  logFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('auth')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  logFilter === 'auth' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Login & Logout
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('system')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  logFilter === 'system' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aktivitas Ujian
              </button>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              title="Muat ulang log"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('monitoring')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Buka Live Monitoring
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
          {(() => {
            const visibleLogs = logs.filter((log) => {
              const isAuthLog = log.action === 'LOGIN' || log.action === 'LOGOUT';
              if (logFilter === 'auth') return isAuthLog;
              if (logFilter === 'system') return !isAuthLog;
              return true;
            });

            if (loading && logs.length === 0) {
              return <div className="py-8 text-center text-xs text-slate-400">Memuat log aktivitas...</div>;
            }

            if (visibleLogs.length === 0) {
              return (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  Belum ada log aktivitas yang tercatat pada kategori ini.
                </div>
              );
            }

            return visibleLogs.map((log) => {
              const isLogin = log.action === 'LOGIN';
              const isLogout = log.action === 'LOGOUT';
              const roleLabel =
                log.role === 'admin' ? 'Admin' : log.role === 'teacher' ? 'Guru' : log.role || 'Sistem';
              const actionLabel = isLogin ? 'Login' : isLogout ? 'Logout' : log.action;

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs"
                >
                  {isLogin ? (
                    <LogIn className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : isLogout ? (
                    <LogOut className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  ) : (
                    <Activity className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isLogin
                              ? 'bg-emerald-100 text-emerald-800'
                              : isLogout
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {actionLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            log.role === 'admin'
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {roleLabel}
                        </span>
                        <span className="font-semibold text-slate-900">{log.actorName}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : ''}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1">{log.details}</p>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};
