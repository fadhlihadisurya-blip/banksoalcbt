import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import { Users, School, Database, FileQuestion, Activity, ArrowUpRight } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
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
      setLogs((logsRes.logs || []).slice(0, 5));
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

      {/* System Integrity & Fast Monitoring Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Aktivitas & Log Sistem Terbaru</h3>
              <p className="text-xs text-slate-500">Pencatatan sesi ujian, pembuatan token, dan audit pengawasan dari Firestore</p>
            </div>
            <button
              onClick={() => onNavigate('monitoring')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Buka Live Monitoring
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Memuat log aktivitas...</div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Belum ada log aktivitas sistem yang tercatat di Firestore.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                  <Activity className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{log.action} · {log.actorName}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : ''}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{log.details}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security Summary Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Spesifikasi Server & Keamanan</h3>
            <p className="text-xs text-slate-500 mt-0.5">Integritas data ujian di tingkat sekolah</p>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Database Cloud</span>
                <span className="font-medium text-emerald-600">Firebase Firestore (Terhubung)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Autentikasi Admin</span>
                <span className="font-medium text-emerald-600">Firebase Provider (Email/Password)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Kunci Jawaban</span>
                <span className="font-medium text-emerald-600">Tersimpan di Backend (Aman)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Randomisasi Soal</span>
                <span className="font-medium text-slate-900">Unik per Peserta</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Mesin AI Analytics</span>
                <span className="font-medium text-indigo-600">Gemini 3.8 Flash (Server-Side)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Proteksi Sesi Ganda</span>
                <span className="font-medium text-slate-900">Terkunci per NIS</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('monitoring')}
              className="w-full py-2 px-3 text-xs font-semibold text-center text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Buka Ruang Pengawas Ujian
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
