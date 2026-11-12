import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Subject, Chapter, Subchapter, ClassGroup, AcademicYear, Question } from '../../types/cbt';
import {
  FileQuestion,
  Layers,
  Sparkles,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  ChevronRight,
} from 'lucide-react';

interface ExamGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExamGeneratorModal: React.FC<ExamGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Taxonomy & Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  // Form payload
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [kktpScore, setKktpScore] = useState(75);
  const [scheduleStart, setScheduleStart] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [scheduleEnd, setScheduleEnd] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)
  );

  // Chapter selection
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  // Cognitive distribution targets
  const [lotsCount, setLotsCount] = useState(2);
  const [motsCount, setMotsCount] = useState(3);
  const [hotsCount, setHotsCount] = useState(2);

  // Token settings
  const [tokenAutoRotate, setTokenAutoRotate] = useState(true);
  const [tokenIntervalMinutes, setTokenIntervalMinutes] = useState(15);

  // Anti-cheating
  const [forceFullscreen, setForceFullscreen] = useState(true);
  const [detectTabSwitch, setDetectTabSwitch] = useState(true);
  const [blockRightClick, setBlockRightClick] = useState(true);
  const [blockCopyPaste, setBlockCopyPaste] = useState(true);
  const [maxToleranceViolations, setMaxToleranceViolations] = useState(3);

  // Availability validation state
  const [validation, setValidation] = useState<{
    isValid: boolean;
    totalAvailable: number;
    lots: { available: number; required: number; sufficient: boolean };
    mots: { available: number; required: number; sufficient: boolean };
    hots: { available: number; required: number; sufficient: boolean };
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
    }
  }, [isOpen]);

  const loadDependencies = async () => {
    try {
      const [taxRes, clsRes] = await Promise.all([
        api.getTaxonomy(),
        api.getClasses(),
      ]);
      setSubjects(taxRes.subjects);
      setChapters(taxRes.chapters);
      setClasses(clsRes.classes);
      setAcademicYears(clsRes.academicYears);

      if (taxRes.subjects.length > 0 && !subjectId) {
        setSubjectId(taxRes.subjects[0].id);
        const related = taxRes.chapters.filter((c) => c.subjectId === taxRes.subjects[0].id);
        setSelectedChapterIds(related.map((c) => c.id));
      }
      if (clsRes.classes.length > 0 && targetClassIds.length === 0) {
        setTargetClassIds([clsRes.classes[0].id]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const related = chapters.filter((c) => c.subjectId === newSubjectId);
    setSelectedChapterIds(related.map((c) => c.id));
  };

  // Run availability validation against active bank questions
  const checkAvailability = async () => {
    try {
      setValidationLoading(true);
      const res = await api.validateAvailability({
        subjectId,
        selectedChapterIds,
        cognitiveTarget: { lotsCount, motsCount, hotsCount },
      });
      setValidation(res);
    } catch (err) {
      console.error(err);
    } finally {
      setValidationLoading(false);
    }
  };

  useEffect(() => {
    if (subjectId && (step === 2 || step === 3)) {
      checkAvailability();
    }
  }, [subjectId, selectedChapterIds, lotsCount, motsCount, hotsCount, step]);

  const toggleClassId = (id: string) => {
    setTargetClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleChapterId = (id: string) => {
    setSelectedChapterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSaveExam = async () => {
    if (!title.trim()) {
      alert('Nama / Judul ujian wajib diisi.');
      return;
    }
    if (targetClassIds.length === 0) {
      alert('Pilih minimal satu kelas peserta ujian.');
      return;
    }

    if (validation && !validation.isValid) {
      const confirmProceed = confirm(
        'PERINGATAN: Ketersediaan butir soal aktif pada bank soal kurang dari target yang ditentukan. Apakah Anda ingin melanjutkan?'
      );
      if (!confirmProceed) return;
    }

    setSaving(true);
    try {
      await api.createExam({
        title,
        subjectId,
        targetClassIds,
        scheduleStart: new Date(scheduleStart).toISOString(),
        scheduleEnd: new Date(scheduleEnd).toISOString(),
        durationMinutes,
        maxScore: 100,
        kktpScore,
        selectedChapterIds,
        cognitiveTarget: {
          lotsCount,
          motsCount,
          hotsCount,
          totalQuestions: lotsCount + motsCount + hotsCount,
        },
        tokenAutoRotate,
        tokenIntervalMinutes,
        antiCheating: {
          forceFullscreen,
          detectTabSwitch,
          blockRightClick,
          blockCopyPaste,
          maxToleranceViolations,
          autoSubmitOnViolationLimit: false,
        },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan ujian.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalQuestions = lotsCount + motsCount + hotsCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Generator Ujian Dinamis SMA
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pembuatan paket ujian otomatis dengan randomisasi unik dan validasi kognitif
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between text-xs font-semibold">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 ${step === 1 ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Identitas & Peserta</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <button
              onClick={() => setStep(2)}
              className={`flex items-center gap-1.5 ${step === 2 ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Bab & Kognitif</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <button
              onClick={() => setStep(3)}
              className={`flex items-center gap-1.5 ${step === 3 ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Token & Anti-Curang</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <button
              onClick={() => setStep(4)}
              className={`flex items-center gap-1.5 ${step === 4 ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 4 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>4</span>
              <span>Validasi & Review</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Steps */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* STEP 1: IDENTITAS & KELAS */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama / Judul Ujian
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Asesmen Sumatif Akhir Semester Fisika Terapan"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Durasi Pengerjaan (Menit)
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    min={15}
                    max={240}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jadwal Mulai
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jadwal Berakhir (Batas Akses)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleEnd}
                    onChange={(e) => setScheduleEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Kelas / Rombongan Belajar Peserta
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {classes.map((cls) => {
                    const isSelected = targetClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleClassId(cls.id)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{cls.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BAB & KOMPOSISI KOGNITIF */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cakupan Bab / Materi Soal
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                  {chapters
                    .filter((c) => c.subjectId === subjectId)
                    .map((ch) => {
                      const isSelected = selectedChapterIds.includes(ch.id);
                      return (
                        <label
                          key={ch.id}
                          className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 text-xs cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleChapterId(ch.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-slate-800 font-medium">{ch.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Cognitive composition */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Target Komposisi Soal per Siswa (Total: {totalQuestions} Soal)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    KKTP: {kktpScore}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      LOTS (Pemahaman)
                    </label>
                    <input
                      type="number"
                      value={lotsCount}
                      onChange={(e) => setLotsCount(Math.max(0, Number(e.target.value)))}
                      min={0}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg font-mono font-bold"
                    />
                    {validation && (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Tersedia di bank: {validation.lots.available}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MOTS (Aplikasi)
                    </label>
                    <input
                      type="number"
                      value={motsCount}
                      onChange={(e) => setMotsCount(Math.max(0, Number(e.target.value)))}
                      min={0}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg font-mono font-bold"
                    />
                    {validation && (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Tersedia di bank: {validation.mots.available}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      HOTS (Nalar Tinggi)
                    </label>
                    <input
                      type="number"
                      value={hotsCount}
                      onChange={(e) => setHotsCount(Math.max(0, Number(e.target.value)))}
                      min={0}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg font-mono font-bold"
                    />
                    {validation && (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Tersedia di bank: {validation.hots.available}
                      </span>
                    )}
                  </div>
                </div>

                {/* Real-time Availability Warning Banner */}
                {validation && !validation.isValid && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Peringatan Defisit Bank Soal:</strong> Jumlah soal aktif tidak mencukupi untuk komposisi yang diminta:
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
                        {!validation.lots.sufficient && (
                          <li>LOTS kurang {validation.lots.required - validation.lots.available} butir</li>
                        )}
                        {!validation.mots.sufficient && (
                          <li>MOTS kurang {validation.mots.required - validation.mots.available} butir</li>
                        )}
                        {!validation.hots.sufficient && (
                          <li>HOTS kurang {validation.hots.required - validation.hots.available} butir</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: TOKEN & ANTI-CURANG */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Token Configuration */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Pengaturan Token Ujian
                  </h4>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tokenAutoRotate}
                    onChange={(e) => setTokenAutoRotate(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Aktifkan pergantian token otomatis (Auto-Rotate)</span>
                </label>

                {tokenAutoRotate && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Interval Pergantian Token Otomatis:
                    </label>
                    <div className="flex items-center gap-2">
                      {[5, 10, 15, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setTokenIntervalMinutes(mins)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            tokenIntervalMinutes === mins
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {mins} Menit
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Siswa yang sudah masuk ujian tidak akan terputus saat token berganti.
                    </p>
                  </div>
                )}
              </div>

              {/* Anti-cheating Configuration */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Sistem Anti-Cheating Terintegrasi
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceFullscreen}
                      onChange={(e) => setForceFullscreen(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Kunci Mode Fullscreen</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detectTabSwitch}
                      onChange={(e) => setDetectTabSwitch(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Deteksi Pindah Tab / Jendela</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={blockRightClick}
                      onChange={(e) => setBlockRightClick(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Blokir Klik Kanan (Inspect)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={blockCopyPaste}
                      onChange={(e) => setBlockCopyPaste(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Blokir Salin-Tempel (Copy-Paste)</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batas Toleransi Peringatan Kecurangan Sebelum Notifikasi Pengawas:
                  </label>
                  <select
                    value={maxToleranceViolations}
                    onChange={(e) => setMaxToleranceViolations(Number(e.target.value))}
                    className="p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>1 Peringatan (Sangat Ketat)</option>
                    <option value={2}>2 Peringatan</option>
                    <option value={3}>3 Peringatan (Standar Sekolah)</option>
                    <option value={5}>5 Peringatan</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: VALIDASI & REVIEW */}
          {step === 4 && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-sm text-slate-900">Ringkasan Parameter Ujian</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-2 border-t border-slate-200">
                  <div>Nama Ujian: <strong className="text-slate-900">{title || 'Ujian Baru'}</strong></div>
                  <div>Mata Pelajaran: <strong className="text-slate-900">{subjects.find((s) => s.id === subjectId)?.name}</strong></div>
                  <div>Durasi: <strong className="text-slate-900">{durationMinutes} Menit</strong></div>
                  <div>KKTP: <strong className="text-slate-900">{kktpScore}</strong></div>
                  <div>Total Soal per Siswa: <strong className="text-slate-900">{totalQuestions} Butir</strong></div>
                  <div>Komposisi Kognitif: <strong className="text-slate-900">{lotsCount} LOTS · {motsCount} MOTS · {hotsCount} HOTS</strong></div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Garansi Integritas Backend:</span>
                </div>
                <ul className="list-disc list-inside text-emerald-800 space-y-0.5">
                  <li>Paket soal dan pilihan jawaban diacak unik di server untuk setiap siswa.</li>
                  <li>Kunci jawaban tidak pernah dikirim ke browser siswa.</li>
                  <li>Paket soal terkunci permanen per akun siswa sehingga tidak berubah jika terjadi pemutusan koneksi.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Kembali
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
              >
                Lanjutkan
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveExam}
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? 'Menyimpan & Mengacak...' : 'Simpan & Publikasikan Ujian'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
