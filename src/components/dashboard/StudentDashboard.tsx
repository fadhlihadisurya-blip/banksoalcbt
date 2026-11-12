import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { StudentExamInfo } from '../../types/cbt';
import {
  FileQuestion,
  Clock,
  KeyRound,
  CheckCircle,
  Play,
  RotateCcw,
  Award,
  AlertCircle,
  Calendar,
  Lock,
} from 'lucide-react';

interface StudentDashboardProps {
  onStartExam: (examId: string, inputToken?: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onStartExam }) => {
  const { user } = useAuth();
  const [exams, setExams] = useState<StudentExamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamForToken, setSelectedExamForToken] = useState<StudentExamInfo | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadExams();
    }
  }, [user?.id]);

  const loadExams = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;
      const res = await api.getStudentExams(user.id);
      setExams(res.exams || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTokenDialog = (exam: StudentExamInfo) => {
    if (exam.studentStatus === 'in_progress') {
      // Direct resume without re-entering token
      onStartExam(exam.id);
      return;
    }
    setSelectedExamForToken(exam);
    setInputToken('');
    setTokenError('');
  };

  const handleConfirmStart = async () => {
    if (!selectedExamForToken) return;
    if (selectedExamForToken.isTokenActive && !inputToken.trim()) {
      setTokenError('Masukkan token ujian yang diberikan pengawas.');
      return;
    }

    setSubmittingToken(true);
    setTokenError('');
    try {
      // Validate by starting
      onStartExam(selectedExamForToken.id, inputToken.trim());
      setSelectedExamForToken(null);
    } catch (err: any) {
      setTokenError(err.message || 'Token tidak valid.');
    } finally {
      setSubmittingToken(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Profile Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-xs">
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
              <span>Kelas: <strong className="text-slate-700">XII MIPA 1</strong></span>
              <span>·</span>
              <span>SMAN 1 Prestasi Bangsa</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs space-y-1">
          <div className="text-slate-500">Status Integritas Siswa:</div>
          <div className="font-semibold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sesi Terdaftar & Aman</span>
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

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Memuat daftar ujian...</div>
        ) : exams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
            Belum ada ujian yang dijadwalkan untuk kelas Anda saat ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-indigo-600">{exam.subject}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.durationMinutes} Menit</span>
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 mb-2">
                    {exam.title}
                  </h4>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>KKTP Minimum: <strong className="font-mono">{exam.kktpScore || 75}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Token Ujian: {exam.isTokenActive ? 'Wajib Dimasukkan' : 'Terbuka'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    {exam.studentStatus === 'completed' ? (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Selesai Dikerjakan</span>
                      </span>
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
                          <span className="text-xs text-slate-400 block">Nilai Anda:</span>
                          <span className="text-lg font-bold font-mono text-indigo-600">
                            {exam.score} / 100
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Nilai belum dipublikasikan</span>
                      )
                    ) : exam.studentStatus === 'in_progress' ? (
                      <button
                        onClick={() => handleOpenTokenDialog(exam)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Lanjutkan Ujian</span>
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
            ))}
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
                    onChange={(e) => setInputToken(e.target.value.toUpperCase())}
                    placeholder="Contoh: SMA7X9"
                    maxLength={10}
                    className="w-full px-3 py-2.5 text-center text-lg font-bold font-mono tracking-widest uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block text-center">
                    Token aktif demo: <code className="text-indigo-600 font-bold">SMA7X9</code>
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedExamForToken(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
