import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../lib/api';
import { StudentExamInfo } from '../../types/cbt';
import {
  Clock,
  KeyRound,
  CheckCircle,
  Play,
  RotateCcw,
  Award,
  AlertCircle,
  Calendar,
  Lock,
  ShieldAlert,
  MousePointerClick,
  Loader2,
  Save,
} from 'lucide-react';
import {
  incrementStudentLoading,
  resetStudentActivityCounters,
  useStudentActivityCounters,
} from '../../lib/studentActivityCounter';

interface StudentDashboardProps {
  onStartExam: (examId: string, inputToken?: string) => Promise<void>;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onStartExam }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [exams, setExams] = useState<StudentExamInfo[]>([]);
  const [className, setClassName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedExamForToken, setSelectedExamForToken] = useState<StudentExamInfo | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [actionError, setActionError] = useState('');
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [submittingToken, setSubmittingToken] = useState(false);
  const activityCounters = useStudentActivityCounters(user?.id);

  useEffect(() => {
    if (user?.id) {
      loadExams();
    }
  }, [user?.id]);

  const loadExams = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;
      incrementStudentLoading(user.id);
      const [examsRes, classesRes] = await Promise.all([
        api.getStudentExams(user.id),
        api.getClasses().catch(() => ({ classes: [] })),
      ]);
      setExams(examsRes.exams || []);
      if (user.classId) {
        const matchedClass = (classesRes.classes || []).find((c) => c.id === user.classId);
        setClassName(matchedClass?.name || user.classId);
      } else {
        setClassName('-');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerBrowserFullscreen = () => {
    try {
      const elem: any = document.documentElement;
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        if (elem.requestFullscreen) {
          const p = elem.requestFullscreen();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignore browser restrictions if fullscreen is disallowed
    }
  };

  const exitBrowserFullscreenIfActive = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } catch {
      // Ignore
    }
  };

  const handleOpenTokenDialog = async (exam: StudentExamInfo) => {
    setActionError('');
    if (exam.studentStatus === 'in_progress') {
      triggerBrowserFullscreen();
      setStartingExamId(exam.id);
      try {
        // Direct resume without re-entering token
        await onStartExam(exam.id);
      } catch (err: any) {
        exitBrowserFullscreenIfActive();
        setActionError(err?.message || 'Gagal melanjutkan sesi ujian.');
      } finally {
        setStartingExamId(null);
      }
      return;
    }
    setSelectedExamForToken(exam);
    setInputToken('');
    setTokenError('');
  };

  const handleConfirmStart = async () => {
    if (!selectedExamForToken || submittingToken) return;
    if (selectedExamForToken.isTokenActive && !inputToken.trim()) {
      setTokenError('Masukkan token ujian yang diberikan pengawas.');
      return;
    }

    // Request fullscreen synchronously inside the click gesture before async API calls
    triggerBrowserFullscreen();
    setSubmittingToken(true);
    setTokenError('');
    try {
      // Validate by starting
      await onStartExam(selectedExamForToken.id, inputToken.trim());
      setSelectedExamForToken(null);
    } catch (err: any) {
      exitBrowserFullscreenIfActive();
      setTokenError(err?.message || 'Token tidak valid.');
    } finally {
      setSubmittingToken(false);
    }
  };

  const totalViolations = exams.reduce((sum, ex) => sum + (Number(ex.violationCount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Student Profile Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-xs shrink-0">
            {user?.name.charAt(0)}
          </div>
          <div>
            <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">
              Peserta Ujian Resmi SMA
            </div>
            <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
              <span>NIS: <strong className="font-mono text-slate-700">{user?.nis || '-'}</strong></span>
              <span>·</span>
              <span>Kelas: <strong className="text-slate-700">{className || '-'}</strong></span>
              <span>·</span>
              <span>{settings.schoolName || 'Portal CBT Sekolah'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs space-y-1">
            <div className="text-slate-500">Pelanggaran Tercatat:</div>
            <div
              className={`font-semibold flex items-center gap-1.5 ${
                totalViolations >= 2
                  ? 'text-rose-700'
                  : totalViolations === 1
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              <ShieldAlert
                className={`w-3.5 h-3.5 ${
                  totalViolations >= 2
                    ? 'text-rose-600'
                    : totalViolations === 1
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              />
              <span className="font-mono font-bold">{totalViolations}</span>
              <span>{totalViolations === 0 ? '(Aman)' : 'Pelanggaran'}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 font-medium">Counter Click (Aktivitas Data):</span>
              <button
                type="button"
                data-skip-click-count="true"
                onClick={() => resetStudentActivityCounters(user?.id)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                title="Reset counter aktivitas"
              >
                Reset
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono font-semibold text-slate-700">
              <span className="flex items-center gap-1" title="Jumlah klik siswa">
                <MousePointerClick className="w-3.5 h-3.5 text-indigo-600" />
                <span>Klik: {activityCounters.clickCount}</span>
              </span>
              <span className="flex items-center gap-1" title="Jumlah proses muat/loading data">
                <Loader2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Loading: {activityCounters.loadingCount}</span>
              </span>
              <span className="flex items-center gap-1" title="Jumlah proses simpan/save data">
                <Save className="w-3.5 h-3.5 text-emerald-600" />
                <span>Save: {activityCounters.saveCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Available Exams Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Ujian yang Tersedia</h3>
            <p className="text-xs text-slate-500">Pilih ujian sesuai jadwal yang telah ditentukan</p>
          </div>
          <button
            onClick={loadExams}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Segarkan Daftar
          </button>
        </div>

        {actionError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError('')}
              className="text-rose-500 hover:text-rose-700 font-semibold"
            >
              Tutup
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Memuat daftar ujian...</div>
        ) : exams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs space-y-1.5">
            <p className="font-semibold text-slate-700">
              Belum ada ujian yang dijadwalkan untuk kelas Anda ({className || '-'}) saat ini.
            </p>
            <p className="text-[11px] text-slate-400">
              Pastikan Guru/Admin telah memasukkan kelas <strong className="text-slate-600">{className || '-'}</strong> ke daftar kelas peserta pada paket ujian terkait.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => {
              const formatSchedule = (iso?: string) => {
                if (!iso) return '-';
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return '-';
                return d.toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              };
              return (
              <div
                key={exam.id}
                className={`bg-white border rounded-xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between ${
                  exam.isRemedial ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-indigo-600 truncate">{exam.subject}</span>
                      {exam.isRemedial && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase shrink-0">
                          Remedial · Percobaan ke-{exam.attemptCount || 1}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.durationMinutes} Menit</span>
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 mb-2">
                    {exam.title}
                  </h4>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    {exam.isRemedial ? (
                      <>
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            Jumlah Soal Remedial:{' '}
                            <strong className="font-mono text-slate-800">
                              {exam.remedialQuestionCount || 0} butir
                            </strong>{' '}
                            ({exam.remedialMode === 'same_wrong' ? 'Soal Salah Sebelumnya' : 'Soal Acak Sub-Sub-Bab'})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Nilai Awal: <strong className="font-mono text-rose-600">{exam.baseScore ?? 0}</strong> · Batas Lulus Maks KKM:{' '}
                            <strong className="font-mono text-emerald-700">{exam.kktpScore || 75}</strong> · <span className="font-semibold text-amber-700">1x Pengerjaan</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Jadwal: <strong className="font-mono text-slate-700">{formatSchedule(exam.scheduleStart)}</strong> –{' '}
                            <strong className="font-mono text-slate-700">{formatSchedule(exam.scheduleEnd)}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          <span>KKTP Minimum: <strong className="font-mono">{exam.kktpScore || 75}</strong></span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Token Ujian: {exam.isTokenActive ? 'Wajib Dimasukkan' : 'Terbuka (Tanpa Token)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert
                        className={`w-3.5 h-3.5 ${(exam.violationCount || 0) > 0 ? 'text-rose-500' : 'text-slate-400'}`}
                      />
                      <span>
                        Pelanggaran Tercatat:{' '}
                        <strong
                          className={`font-mono ${
                            (exam.violationCount || 0) > 0 ? 'text-rose-600' : 'text-slate-700'
                          }`}
                        >
                          {exam.violationCount || 0}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    {exam.studentStatus === 'completed' ? (
                      exam.isRemedial ? (
                        exam.isRemedialPassed ? (
                          <span className="text-xs font-semibold text-teal-700 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-teal-600" />
                            <span>Tuntas Remedial</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                            <span>Belum Lulus (Menunggu Jadwal Ulang)</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>Selesai Dikerjakan</span>
                        </span>
                      )
                    ) : exam.studentStatus === 'in_progress' ? (
                      <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                        <RotateCcw className="w-4 h-4 text-amber-600" />
                        <span>Sesi Tersimpan Sedang Berjalan</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Belum Dimulai</span>
                    )}
                  </div>

                  <div>
                    {exam.studentStatus === 'completed' ? (
                      exam.isPublishedResults ? (
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">
                            {exam.isRemedial ? 'Nilai Akhir (Maks KKM):' : 'Nilai Anda:'}
                          </span>
                          <span className="text-lg font-bold font-mono text-indigo-600">
                            {exam.score} / {exam.isRemedial ? exam.kktpScore || 75 : 100}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Nilai belum dipublikasikan</span>
                      )
                    ) : exam.studentStatus === 'in_progress' ? (
                      <button
                        onClick={() => handleOpenTokenDialog(exam)}
                        disabled={startingExamId === exam.id}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{startingExamId === exam.id ? 'Memuat...' : 'Lanjutkan Ujian'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenTokenDialog(exam)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Mulai Ujian</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Token Input Dialog Modal */}
      {selectedExamForToken && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Konfirmasi Masuk Ujian</h4>
                <p className="text-xs text-slate-500">{selectedExamForToken.title}</p>
              </div>
            </div>

            {tokenError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{tokenError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
                <strong>Ketentuan Ujian CBT:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500">
                  <li>Layar akan otomatis terkunci ke mode Fullscreen.</li>
                  <li>Dilarang berpindah tab atau meminimalkan jendela browser.</li>
                  <li>Jawaban tersimpan otomatis secara berkala di server.</li>
                </ul>
              </div>

              {selectedExamForToken.isTokenActive && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Masukkan Token Ujian (Dari Pengawas):
                  </label>
                  <input
                    type="text"
                    value={inputToken}
                    onChange={(e) => {
                      setInputToken(e.target.value.toUpperCase());
                      if (tokenError) setTokenError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmStart();
                      }
                    }}
                    placeholder="Masukkan kode token..."
                    maxLength={10}
                    className="w-full px-3 py-2.5 text-center text-lg font-bold font-mono tracking-widest uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedExamForToken(null)}
                disabled={submittingToken}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmStart}
                disabled={submittingToken}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {submittingToken ? 'Memvalidasi...' : 'Mulai Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
