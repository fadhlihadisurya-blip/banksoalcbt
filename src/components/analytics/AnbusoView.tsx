import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Exam, ExamResultItem, Question } from '../../types/cbt';
import {
  computeAnbusoReport,
  DecisionStatus,
  ItemAnbusoAnalysis,
} from '../../lib/anbusoAnalytics';
import { downloadStyledXlsx, StyledCell } from '../../lib/excelExport';
import { RichContent } from '../common/RichContent';
import {
  ClipboardCheck,
  Search,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  HelpCircle,
  Eye,
  X,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

interface AnbusoViewProps {
  initialExamId?: string;
}

const DECISION_BADGE: Record<
  DecisionStatus,
  { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Diterima: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  'Revisi Pengecoh': {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    icon: Wrench,
  },
  'Revisi Soal': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: AlertTriangle,
  },
  'Dibuang / Diganti': {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: XCircle,
  },
  'Perlu Data': {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    icon: HelpCircle,
  },
};

export const AnbusoView: React.FC<AnbusoViewProps> = ({ initialExamId }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || '');
  const [results, setResults] = useState<ExamResultItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | DecisionStatus>('ALL');
  const [selectedItem, setSelectedItem] = useState<ItemAnbusoAnalysis | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadExamResults(selectedExamId);
    }
  }, [selectedExamId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const [examsRes, qRes] = await Promise.all([api.getExams(), api.getQuestions()]);
      const examList = examsRes.exams || [];
      setExams(examList);
      setQuestions(qRes.questions || []);

      if (initialExamId && examList.some((e) => e.id === initialExamId)) {
        setSelectedExamId(initialExamId);
      } else if (examList.length > 0) {
        setSelectedExamId(examList[0].id);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal memuat daftar ujian dan bank soal.');
      setLoading(false);
    }
  };

  const loadExamResults = async (examId: string) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await api.getExamResults(examId);
      setResults(res.results || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal memuat data jawaban peserta untuk Anbuso.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  const report = useMemo(() => {
    if (!selectedExamId) return null;
    return computeAnbusoReport(
      selectedExamId,
      selectedExam?.title || 'Paket Ujian',
      results,
      questions
    );
  }, [selectedExamId, selectedExam?.title, results, questions]);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    return report.items.filter((item) => {
      if (decisionFilter !== 'ALL' && item.decision !== decisionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.questionCode.toLowerCase().includes(q) ||
          item.questionTextPreview.toLowerCase().includes(q) ||
          item.cognitiveLevel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [report, decisionFilter, searchQuery]);

  const handleExportExcel = async () => {
    if (!report || report.items.length === 0) {
      setErrorMessage('Belum ada data analisis butir soal untuk diekspor.');
      return;
    }

    try {
      const headers: StyledCell[] = [
        { value: 'No', style: 'header' },
        { value: 'Kode Soal', style: 'header' },
        { value: 'Tipe', style: 'header' },
        { value: 'Kognitif', style: 'header' },
        { value: 'Responden (N)', style: 'header' },
        { value: 'Benar', style: 'header' },
        { value: 'Salah', style: 'header' },
        { value: 'Kosong', style: 'header' },
        { value: 'Difficulty (P)', style: 'header' },
        { value: 'Kategori Difficulty', style: 'header' },
        { value: 'Discrimination (D)', style: 'header' },
        { value: 'Kategori Discrimination', style: 'header' },
        { value: 'Point-Biserial (r)', style: 'header' },
        { value: 'Distractor Summary', style: 'header' },
        { value: 'Distribusi Pilihan', style: 'header' },
        { value: 'Reliabilitas Item', style: 'header' },
        { value: 'Decision', style: 'header' },
        { value: 'Rekomendasi', style: 'header' },
      ];

      const rows: StyledCell[][] = report.items.map((item, idx) => {
        const optionDist = item.distractorApplicable
          ? item.distractorOptions
              .map((o) => `${o.optionId}${o.isKey ? '*' : ''}: ${o.chosenPct}%`)
              .join(' | ')
          : '-';

        const isProblematic =
          item.decision === 'Dibuang / Diganti' || item.decision === 'Revisi Soal';

        return [
          { value: idx + 1, style: 'center' },
          { value: item.questionCode, style: 'center' },
          { value: item.questionType.toUpperCase(), style: 'center' },
          { value: item.cognitiveLevel, style: 'center' },
          { value: item.respondentCount, style: 'center' },
          { value: item.correctCount, style: 'center' },
          { value: item.wrongCount, style: 'center' },
          { value: item.emptyCount, style: 'center' },
          { value: item.difficultyIndex, style: 'center' },
          { value: item.difficultyCategory, style: 'center' },
          {
            value: item.discriminationIndex !== null ? item.discriminationIndex : '-',
            style: 'center',
          },
          { value: item.discriminationCategory, style: 'center' },
          {
            value: item.pointBiserial !== null ? item.pointBiserial : '-',
            style: 'center',
          },
          { value: item.distractorSummary, style: 'center' },
          { value: optionDist, style: 'default' },
          { value: item.reliabilityNote, style: 'default' },
          {
            value: item.decision,
            style: isProblematic ? 'wrong' : 'center',
          },
          { value: item.decisionReason, style: 'default' },
        ];
      });

      await downloadStyledXlsx({
        sheetName: 'Anbuso',
        fileName: `anbuso_${report.examTitle.replace(/\s+/g, '_')}.xlsx`,
        rows: [headers, ...rows],
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Gagal mengekspor laporan Anbuso.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md mb-1 border border-indigo-200">
            <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Analisis Butir Soal (Classical Test Theory)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Anbuso — Analisis Psikometri Soal
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Evaluasi <strong>Discrimination</strong>, <strong>Difficulty</strong>,{' '}
            <strong>Distractor</strong>, <strong>Reliabilitas</strong>, dan{' '}
            <strong>Decision</strong> untuk setiap butir soal yang dikerjakan murid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white shadow-xs focus:ring-2 focus:ring-indigo-500"
          >
            {exams.length === 0 ? (
              <option value="">Belum ada paket ujian</option>
            ) : (
              exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!report || report.items.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Anbuso (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
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

      {/* Summary KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card 1: Respondents & Items */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">
              Cakupan Analisis
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-slate-900">
                {report.analyzedItemCount}
              </span>
              <span className="text-xs text-slate-500">Butir Soal</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Dari <strong>{report.participantCount}</strong> murid selesai
            </span>
          </div>

          {/* Card 2: Reliabilitas */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Reliabilitas Tes</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-indigo-700">
                {report.reliability.alpha !== null ? report.reliability.alpha.toFixed(2) : '-'}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  report.reliability.category === 'Sangat Tinggi' ||
                  report.reliability.category === 'Tinggi'
                    ? 'bg-emerald-100 text-emerald-800'
                    : report.reliability.category === 'Cukup'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {report.reliability.category}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 truncate" title={report.reliability.note}>
              {report.reliability.methodLabel}
              {report.reliability.sem !== null ? ` · SEM: ${report.reliability.sem}` : ''}
            </span>
          </div>

          {/* Card 3: Difficulty */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Rata-rata Difficulty (P)</span>
              <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-slate-900">
                {report.summary.avgDifficulty.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">
                ({Math.round(report.summary.avgDifficulty * 100)}%)
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">
              {report.summary.easyCount} Mudah · {report.summary.mediumCount} Sedang ·{' '}
              {report.summary.hardCount} Sukar
            </span>
          </div>

          {/* Card 4: Discrimination */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">
              Rata-rata Discrimination (D)
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-slate-900">
                {report.summary.avgDiscrimination !== null
                  ? report.summary.avgDiscrimination.toFixed(2)
                  : '-'}
              </span>
              <span className="text-[10px] text-slate-500">Indeks D</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              <strong>{report.summary.goodDiscriminationCount}</strong> butir berdaya pembeda Baik (D ≥ 0.30)
            </span>
          </div>

          {/* Card 5: Decision */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Ringkasan Decision</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Diterima: {report.summary.decisionCounts.Diterima}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Revisi: {report.summary.decisionCounts['Revisi Soal'] + report.summary.decisionCounts['Revisi Pengecoh']}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                Dibuang: {report.summary.decisionCounts['Dibuang / Diganti']}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Reliability Explanation Banner */}
      {report && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <strong className="text-slate-800">Catatan Reliabilitas Instrumen:</strong>{' '}
            {report.reliability.note}
          </div>
          <div className="text-[11px] text-slate-500 font-mono shrink-0">
            Acuan P: 0.30–0.70 (Sedang) · Acuan D: ≥0.30 (Baik) · Pengecoh: ≥5%
          </div>
        </div>
      )}

      {/* Filter & Search Bar + Main Anbuso Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode soal atau isi soal..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">Semua Decision</option>
              <option value="Diterima">Diterima</option>
              <option value="Revisi Pengecoh">Revisi Pengecoh</option>
              <option value="Revisi Soal">Revisi Soal</option>
              <option value="Dibuang / Diganti">Dibuang / Diganti</option>
              <option value="Perlu Data">Perlu Data</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Menampilkan {filteredItems.length} dari {report?.items.length || 0} Butir Soal
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-10">No</th>
                <th className="py-3 px-3">Butir Soal</th>
                <th className="py-3 px-3 text-center">N</th>
                <th className="py-3 px-3">Difficulty (P)</th>
                <th className="py-3 px-3">Discrimination (D)</th>
                <th className="py-3 px-3">Distractor</th>
                <th className="py-3 px-3">Reliabilitas</th>
                <th className="py-3 px-3">Decision</th>
                <th className="py-3 px-3 text-center no-print">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    Menganalisis butir soal peserta ujian...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    {results.length === 0
                      ? 'Belum ada murid yang menyelesaikan ujian ini untuk dianalisis.'
                      : 'Tidak ada butir soal yang cocok dengan filter.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const badge = DECISION_BADGE[item.decision];
                  const DecisionIcon = badge.icon;
                  return (
                    <tr key={item.questionId} className="hover:bg-slate-50/70 transition-colors align-top">
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>

                      <td className="py-3 px-3 min-w-[210px] max-w-[270px]">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {item.questionCode}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.cognitiveLevel}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">
                            {item.questionType === 'pg_kompleks'
                              ? 'PGK'
                              : item.questionType === 'benar_salah'
                              ? 'B/S'
                              : item.questionType.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                          {item.questionTextPreview}
                        </p>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <div className="font-bold text-slate-900">{item.respondentCount}</div>
                        <div className="text-[10px] text-slate-500 whitespace-nowrap">
                          <span className="text-emerald-600">{item.correctCount}B</span> ·{' '}
                          <span className="text-rose-500">{item.wrongCount}S</span>
                        </div>
                      </td>

                      {/* Difficulty */}
                      <td className="py-3 px-3 min-w-[125px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">
                            {item.difficultyIndex.toFixed(2)}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              item.difficultyCategory === 'Sedang'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.difficultyCategory === 'Mudah'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {item.difficultyCategory}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${
                              item.difficultyCategory === 'Sedang'
                                ? 'bg-emerald-500'
                                : item.difficultyCategory === 'Mudah'
                                ? 'bg-sky-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${item.difficultyPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Discrimination */}
                      <td className="py-3 px-3 min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">
                            {item.discriminationIndex !== null
                              ? item.discriminationIndex.toFixed(2)
                              : '-'}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              item.discriminationCategory === 'Sangat Baik' ||
                              item.discriminationCategory === 'Baik'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.discriminationCategory === 'Cukup'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : item.discriminationCategory === 'Negatif' ||
                                  item.discriminationCategory === 'Jelek'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.discriminationCategory}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          r_pbis: {item.pointBiserial !== null ? item.pointBiserial.toFixed(2) : '-'}
                        </div>
                      </td>

                      {/* Distractor */}
                      <td className="py-3 px-3 min-w-[175px]">
                        <div className="text-[11px] font-semibold text-slate-700 mb-1">
                          {item.distractorSummary}
                        </div>
                        {item.distractorApplicable && item.distractorOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.distractorOptions.map((opt) => (
                              <span
                                key={opt.optionId}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                  opt.isKey
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                                    : opt.status === 'efektif'
                                    ? 'bg-slate-50 text-slate-700 border-slate-200'
                                    : 'bg-rose-50 text-rose-600 border-rose-200'
                                }`}
                                title={
                                  opt.isKey
                                    ? `Kunci (${opt.chosenCount} siswa)`
                                    : `Pengecoh (${opt.chosenCount} siswa)`
                                }
                              >
                                {opt.optionId}
                                {opt.isKey ? '*' : ''}:{opt.chosenPct}%
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Reliabilitas */}
                      <td className="py-3 px-3 min-w-[155px]">
                        <span
                          className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border mb-1 ${
                            item.reliabilityImpact === 'mendukung'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.reliabilityImpact === 'menurunkan'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : item.reliabilityImpact === 'netral'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.reliabilityImpact === 'mendukung'
                            ? 'Mendukung α'
                            : item.reliabilityImpact === 'menurunkan'
                            ? 'Menurunkan α'
                            : item.reliabilityImpact === 'netral'
                            ? 'Netral'
                            : 'Data Terbatas'}
                        </span>
                        <div className="text-[10px] text-slate-500 leading-snug">
                          {item.reliabilityNote}
                        </div>
                      </td>

                      {/* Decision */}
                      <td className="py-3 px-3 min-w-[140px]">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-bold ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          <DecisionIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.decision}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center no-print">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
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

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {selectedItem.questionCode}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {selectedItem.cognitiveLevel}
                  </span>
                  <span className="text-xs text-slate-500">
                    Responden: <strong>{selectedItem.respondentCount}</strong> murid
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">
                  Detail Analisis Butir Soal (Anbuso)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question Content Preview */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Pertanyaan & Kunci Jawaban
              </span>
              <div className="text-sm text-slate-800">
                <RichContent html={selectedItem.questionHtml} />
              </div>
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                Kunci Jawaban:{' '}
                <strong className="text-emerald-700 font-mono">
                  {selectedItem.correctAnswerDisplay}
                </strong>
              </div>
            </div>

            {/* 4 Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  1. Difficulty (Tingkat Kesukaran)
                </span>
                <div className="text-base font-bold font-mono text-slate-900">
                  P = {selectedItem.difficultyIndex.toFixed(3)} ({selectedItem.difficultyPct}%) —{' '}
                  <span className="text-indigo-700">{selectedItem.difficultyCategory}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Benar: {selectedItem.correctCount} · Salah: {selectedItem.wrongCount} · Kosong:{' '}
                  {selectedItem.emptyCount}
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  2. Discrimination (Daya Pembeda)
                </span>
                <div className="text-base font-bold font-mono text-slate-900">
                  D ={' '}
                  {selectedItem.discriminationIndex !== null
                    ? selectedItem.discriminationIndex.toFixed(3)
                    : '-'}{' '}
                  — <span className="text-indigo-700">{selectedItem.discriminationCategory}</span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono">
                  Kel. Atas (P_U): {selectedItem.upperAccuracy.toFixed(2)} · Kel. Bawah (P_L):{' '}
                  {selectedItem.lowerAccuracy.toFixed(2)} · r_pbis:{' '}
                  {selectedItem.pointBiserial !== null ? selectedItem.pointBiserial.toFixed(3) : '-'}
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  3. Reliabilitas & Konsistensi Internal
                </span>
                <div className="text-sm font-bold text-slate-900">
                  {selectedItem.reliabilityNote}
                </div>
                <p className="text-[11px] text-slate-600 font-mono">
                  Reliabilitas Tes (α):{' '}
                  {report?.reliability.alpha !== null && report?.reliability.alpha !== undefined
                    ? report.reliability.alpha.toFixed(3)
                    : '-'}{' '}
                  · Korelasi Butir-Total:{' '}
                  {selectedItem.itemTotalCorrelation !== null
                    ? selectedItem.itemTotalCorrelation.toFixed(3)
                    : '-'}
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  4. Decision (Keputusan Butir Soal)
                </span>
                <div className="text-base font-bold text-slate-900">{selectedItem.decision}</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {selectedItem.decisionReason}
                </p>
              </div>
            </div>

            {/* Distractor Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                5. Analisis Distractor (Sebaran Pilihan Jawaban Murid)
              </h4>
              {!selectedItem.distractorApplicable ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                  Butir soal bertipe Uraian/Esai tidak memiliki opsi pengecoh objektif.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 w-16 text-center">Opsi</th>
                        <th className="py-2 px-3">Teks Opsi</th>
                        <th className="py-2 px-3 text-center">Dipilih</th>
                        <th className="py-2 px-3 text-center">Kel. Atas</th>
                        <th className="py-2 px-3 text-center">Kel. Bawah</th>
                        <th className="py-2 px-3">Status Pengecoh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedItem.distractorOptions.map((opt) => (
                        <tr key={opt.optionId} className={opt.isKey ? 'bg-emerald-50/40' : ''}>
                          <td className="py-2 px-3 text-center font-mono font-bold">
                            {opt.optionId}
                            {opt.isKey ? ' ★' : ''}
                          </td>
                          <td className="py-2 px-3 text-slate-700 max-w-xs truncate">
                            {opt.optionText}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">
                            {opt.chosenCount} ({opt.chosenPct}%)
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-emerald-700">
                            {opt.upperCount}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-rose-600">
                            {opt.lowerCount}
                          </td>
                          <td className="py-2 px-3">
                            {opt.status === 'kunci' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Kunci Jawaban
                              </span>
                            ) : opt.status === 'efektif' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800">
                                Pengecoh Efektif (≥5%)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
                                Tidak Berfungsi (&lt;5%)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
