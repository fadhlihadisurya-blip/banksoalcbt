import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Exam, ExamResultItem, StudentResultItem, StudentResultsPayload } from '../../types/cbt';
import { incrementStudentLoading } from '../../lib/studentActivityCounter';
import {
  Download,
  Printer,
  Eye,
  EyeOff,
  Search,
  AlertCircle,
} from 'lucide-react';
import { downloadStyledXlsx, StyledCell } from '../../lib/excelExport';

interface ExamResultsViewProps {
  initialExamId?: string;
}

export const ExamResultsView: React.FC<ExamResultsViewProps> = ({
  initialExamId,
}) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const isStudent = user?.role === 'student';
  const canManagePublish = user?.role === 'admin' || user?.role === 'teacher';

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || '');
  const [resultsData, setResultsData] = useState<{
    exam: Exam;
    results: ExamResultItem[];
    stats: {
      totalParticipants: number;
      highest: number;
      lowest: number;
      average: number;
      median: number;
      passedCount: number;
      failedCount: number;
      passingRate: number;
    };
  } | null>(null);

  const [studentData, setStudentData] = useState<StudentResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isStudent) {
      if (user?.id) {
        loadStudentResults(user.id);
      }
      return;
    }
    loadExams();
  }, [isStudent, user?.id]);

  useEffect(() => {
    if (!isStudent && selectedExamId) {
      loadResults(selectedExamId);
    }
  }, [isStudent, selectedExamId]);

  const loadStudentResults = async (studentId: string) => {
    try {
      setLoading(true);
      setErrorMessage('');
      incrementStudentLoading(studentId);
      const data = await api.getStudentResults(studentId);
      setStudentData(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal memuat riwayat hasil ujian.');
    } finally {
      setLoading(false);
    }
  };

  const loadExams = async () => {
    try {
      const res = await api.getExams();
      const list = res.exams || [];
      setExams(list);
      if (!selectedExamId && list.length > 0) {
        setSelectedExamId(list[0].id);
      } else if (list.length === 0) {
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal memuat daftar ujian.');
      setLoading(false);
    }
  };

  const loadResults = async (examId: string) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const data = await api.getExamResults(examId);
      setResultsData(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal memuat hasil penilaian ujian.');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!canManagePublish || !selectedExamId) return;
    setIsPublishing(true);
    setErrorMessage('');
    try {
      const res = await api.togglePublishResults(selectedExamId);
      if (resultsData) {
        setResultsData({
          ...resultsData,
          exam: {
            ...resultsData.exam,
            isPublishedResults: res.isPublishedResults,
          },
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengubah status visibilitas nilai siswa.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExportExcel = async () => {
    if (!resultsData || resultsData.results.length === 0) {
      setErrorMessage('Tidak ada data hasil ujian untuk diekspor.');
      return;
    }

    try {
      const maxQuestions = Math.max(
        0,
        ...resultsData.results.map((r) => {
          const details = Array.isArray(r.questionDetails) ? r.questionDetails : [];
          const maxNum = details.reduce(
            (mx: number, qd: any) => Math.max(mx, Number(qd?.number) || 0),
            0
          );
          return Math.max(Number(r.totalQuestions) || 0, details.length, maxNum);
        })
      );

      const questionHeaders: StyledCell[] = Array.from({ length: maxQuestions }, (_, idx) => ({
        value: idx + 1,
        style: 'header',
      }));

      const headerRow: StyledCell[] = [
        { value: 'No', style: 'header' },
        { value: 'NIS', style: 'header' },
        { value: 'Kelas', style: 'header' },
        { value: 'Nama Siswa', style: 'header' },
        ...questionHeaders,
        { value: 'Benar', style: 'header' },
        { value: 'Salah', style: 'header' },
        { value: 'Kosong', style: 'header' },
        { value: 'Nilai Akhir', style: 'header' },
        { value: 'Status KKTP', style: 'header' },
      ];

      const dataRows: StyledCell[][] = resultsData.results.map((r, i) => {
        const details = Array.isArray(r.questionDetails) ? r.questionDetails : [];
        const questionCells: StyledCell[] = Array.from({ length: maxQuestions }, (_, idx) => {
          const qNum = idx + 1;
          const qd =
            details.find((item: any) => Number(item?.number) === qNum) || details[idx] || null;
          const codeText = qd
            ? String(qd.questionCode || qd.code || qd.questionId || '-')
            : '-';

          const ans = qd?.studentAnswer;
          const isUnanswered =
            ans === undefined ||
            ans === null ||
            ans === '' ||
            (Array.isArray(ans) && ans.length === 0);
          const isWrong = Boolean(qd) && !isUnanswered && !qd.pendingManualGrade && !qd.isCorrect;

          return {
            value: codeText,
            style: isWrong ? 'wrong' : 'center',
          };
        });

        return [
          { value: i + 1, style: 'center' },
          { value: r.studentNis || '-', style: 'center' },
          { value: r.className || '-', style: 'default' },
          { value: r.studentName || '-', style: 'default' },
          ...questionCells,
          { value: Number(r.correctCount) || 0, style: 'center' },
          { value: Number(r.wrongCount) || 0, style: 'center' },
          { value: Number(r.emptyCount) || 0, style: 'center' },
          { value: Number(r.finalScore) || 0, style: 'center' },
          {
            value: r.isPassed
              ? 'Tuntas'
              : r.isRemedialPassed
              ? 'Tuntas Remedial'
              : 'Remedial',
            style: 'center',
          },
        ];
      });

      await downloadStyledXlsx({
        sheetName: 'Rekap Nilai',
        fileName: `rekap_nilai_${resultsData.exam.title.replace(/\s+/g, '_')}.xlsx`,
        rows: [headerRow, ...dataRows],
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal mengekspor data ke Excel.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isStudent) {
    const studentResults: StudentResultItem[] = studentData?.results || [];
    const filteredStudentResults = studentResults.filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (r.examTitle || '').toLowerCase().includes(q) ||
        (r.studentName || '').toLowerCase().includes(q) ||
        (r.studentNis || '').toLowerCase().includes(q)
      );
    });

    const stats = studentData?.stats || {
      totalCompleted: 0,
      hasHiddenScores: false,
      average: 0,
      highest: 0,
      lowest: 0,
      median: 0,
    };

    const formatStat = (val: number | null) => (val === null ? '***' : val);

    return (
      <div className="space-y-6">
        {/* Header and Controls (Student View) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Rekap Penilaian & Hasil Ujian
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>Riwayat Ujian yang Telah Diselesaikan</span>
              <span>·</span>
              <span>{user?.name} ({user?.nis || user?.username})</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Rekap</span>
            </button>
          </div>
        </div>

        {/* Printable Report Header */}
        <div className="hidden print-only mb-6 border-b pb-4 text-center">
          <h1 className="text-xl font-bold uppercase">{settings.schoolName || 'PORTAL CBT SEKOLAH'}</h1>
          <p className="text-xs text-gray-600">Laporan Hasil Asesmen Ujian Berbasis Komputer (CBT)</p>
          <p className="text-sm font-semibold mt-1">
            {user?.name} ({user?.nis || user?.username})
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 no-print">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Student Statistics KPI Strip (5 cards, KKTP removed) */}
        {studentData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">Total ujian selesai</span>
              <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {stats.totalCompleted}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">Rata-rata Nilai</span>
              <span className="text-xl font-bold font-mono text-indigo-600 tabular-nums">
                {formatStat(stats.average)}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">Nilai Tertinggi</span>
              <span className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
                {formatStat(stats.highest)}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">Nilai Terendah</span>
              <span className="text-xl font-bold font-mono text-rose-600 tabular-nums">
                {formatStat(stats.lowest)}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">Median (Nilai Tengah)</span>
              <span className="text-xl font-bold font-mono text-slate-800 tabular-nums">
                {formatStat(stats.median)}
              </span>
            </div>
          </div>
        )}

        {/* Student Results Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama ujian..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <span className="text-xs text-slate-500 font-mono">
              {filteredStudentResults.length} dari {studentResults.length} Data Nilai
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Peserta</th>
                  <th className="py-3 px-4">NIS</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Nama Ujian</th>
                  <th className="py-3 px-4 text-center">Benar</th>
                  <th className="py-3 px-4 text-center">Salah</th>
                  <th className="py-3 px-4 text-center">Kosong</th>
                  <th className="py-3 px-4 text-right">Nilai Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      Memuat hasil penilaian...
                    </td>
                  </tr>
                ) : filteredStudentResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      Belum ada hasil ujian yang terkumpul.
                    </td>
                  </tr>
                ) : (
                  filteredStudentResults.map((r, i) => {
                    const isHidden = !r.isPublishedResults || r.finalScore === null;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400">{i + 1}</td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-900">{r.studentName}</td>
                        <td className="py-3 px-4 text-slate-500">{r.studentNis}</td>
                        <td className="py-3 px-4 font-sans text-slate-700">{r.className}</td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-800">
                          <div>{r.examTitle}</div>
                          {r.isRemedial && (
                            <div className="text-[10px] font-mono text-amber-700 mt-0.5">
                              Percobaan ke-{r.attemptCount || 1} · KKM {r.kktpScore ?? 75}{' '}
                              {r.isRemedialPassed ? '· Tuntas Remedial' : '· Belum Lulus'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-emerald-600 font-semibold">
                          {isHidden || r.correctCount === null ? (
                            <span className="text-slate-400 tracking-widest" title="Disembunyikan oleh Admin/Guru">
                              ***
                            </span>
                          ) : (
                            r.correctCount
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-rose-500">
                          {isHidden || r.wrongCount === null ? (
                            <span className="text-slate-400 tracking-widest" title="Disembunyikan oleh Admin/Guru">
                              ***
                            </span>
                          ) : (
                            r.wrongCount
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400">{r.emptyCount}</td>
                        <td className="py-3 px-4 text-right text-base font-bold text-slate-900">
                          {isHidden ? (
                            <span className="text-slate-400 tracking-widest" title="Nilai disembunyikan oleh Admin/Guru">
                              ***
                            </span>
                          ) : (
                            r.finalScore
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Admin & Teacher View
  const filteredResults = (resultsData?.results || []).filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.studentName.toLowerCase().includes(q) || r.studentNis.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Rekap Penilaian & Hasil Ujian
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Koreksi Otomatis Objektif</span>
            <span>·</span>
            <span>Evaluasi Ketercapaian Tujuan Pembelajaran (KKTP)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Exam Selector */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white shadow-xs focus:ring-2 focus:ring-indigo-500"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>

          {/* Toggle Publish button (Admin & Teacher only) */}
          {canManagePublish && resultsData && (
            <button
              onClick={handleTogglePublish}
              disabled={isPublishing}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                resultsData.exam.isPublishedResults
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="Klik untuk menampilkan atau menyembunyikan nilai pada akun siswa"
            >
              {resultsData.exam.isPublishedResults ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tampilkan Nilai Siswa</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sembunyikan Nilai Siswa</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            title="Ekspor rekap hasil ujian (.xlsx) dengan kode soal & tanda merah jawaban salah"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print-only mb-6 border-b pb-4 text-center">
        <h1 className="text-xl font-bold uppercase">{settings.schoolName || 'PORTAL CBT SEKOLAH'}</h1>
        <p className="text-xs text-gray-600">Laporan Hasil Asesmen Ujian Berbasis Komputer (CBT)</p>
        <p className="text-sm font-semibold mt-1">{resultsData?.exam.title}</p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
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

      {/* Statistics KPI Strip */}
      {resultsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Total Peserta Selesai</span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {resultsData.stats.totalParticipants}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Rata-rata Nilai</span>
            <span className="text-xl font-bold font-mono text-indigo-600 tabular-nums">
              {resultsData.stats.average}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Nilai Tertinggi</span>
            <span className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
              {resultsData.stats.highest}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Nilai Terendah</span>
            <span className="text-xl font-bold font-mono text-rose-600 tabular-nums">
              {resultsData.stats.lowest}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Median (Nilai Tengah)</span>
            <span className="text-xl font-bold font-mono text-slate-800 tabular-nums">
              {resultsData.stats.median}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Ketuntasan KKTP ({resultsData.exam.kktpScore || 75})</span>
            <span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
              {resultsData.stats.passingRate}%
            </span>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari siswa atau NIS..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <span className="text-xs text-slate-500 font-mono">
            {filteredResults.length} dari {resultsData?.results.length || 0} Data Nilai
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Peserta</th>
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4 text-center">Benar</th>
                <th className="py-3 px-4 text-center">Salah</th>
                <th className="py-3 px-4 text-center">Kosong</th>
                <th className="py-3 px-4 text-right">Nilai Akhir</th>
                <th className="py-3 px-4 text-center">Status KKTP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    Memuat hasil penilaian...
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    Belum ada hasil ujian yang terkumpul.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400">{i + 1}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">{r.studentName}</td>
                    <td className="py-3 px-4 text-slate-500">{r.studentNis}</td>
                    <td className="py-3 px-4 font-sans text-slate-700">{r.className}</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-semibold">{r.correctCount}</td>
                    <td className="py-3 px-4 text-center text-rose-500">{r.wrongCount}</td>
                    <td className="py-3 px-4 text-center text-slate-400">{r.emptyCount}</td>
                    <td className="py-3 px-4 text-right text-base font-bold text-slate-900">
                      {r.finalScore}
                    </td>
                    <td className="py-3 px-4 text-center font-sans font-semibold">
                      {r.isPassed ? (
                        <span className="text-emerald-700">Tuntas</span>
                      ) : r.isRemedialPassed ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-semibold">
                          Tuntas Remedial
                        </span>
                      ) : (
                        <span className="text-rose-600">Perlu Remedial</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
