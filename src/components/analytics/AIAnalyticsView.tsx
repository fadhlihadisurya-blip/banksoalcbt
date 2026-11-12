import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Exam,
  ExamResultItem,
  AIIndividualAnalytics,
  AIClassicalAnalytics,
} from '../../types/cbt';
import {
  Sparkles,
  BrainCircuit,
  Users,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Printer,
  RefreshCw,
  Lightbulb,
  GraduationCap,
  Target,
} from 'lucide-react';

interface AIAnalyticsViewProps {
  initialExamId?: string;
}

export const AIAnalyticsView: React.FC<AIAnalyticsViewProps> = ({ initialExamId }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || '');
  const [activeTab, setActiveTab] = useState<'classical' | 'individual'>('classical');

  // Classical analytics state
  const [classicalData, setClassicalData] = useState<AIClassicalAnalytics | null>(null);
  const [loadingClassical, setLoadingClassical] = useState(false);

  // Individual analytics state
  const [examResults, setExamResults] = useState<ExamResultItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [individualData, setIndividualData] = useState<AIIndividualAnalytics | null>(null);
  const [loadingIndividual, setLoadingIndividual] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadExamDetails(selectedExamId);
      runClassicalAnalytics(selectedExamId);
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

  const loadExamDetails = async (examId: string) => {
    try {
      const res = await api.getExamResults(examId);
      setExamResults(res.results || []);
      if (res.results.length > 0) {
        setSelectedStudentId(res.results[0].studentId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runClassicalAnalytics = async (examId: string) => {
    setLoadingClassical(true);
    try {
      const res = await api.runClassicalAIAnalytics(examId);
      setClassicalData(res.analytics);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingClassical(false);
    }
  };

  const runIndividualAnalytics = async (examId: string, studentId: string) => {
    if (!studentId) return;
    setLoadingIndividual(true);
    try {
      const res = await api.runIndividualAIAnalytics(examId, studentId);
      setIndividualData(res.analytics);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingIndividual(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'individual' && selectedExamId && selectedStudentId) {
      runIndividualAnalytics(selectedExamId, selectedStudentId);
    }
  }, [activeTab, selectedExamId, selectedStudentId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedStudentResult = examResults.find((r) => r.studentId === selectedStudentId);

  return (
    <div className="space-y-6">
      {/* Title & Exam Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md mb-1 border border-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Gemini 3.8 Flash Learning Analytics Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Analisis Pembelajaran Berbasis AI
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Diagnosis Taksonomi Bloom</span>
            <span>·</span>
            <span>Pemetaan Miskonsepsi & Kurikulum Merdeka</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white shadow-xs focus:ring-2 focus:ring-purple-500"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Hasil AI</span>
          </button>
        </div>
      </div>

      {/* Mode Segmented Tabs: Classical vs Individual */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit no-print">
        <button
          onClick={() => setActiveTab('classical')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'classical'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-purple-600" />
          <span>Analisis Klasikal (Tingkat Kelas)</span>
        </button>

        <button
          onClick={() => setActiveTab('individual')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'individual'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4 text-purple-600" />
          <span>Analisis Individual per Siswa</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ANALISIS KLASIKAL (COHORT / CLASS-LEVEL) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'classical' && (
        <div className="space-y-6">
          {loadingClassical ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <BrainCircuit className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              <div className="text-sm font-bold text-slate-900">
                Gemini sedang memproses data kognitif dan pola jawaban siswa...
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Mengevaluasi penguasaan indikator kompetensi, mengidentifikasi miskonsepsi bersama, dan menyusun pengelompokan diferensiasi pembelajaran.
              </p>
            </div>
          ) : !classicalData ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Belum ada data ujian yang cukup untuk dianalisis oleh AI.
            </div>
          ) : (
            <>
              {/* Executive Summary Card */}
              <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-purple-800/40">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Ringkasan Eksekutif Hasil Belajar (AI Executive Summary)</span>
                </div>
                <p className="text-sm sm:text-base leading-relaxed text-slate-100 font-sans">
                  {classicalData.executiveSummary}
                </p>
              </div>

              {/* Cognitive Proficiency Bars */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Penguasaan Domain Kognitif Klasikal (Bloom)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Persentase keberhasilan siswa menjawab soal sesuai level berpikir
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-emerald-900">LOTS (Mengingat/Memahami)</span>
                      <span className="text-xl font-bold font-mono text-emerald-800">
                        {classicalData.overallCognitiveProficiency.lotsPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-emerald-200/60 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${classicalData.overallCognitiveProficiency.lotsPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-emerald-700 mt-2 block">
                      Konsep dasar dan definisi telah diserap dengan sangat baik.
                    </span>
                  </div>

                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-indigo-900">MOTS (Menerapkan/Analisis)</span>
                      <span className="text-xl font-bold font-mono text-indigo-800">
                        {classicalData.overallCognitiveProficiency.motsPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-indigo-200/60 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${classicalData.overallCognitiveProficiency.motsPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-indigo-700 mt-2 block">
                      Kemampuan pemecahan soal berumus standar cukup memadai.
                    </span>
                  </div>

                  <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-purple-900">HOTS (Evaluasi/Kreasi)</span>
                      <span className="text-xl font-bold font-mono text-purple-800">
                        {classicalData.overallCognitiveProficiency.hotsPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-purple-200/60 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${classicalData.overallCognitiveProficiency.hotsPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-purple-700 mt-2 block">
                      Perlu penguatan penalaran studi kasus multi-tahap.
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>AI Insight:</strong> {classicalData.overallCognitiveProficiency.insight}</span>
                </div>
              </div>

              {/* Mastered vs Weakness Topics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Weakness Topics */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Materi / Sub-Bab dengan Kelemahan Tertinggi
                    </h3>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {classicalData.highestWeaknessTopics.map((topic, i) => (
                      <li
                        key={i}
                        className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-rose-900 font-medium flex items-center gap-2"
                      >
                        <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {i + 1}
                        </span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Mastered Topics */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Materi yang Berhasil Dikuasai Mayoritas Siswa
                    </h3>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {classicalData.masteredTopics.map((topic, i) => (
                      <li
                        key={i}
                        className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-900 font-medium flex items-center gap-2"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {i + 1}
                        </span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Student Differentiation Clusters (Klaster Belajar) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pengelompokan Siswa Berdasarkan Kebutuhan Belajar (Differentiated Learning)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rekomendasi AI untuk intervensi kelas yang tepat sasaran
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  {/* Cluster 1: Remedial */}
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
                    <div className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">
                      1. Kelompok Remedial Intensif
                    </div>
                    <p className="text-[11px] text-slate-600 mb-3">
                      Memerlukan pengulangan konsep dasar dan bimbingan langsung guru.
                    </p>
                    <div className="space-y-1">
                      {classicalData.studentClusters.remedial.length > 0 ? (
                        classicalData.studentClusters.remedial.map((name, i) => (
                          <div
                            key={i}
                            className="p-1.5 bg-white rounded border border-rose-200 text-xs text-rose-900 font-medium"
                          >
                            {name}
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">Tidak ada siswa</span>
                      )}
                    </div>
                  </div>

                  {/* Cluster 2: Penguatan */}
                  <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
                    <div className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">
                      2. Kelompok Penguatan Terarah
                    </div>
                    <p className="text-[11px] text-slate-600 mb-3">
                      Perlu latihan soal variasi MOTS dan pendalaman langkah kalkulasi.
                    </p>
                    <div className="space-y-1">
                      {classicalData.studentClusters.reinforcement.length > 0 ? (
                        classicalData.studentClusters.reinforcement.map((name, i) => (
                          <div
                            key={i}
                            className="p-1.5 bg-white rounded border border-indigo-200 text-xs text-indigo-900 font-medium"
                          >
                            {name}
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">Tidak ada siswa</span>
                      )}
                    </div>
                  </div>

                  {/* Cluster 3: Pengayaan */}
                  <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                    <div className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-1">
                      3. Kelompok Pengayaan & Tutor Sebaya
                    </div>
                    <p className="text-[11px] text-slate-600 mb-3">
                      Tuntas prima; siap studi kasus lanjutan dan menjadi tutor teman sekelas.
                    </p>
                    <div className="space-y-1">
                      {classicalData.studentClusters.enrichment.length > 0 ? (
                        classicalData.studentClusters.enrichment.map((name, i) => (
                          <div
                            key={i}
                            className="p-1.5 bg-white rounded border border-purple-200 text-xs text-purple-900 font-medium"
                          >
                            {name}
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">Tidak ada siswa</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Plan for Teachers */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Rencana Tindak Lanjut Pedagogis Guru (Teacher Action Plan)
                  </h3>
                </div>
                <div className="space-y-2 pt-1 text-xs">
                  {classicalData.teacherActionPlan.map((action, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-slate-800 leading-relaxed font-medium">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: ANALISIS INDIVIDUAL PER SISWA */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'individual' && (
        <div className="space-y-6">
          {/* Student Selector Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Pilih Siswa untuk Dianalisis:</span>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-white shadow-xs focus:ring-2 focus:ring-purple-500 min-w-[240px]"
              >
                {examResults.map((r) => (
                  <option key={r.studentId} value={r.studentId}>
                    {r.studentName} (Skor: {r.finalScore} · {r.className})
                  </option>
                ))}
              </select>
            </div>

            {selectedStudentResult && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block">Nilai Akhir:</span>
                  <span className="text-xl font-bold text-slate-900">{selectedStudentResult.finalScore} / 100</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status KKTP:</span>
                  <span className={`font-bold ${selectedStudentResult.isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedStudentResult.isPassed ? 'TUNTAS' : 'REMEDIAL'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {loadingIndividual ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <BrainCircuit className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              <div className="text-sm font-bold text-slate-900">
                Gemini sedang mendiagnosis lembar kerja siswa...
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Mengekstrak pola kesalahan, mengukur capaian tiap indikator kompetensi, dan menyusun roadmap remedial individual.
              </p>
            </div>
          ) : !individualData ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Pilih siswa untuk melihat analisis pembelajaran individual.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Individual Diagnosis Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-700">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>DIAGNOSIS KOGNITIF SISWA</span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-sans">
                  {individualData.summary}
                </p>
              </div>

              {/* Cognitive Diagnostic Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Kemampuan LOTS</span>
                  <div className="font-bold text-sm text-emerald-800">
                    {individualData.cognitiveDiagnosis.lots}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Kemampuan MOTS</span>
                  <div className="font-bold text-sm text-indigo-800">
                    {individualData.cognitiveDiagnosis.mots}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Kemampuan HOTS</span>
                  <div className="font-bold text-sm text-purple-800">
                    {individualData.cognitiveDiagnosis.hots}
                  </div>
                </div>
              </div>

              {/* Mastered vs Remedial Roadmap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Materi yang Belum Dikuasai (Perlu Remedial)</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs">
                    {individualData.weakTopics.map((item, i) => (
                      <li key={i} className="p-2.5 rounded-lg bg-rose-50 text-rose-900 font-medium">
                        • {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-900 block mb-1.5">Rencana Aksi Remedial:</span>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {individualData.remediationPlan.map((plan, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-indigo-600 font-bold">✓</span>
                          <span>{plan}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Materi yang Sudah Dikuasai Baik</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs">
                    {individualData.masteredTopics.map((item, i) => (
                      <li key={i} className="p-2.5 rounded-lg bg-emerald-50 text-emerald-900 font-medium">
                        • {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-900 block mb-1.5">Rekomendasi Pengayaan & Mandiri:</span>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {individualData.enrichmentPlan.map((plan, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-purple-600 font-bold">★</span>
                          <span>{plan}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
