import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  Subject,
  Chapter,
  Subchapter,
  Competency,
  ClassGroup,
  AcademicYear,
  NodeCognitiveComposition,
} from '../../types/cbt';
import {
  Shield,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronDown,
  Scale,
  MinusCircle,
  ListChecks,
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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Taxonomy & Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subchapters, setSubchapters] = useState<Subchapter[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const toLocalDateTimeInput = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Step 1: Identitas & Peserta
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [scheduleStart, setScheduleStart] = useState(() =>
    toLocalDateTimeInput(new Date())
  );
  const [scheduleEnd, setScheduleEnd] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000))
  );

  // Step 2: Bab & Kognitif
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [selectedSubchapterIds, setSelectedSubchapterIds] = useState<string[]>([]);
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>([]);
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>([]);
  const [expandedSubchapterIds, setExpandedSubchapterIds] = useState<string[]>([]);
  const [nodeTargets, setNodeTargets] = useState<
    Record<string, { lotsCount: number; motsCount: number; hotsCount: number }>
  >({});

  // Step 3: Bobot Soal
  const [pgKompleksMode, setPgKompleksMode] = useState<'partial' | 'exact'>('partial');
  const [useMinusSystem, setUseMinusSystem] = useState(false);
  const [minusValue, setMinusValue] = useState(1);
  const [lotsWeight, setLotsWeight] = useState(2);
  const [motsWeight, setMotsWeight] = useState(3);
  const [hotsWeight, setHotsWeight] = useState(5);
  const [autoSyncMaxScore, setAutoSyncMaxScore] = useState(true);
  const [maxScore, setMaxScore] = useState(23);
  const [kktpScore, setKktpScore] = useState(75);

  // Step 4: Token & Anti-Curang
  const [tokenAutoRotate, setTokenAutoRotate] = useState(true);
  const [tokenIntervalMinutes, setTokenIntervalMinutes] = useState(15);
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
    perScope?: Record<
      string,
      {
        label?: string;
        lots: { available: number; required: number; sufficient: boolean };
        mots: { available: number; required: number; sufficient: boolean };
        hots: { available: number; required: number; sufficient: boolean };
        isValid: boolean;
      }
    >;
  } | null>(null);

  const [saving, setSaving] = useState(false);

  const targetUnits: NodeCognitiveComposition[] = useMemo(() => {
    const units: NodeCognitiveComposition[] = [];
    const subjChapters = chapters.filter(
      (c) => c.subjectId === subjectId && selectedChapterIds.includes(c.id)
    );

    for (const ch of subjChapters) {
      const chSubchapters = subchapters.filter((sc) => sc.chapterId === ch.id);
      if (chSubchapters.length === 0) {
        const key = `chapter:${ch.id}`;
        const saved = nodeTargets[key] || { lotsCount: 1, motsCount: 1, hotsCount: 1 };
        units.push({
          scopeType: 'chapter',
          scopeId: ch.id,
          chapterId: ch.id,
          label: `Bab: ${ch.name}`,
          lotsCount: saved.lotsCount,
          motsCount: saved.motsCount,
          hotsCount: saved.hotsCount,
        });
        continue;
      }

      const activeSubchapters = chSubchapters.filter((sc) =>
        selectedSubchapterIds.includes(sc.id)
      );
      for (const sc of activeSubchapters) {
        const allScCompetencies = competencies.filter((cmp) => cmp.subchapterId === sc.id);
        if (allScCompetencies.length > 0) {
          const activeCompetencies = allScCompetencies.filter((cmp) =>
            selectedCompetencyIds.includes(cmp.id)
          );
          for (const cmp of activeCompetencies) {
            const key = `competency:${cmp.id}`;
            const saved = nodeTargets[key] || { lotsCount: 1, motsCount: 1, hotsCount: 1 };
            units.push({
              scopeType: 'competency',
              scopeId: cmp.id,
              chapterId: ch.id,
              subchapterId: sc.id,
              competencyId: cmp.id,
              label: `${ch.name} › ${sc.name} › ${cmp.code ? `[${cmp.code}] ` : ''}${cmp.description}`,
              lotsCount: saved.lotsCount,
              motsCount: saved.motsCount,
              hotsCount: saved.hotsCount,
            });
          }
        } else {
          const key = `subchapter:${sc.id}`;
          const saved = nodeTargets[key] || { lotsCount: 1, motsCount: 1, hotsCount: 1 };
          units.push({
            scopeType: 'subchapter',
            scopeId: sc.id,
            chapterId: ch.id,
            subchapterId: sc.id,
            label: `${ch.name} › ${sc.name}`,
            lotsCount: saved.lotsCount,
            motsCount: saved.motsCount,
            hotsCount: saved.hotsCount,
          });
        }
      }
    }

    return units;
  }, [
    subjectId,
    chapters,
    subchapters,
    competencies,
    selectedChapterIds,
    selectedSubchapterIds,
    selectedCompetencyIds,
    nodeTargets,
  ]);

  const lotsCount = useMemo(
    () => targetUnits.reduce((sum, u) => sum + u.lotsCount, 0),
    [targetUnits]
  );
  const motsCount = useMemo(
    () => targetUnits.reduce((sum, u) => sum + u.motsCount, 0),
    [targetUnits]
  );
  const hotsCount = useMemo(
    () => targetUnits.reduce((sum, u) => sum + u.hotsCount, 0),
    [targetUnits]
  );

  const totalQuestions = lotsCount + motsCount + hotsCount;
  const rawTotalWeight = Number(
    (lotsCount * lotsWeight + motsCount * motsWeight + hotsCount * hotsWeight).toFixed(2)
  );

  useEffect(() => {
    if (autoSyncMaxScore) {
      setMaxScore(rawTotalWeight > 0 ? rawTotalWeight : 100);
    }
  }, [rawTotalWeight, autoSyncMaxScore]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      loadDependencies();
    }
  }, [isOpen]);

  const applyFullScopeForSubject = (
    subjId: string,
    allChapters: Chapter[],
    allSubchapters: Subchapter[],
    allCompetencies: Competency[]
  ) => {
    const chs = allChapters.filter((c) => c.subjectId === subjId);
    const chIds = chs.map((c) => c.id);
    const scs = allSubchapters.filter((sc) => chIds.includes(sc.chapterId));
    const scIds = scs.map((sc) => sc.id);
    const cmps = allCompetencies.filter((cmp) => scIds.includes(cmp.subchapterId));
    const cmpIds = cmps.map((cmp) => cmp.id);
    setSelectedChapterIds(chIds);
    setSelectedSubchapterIds(scIds);
    setSelectedCompetencyIds(cmpIds);
    setExpandedChapterIds(chIds);
    setExpandedSubchapterIds(scIds);
  };

  const loadDependencies = async () => {
    try {
      const [taxRes, clsRes] = await Promise.all([
        api.getTaxonomy(),
        api.getClasses(),
      ]);
      const nextSubjects = taxRes.subjects || [];
      const nextChapters = taxRes.chapters || [];
      const nextSubchapters = taxRes.subchapters || [];
      const nextCompetencies = taxRes.competencies || [];

      setSubjects(nextSubjects);
      setChapters(nextChapters);
      setSubchapters(nextSubchapters);
      setCompetencies(nextCompetencies);
      setClasses(clsRes.classes);
      setAcademicYears(clsRes.academicYears);

      if (nextSubjects.length > 0 && !subjectId) {
        const firstSubj = nextSubjects[0].id;
        setSubjectId(firstSubj);
        applyFullScopeForSubject(firstSubj, nextChapters, nextSubchapters, nextCompetencies);
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
    applyFullScopeForSubject(newSubjectId, chapters, subchapters, competencies);
  };

  const updateNodeTarget = (
    scopeType: NodeCognitiveComposition['scopeType'],
    scopeId: string,
    field: 'lotsCount' | 'motsCount' | 'hotsCount',
    value: number
  ) => {
    const key = `${scopeType}:${scopeId}`;
    const safeVal = Math.max(0, Number.isNaN(value) ? 0 : value);
    setNodeTargets((prev) => {
      const current = prev[key] || { lotsCount: 1, motsCount: 1, hotsCount: 1 };
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: safeVal,
        },
      };
    });
  };

  // Run availability validation against active bank questions
  const checkAvailability = async () => {
    try {
      const res = await api.validateAvailability({
        subjectId,
        selectedChapterIds,
        selectedSubchapterIds,
        selectedCompetencyIds,
        cognitiveTarget: {
          lotsCount,
          motsCount,
          hotsCount,
          perScopeTargets: targetUnits,
        },
      });
      setValidation(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (subjectId && (step === 2 || step === 5)) {
      checkAvailability();
    }
  }, [
    subjectId,
    selectedChapterIds,
    selectedSubchapterIds,
    selectedCompetencyIds,
    targetUnits,
    step,
  ]);

  const toggleClassId = (id: string) => {
    setTargetClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleChapterExpand = (chapterId: string) => {
    setExpandedChapterIds((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const toggleSubchapterExpand = (subchapterId: string) => {
    setExpandedSubchapterIds((prev) =>
      prev.includes(subchapterId)
        ? prev.filter((id) => id !== subchapterId)
        : [...prev, subchapterId]
    );
  };

  const toggleChapterId = (chapterId: string) => {
    const childSubIds = subchapters
      .filter((sc) => sc.chapterId === chapterId)
      .map((sc) => sc.id);
    const childCmpIds = competencies
      .filter((cmp) => childSubIds.includes(cmp.subchapterId))
      .map((cmp) => cmp.id);

    const isSelected = selectedChapterIds.includes(chapterId);
    if (isSelected) {
      setSelectedChapterIds((prev) => prev.filter((id) => id !== chapterId));
      setSelectedSubchapterIds((prev) => prev.filter((id) => !childSubIds.includes(id)));
      setSelectedCompetencyIds((prev) => prev.filter((id) => !childCmpIds.includes(id)));
    } else {
      setSelectedChapterIds((prev) => Array.from(new Set([...prev, chapterId])));
      setSelectedSubchapterIds((prev) => Array.from(new Set([...prev, ...childSubIds])));
      setSelectedCompetencyIds((prev) => Array.from(new Set([...prev, ...childCmpIds])));
    }
  };

  const toggleSubchapterId = (subchapterId: string, chapterId: string) => {
    const childCmpIds = competencies
      .filter((cmp) => cmp.subchapterId === subchapterId)
      .map((cmp) => cmp.id);
    const siblingSubIds = subchapters
      .filter((sc) => sc.chapterId === chapterId)
      .map((sc) => sc.id);

    const isSelected = selectedSubchapterIds.includes(subchapterId);
    if (isSelected) {
      const nextSubIds = selectedSubchapterIds.filter((id) => id !== subchapterId);
      setSelectedSubchapterIds(nextSubIds);
      setSelectedCompetencyIds((prev) => prev.filter((id) => !childCmpIds.includes(id)));

      const anySiblingLeft = siblingSubIds.some((id) => nextSubIds.includes(id));
      if (!anySiblingLeft) {
        setSelectedChapterIds((prev) => prev.filter((id) => id !== chapterId));
      }
    } else {
      setSelectedChapterIds((prev) => Array.from(new Set([...prev, chapterId])));
      setSelectedSubchapterIds((prev) => Array.from(new Set([...prev, subchapterId])));
      setSelectedCompetencyIds((prev) => Array.from(new Set([...prev, ...childCmpIds])));
    }
  };

  const toggleCompetencyId = (competencyId: string, subchapterId: string, chapterId: string) => {
    const siblingCmpIds = competencies
      .filter((cmp) => cmp.subchapterId === subchapterId)
      .map((cmp) => cmp.id);
    const siblingSubIds = subchapters
      .filter((sc) => sc.chapterId === chapterId)
      .map((sc) => sc.id);

    const isSelected = selectedCompetencyIds.includes(competencyId);
    if (isSelected) {
      const nextCmpIds = selectedCompetencyIds.filter((id) => id !== competencyId);
      setSelectedCompetencyIds(nextCmpIds);

      const anyCmpSiblingLeft = siblingCmpIds.some((id) => nextCmpIds.includes(id));
      if (!anyCmpSiblingLeft) {
        const nextSubIds = selectedSubchapterIds.filter((id) => id !== subchapterId);
        setSelectedSubchapterIds(nextSubIds);
        const anySubSiblingLeft = siblingSubIds.some((id) => nextSubIds.includes(id));
        if (!anySubSiblingLeft) {
          setSelectedChapterIds((prev) => prev.filter((id) => id !== chapterId));
        }
      }
    } else {
      setSelectedChapterIds((prev) => Array.from(new Set([...prev, chapterId])));
      setSelectedSubchapterIds((prev) => Array.from(new Set([...prev, subchapterId])));
      setSelectedCompetencyIds((prev) => Array.from(new Set([...prev, competencyId])));
    }
  };

  const clearScopeForSubject = () => {
    setSelectedChapterIds([]);
    setSelectedSubchapterIds([]);
    setSelectedCompetencyIds([]);
  };

  const handleSaveExam = async () => {
    if (!title.trim()) {
      alert('Nama / Judul ujian wajib diisi.');
      setStep(1);
      return;
    }
    if (targetClassIds.length === 0) {
      alert('Pilih minimal satu kelas peserta ujian.');
      setStep(1);
      return;
    }
    const subjectChapters = chapters.filter((c) => c.subjectId === subjectId);
    if (
      subjectChapters.length > 0 &&
      selectedChapterIds.length === 0 &&
      selectedSubchapterIds.length === 0 &&
      selectedCompetencyIds.length === 0
    ) {
      alert('Pilih minimal satu cakupan materi (Bab / Sub Bab / Sub-Sub Bab).');
      setStep(2);
      return;
    }
    if (totalQuestions <= 0) {
      alert('Total soal minimal 1 butir.');
      setStep(2);
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
        academicYearId: academicYears.find((y) => y.isActive)?.id || academicYears[0]?.id,
        targetClassIds,
        scheduleStart: new Date(scheduleStart).toISOString(),
        scheduleEnd: new Date(scheduleEnd).toISOString(),
        durationMinutes,
        maxScore: Math.max(1, Number(maxScore) || rawTotalWeight || 100),
        kktpScore: Number(kktpScore) || 0,
        selectedChapterIds,
        selectedSubchapterIds,
        selectedCompetencyIds,
        cognitiveTarget: {
          lotsCount,
          motsCount,
          hotsCount,
          totalQuestions,
          perScopeTargets: targetUnits,
        },
        scoringConfig: {
          pgKompleksMode,
          useMinusSystem,
          minusValue: useMinusSystem ? Math.max(0, Number(minusValue) || 0) : 0,
          weights: {
            LOTS: Math.max(0, Number(lotsWeight) || 0),
            MOTS: Math.max(0, Number(motsWeight) || 0),
            HOTS: Math.max(0, Number(hotsWeight) || 0),
          },
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

  const stepsMeta = [
    { num: 1 as const, label: 'Identitas & Peserta' },
    { num: 2 as const, label: 'Bab & Kognitif' },
    { num: 3 as const, label: 'Bobot Soal' },
    { num: 4 as const, label: 'Token & Anti-Curang' },
    { num: 5 as const, label: 'Validasi & Review' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[90vh]">
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
              Pembuatan paket ujian otomatis dengan randomisasi unik, pembobotan kognitif, dan validasi soal
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Step Indicator */}
        <div className="py-4 border-b border-slate-100 shrink-0 overflow-x-auto">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold min-w-[600px]">
            {stepsMeta.map((item, idx) => (
              <React.Fragment key={item.num}>
                <button
                  type="button"
                  onClick={() => setStep(item.num)}
                  className={`flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    step === item.num ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      step === item.num
                        ? 'bg-indigo-600 text-white'
                        : step > item.num
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {item.num}
                  </span>
                  <span>{item.label}</span>
                </button>
                {idx < stepsMeta.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Modal Body / Steps */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* STEP 1: IDENTITAS & PESERTA */}
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Pilih Kelas / Rombongan Belajar Peserta
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Terpilih: {targetClassIds.length} dari {classes.length} kelas
                      {targetClassIds.length > 0 && classes.length > 0 && (
                        <span className="text-indigo-700 font-medium">
                          {' '}
                          ({classes
                            .filter((c) => targetClassIds.includes(c.id))
                            .map((c) => c.name)
                            .join(', ')})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTargetClassIds(classes.map((c) => c.id))}
                      className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                    >
                      Pilih Semua Kelas
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetClassIds([])}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
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

          {/* STEP 2: BAB & KOGNITIF */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Cakupan Bab / Materi Soal (Hingga Sub-Sub Bab)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Terpilih: {selectedChapterIds.length} Bab · {selectedSubchapterIds.length} Sub Bab · {selectedCompetencyIds.length} Sub-Sub Bab
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        applyFullScopeForSubject(subjectId, chapters, subchapters, competencies)
                      }
                      className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={clearScopeForSubject}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-slate-50">
                  {chapters.filter((c) => c.subjectId === subjectId).length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">
                      Belum ada Bab pada mata pelajaran ini.
                    </div>
                  ) : (
                    chapters
                      .filter((c) => c.subjectId === subjectId)
                      .map((ch) => {
                        const chSubchapters = subchapters.filter((sc) => sc.chapterId === ch.id);
                        const chCompetencies = competencies.filter((cmp) =>
                          chSubchapters.some((sc) => sc.id === cmp.subchapterId)
                        );
                        const isChSelected = selectedChapterIds.includes(ch.id);
                        const isChExpanded = expandedChapterIds.includes(ch.id);
                        const selectedSubCount = chSubchapters.filter((sc) =>
                          selectedSubchapterIds.includes(sc.id)
                        ).length;
                        const selectedCmpCount = chCompetencies.filter((cmp) =>
                          selectedCompetencyIds.includes(cmp.id)
                        ).length;

                        return (
                          <div
                            key={ch.id}
                            className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                          >
                            {/* Level 1: Bab */}
                            <div className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {chSubchapters.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleChapterExpand(ch.id)}
                                    className="p-0.5 rounded hover:bg-slate-200 text-slate-500 shrink-0"
                                    title={isChExpanded ? 'Tutup Sub Bab' : 'Buka Sub Bab'}
                                  >
                                    {isChExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="w-4 shrink-0" />
                                )}
                                <label className="flex items-center gap-2 text-xs cursor-pointer min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isChSelected}
                                    onChange={() => toggleChapterId(ch.id)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                                  />
                                  <span className="font-bold text-slate-900 truncate">
                                    Bab: {ch.name}
                                  </span>
                                </label>
                              </div>
                              {chSubchapters.length > 0 && (
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                  {selectedSubCount}/{chSubchapters.length} Sub Bab
                                  {chCompetencies.length > 0
                                    ? ` · ${selectedCmpCount}/${chCompetencies.length} Sub-Sub`
                                    : ''}
                                </span>
                              )}
                            </div>

                            {/* Level 2: Sub Bab */}
                            {isChExpanded && chSubchapters.length > 0 && (
                              <div className="border-t border-slate-100 bg-slate-50/50 pl-6 pr-2 py-1.5 space-y-1.5">
                                {chSubchapters.map((sc) => {
                                  const scCompetencies = competencies.filter(
                                    (cmp) => cmp.subchapterId === sc.id
                                  );
                                  const isScSelected = selectedSubchapterIds.includes(sc.id);
                                  const isScExpanded = expandedSubchapterIds.includes(sc.id);
                                  const selectedScCmpCount = scCompetencies.filter((cmp) =>
                                    selectedCompetencyIds.includes(cmp.id)
                                  ).length;

                                  return (
                                    <div
                                      key={sc.id}
                                      className="bg-white rounded-md border border-slate-200/80 overflow-hidden"
                                    >
                                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-slate-50">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          {scCompetencies.length > 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => toggleSubchapterExpand(sc.id)}
                                              className="p-0.5 rounded hover:bg-slate-200 text-slate-500 shrink-0"
                                              title={
                                                isScExpanded
                                                  ? 'Tutup Sub-Sub Bab'
                                                  : 'Buka Sub-Sub Bab'
                                              }
                                            >
                                              {isScExpanded ? (
                                                <ChevronDown className="w-3 h-3" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3" />
                                              )}
                                            </button>
                                          ) : (
                                            <span className="w-4 shrink-0" />
                                          )}
                                          <label className="flex items-center gap-2 text-xs cursor-pointer min-w-0 flex-1">
                                            <input
                                              type="checkbox"
                                              checked={isScSelected}
                                              onChange={() => toggleSubchapterId(sc.id, ch.id)}
                                              className="rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                                            />
                                            <span className="font-semibold text-slate-800 truncate">
                                              Sub Bab: {sc.name}
                                            </span>
                                          </label>
                                        </div>
                                        {scCompetencies.length > 0 && (
                                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                            {selectedScCmpCount}/{scCompetencies.length} Sub-Sub Bab
                                          </span>
                                        )}
                                      </div>

                                      {/* Level 3: Sub-Sub Bab */}
                                      {isScExpanded && scCompetencies.length > 0 && (
                                        <div className="border-t border-slate-100 bg-indigo-50/30 pl-7 pr-2 py-1.5 space-y-1">
                                          {scCompetencies.map((cmp) => {
                                            const isCmpSelected = selectedCompetencyIds.includes(
                                              cmp.id
                                            );
                                            return (
                                              <label
                                                key={cmp.id}
                                                className="flex items-start gap-2 px-2 py-1 rounded hover:bg-white text-[11px] cursor-pointer"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isCmpSelected}
                                                  onChange={() =>
                                                    toggleCompetencyId(cmp.id, sc.id, ch.id)
                                                  }
                                                  className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 shrink-0"
                                                />
                                                <span className="text-slate-700 leading-snug">
                                                  {cmp.code ? (
                                                    <span className="font-mono font-semibold text-indigo-700 mr-1">
                                                      [{cmp.code}]
                                                    </span>
                                                  ) : null}
                                                  {cmp.description}
                                                </span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Cognitive composition per Sub-Sub Bab (or Sub Bab fallback) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Target Komposisi Soal per Siswa (Total: {totalQuestions} Soal)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Ditentukan untuk setiap Sub-Sub Bab yang dipilih; jika belum ada Sub-Sub Bab, ditentukan pada level Sub Bab.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                      LOTS: {lotsCount}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                      MOTS: {motsCount}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                      HOTS: {hotsCount}
                    </span>
                  </div>
                </div>

                {targetUnits.length === 0 ? (
                  <div className="p-4 bg-white border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
                    Pilih minimal satu cakupan materi (Bab / Sub Bab / Sub-Sub Bab) di atas untuk mengatur target komposisi soal.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {targetUnits.map((unit) => {
                      const key = `${unit.scopeType}:${unit.scopeId}`;
                      const nodeVal = validation?.perScope?.[key];
                      const unitTotal = unit.lotsCount + unit.motsCount + unit.hotsCount;
                      const isNodeDeficit = nodeVal ? !nodeVal.isValid : false;

                      const chName = chapters.find((c) => c.id === unit.chapterId)?.name || '';
                      const scName = unit.subchapterId
                        ? subchapters.find((s) => s.id === unit.subchapterId)?.name || ''
                        : '';
                      const cmpObj = unit.competencyId
                        ? competencies.find((c) => c.id === unit.competencyId)
                        : undefined;

                      return (
                        <div
                          key={key}
                          className={`p-3 bg-white rounded-xl border space-y-2.5 ${
                            isNodeDeficit ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    unit.scopeType === 'competency'
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : unit.scopeType === 'subchapter'
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {unit.scopeType === 'competency'
                                    ? 'Sub-Sub Bab'
                                    : unit.scopeType === 'subchapter'
                                    ? 'Sub Bab'
                                    : 'Bab'}
                                </span>
                                <span className="text-[11px] text-slate-500 truncate">
                                  {unit.scopeType === 'competency'
                                    ? `${chName} › ${scName}`
                                    : unit.scopeType === 'subchapter'
                                    ? `${chName} (Belum ada Sub-Sub Bab)`
                                    : 'Belum ada Sub Bab'}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                                {unit.scopeType === 'competency' && cmpObj
                                  ? `${cmpObj.code ? `[${cmpObj.code}] ` : ''}${cmpObj.description}`
                                  : unit.scopeType === 'subchapter'
                                  ? scName
                                  : chName}
                              </p>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
                              {unitTotal} Soal
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                LOTS
                              </label>
                              <input
                                type="number"
                                value={unit.lotsCount}
                                onChange={(e) =>
                                  updateNodeTarget(
                                    unit.scopeType,
                                    unit.scopeId,
                                    'lotsCount',
                                    Number(e.target.value)
                                  )
                                }
                                min={0}
                                className={`w-full p-1.5 text-xs border rounded-lg font-mono font-bold bg-white ${
                                  nodeVal && !nodeVal.lots.sufficient
                                    ? 'border-amber-400 text-amber-800 bg-amber-50/40'
                                    : 'border-slate-300'
                                }`}
                              />
                              {nodeVal && (
                                <span
                                  className={`text-[10px] mt-1 block ${
                                    nodeVal.lots.sufficient
                                      ? 'text-slate-500'
                                      : 'text-amber-700 font-semibold'
                                  }`}
                                >
                                  Tersedia: {nodeVal.lots.available}
                                </span>
                              )}
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                MOTS
                              </label>
                              <input
                                type="number"
                                value={unit.motsCount}
                                onChange={(e) =>
                                  updateNodeTarget(
                                    unit.scopeType,
                                    unit.scopeId,
                                    'motsCount',
                                    Number(e.target.value)
                                  )
                                }
                                min={0}
                                className={`w-full p-1.5 text-xs border rounded-lg font-mono font-bold bg-white ${
                                  nodeVal && !nodeVal.mots.sufficient
                                    ? 'border-amber-400 text-amber-800 bg-amber-50/40'
                                    : 'border-slate-300'
                                }`}
                              />
                              {nodeVal && (
                                <span
                                  className={`text-[10px] mt-1 block ${
                                    nodeVal.mots.sufficient
                                      ? 'text-slate-500'
                                      : 'text-amber-700 font-semibold'
                                  }`}
                                >
                                  Tersedia: {nodeVal.mots.available}
                                </span>
                              )}
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                HOTS
                              </label>
                              <input
                                type="number"
                                value={unit.hotsCount}
                                onChange={(e) =>
                                  updateNodeTarget(
                                    unit.scopeType,
                                    unit.scopeId,
                                    'hotsCount',
                                    Number(e.target.value)
                                  )
                                }
                                min={0}
                                className={`w-full p-1.5 text-xs border rounded-lg font-mono font-bold bg-white ${
                                  nodeVal && !nodeVal.hots.sufficient
                                    ? 'border-amber-400 text-amber-800 bg-amber-50/40'
                                    : 'border-slate-300'
                                }`}
                              />
                              {nodeVal && (
                                <span
                                  className={`text-[10px] mt-1 block ${
                                    nodeVal.hots.sufficient
                                      ? 'text-slate-500'
                                      : 'text-amber-700 font-semibold'
                                  }`}
                                >
                                  Tersedia: {nodeVal.hots.available}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Real-time Availability Warning Banner */}
                {validation && !validation.isValid && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Peringatan Defisit Bank Soal:</strong> Jumlah soal aktif pada beberapa materi belum mencukupi target yang diminta:
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
                        {validation.perScope &&
                        Object.values(validation.perScope).some((n) => !n.isValid) ? (
                          Object.entries(validation.perScope)
                            .filter(([, n]) => !n.isValid)
                            .map(([k, n]) => {
                              const lacks: string[] = [];
                              if (!n.lots.sufficient)
                                lacks.push(`LOTS kurang ${n.lots.required - n.lots.available}`);
                              if (!n.mots.sufficient)
                                lacks.push(`MOTS kurang ${n.mots.required - n.mots.available}`);
                              if (!n.hots.sufficient)
                                lacks.push(`HOTS kurang ${n.hots.required - n.hots.available}`);
                              return (
                                <li key={k}>
                                  <span className="font-semibold">{n.label || k}:</span>{' '}
                                  {lacks.join(', ')}
                                </li>
                              );
                            })
                        ) : (
                          <>
                            {!validation.lots.sufficient && (
                              <li>LOTS kurang {validation.lots.required - validation.lots.available} butir</li>
                            )}
                            {!validation.mots.sufficient && (
                              <li>MOTS kurang {validation.mots.required - validation.mots.available} butir</li>
                            )}
                            {!validation.hots.sufficient && (
                              <li>HOTS kurang {validation.hots.required - validation.hots.available} butir</li>
                            )}
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: BOBOT SOAL */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Sistem Penilaian Pilihan Ganda Kompleks */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Sistem Penilaian Pilihan Ganda Kompleks
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setPgKompleksMode('partial')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      pgKompleksMode === 'partial'
                        ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>1. Sistem Kredit Parsial</span>
                      {pgKompleksMode === 'partial' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Misalnya, jika ada <strong>3 jawaban benar</strong> dan siswa hanya memilih <strong>2 dengan benar</strong>, ia mendapat skor bagian (<strong>2/3 dari bobot soal</strong>). Jumlah jawaban yang dapat dipilih maksimal sesuai jumlah jawaban benar.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPgKompleksMode('exact')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      pgKompleksMode === 'exact'
                        ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>2. Sistem Benar Mutlak</span>
                      {pgKompleksMode === 'exact' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Semua jawaban benar harus dipilih dengan tepat. Jika ada satu pun pilihan yang salah atau kurang, skor butir soal dianggap <strong>nol (0)</strong>.
                    </p>
                  </button>
                </div>
              </div>

              {/* Tipe Penilaian: Sistem Minus / Tanpa Sistem Minus */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <MinusCircle className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Tipe Penilaian Soal
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setUseMinusSystem(false)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      !useMinusSystem
                        ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>Tanpa Sistem Minus</span>
                      {!useMinusSystem && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Jawaban benar mendapat bobot poin tingkatan; jawaban salah dan kosong bernilai <strong>0</strong>.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseMinusSystem(true)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      useMinusSystem
                        ? 'bg-rose-50 border-rose-500 ring-1 ring-rose-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>Sistem Minus</span>
                      {useMinusSystem && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Jawaban salah mendapat pengurangan poin (minus); jawaban kosong tidak dikurangi (<strong>0</strong>).
                    </p>
                  </button>
                </div>

                {useMinusSystem && (
                  <div className="p-3 bg-white border border-rose-200 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-800">
                          Besarnya Nilai Minus (per Jawaban Salah)
                        </label>
                        <span className="text-[11px] text-slate-500">
                          Setiap jawaban salah akan dikurangi <strong>-{minusValue || 0} poin</strong>.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[0.25, 0.5, 1, 2].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setMinusValue(preset)}
                              className={`px-2 py-1 text-[11px] font-mono font-semibold rounded border transition-colors ${
                                minusValue === preset
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              -{preset}
                            </button>
                          ))}
                        </div>
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1.5 text-xs font-mono font-bold text-rose-600">-</span>
                          <input
                            type="number"
                            value={minusValue}
                            onChange={(e) => setMinusValue(Math.max(0, Number(e.target.value)))}
                            min={0}
                            step="0.25"
                            className="w-full pl-5 pr-2 py-1.5 text-xs border border-rose-300 rounded-lg font-mono font-bold text-rose-700 bg-rose-50/40 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pembobotan per Tingkatan LOTS, MOTS, HOTS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pembobotan Skor per Tingkatan Kognitif
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Poin per butir soal benar
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* LOTS Weight */}
                  <div className="p-3 bg-white border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800">LOTS</span>
                      <span className="text-[11px] font-mono text-slate-500">{lotsCount} Soal</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Bobot / Poin per Soal
                      </label>
                      <input
                        type="number"
                        value={lotsWeight}
                        onChange={(e) => setLotsWeight(Math.max(0, Number(e.target.value)))}
                        min={0}
                        step="0.5"
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono font-semibold pt-1 border-t border-slate-100">
                      Subtotal: {Number((lotsCount * lotsWeight).toFixed(2))} Poin
                    </div>
                  </div>

                  {/* MOTS Weight */}
                  <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-800">MOTS</span>
                      <span className="text-[11px] font-mono text-slate-500">{motsCount} Soal</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Bobot / Poin per Soal
                      </label>
                      <input
                        type="number"
                        value={motsWeight}
                        onChange={(e) => setMotsWeight(Math.max(0, Number(e.target.value)))}
                        min={0}
                        step="0.5"
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="text-[11px] text-indigo-700 font-mono font-semibold pt-1 border-t border-slate-100">
                      Subtotal: {Number((motsCount * motsWeight).toFixed(2))} Poin
                    </div>
                  </div>

                  {/* HOTS Weight */}
                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-800">HOTS</span>
                      <span className="text-[11px] font-mono text-slate-500">{hotsCount} Soal</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Bobot / Poin per Soal
                      </label>
                      <input
                        type="number"
                        value={hotsWeight}
                        onChange={(e) => setHotsWeight(Math.max(0, Number(e.target.value)))}
                        min={0}
                        step="0.5"
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="text-[11px] text-purple-700 font-mono font-semibold pt-1 border-t border-slate-100">
                      Subtotal: {Number((hotsCount * hotsWeight).toFixed(2))} Poin
                    </div>
                  </div>
                </div>
              </div>

              {/* Ringkasan Total Soal & Total Skor Maksimal */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="p-3 bg-white rounded-lg border border-indigo-100">
                    <span className="text-[11px] font-medium text-slate-500 block">Total Soal</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {totalQuestions} <span className="text-xs font-normal text-slate-500">Butir</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {lotsCount} LOTS · {motsCount} MOTS · {hotsCount} HOTS
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-indigo-100">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Total Skor Maksimal
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAutoSyncMaxScore(true);
                            setMaxScore(rawTotalWeight > 0 ? rawTotalWeight : 100);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            autoSyncMaxScore
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Samakan otomatis dengan total bobot poin"
                        >
                          Bobot ({rawTotalWeight})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAutoSyncMaxScore(false);
                            setMaxScore(100);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            !autoSyncMaxScore && maxScore === 100
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Skala 100
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      value={maxScore}
                      onChange={(e) => {
                        setAutoSyncMaxScore(false);
                        setMaxScore(Math.max(1, Number(e.target.value)));
                      }}
                      min={1}
                      className="w-full px-2.5 py-1.5 text-sm font-bold font-mono text-indigo-700 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-indigo-100">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Batas Tuntas (KKTP)
                    </label>
                    <input
                      type="number"
                      value={kktpScore}
                      onChange={(e) => setKktpScore(Math.max(0, Number(e.target.value)))}
                      min={0}
                      className="w-full px-2.5 py-1.5 text-sm font-bold font-mono text-emerald-700 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: TOKEN & ANTI-CURANG */}
          {step === 4 && (
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

          {/* STEP 5: VALIDASI & REVIEW */}
          {step === 5 && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-slate-900">Ringkasan Parameter Ujian</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-600 pt-2 border-t border-slate-200">
                  <div>Nama Ujian: <strong className="text-slate-900">{title || 'Ujian Baru'}</strong></div>
                  <div>Mata Pelajaran: <strong className="text-slate-900">{subjects.find((s) => s.id === subjectId)?.name}</strong></div>
                  <div>Durasi: <strong className="text-slate-900">{durationMinutes} Menit</strong></div>
                  <div>
                    Kelas Peserta:{' '}
                    <strong className="text-slate-900">
                      {targetClassIds.length} Rombel (
                      {classes
                        .filter((c) => targetClassIds.includes(c.id))
                        .map((c) => c.name)
                        .join(', ') || '-'}
                      )
                    </strong>
                  </div>
                  <div>Total Soal per Siswa: <strong className="text-slate-900">{totalQuestions} Butir</strong></div>
                  <div>
                    Cakupan Materi:{' '}
                    <strong className="text-slate-900">
                      {selectedChapterIds.length} Bab · {selectedSubchapterIds.length} Sub Bab · {selectedCompetencyIds.length} Sub-Sub Bab
                    </strong>
                  </div>
                  <div>Komposisi Kognitif: <strong className="text-slate-900">{lotsCount} LOTS · {motsCount} MOTS · {hotsCount} HOTS</strong></div>
                  <div>
                    Penilaian PG Kompleks:{' '}
                    <strong className="text-indigo-700">
                      {pgKompleksMode === 'partial'
                        ? 'Sistem Kredit Parsial (Maks pilih = jml benar)'
                        : 'Sistem Benar Mutlak (Salah = 0)'}
                    </strong>
                  </div>
                  <div>
                    Tipe Penilaian:{' '}
                    <strong className={useMinusSystem ? 'text-rose-700' : 'text-emerald-700'}>
                      {useMinusSystem
                        ? `Sistem Minus (-${minusValue} per jawaban salah)`
                        : 'Tanpa Sistem Minus (Salah = 0)'}
                    </strong>
                  </div>
                  <div>
                    Bobot Tingkatan:{' '}
                    <strong className="text-slate-900">
                      LOTS {lotsWeight} · MOTS {motsWeight} · HOTS {hotsWeight}
                    </strong>
                  </div>
                  <div>
                    Total Skor Maksimal:{' '}
                    <strong className="text-indigo-700 font-mono">
                      {maxScore} (Total Bobot: {rawTotalWeight})
                    </strong>
                  </div>
                  <div>KKTP: <strong className="text-slate-900 font-mono">{kktpScore}</strong></div>
                </div>

                {targetUnits.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-700">
                      Rincian Target per Sub-Sub Bab / Sub Bab:
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {targetUnits.map((unit) => (
                        <div
                          key={`${unit.scopeType}:${unit.scopeId}`}
                          className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px]"
                        >
                          <span className="text-slate-700 truncate">
                            <span className="font-semibold text-indigo-700 mr-1">
                              [{unit.scopeType === 'competency' ? 'Sub-Sub Bab' : unit.scopeType === 'subchapter' ? 'Sub Bab' : 'Bab'}]
                            </span>
                            {unit.label}
                          </span>
                          <span className="font-mono font-semibold text-slate-800 shrink-0">
                            {unit.lotsCount}L · {unit.motsCount}M · {unit.hotsCount}H
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Garansi Integritas Backend:</span>
                </div>
                <ul className="list-disc list-inside text-emerald-800 space-y-0.5">
                  <li>Paket soal dan pilihan jawaban diacak unik di server untuk setiap siswa.</li>
                  <li>Pembobotan LOTS/MOTS/HOTS serta aturan sistem minus diterapkan otomatis pada penilaian dan live monitoring.</li>
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

            {step < 5 ? (
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
