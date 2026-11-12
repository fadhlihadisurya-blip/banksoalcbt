import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Exam, Question } from '../../types/cbt';
import {
  FileQuestion,
  Database,
  Activity,
  Award,
  Sparkles,
  KeyRound,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { NavTab } from '../layout/AppLayout';

interface TeacherDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenExamGenerator: () => void;
  onOpenTokenModal: (exam: Exam) => void;
  onSelectExamForMonitoring: (examId: string) => void;
  onSelectExamForAnalytics: (examId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onNavigate,
  onOpenExamGenerator,
  onOpenTokenModal,
  onSelectExamForMonitoring,
  onSelectExamForAnalytics,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [examsRes, questionsRes] = await Promise.all([
        api.getExams(),
        api.getQuestions(),
      ]);
      setExams(examsRes.exams || []);
      setQuestions(questionsRes.questions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const lotsCount = questions.filter((q) => q.cognitiveLevel === 'LOTS' && q.status === 'active').length;
  const motsCount = questions.filter((q) => q.cognitiveLevel === 'MOTS' && q.status === 'active').length;
  const hotsCount = questions.filter((q) => q.cognitiveLevel === 'HOTS' && q.status === 'active').length;
  const activeExams = exams.filter((e) => e.status === 'active');

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Action Hub */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-md border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 text-indigo-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pusat Asesmen Berbasis AI & Analisis Kognitif</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Selamat Datang, Bapak/Ibu Guru
          </h2>
          <p className="mt-1 text-sm text-slate-300 leading-relaxed">
            Kelola bank soal kurikulum SMA, buat paket ujian terandomisasi unik per siswa, awasi peserta dengan anti-curang, dan peroleh diagnosis belajar mendalam melalui AI Gemini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenExamGenerator}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Generator Ujian Dinamis</span>
          </button>
          <button
            onClick={() => onNavigate('bank')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>Kelola Bank Soal</span>
          </button>
        </div>
      </div>

      {/* Cognitive Bank Distribution & Exam Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Bank Soal Kognitif */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Distribusi Bank Soal Aktif</span>
              <Database className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {questions.length} <span className="text-xs font-normal text-slate-400">Butir</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Klasifikasi Taksonomi Bloom SMA</p>

            {/* LOTS / MOTS / HOTS Bars */}
            <div className="mt-4 space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">LOTS (Mengingat & Memahami)</span>
                  <span className="font-mono font-semibold text-slate-900">{lotsCount} soal</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${questions.length ? (lotsCount / questions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">MOTS (Menerapkan & Analisis)</span>
                  <span className="font-mono font-semibold text-slate-900">{motsCount} soal</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${questions.length ? (motsCount / questions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">HOTS (Evaluasi & Kreasi)</span>
                  <span className="font-mono font-semibold text-slate-900">{hotsCount} soal</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600"
                    style={{ width: `${questions.length ? (hotsCount / questions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigate('bank')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center justify-between w-full"
            >
              <span>Tambah / Impor Soal Massal (Excel)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: Ujian Berjalan & Token Aktif */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Ujian & Token Berjalan</span>
              <KeyRound className="w-4 h-4 text-amber-600" />
            </div>

            {activeExams.length > 0 ? (
              <div className="mt-3">
                <div className="text-xs text-slate-500">Ujian Terpilih:</div>
                <div className="font-semibold text-sm text-slate-900 truncate mt-0.5">
                  {activeExams[0].title}
                </div>

                <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                  <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                    TOKEN UJIAN AKTIF
                  </div>
                  <div className="text-2xl font-bold font-mono tracking-widest text-slate-900 my-1">
                    {activeExams[0].token}
                  </div>
                  <div className="text-[11px] text-amber-700">
                    Rotasi otomatis tiap {activeExams[0].tokenIntervalMinutes || 15} menit
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-center py-6 text-xs text-slate-400">
                Tidak ada ujian aktif saat ini.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            {activeExams.length > 0 && (
              <>
                <button
                  onClick={() => onOpenTokenModal(activeExams[0])}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-1"
                >
                  Kelola Token
                </button>
                <button
                  onClick={() => {
                    onSelectExamForMonitoring(activeExams[0].id);
                    onNavigate('monitoring');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex-1"
                >
                  Live Monitoring
                </button>
              </>
            )}
          </div>
        </div>

        {/* Card 3: AI Learning Analytics Shortcut */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Gemini AI Analytics</span>
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>

            <div className="mt-3">
              <div className="text-sm font-bold text-slate-900">Diagnosis Kognitif & Rekomendasi</div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Analisis otomatis berbasis bukti: mengukur capaian tiap indikator kompetensi, mendeteksi miskonsepsi, dan merekomendasikan strategi remedial bagi guru.
              </p>
            </div>

            <div className="mt-4 p-3 bg-purple-50/60 border border-purple-100 rounded-lg text-xs space-y-1.5 text-purple-900">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                <span>Analisis Klasikal per Rombel</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                <span>Rekomendasi Diferensiasi Belajar</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                if (activeExams.length > 0) {
                  onSelectExamForAnalytics(activeExams[0].id);
                }
                onNavigate('analytics');
              }}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Buka AI Learning Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Exams Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Daftar Paket Ujian Sekolah</h3>
            <p className="text-xs text-slate-500">Monitoring langsung, pengelolaan token, dan publikasi hasil ujian</p>
          </div>
          <button
            onClick={onOpenExamGenerator}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors self-start sm:self-auto"
          >
            + Buat Ujian Baru
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Ujian</th>
                <th className="py-3 px-4">Durasi & KKTP</th>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Anti-Curang</th>
                <th className="py-3 px-4">Status Hasil</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{exam.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Fisika · Kelas XII MIPA · {exam.cognitiveTarget?.totalQuestions || 7} Soal
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono tabular-nums">
                    <div>{exam.durationMinutes} Menit</div>
                    <div className="text-[11px] text-slate-500">KKTP: {exam.kktpScore || 75}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded text-xs">
                        {exam.token}
                      </span>
                      <button
                        onClick={() => onOpenTokenModal(exam)}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Atur Token"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="text-slate-700 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fullscreen + Tab Intercept</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`text-[11px] font-semibold ${exam.isPublishedResults ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {exam.isPublishedResults ? 'Hasil Dipublikasi' : 'Disembunyikan'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          onSelectExamForMonitoring(exam.id);
                          onNavigate('monitoring');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                      >
                        Monitoring
                      </button>
                      <button
                        onClick={() => {
                          onSelectExamForAnalytics(exam.id);
                          onNavigate('analytics');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
                      >
                        AI Analytics
                      </button>
                      <button
                        onClick={() => {
                          onSelectExamForAnalytics(exam.id);
                          onNavigate('results');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Nilai
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
