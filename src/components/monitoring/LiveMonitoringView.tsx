import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { MonitoringPayload, MonitoringStudent, Exam } from '../../types/cbt';
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  KeyRound,
  ShieldAlert,
  MoreVertical,
  PlusCircle,
  RotateCcw,
  User,
  X,
} from 'lucide-react';

interface LiveMonitoringViewProps {
  selectedExamId?: string;
  onOpenTokenModal: (exam: Exam) => void;
}

export const LiveMonitoringView: React.FC<LiveMonitoringViewProps> = ({
  selectedExamId,
  onOpenTokenModal,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [currentExamId, setCurrentExamId] = useState<string>(selectedExamId || '');
  const [monitoringData, setMonitoringData] = useState<MonitoringPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<MonitoringStudent | null>(null);
  const [isManaging, setIsManaging] = useState(false);

  useEffect(() => {
    loadExamsList();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      setCurrentExamId(selectedExamId);
    }
  }, [selectedExamId]);

  useEffect(() => {
    if (currentExamId) {
      fetchMonitoring();
      const interval = setInterval(fetchMonitoring, 4000); // Poll every 4 seconds for live telemetry
      return () => clearInterval(interval);
    }
  }, [currentExamId]);

  const loadExamsList = async () => {
    try {
      const res = await api.getExams();
      setExams(res.exams || []);
      if (!currentExamId && res.exams.length > 0) {
        setCurrentExamId(res.exams[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMonitoring = async () => {
    if (!currentExamId) return;
    try {
      const data = await api.getMonitoringData(currentExamId);
      setMonitoringData(data);
      if (selectedStudent) {
        // Sync open student modal
        const updated = data.students.find((s) => s.studentId === selectedStudent.studentId);
        if (updated) setSelectedStudent(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTime = async (studentId: string, minutes: number) => {
    if (!currentExamId) return;
    setIsManaging(true);
    try {
      await api.manageStudentSession(currentExamId, studentId, 'ADD_TIME', minutes);
      fetchMonitoring();
      alert(`Berhasil menambahkan waktu ${minutes} menit untuk siswa.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan waktu.');
    } finally {
      setIsManaging(false);
    }
  };

  const handleResetSession = async (studentId: string) => {
    if (!confirm('Apakah Anda yakin ingin mereset sesi siswa ini? Siswa dapat mengulang kembali ujian dari awal.')) {
      return;
    }
    if (!currentExamId) return;
    setIsManaging(true);
    try {
      await api.manageStudentSession(currentExamId, studentId, 'RESET_SESSION');
      fetchMonitoring();
      setSelectedStudent(null);
      alert('Sesi siswa berhasil direset.');
    } catch (err: any) {
      alert(err.message || 'Gagal mereset sesi.');
    } finally {
      setIsManaging(false);
    }
  };

  const formatSeconds = (secs: number) => {
    if (secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const studentsList = monitoringData?.students || [];
  const filteredStudents = studentsList.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.nis.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const activeExam = exams.find((e) => e.id === currentExamId);

  return (
    <div className="space-y-6">
      {/* Top Header & Exam Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Live Monitoring Pengawas Ujian
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Pembaruan Real-Time (Setiap 4 Detik)</span>
            <span>·</span>
            <span>Deteksi Pelanggaran & Telemetri Sesi</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Exam Selector Dropdown */}
          <select
            value={currentExamId}
            onChange={(e) => setCurrentExamId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>

          {activeExam && (
            <button
              onClick={() => onOpenTokenModal(activeExam)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-xs transition-colors whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Token: <strong className="font-mono">{monitoringData?.exam.token || '...'}</strong></span>
            </button>
          )}

          <button
            onClick={fetchMonitoring}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white"
            title="Segarkan data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      {monitoringData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Total Peserta</span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {monitoringData.summary.totalStudents}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Sedang Mengerjakan</span>
            <span className="text-xl font-bold font-mono text-indigo-600 tabular-nums">
              {monitoringData.summary.inProgress}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Selesai Submit</span>
            <span className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
              {monitoringData.summary.completed}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Belum Mulai</span>
            <span className="text-xl font-bold font-mono text-slate-400 tabular-nums">
              {monitoringData.summary.notStarted}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Terputus Jaringan</span>
            <span className="text-xl font-bold font-mono text-amber-600 tabular-nums">
              {monitoringData.summary.disconnected}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Terindikasi Pelanggaran</span>
            <span className="text-xl font-bold font-mono text-rose-600 tabular-nums">
              {monitoringData.summary.suspicious}
            </span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau NIS siswa..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto py-2 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Status Peserta</option>
            <option value="in_progress">Sedang Mengerjakan</option>
            <option value="completed">Selesai</option>
            <option value="not_started">Belum Mulai</option>
            <option value="disconnected">Terputus</option>
            <option value="suspicious">Terindikasi Mencurigakan</option>
          </select>
        </div>
      </div>

      {/* Real-time Student Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Siswa & NIS</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Status Sesi</th>
                <th className="py-3 px-4">Progres Pengerjaan</th>
                <th className="py-3 px-4">Sisa Waktu</th>
                <th className="py-3 px-4">Pelanggaran</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Menghubungkan ke telemetri peserta...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Tidak ada siswa yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  let badge = (
                    <span className="text-slate-500 font-medium">Belum Masuk</span>
                  );
                  if (s.status === 'completed') {
                    badge = (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Selesai</span>
                      </span>
                    );
                  } else if (s.status === 'in_progress') {
                    badge = (
                      <span className="text-indigo-700 font-semibold flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                        <span>Mengerjakan (Soal #{s.currentQuestionIndex + 1})</span>
                      </span>
                    );
                  } else if (s.status === 'disconnected') {
                    badge = (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Koneksi Terputus</span>
                      </span>
                    );
                  } else if (s.status === 'suspicious') {
                    badge = (
                      <span className="text-rose-700 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Peringatan Anti-Curang</span>
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={s.studentId}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedStudent(s)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">NIS: {s.nis}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-700">{s.className}</td>

                      <td className="py-3 px-4">{badge}</td>

                      <td className="py-3 px-4">
                        <div className="w-44">
                          <div className="flex justify-between text-[11px] mb-1 font-mono">
                            <span className="text-slate-600">
                              {s.answeredCount} / {s.totalQuestions} Soal
                            </span>
                            <span className="font-bold text-slate-900">{s.progressPercent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 transition-all"
                              style={{ width: `${s.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                        {s.hasFinished ? '-' : formatSeconds(s.remainingSeconds)}
                      </td>

                      <td className="py-3 px-4">
                        {s.violationCount > 0 ? (
                          <span className="font-mono font-bold text-rose-600">
                            {s.violationCount} Kali
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(s);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                        >
                          Detail Sesi
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Session Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedStudent.name}</h3>
                  <div className="text-xs text-slate-500 font-mono">
                    NIS: {selectedStudent.nis} · {selectedStudent.className}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Telemetry overview */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block">Status Sekarang:</span>
                  <strong className="text-slate-900 capitalize">{selectedStudent.status}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Sisa Waktu:</span>
                  <strong className="text-slate-900 font-mono">
                    {formatSeconds(selectedStudent.remainingSeconds)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Soal Sedang Dibuka:</span>
                  <strong className="text-slate-900">
                    Nomor {selectedStudent.currentQuestionIndex + 1}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Progres Terjawab:</span>
                  <strong className="text-slate-900">
                    {selectedStudent.answeredCount} dari {selectedStudent.totalQuestions} Butir ({selectedStudent.progressPercent}%)
                  </strong>
                </div>
              </div>

              {/* Anti-cheating incidents list */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Riwayat Kejadian & Peringatan ({selectedStudent.violationCount})</span>
                </h4>
                {selectedStudent.violations && selectedStudent.violations.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {selectedStudent.violations.map((v, i) => (
                      <div key={i} className="p-2 bg-white rounded border border-slate-200 text-[11px]">
                        <div className="flex items-center justify-between text-rose-600 font-semibold">
                          <span>{v.type} (Level {v.level})</span>
                          <span className="font-mono text-slate-400">
                            {new Date(v.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-0.5">{v.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs">
                    Tidak ada aktivitas mencurigakan yang terdeteksi pada sesi siswa ini.
                  </div>
                )}
              </div>

              {/* Proctor emergency actions */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 block">Intervensi Pengawas:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddTime(selectedStudent.studentId, 10)}
                    disabled={isManaging}
                    className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-xs border border-indigo-200 transition-colors"
                  >
                    +10 Menit Waktu
                  </button>
                  <button
                    onClick={() => handleAddTime(selectedStudent.studentId, 15)}
                    disabled={isManaging}
                    className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-xs border border-indigo-200 transition-colors"
                  >
                    +15 Menit Waktu
                  </button>
                  <button
                    onClick={() => handleResetSession(selectedStudent.studentId)}
                    disabled={isManaging}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold text-xs border border-rose-200 transition-colors"
                    title="Gunakan jika komputer siswa mati mendadak"
                  >
                    Reset Sesi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
