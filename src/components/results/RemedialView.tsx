import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  RemedialMode,
  RemedialOverviewPayload,
  RemedialExamStudentRow,
} from '../../types/cbt';
import { computeRemedialDuration } from '../../lib/remedialHelper';
import {
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Search,
  Shuffle,
  CopyCheck,
  Clock,
  X,
  RefreshCw,
  Award,
  Users,
  BookOpen,
  Check,
} from 'lucide-react';

interface RemedialViewProps {
  initialExamId?: string;
}

export const RemedialView: React.FC<RemedialViewProps> = ({ initialExamId }) => {
  const { user } = useAuth();
  const [data, setData] = useState<RemedialOverviewPayload | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || '');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'remedial' | 'passed'>('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Selection for batch or individual remedial generation
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Generate Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateMode, setGenerateMode] = useState<RemedialMode>('same_wrong');
  const [modalTargetIds, setModalTargetIds] = useState<string[] | undefined>(undefined);
  const [generating, setGenerating] = useState(false);

  const loadOverview = async (examIdToLoad?: string) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await api.getRemedialOverview(examIdToLoad || undefined);
      setData(res);
      if (res?.selectedExam?.id) {
        setSelectedExamId(res.selectedExam.id);
      } else if (!examIdToLoad && res?.completedExams?.length > 0) {
        setSelectedExamId(res.completedExams[0].id);
      }
      setSelectedStudentIds([]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal memuat data ujian untuk remedial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview(selectedExamId || undefined);
  }, [selectedExamId]);

  const students = data?.students || [];
  const remedialCandidates = students.filter((s) => !s.isPassedOriginal);
  const schedulableStudents = remedialCandidates.filter(
    (s) => !s.remedial || (s.remedial.status === 'completed' && !s.remedial.isPassed)
  );

  const filteredStudents = students.filter((s) => {
    if (statusFilter === 'remedial' && s.isPassedOriginal) return false;
    if (statusFilter === 'passed' && !s.isPassedOriginal) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.studentName.toLowerCase().includes(q) ||
        s.studentNis.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleToggleSelectAllRemedial = () => {
    const candidateIds = schedulableStudents.map((s) => s.studentId);
    if (candidateIds.length === 0) return;
    const allSelected = candidateIds.every((id) => selectedStudentIds.includes(id));
    setSelectedStudentIds(allSelected ? [] : candidateIds);
  };

  const openGenerateModal = (targetIds?: string[]) => {
    setErrorMessage('');
    setSuccessMessage('');
    setModalTargetIds(targetIds && targetIds.length > 0 ? targetIds : undefined);
    setShowGenerateModal(true);
  };

  const handleGenerate = async () => {
    if (!selectedExamId || generating) return;
    setGenerating(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const targetIds =
        modalTargetIds && modalTargetIds.length > 0
          ? modalTargetIds
          : selectedStudentIds.length > 0
          ? selectedStudentIds
          : undefined;

      const res = await api.generateRemedials({
        examId: selectedExamId,
        mode: generateMode,
        studentIds: targetIds,
        actorName: user?.name || 'Guru / Admin',
        actorRole: user?.role || 'teacher',
      });

      setShowGenerateModal(false);
      setSuccessMessage(res.message || `Berhasil membuat soal remedial untuk ${res.count} murid.`);
      await loadOverview(selectedExamId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal membuat soal remedial.');
    } finally {
      setGenerating(false);
    }
  };

  const targetModalCount = modalTargetIds?.length
    ? modalTargetIds.length
    : selectedStudentIds.length > 0
    ? selectedStudentIds.length
    : schedulableStudents.length;

  const renderStatusCell = (s: RemedialExamStudentRow) => {
    if (s.isPassedOriginal) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{s.originalScore}</span>
          <span className="font-sans text-[11px] font-semibold">(Lulus)</span>
        </div>
      );
    }
    if (s.remedial?.status === 'completed' && s.remedial?.isPassed) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 font-bold text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          <span>Tuntas Remedial</span>
          <span className="font-mono font-semibold text-teal-600 text-[11px]">
            ({s.originalScore})
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        <span>Remedial</span>
        <span className="font-mono font-semibold text-rose-500 text-[11px]">
          ({s.originalScore})
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-indigo-600" />
            <span>Program Remedial Ujian</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pilih ujian yang telah dikerjakan murid, pantau status lulus atau Remedial di bawah KKM, dan buat paket soal remedial otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadOverview(selectedExamId || undefined)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => openGenerateModal()}
            disabled={!data?.selectedExam || schedulableStudents.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Generate Remedial
              {selectedStudentIds.length > 0
                ? ` (${selectedStudentIds.length} Dipilih)`
                : schedulableStudents.length > 0
                ? ` (${schedulableStudents.length} Murid)`
                : ''}
            </span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-700 font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-emerald-600 hover:text-emerald-800 font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Exam Selector Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Pilih Daftar Ujian yang Telah Dikerjakan Murid
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={loading || !data?.completedExams?.length}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {!data?.completedExams?.length ? (
                <option value="">Belum ada ujian yang dikerjakan murid</option>
              ) : (
                data.completedExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} · {ex.subjectName} ({ex.participantCount} peserta · {ex.remedialNeededCount} Remedial · KKM {ex.kktpScore})
                  </option>
                ))
              )}
            </select>
          </div>

          {data?.selectedExam && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Batas KKM</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">
                  {data.selectedExam.kktpScore} / {data.selectedExam.maxScore}
                </span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-indigo-50/70 border border-indigo-200 max-w-xs">
                <span className="text-indigo-800 font-semibold block text-[11px]">
                  Aturan Batas Lulus Remedial
                </span>
                <span className="text-[11px] text-indigo-700 leading-snug block">
                  Tambahan nilai dari jawaban benar dihitung hingga maksimal KKM ({data.selectedExam.kktpScore}).
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Summary KPI Cards */}
        {data?.selectedExam && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Total Peserta
              </span>
              <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
                {data.summary.totalParticipants}
              </span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3">
              <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Lulus (&ge; KKM)
              </span>
              <span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
                {data.summary.passedCount}
              </span>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
              <span className="text-[11px] text-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Perlu Remedial (&lt; KKM)
              </span>
              <span className="text-lg font-bold font-mono text-rose-700 mt-0.5 block">
                {data.summary.remedialCount}
              </span>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3">
              <span className="text-[11px] text-indigo-700 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                Soal Remedial Dibuat
              </span>
              <span className="text-lg font-bold font-mono text-indigo-700 mt-0.5 block">
                {data.summary.generatedCount}
              </span>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
              <span className="text-[11px] text-amber-800 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                Tuntas Total (Pasca Remedial)
              </span>
              <span className="text-lg font-bold font-mono text-amber-800 mt-0.5 block">
                {data.summary.passedAfterRemedialCount} / {data.summary.totalParticipants}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Student List Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIS, atau kelas..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('remedial')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'remedial'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Remedial ({remedialCandidates.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('passed')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'passed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Lulus ({students.length - remedialCandidates.length})
              </button>
            </div>
          </div>

          {schedulableStudents.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAllRemedial}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 self-start sm:self-auto"
            >
              {schedulableStudents.every((s) => selectedStudentIds.includes(s.studentId))
                ? 'Batalkan Pilih Semua Siap Jadwal'
                : `Pilih Semua Siap Jadwal Remedial (${schedulableStudents.length})`}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">Pilih</th>
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3">NIS</th>
                <th className="py-3 px-3">Kelas</th>
                <th className="py-3 px-3">Nama Murid</th>
                <th className="py-3 px-3 text-center">Nilai / Status</th>
                <th className="py-3 px-3 text-center">Salah / Kosong</th>
                <th className="py-3 px-3">Paket Soal Remedial</th>
                <th className="py-3 px-3 text-center">Hasil Remedial (Maks KKM)</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    Memuat daftar hasil ujian dan status remedial...
                  </td>
                </tr>
              ) : !data?.selectedExam ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    Belum ada ujian yang telah dikerjakan oleh murid.
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    Tidak ada murid yang sesuai filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const isChecked = selectedStudentIds.includes(s.studentId);
                  const rem = s.remedial;
                  const wrongAndEmpty = s.wrongCount + s.emptyCount;

                  return (
                    <tr key={s.studentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center">
                        {!s.isPassedOriginal &&
                        (!rem || (rem.status === 'completed' && !rem.isPassed)) ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudent(s.studentId)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            aria-label={`Pilih ${s.studentName} untuk remedial`}
                          />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{s.studentNis}</td>
                      <td className="py-3 px-3 text-slate-700">{s.className}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{s.studentName}</td>
                      <td className="py-3 px-3 text-center">{renderStatusCell(s)}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-mono font-semibold text-slate-700">
                          {wrongAndEmpty} / {s.totalQuestions} soal
                        </div>
                        {!s.isPassedOriginal && s.wrongCompetencyCodes && s.wrongCompetencyCodes.length > 0 && (
                          <div
                            className="text-[10px] text-slate-500 truncate max-w-[180px] mx-auto"
                            title={s.wrongCompetencyCodes.join(', ')}
                          >
                            Sub-sub-bab: {s.wrongCompetencyCodes.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {s.isPassedOriginal ? (
                          <span className="text-[11px] text-slate-400">Tidak perlu remedial</span>
                        ) : rem ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  rem.mode === 'same_wrong'
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-violet-50 text-violet-700 border-violet-200'
                                }`}
                              >
                                {rem.mode === 'same_wrong' ? 'Soal Sama' : 'Random Sub-Sub-Bab'}
                              </span>
                              <span className="font-mono font-semibold text-slate-700">
                                {rem.questionIds.length} soal
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                Percobaan ke-{rem.attemptCount || 1}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              +{Number(rem.pointsPerCorrect).toFixed(1)} poin/benar ·{' '}
                              {rem.durationMinutes} menit ·{' '}
                              {rem.status === 'completed'
                                ? 'Selesai (1x)'
                                : rem.status === 'in_progress'
                                ? 'Sedang Dikerjakan (1x)'
                                : 'Siap Dikerjakan (1x)'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">
                            Belum dibuat
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {s.isPassedOriginal ? (
                          <span className="font-mono font-bold text-emerald-700">
                            {s.originalScore}
                          </span>
                        ) : rem && rem.status === 'completed' ? (
                          <div className="space-y-0.5">
                            <div className="font-mono font-bold text-sm">
                              <span className={rem.isPassed ? 'text-emerald-700' : 'text-rose-700'}>
                                {rem.finalCappedScore}
                              </span>
                              <span className="text-[11px] font-normal text-slate-500 ml-1">
                                ({rem.baseScore} + {rem.addedScore})
                              </span>
                            </div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                rem.isPassed
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {rem.isPassed
                                ? 'Tuntas Remedial'
                                : `Masih Remedial (< ${rem.kktpScore})`}
                            </span>
                            {Array.isArray(rem.attemptHistory) && rem.attemptHistory.length > 0 && (
                              <div className="text-[10px] text-slate-400">
                                Riwayat: {rem.attemptHistory.map((h) => `#${h.attempt}:${h.finalCappedScore}`).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!s.isPassedOriginal &&
                          (!rem ? (
                            <button
                              type="button"
                              onClick={() => openGenerateModal([s.studentId])}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Generate</span>
                            </button>
                          ) : rem.status === 'completed' && !rem.isPassed ? (
                            <button
                              type="button"
                              onClick={() => openGenerateModal([s.studentId])}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                              title="Jadwalkan ulang remedial dengan jumlah soal yang sama"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Jadwalkan Ulang</span>
                            </button>
                          ) : rem.status === 'completed' && rem.isPassed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Tuntas</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200">
                              <Clock className="w-3 h-3" />
                              <span>Terjadwal (1x)</span>
                            </span>
                          ))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Remedial Modal */}
      {showGenerateModal && data?.selectedExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Generate Soal Remedial</h3>
                  <p className="text-xs text-slate-500">
                    {data.selectedExam.title} · Target {targetModalCount} murid di bawah KKM ({data.selectedExam.kktpScore})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Pilih Sumber Soal Remedial:
              </label>

              {/* Mode 1: Same wrong questions */}
              <button
                type="button"
                onClick={() => setGenerateMode('same_wrong')}
                className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  generateMode === 'same_wrong'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    generateMode === 'same_wrong'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                >
                  <CopyCheck className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Soal yang Sama dengan yang Salah Dikerjakan
                    </span>
                    {generateMode === 'same_wrong' && (
                      <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Murid mengerjakan kembali butir soal yang sama persis dengan soal yang dijawab salah atau kosong pada ujian sebelumnya.
                  </p>
                </div>
              </button>

              {/* Mode 2: Random same count and sub-sub-bab */}
              <button
                type="button"
                onClick={() => setGenerateMode('random_same_competency')}
                className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  generateMode === 'random_same_competency'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    generateMode === 'random_same_competency'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Soal Random (Jumlah &amp; Sub-Sub-Bab Sama)
                    </span>
                    {generateMode === 'random_same_competency' && (
                      <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Mengambil soal acak dari Bank Soal Pusat dengan jumlah butir dan Sub-Sub-Bab yang sama persis dengan soal yang salah dikerjakan murid.
                  </p>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 flex flex-col justify-center">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Durasi Pengerjaan (Otomatis)</span>
                </span>
                <span className="mt-1 leading-snug text-slate-600">
                  (Total Waktu Ujian &divide; Jumlah Soal Ujian) &times; Jumlah Soal Remedial.
                </span>
                {(() => {
                  const targetStudents = modalTargetIds?.length
                    ? schedulableStudents.filter((s) => modalTargetIds.includes(s.studentId))
                    : selectedStudentIds.length > 0
                    ? schedulableStudents.filter((s) => selectedStudentIds.includes(s.studentId))
                    : schedulableStudents;
                  const durations = targetStudents.map((s) => {
                    const remCount = Math.max(
                      1,
                      s.remedial?.questionIds?.length || s.wrongCount + s.emptyCount || 1
                    );
                    const totalQ = Math.max(1, s.totalQuestions || remCount);
                    return computeRemedialDuration({
                      examDurationMinutes: data.selectedExam!.durationMinutes,
                      examTotalQuestions: totalQ,
                      remedialQuestionCount: remCount,
                    }).durationMinutes;
                  });
                  if (durations.length === 0) return null;
                  const minDur = Math.min(...durations);
                  const maxDur = Math.max(...durations);
                  const sampleQ = targetStudents[0]?.totalQuestions || 0;
                  return (
                    <span className="mt-1 font-mono font-semibold text-indigo-700">
                      {minDur === maxDur ? `${minDur} menit` : `${minDur} – ${maxDur} menit`}
                      {sampleQ > 0 ? ` (${data.selectedExam!.durationMinutes} mnt ÷ ${sampleQ} soal)` : ''}
                    </span>
                  );
                })()}
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 flex flex-col justify-center">
                <span className="font-bold">Aturan Pengerjaan (1x per Jadwal):</span>
                <span className="mt-0.5 leading-snug">
                  Penjadwalan hanya untuk 1x pengerjaan. Jika belum mencapai KKM <strong>{data.selectedExam.kktpScore}</strong>, murid dapat dijadwalkan ulang dengan jumlah soal yang sama sampai Tuntas Remedial.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                disabled={generating}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || targetModalCount === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{generating ? 'Membuat Soal...' : `Generate untuk ${targetModalCount} Murid`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
