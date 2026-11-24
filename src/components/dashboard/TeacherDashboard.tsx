import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Exam,
  Question,
  ClassGroup,
  Subject,
  Chapter,
  Subchapter,
  Competency,
  TeacherMenuKey,
  normalizeTeacherMenus,
} from '../../types/cbt';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
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
  Pencil,
  CheckCircle2,
  X,
  Trash2,
  AlertTriangle,
  ClipboardCheck,
  BarChart3,
  Copy,
  Check,
} from 'lucide-react';
import { NavTab } from '../layout/AppLayout';

interface TeacherDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenExamGenerator: () => void;
  onOpenTokenModal: (exam: Exam) => void;
  onSelectExamForMonitoring: (examId: string) => void;
  onSelectExamForResults: (examId: string) => void;
  refreshKey?: number;
}

const toLocalDateTimeInput = (isoOrDate: string | Date) => {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onNavigate,
  onOpenExamGenerator,
  onOpenTokenModal,
  onSelectExamForMonitoring,
  onSelectExamForResults,
  refreshKey = 0,
}) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const teacherMenus = normalizeTeacherMenus(settings.teacherMenus);
  const canAccess = (key: TeacherMenuKey) => user?.role === 'admin' || teacherMenus[key];

  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subchapters, setSubchapters] = useState<Subchapter[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Exam (Target Classes & Schedule)
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTargetClassIds, setEditTargetClassIds] = useState<string[]>([]);
  const [editDurationMinutes, setEditDurationMinutes] = useState(90);
  const [editKktpScore, setEditKktpScore] = useState(75);
  const [editScheduleStart, setEditScheduleStart] = useState('');
  const [editScheduleEnd, setEditScheduleEnd] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Exam
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);

  // Question Proportion Modal (Low / Med / High)
  const [proportionExam, setProportionExam] = useState<Exam | null>(null);
  const [copiedProportion, setCopiedProportion] = useState(false);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [examsRes, questionsRes, classesRes, taxRes] = await Promise.all([
        api.getExams(),
        api.getQuestions(),
        api.getClasses().catch(() => ({ classes: [] })),
        api.getTaxonomy().catch(() => ({ subjects: [], chapters: [], subchapters: [], competencies: [] })),
      ]);
      setExams(examsRes.exams || []);
      setQuestions(questionsRes.questions || []);
      setClasses(classesRes.classes || []);
      setSubjects(taxRes.subjects || []);
      setChapters(taxRes.chapters || []);
      setSubchapters(taxRes.subchapters || []);
      setCompetencies(taxRes.competencies || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setEditTitle(exam.title || '');
    setEditTargetClassIds(Array.isArray(exam.targetClassIds) ? [...exam.targetClassIds] : []);
    setEditDurationMinutes(exam.durationMinutes || 90);
    setEditKktpScore(exam.kktpScore || 75);
    setEditScheduleStart(exam.scheduleStart ? toLocalDateTimeInput(exam.scheduleStart) : '');
    setEditScheduleEnd(exam.scheduleEnd ? toLocalDateTimeInput(exam.scheduleEnd) : '');
  };

  const handleSaveEditExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;
    if (!editTitle.trim()) {
      alert('Nama ujian wajib diisi.');
      return;
    }
    if (editTargetClassIds.length === 0) {
      alert('Pilih minimal satu kelas peserta ujian.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload: Partial<Exam> = {
        title: editTitle.trim(),
        targetClassIds: editTargetClassIds,
        durationMinutes: Math.max(5, Number(editDurationMinutes) || 90),
        kktpScore: Math.max(0, Number(editKktpScore) || 0),
      };
      if (editScheduleStart) {
        payload.scheduleStart = new Date(editScheduleStart).toISOString();
      }
      if (editScheduleEnd) {
        payload.scheduleEnd = new Date(editScheduleEnd).toISOString();
      }

      await api.updateExam(editingExam.id, payload);
      setEditingExam(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui paket ujian.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteExam = async () => {
    if (!deletingExam) return;
    setIsDeletingExam(true);
    try {
      await api.deleteExam(deletingExam.id);
      setDeletingExam(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus paket ujian.');
    } finally {
      setIsDeletingExam(false);
    }
  };

  const lotsCount = questions.filter((q) => q.cognitiveLevel === 'LOTS' && q.status === 'active').length;
  const motsCount = questions.filter((q) => q.cognitiveLevel === 'MOTS' && q.status === 'active').length;
  const hotsCount = questions.filter((q) => q.cognitiveLevel === 'HOTS' && q.status === 'active').length;
  const activeExams = exams.filter((e) => e.status === 'active');
  const showDeleteExamAction = settings.showDeleteExamAction !== false;

  const resolveScopeLabel = (unit: {
    scopeType?: string;
    scopeId?: string;
    chapterId?: string;
    subchapterId?: string;
    competencyId?: string;
    label?: string;
  }) => {
    if (unit.label && unit.label.trim().length > 0) return unit.label;
    const ch = chapters.find((c) => c.id === unit.chapterId)?.name;
    const sc = subchapters.find((s) => s.id === unit.subchapterId)?.name;
    const cmp = competencies.find((k) => k.id === unit.competencyId);
    const cmpLabel = cmp ? `${cmp.code ? `[${cmp.code}] ` : ''}${cmp.description}` : '';
    return [ch, sc, cmpLabel].filter(Boolean).join(' › ') || unit.scopeId || 'Materi Ujian';
  };

  const getExamProportionSummary = (exam: Exam) => {
    const target = exam.cognitiveTarget;
    const perScope = Array.isArray(target?.perScopeTargets) ? target.perScopeTargets : [];
    const low =
      perScope.length > 0
        ? perScope.reduce((sum, u) => sum + Math.max(0, Number(u.lotsCount) || 0), 0)
        : Math.max(0, Number(target?.lotsCount) || 0);
    const med =
      perScope.length > 0
        ? perScope.reduce((sum, u) => sum + Math.max(0, Number(u.motsCount) || 0), 0)
        : Math.max(0, Number(target?.motsCount) || 0);
    const high =
      perScope.length > 0
        ? perScope.reduce((sum, u) => sum + Math.max(0, Number(u.hotsCount) || 0), 0)
        : Math.max(0, Number(target?.hotsCount) || 0);
    const total = Math.max(low + med + high, Number(target?.totalQuestions) || 0);
    return { low, med, high, total, perScope };
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Action Hub */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-md border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 text-indigo-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pusat Asesmen & Analisis Butir Soal</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Selamat Datang, Bapak/Ibu Guru
          </h2>
          <p className="mt-1 text-sm text-slate-300 leading-relaxed">
            Kelola bank soal kurikulum SMA, buat paket ujian terandomisasi unik per siswa, awasi peserta dengan anti-curang, dan evaluasi kualitas butir soal melalui Anbuso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canAccess('exams') && (
            <button
              onClick={onOpenExamGenerator}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Generator Ujian Dinamis</span>
            </button>
          )}
          {canAccess('bank') && (
            <button
              onClick={() => onNavigate('bank')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition-colors"
            >
              <Database className="w-4 h-4" />
              <span>Kelola Bank Soal</span>
            </button>
          )}
        </div>
      </div>

      {/* Cognitive Bank Distribution & Exam Status */}
      <div className={`grid grid-cols-1 ${canAccess('anbuso') ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-5`}>
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

          {canAccess('bank') && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => onNavigate('bank')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center justify-between w-full"
              >
                <span>Tambah / Impor Soal Massal (Excel)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
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
                {canAccess('monitoring') && (
                  <button
                    onClick={() => {
                      onSelectExamForMonitoring(activeExams[0].id);
                      onNavigate('monitoring');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex-1"
                  >
                    Live Monitoring
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Card 3: Anbuso Shortcut */}
        {canAccess('anbuso') && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Analisis Butir Soal</span>
                <ClipboardCheck className="w-4 h-4 text-indigo-600" />
              </div>

              <div className="mt-3">
                <div className="text-sm font-bold text-slate-900">Evaluasi Kualitas Soal (Anbuso)</div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Ukur kualitas setiap butir soal secara objektif berdasarkan jawaban peserta untuk perbaikan bank soal sekolah.
                </p>
              </div>

              <div className="mt-4 p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs space-y-1.5 text-indigo-900">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  <span>Difficulty, Discrimination & Distractor</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  <span>Reliabilitas & Decision Butir Soal</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  if (activeExams.length > 0) {
                    onSelectExamForResults(activeExams[0].id);
                  }
                  onNavigate('anbuso');
                }}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Buka Menu Anbuso</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Exams Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Daftar Paket Ujian Sekolah</h3>
            <p className="text-xs text-slate-500">Monitoring langsung, pengelolaan token, dan publikasi hasil ujian</p>
          </div>
          {canAccess('exams') && (
            <button
              onClick={onOpenExamGenerator}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors self-start sm:self-auto"
            >
              + Buat Ujian Baru
            </button>
          )}
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
              {exams.map((exam) => {
                const targetNames = (exam.targetClassIds || [])
                  .map((cid) => classes.find((c) => c.id === cid)?.name || cid)
                  .filter(Boolean);
                return (
                  <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{exam.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {exam.targetClassIds?.length || 0} Kelas Peserta · {exam.cognitiveTarget?.totalQuestions || 0} Soal
                      </div>
                      {targetNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {targetNames.map((clsName, idx) => (
                            <span
                              key={`${exam.id}-cls-${idx}`}
                              className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded"
                            >
                              {clsName}
                            </span>
                          ))}
                        </div>
                      )}
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
                            setCopiedProportion(false);
                            setProportionExam(exam);
                          }}
                          className="p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                          title="Proporsi Soal (Low, Med, High)"
                          aria-label="Proporsi Soal Low, Med, High"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditExam(exam)}
                          className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                          title="Edit Paket Ujian (Kelas & Jadwal)"
                          aria-label="Edit Paket Ujian"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {canAccess('monitoring') && (
                          <button
                            onClick={() => {
                              onSelectExamForMonitoring(exam.id);
                              onNavigate('monitoring');
                            }}
                            className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Live Monitoring Ujian"
                            aria-label="Monitoring Ujian"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        )}
                        {canAccess('results') && (
                          <button
                            onClick={() => {
                              onSelectExamForResults(exam.id);
                              onNavigate('results');
                            }}
                            className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Hasil & Nilai Ujian"
                            aria-label="Nilai Ujian"
                          >
                            <Award className="w-4 h-4" />
                          </button>
                        )}
                        {showDeleteExamAction && (
                          <button
                            onClick={() => setDeletingExam(exam)}
                            className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                            title="Hapus Paket Ujian"
                            aria-label="Hapus Paket Ujian"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Kelas & Jadwal Ujian */}
      {editingExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditExam}
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Paket Ujian</h3>
                <p className="text-[11px] text-slate-500">Atur kelas peserta agar ujian tampil di akun siswa yang sesuai</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Paket Ujian</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Durasi (Menit)</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={editDurationMinutes}
                    onChange={(e) => setEditDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">KKTP</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editKktpScore}
                    onChange={(e) => setEditKktpScore(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jadwal Mulai</label>
                  <input
                    type="datetime-local"
                    value={editScheduleStart}
                    onChange={(e) => setEditScheduleStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jadwal Berakhir</label>
                  <input
                    type="datetime-local"
                    value={editScheduleEnd}
                    onChange={(e) => setEditScheduleEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">
                    Kelas / Rombel Peserta ({editTargetClassIds.length}/{classes.length})
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditTargetClassIds(classes.map((c) => c.id))}
                      className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200"
                    >
                      Pilih Semua Kelas
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTargetClassIds([])}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded border border-slate-200"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {classes.map((cls) => {
                    const checked = editTargetClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() =>
                          setEditTargetClassIds((prev) =>
                            prev.includes(cls.id) ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                          )
                        }
                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-colors ${
                          checked
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{cls.name}</span>
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal Proporsi Soal Low / Med / High */}
      {proportionExam && (() => {
        const { low, med, high, total, perScope } = getExamProportionSummary(proportionExam);
        const denom = low + med + high || total || 1;
        const lowPct = Math.round((low / denom) * 100);
        const medPct = Math.round((med / denom) * 100);
        const highPct = Math.round((high / denom) * 100);
        const subjectName = subjects.find((s) => s.id === proportionExam.subjectId)?.name;

        const handleCopyProportion = async () => {
          const lines =
            perScope.length > 0
              ? perScope.map(
                  (u) =>
                    `${resolveScopeLabel(u)}\t${Number(u.lotsCount) || 0}L · ${Number(u.motsCount) || 0}M · ${Number(u.hotsCount) || 0}H`
                )
              : [`${proportionExam.title}\t${low}L · ${med}M · ${high}H`];
          try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setCopiedProportion(true);
            setTimeout(() => setCopiedProportion(false), 2500);
          } catch {}
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-sky-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Proporsi Soal (Low, Med, High)
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    <strong className="text-slate-700">{proportionExam.title}</strong>
                    {subjectName ? ` · ${subjectName}` : ''} · Total {total} Soal
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyProportion}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                    title="Salin rincian proporsi"
                  >
                    {copiedProportion ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProportionExam(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto text-xs">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <div className="text-[11px] font-semibold text-emerald-800">Low (LOTS)</div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono text-emerald-900">{low}</span>
                      <span className="text-[11px] font-mono font-semibold text-emerald-700">
                        {lowPct}%
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
                    <div className="text-[11px] font-semibold text-indigo-800">Med (MOTS)</div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono text-indigo-900">{med}</span>
                      <span className="text-[11px] font-mono font-semibold text-indigo-700">
                        {medPct}%
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200">
                    <div className="text-[11px] font-semibold text-purple-800">High (HOTS)</div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono text-purple-900">{high}</span>
                      <span className="text-[11px] font-mono font-semibold text-purple-700">
                        {highPct}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stacked Bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>Distribusi Level Kognitif Paket Ujian</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {low}L · {med}M · {high}H
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    {low > 0 && (
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${(low / denom) * 100}%` }}
                        title={`Low (LOTS): ${low} soal`}
                      />
                    )}
                    {med > 0 && (
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${(med / denom) * 100}%` }}
                        title={`Med (MOTS): ${med} soal`}
                      />
                    )}
                    {high > 0 && (
                      <div
                        className="h-full bg-purple-600"
                        style={{ width: `${(high / denom) * 100}%` }}
                        title={`High (HOTS): ${high} soal`}
                      />
                    )}
                  </div>
                </div>

                {/* Per-Scope Breakdown */}
                {perScope.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        Rincian Proporsi per Materi / Kompetensi ({perScope.length})
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">L · M · H</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {perScope.map((unit, idx) => {
                        const uL = Number(unit.lotsCount) || 0;
                        const uM = Number(unit.motsCount) || 0;
                        const uH = Number(unit.hotsCount) || 0;
                        return (
                          <div
                            key={`${unit.scopeType}:${unit.scopeId}:${idx}`}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-4 hover:bg-slate-50/70"
                          >
                            <span className="text-slate-800 leading-snug">
                              {resolveScopeLabel(unit)}
                            </span>
                            <span className="font-mono font-bold text-slate-900 shrink-0 whitespace-nowrap">
                              <span className="text-emerald-700">{uL}L</span>
                              <span className="text-slate-400 mx-1">·</span>
                              <span className="text-indigo-700">{uM}M</span>
                              <span className="text-slate-400 mx-1">·</span>
                              <span className="text-purple-700">{uH}H</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                    Paket ujian ini menggunakan komposisi global:{' '}
                    <strong className="font-mono text-slate-900">
                      {low}L · {med}M · {high}H
                    </strong>{' '}
                    (Low: {low} soal, Med: {med} soal, High: {high} soal).
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setProportionExam(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Konfirmasi Hapus Paket Ujian */}
      {deletingExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Hapus Paket Ujian?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Paket ujian <strong className="text-slate-900">"{deletingExam.title}"</strong> beserta sesi dan hasil pengerjaannya akan dihapus secara permanen dari sistem.
                </p>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingExam(null)}
                disabled={isDeletingExam}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExam}
                disabled={isDeletingExam}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {isDeletingExam ? 'Menghapus...' : 'Ya, Hapus Ujian'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
