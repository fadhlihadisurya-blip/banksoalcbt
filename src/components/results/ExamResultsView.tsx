import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Exam, ExamResultItem } from '../../types/cbt';
import {
  Award,
  Sparkles,
  Download,
  Printer,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Filter,
  Search,
  FileSpreadsheet,
} from 'lucide-react';

interface ExamResultsViewProps {
  initialExamId?: string;
  onOpenAnalytics: (examId: string) => void;
}

export const ExamResultsView: React.FC<ExamResultsViewProps> = ({
  initialExamId,
  onOpenAnalytics,
}) => {
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

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadResults(selectedExamId);
    }
  }, [selectedExamId]);

  const loadExams = async () => {
    try {
      const res = await api.getExams();
      setExams(res.exams || []);
      if (!selectedExamId && res.exams.length > 0) {
        setSelectedExamId(res.exams[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadResults = async (examId: string) => {
    try {
      setLoading(true);
      const data = await api.getExamResults(examId);
      setResultsData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!selectedExamId) return;
    setIsPublishing(true);
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
      alert(err.message || 'Gagal mengubah status publikasi.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExportCSV = () => {
    if (!resultsData || resultsData.results.length === 0) {
      alert('Tidak ada data hasil ujian untuk diekspor.');
      return;
    }

    const headers = ['No', 'Nama Siswa', 'NIS', 'Kelas', 'Benar', 'Salah', 'Kosong', 'Nilai Akhir', 'Status KKTP'];
    const rows = resultsData.results.map((r, i) => [
      i + 1,
      `"${r.studentName}"`,
      r.studentNis,
      `"${r.className}"`,
      r.correctCount,
      r.wrongCount,
      r.emptyCount,
      r.finalScore,
      r.isPassed ? 'Tuntas' : 'Remedial',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_nilai_${resultsData.exam.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

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

          {/* Toggle Publish button */}
          {resultsData && (
            <button
              onClick={handleTogglePublish}
              disabled={isPublishing}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                resultsData.exam.isPublishedResults
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {resultsData.exam.isPublishedResults ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hasil Terbuka bagi Siswa</span>
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
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Rekap</span>
          </button>

          <button
            onClick={() => onOpenAnalytics(selectedExamId)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Learning Analytics</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print-only mb-6 border-b pb-4 text-center">
        <h1 className="text-xl font-bold uppercase">SMAN 1 PRESTASI BANGSA</h1>
        <p className="text-xs text-gray-600">Laporan Hasil Asesmen Ujian Berbasis Komputer (CBT)</p>
        <p className="text-sm font-semibold mt-1">{resultsData?.exam.title}</p>
      </div>

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
