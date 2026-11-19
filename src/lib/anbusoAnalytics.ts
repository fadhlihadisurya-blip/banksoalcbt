import { ExamResultItem, Question, QuestionType, CognitiveLevel } from '../types/cbt';
import { stripHtmlToText } from './richContent';

export type DifficultyCategory = 'Mudah' | 'Sedang' | 'Sukar';
export type DiscriminationCategory =
  | 'Sangat Baik'
  | 'Baik'
  | 'Cukup'
  | 'Jelek'
  | 'Negatif'
  | 'Belum Cukup Data';

export type DecisionStatus =
  | 'Diterima'
  | 'Revisi Pengecoh'
  | 'Revisi Soal'
  | 'Dibuang / Diganti'
  | 'Perlu Data';

export type ReliabilityCategory =
  | 'Sangat Tinggi'
  | 'Tinggi'
  | 'Cukup'
  | 'Rendah'
  | 'Sangat Rendah'
  | 'Belum Cukup Data';

export interface DistractorOptionStat {
  optionId: string;
  optionText: string;
  isKey: boolean;
  chosenCount: number;
  chosenPct: number;
  upperCount: number;
  lowerCount: number;
  status: 'kunci' | 'efektif' | 'tidak_berfungsi';
}

export interface ItemAnbusoAnalysis {
  questionId: string;
  questionCode: string;
  questionType: QuestionType;
  cognitiveLevel: CognitiveLevel;
  questionTextPreview: string;
  questionHtml: string;
  correctAnswerDisplay: string;
  respondentCount: number;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;

  // 1. Difficulty (P)
  difficultyIndex: number; // 0..1
  difficultyPct: number; // 0..100
  difficultyCategory: DifficultyCategory;
  upperAccuracy: number; // 0..1
  lowerAccuracy: number; // 0..1

  // 2. Discrimination (D & r_pbis)
  discriminationIndex: number | null; // -1..1
  discriminationCategory: DiscriminationCategory;
  pointBiserial: number | null; // -1..1

  // 3. Distractor
  distractorApplicable: boolean;
  distractorOptions: DistractorOptionStat[];
  effectiveDistractorCount: number;
  totalDistractorCount: number;
  distractorSummary: string;

  // 4. Reliabilitas (kontribusi butir)
  itemTotalCorrelation: number | null;
  alphaIfDeleted: number | null;
  reliabilityImpact: 'mendukung' | 'netral' | 'menurunkan' | 'belum_cukup';
  reliabilityNote: string;

  // 5. Decision
  decision: DecisionStatus;
  decisionReason: string;
}

export interface ExamAnbusoReport {
  examId: string;
  examTitle: string;
  participantCount: number;
  analyzedItemCount: number;
  isDynamicSubset: boolean;
  reliability: {
    alpha: number | null;
    methodLabel: string;
    category: ReliabilityCategory;
    sem: number | null;
    note: string;
  };
  summary: {
    avgDifficulty: number;
    avgDiscrimination: number | null;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    goodDiscriminationCount: number;
    decisionCounts: Record<DecisionStatus, number>;
  };
  items: ItemAnbusoAnalysis[];
}

function isUnansweredValue(ans: any): boolean {
  return (
    ans === undefined ||
    ans === null ||
    ans === '' ||
    (Array.isArray(ans) && ans.length === 0)
  );
}

function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sumSq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return sumSq / (values.length - 1);
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den <= 1e-12) return null;
  return Number(Math.max(-1, Math.min(1, num / den)).toFixed(3));
}

function computeCronbachAlpha(matrix: number[][]): number | null {
  // matrix: rows = participants, cols = items
  const n = matrix.length;
  const k = matrix[0]?.length || 0;
  if (n < 2 || k < 2) return null;

  let sumItemVar = 0;
  for (let j = 0; j < k; j++) {
    const col = matrix.map((row) => row[j]);
    sumItemVar += sampleVariance(col);
  }
  const totalScores = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const totalVar = sampleVariance(totalScores);
  if (totalVar <= 1e-12) return null;

  const rawAlpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);
  return Number(Math.max(-1, Math.min(1, rawAlpha)).toFixed(3));
}

function classifyDifficulty(p: number): DifficultyCategory {
  if (p > 0.7) return 'Mudah';
  if (p >= 0.3) return 'Sedang';
  return 'Sukar';
}

function classifyDiscrimination(d: number | null): DiscriminationCategory {
  if (d === null) return 'Belum Cukup Data';
  if (d < 0) return 'Negatif';
  if (d < 0.2) return 'Jelek';
  if (d < 0.3) return 'Cukup';
  if (d < 0.4) return 'Baik';
  return 'Sangat Baik';
}

function classifyReliability(alpha: number | null): ReliabilityCategory {
  if (alpha === null) return 'Belum Cukup Data';
  if (alpha >= 0.8) return 'Sangat Tinggi';
  if (alpha >= 0.7) return 'Tinggi';
  if (alpha >= 0.6) return 'Cukup';
  if (alpha >= 0.4) return 'Rendah';
  return 'Sangat Rendah';
}

export function computeAnbusoReport(
  examId: string,
  examTitle: string,
  results: ExamResultItem[],
  questionsBank: Question[]
): ExamAnbusoReport {
  const questionMap = new Map<string, Question>();
  for (const q of questionsBank) {
    questionMap.set(q.id, q);
  }

  // Gather unique items attempted in this exam
  const itemBuckets = new Map<
    string,
    {
      questionId: string;
      questionCode: string;
      cognitiveLevel: CognitiveLevel;
      entries: Array<{
        result: ExamResultItem;
        detail: any;
        itemProportion: number;
      }>;
    }
  >();

  for (const res of results) {
    const details = Array.isArray(res.questionDetails) ? res.questionDetails : [];
    for (const qd of details) {
      const qid = String(qd?.questionId || '');
      if (!qid) continue;
      const master = questionMap.get(qid);
      const code = String(qd.questionCode || master?.code || qid);
      const cog = (qd.cognitiveLevel || master?.cognitiveLevel || 'MOTS') as CognitiveLevel;
      const maxPts = Number(qd.maxPoints) || Number(master?.points) || 10;
      const rawEarned = Number(qd.scoreEarned) || 0;
      const proportion =
        maxPts > 0
          ? Math.max(0, Math.min(1, rawEarned / maxPts))
          : qd.isCorrect
          ? 1
          : 0;

      if (!itemBuckets.has(qid)) {
        itemBuckets.set(qid, {
          questionId: qid,
          questionCode: code,
          cognitiveLevel: cog,
          entries: [],
        });
      }
      itemBuckets.get(qid)!.entries.push({
        result: res,
        detail: qd,
        itemProportion: proportion,
      });
    }
  }

  const allItemIds = Array.from(itemBuckets.keys());
  const participantCount = results.length;

  // Determine whether all participants took the exact same set of items
  const isCommonSet =
    participantCount >= 2 &&
    allItemIds.length >= 2 &&
    results.every((r) => {
      const ids = new Set((r.questionDetails || []).map((d: any) => String(d?.questionId || '')));
      return allItemIds.every((id) => ids.has(id));
    });

  // Compute Exam-level Reliability
  let examAlpha: number | null = null;
  let methodLabel = 'KR-20 / Cronbach Alpha';
  let reliabilityNote = '';
  const alphaIfDeletedMap = new Map<string, number | null>();

  if (participantCount < 2 || allItemIds.length < 2) {
    reliabilityNote =
      'Minimal dibutuhkan 2 peserta yang telah menyelesaikan ujian dan 2 butir soal untuk menghitung reliabilitas.';
  } else if (isCommonSet) {
    // Exact Cronbach's Alpha / KR-20 matrix
    const scoreLookup = new Map<string, Map<string, number>>();
    for (const r of results) {
      const rowMap = new Map<string, number>();
      for (const qd of r.questionDetails || []) {
        const qid = String(qd?.questionId || '');
        const maxPts = Number(qd.maxPoints) || 10;
        const prop = maxPts > 0 ? Math.max(0, Math.min(1, (Number(qd.scoreEarned) || 0) / maxPts)) : qd.isCorrect ? 1 : 0;
        rowMap.set(qid, prop);
      }
      scoreLookup.set(r.studentId, rowMap);
    }

    const matrix = results.map((r) =>
      allItemIds.map((qid) => scoreLookup.get(r.studentId)?.get(qid) ?? 0)
    );
    examAlpha = computeCronbachAlpha(matrix);
    methodLabel = 'KR-20 / Cronbach Alpha';

    if (allItemIds.length >= 3) {
      allItemIds.forEach((qid, omitIdx) => {
        const subMatrix = matrix.map((row) => row.filter((_, cIdx) => cIdx !== omitIdx));
        alphaIfDeletedMap.set(qid, computeCronbachAlpha(subMatrix));
      });
    }

    reliabilityNote =
      examAlpha === null
        ? 'Varians skor total peserta bernilai 0 sehingga koefisien reliabilitas belum dapat dihitung.'
        : 'Dihitung menggunakan rumus reliabilitas konsistensi internal KR-20 / Cronbach Alpha pada seluruh peserta.';
  } else {
    // Dynamic randomized subset mode: compute average pairwise inter-item correlation
    methodLabel = 'Standardized Alpha (Paket Acak)';
    const itemStudentMaps = new Map<string, Map<string, number>>();
    for (const qid of allItemIds) {
      const m = new Map<string, number>();
      for (const e of itemBuckets.get(qid)!.entries) {
        m.set(e.result.studentId, e.itemProportion);
      }
      itemStudentMaps.set(qid, m);
    }

    const correlations: number[] = [];
    for (let i = 0; i < allItemIds.length; i++) {
      for (let j = i + 1; j < allItemIds.length; j++) {
        const mapA = itemStudentMaps.get(allItemIds[i])!;
        const mapB = itemStudentMaps.get(allItemIds[j])!;
        const xs: number[] = [];
        const ys: number[] = [];
        for (const [sid, valA] of mapA.entries()) {
          if (mapB.has(sid)) {
            xs.push(valA);
            ys.push(mapB.get(sid)!);
          }
        }
        if (xs.length >= 3) {
          const r = pearsonCorrelation(xs, ys);
          if (r !== null) correlations.push(r);
        }
      }
    }

    const avgItemsPerStudent =
      results.reduce((sum, r) => sum + (r.questionDetails?.length || 0), 0) / participantCount;

    if (correlations.length > 0 && avgItemsPerStudent >= 2) {
      const rBar = correlations.reduce((a, b) => a + b, 0) / correlations.length;
      const kEff = Math.max(2, Math.round(avgItemsPerStudent));
      const denom = 1 + (kEff - 1) * rBar;
      if (Math.abs(denom) > 1e-6) {
        examAlpha = Number(Math.max(-1, Math.min(1, (kEff * rBar) / denom)).toFixed(3));
      }
      reliabilityNote =
        'Peserta menerima paket soal acak dinamis; reliabilitas diestimasi melalui Standardized Cronbach Alpha dari rata-rata korelasi antar butir.';
    } else {
      reliabilityNote =
        'Belum cukup irisan butir soal yang sama antar peserta untuk mengestimasi koefisien reliabilitas paket acak.';
    }
  }

  // Standard Error of Measurement (SEM)
  const finalScores = results.map((r) => Number(r.finalScore) || 0);
  const scoreSd = Math.sqrt(sampleVariance(finalScores));
  const sem =
    examAlpha !== null && participantCount >= 2
      ? Number((scoreSd * Math.sqrt(Math.max(0, 1 - Math.max(0, examAlpha)))).toFixed(2))
      : null;

  // Build per-item analyses
  const items: ItemAnbusoAnalysis[] = [];

  for (const bucket of itemBuckets.values()) {
    const master = questionMap.get(bucket.questionId);
    const qType: QuestionType = master?.type || 'pg';
    const rawHtml = master?.questionText || `Butir Soal ${bucket.questionCode}`;
    const preview = stripHtmlToText(rawHtml) || `Soal ${bucket.questionCode}`;

    const n = bucket.entries.length;
    let correctCount = 0;
    let wrongCount = 0;
    let emptyCount = 0;
    let sumProportion = 0;

    for (const entry of bucket.entries) {
      const ans = entry.detail?.studentAnswer;
      const empty = isUnansweredValue(ans);
      if (empty) {
        emptyCount++;
      } else if (entry.detail?.isCorrect) {
        correctCount++;
      } else if (!entry.detail?.pendingManualGrade) {
        wrongCount++;
      }
      sumProportion += entry.itemProportion;
    }

    // 1. Difficulty
    const difficultyIndex = n > 0 ? Number((sumProportion / n).toFixed(3)) : 0;
    const difficultyPct = Math.round(difficultyIndex * 100);
    const difficultyCategory = classifyDifficulty(difficultyIndex);

    // 2. Discrimination (Upper vs Lower groups & Point-Biserial)
    const sortedEntries = [...bucket.entries].sort((a, b) => {
      const diff = (Number(b.result.finalScore) || 0) - (Number(a.result.finalScore) || 0);
      if (diff !== 0) return diff;
      return (Number(b.result.correctCount) || 0) - (Number(a.result.correctCount) || 0);
    });

    const groupSize = n >= 10 ? Math.max(1, Math.round(n * 0.27)) : n >= 2 ? Math.floor(n / 2) : 0;
    const upperEntries = groupSize > 0 ? sortedEntries.slice(0, groupSize) : [];
    const lowerEntries = groupSize > 0 ? sortedEntries.slice(n - groupSize) : [];

    const upperAccuracy =
      upperEntries.length > 0
        ? Number(
            (
              upperEntries.reduce((s, e) => s + e.itemProportion, 0) / upperEntries.length
            ).toFixed(3)
          )
        : 0;
    const lowerAccuracy =
      lowerEntries.length > 0
        ? Number(
            (
              lowerEntries.reduce((s, e) => s + e.itemProportion, 0) / lowerEntries.length
            ).toFixed(3)
          )
        : 0;

    const discriminationIndex =
      n >= 2 && groupSize >= 1 ? Number((upperAccuracy - lowerAccuracy).toFixed(3)) : null;
    const discriminationCategory = classifyDiscrimination(discriminationIndex);

    // Point-biserial (item score vs corrected total score of OTHER items)
    const itemScores = bucket.entries.map((e) => e.itemProportion);
    const otherTotals = bucket.entries.map((e) => {
      const others = (e.result.questionDetails || []).filter(
        (d: any) => String(d?.questionId || '') !== bucket.questionId
      );
      if (others.length === 0) return Number(e.result.finalScore) || 0;
      const earnedSum = others.reduce((s: number, d: any) => s + (Number(d?.scoreEarned) || 0), 0);
      const maxSum = others.reduce((s: number, d: any) => s + (Number(d?.maxPoints) || 10), 0);
      return maxSum > 0 ? (earnedSum / maxSum) * 100 : Number(e.result.finalScore) || 0;
    });
    const pointBiserial = pearsonCorrelation(itemScores, otherTotals);

    // 3. Distractor Analysis
    const upperIds = new Set(upperEntries.map((e) => e.result.studentId));
    const lowerIds = new Set(lowerEntries.map((e) => e.result.studentId));

    let distractorApplicable = qType === 'pg' || qType === 'pg_kompleks' || qType === 'benar_salah';
    const distractorOptions: DistractorOptionStat[] = [];
    let effectiveDistractorCount = 0;
    let totalDistractorCount = 0;
    let correctAnswerDisplay = '-';

    if (qType === 'pg' || qType === 'pg_kompleks') {
      const keySet = new Set<string>(
        Array.isArray(master?.correctAnswer)
          ? master!.correctAnswer.map((v: any) => String(v).trim().toUpperCase())
          : master?.correctAnswer
          ? [String(master.correctAnswer).trim().toUpperCase()]
          : []
      );
      correctAnswerDisplay = keySet.size > 0 ? Array.from(keySet).sort().join(', ') : '-';

      const opts =
        Array.isArray(master?.options) && master!.options.length > 0
          ? master!.options
          : Array.from(
              new Set([
                ...Array.from(keySet),
                ...bucket.entries.flatMap((e) => {
                  const ans = e.detail?.studentAnswer;
                  if (Array.isArray(ans)) return ans.map((x: any) => String(x).trim().toUpperCase());
                  if (!isUnansweredValue(ans)) return [String(ans).trim().toUpperCase()];
                  return [];
                }),
              ])
            )
              .sort()
              .map((id) => ({ id, text: `Opsi ${id}` }));

      for (const opt of opts) {
        const optId = String(opt.id).trim().toUpperCase();
        const isKey = keySet.has(optId);
        let chosenCount = 0;
        let upperCount = 0;
        let lowerCount = 0;

        for (const e of bucket.entries) {
          const ans = e.detail?.studentAnswer;
          const selected = Array.isArray(ans)
            ? ans.map((x: any) => String(x).trim().toUpperCase()).includes(optId)
            : !isUnansweredValue(ans) && String(ans).trim().toUpperCase() === optId;
          if (selected) {
            chosenCount++;
            if (upperIds.has(e.result.studentId)) upperCount++;
            if (lowerIds.has(e.result.studentId)) lowerCount++;
          }
        }

        const chosenPct = n > 0 ? Math.round((chosenCount / n) * 100) : 0;
        let status: DistractorOptionStat['status'] = 'tidak_berfungsi';
        if (isKey) {
          status = 'kunci';
        } else {
          totalDistractorCount++;
          if (chosenPct >= 5) {
            status = 'efektif';
            effectiveDistractorCount++;
          }
        }

        distractorOptions.push({
          optionId: optId,
          optionText: stripHtmlToText(opt.text) || `Opsi ${optId}`,
          isKey,
          chosenCount,
          chosenPct,
          upperCount,
          lowerCount,
          status,
        });
      }
    } else if (qType === 'benar_salah') {
      const keyVal = master?.correctAnswer ? String(master.correctAnswer).trim() : '';
      correctAnswerDisplay = keyVal || '-';
      for (const label of ['Benar', 'Salah']) {
        const isKey = keyVal.toLowerCase() === label.toLowerCase();
        let chosenCount = 0;
        let upperCount = 0;
        let lowerCount = 0;
        for (const e of bucket.entries) {
          const ans = e.detail?.studentAnswer;
          if (!isUnansweredValue(ans) && String(ans).trim().toLowerCase() === label.toLowerCase()) {
            chosenCount++;
            if (upperIds.has(e.result.studentId)) upperCount++;
            if (lowerIds.has(e.result.studentId)) lowerCount++;
          }
        }
        const chosenPct = n > 0 ? Math.round((chosenCount / n) * 100) : 0;
        let status: DistractorOptionStat['status'] = 'tidak_berfungsi';
        if (isKey) {
          status = 'kunci';
        } else {
          totalDistractorCount++;
          if (chosenPct >= 5) {
            status = 'efektif';
            effectiveDistractorCount++;
          }
        }
        distractorOptions.push({
          optionId: label,
          optionText: label,
          isKey,
          chosenCount,
          chosenPct,
          upperCount,
          lowerCount,
          status,
        });
      }
    } else {
      distractorApplicable = false;
      correctAnswerDisplay = master?.rubric ? stripHtmlToText(master.rubric) : 'Rubrik Uraian';
    }

    const distractorSummary = !distractorApplicable
      ? 'N/A (Uraian)'
      : totalDistractorCount === 0
      ? 'Tidak ada pengecoh'
      : `${effectiveDistractorCount}/${totalDistractorCount} Pengecoh Efektif`;

    // 4. Reliabilitas (Item-level contribution)
    const alphaIfDeleted = alphaIfDeletedMap.get(bucket.questionId) ?? null;
    let reliabilityImpact: ItemAnbusoAnalysis['reliabilityImpact'] = 'belum_cukup';
    let reliabilityNote = 'Belum cukup data korelasi';

    if (examAlpha !== null && alphaIfDeleted !== null) {
      const delta = alphaIfDeleted - examAlpha;
      if (delta > 0.015 || (pointBiserial !== null && pointBiserial < 0)) {
        reliabilityImpact = 'menurunkan';
        reliabilityNote = `Jika dihapus α naik ke ${alphaIfDeleted.toFixed(3)}`;
      } else if (delta < -0.005 || (pointBiserial !== null && pointBiserial >= 0.2)) {
        reliabilityImpact = 'mendukung';
        reliabilityNote = `Jika dihapus α turun ke ${alphaIfDeleted.toFixed(3)}`;
      } else {
        reliabilityImpact = 'netral';
        reliabilityNote = `Kontribusi netral (α tanpa soal: ${alphaIfDeleted.toFixed(3)})`;
      }
    } else if (pointBiserial !== null) {
      if (pointBiserial < 0) {
        reliabilityImpact = 'menurunkan';
        reliabilityNote = `Korelasi butir-total negatif (r = ${pointBiserial})`;
      } else if (pointBiserial >= 0.2) {
        reliabilityImpact = 'mendukung';
        reliabilityNote = `Konsisten dengan skor total (r = ${pointBiserial})`;
      } else {
        reliabilityImpact = 'netral';
        reliabilityNote = `Korelasi butir-total lemah (r = ${pointBiserial})`;
      }
    }

    // 5. Decision Synthesis
    let decision: DecisionStatus = 'Perlu Data';
    let decisionReason = '';

    if (n < 2) {
      decision = 'Perlu Data';
      decisionReason =
        'Minimal 2 murid mengerjakan soal ini agar daya pembeda dan kelayakan butir dapat diputuskan.';
    } else if (
      discriminationIndex !== null &&
      (discriminationIndex < 0 ||
        (discriminationIndex < 0.2 && (difficultyIndex < 0.15 || difficultyIndex > 0.9)))
    ) {
      decision = 'Dibuang / Diganti';
      decisionReason =
        discriminationIndex < 0
          ? 'Daya pembeda negatif: peserta kelompok bawah lebih banyak menjawab benar dibanding kelompok atas. Periksa kunci atau ganti soal.'
          : 'Daya pembeda sangat lemah dan tingkat kesukaran ekstrem (terlalu sukar/mudah). Disarankan diganti.';
    } else if (
      (discriminationIndex !== null && discriminationIndex < 0.2) ||
      difficultyIndex < 0.2 ||
      difficultyIndex > 0.85
    ) {
      decision = 'Revisi Soal';
      const issues: string[] = [];
      if (discriminationIndex !== null && discriminationIndex < 0.2) {
        issues.push(`daya pembeda lemah (D=${discriminationIndex.toFixed(2)})`);
      }
      if (difficultyIndex < 0.2) issues.push(`terlalu sukar (P=${difficultyIndex.toFixed(2)})`);
      if (difficultyIndex > 0.85) issues.push(`terlalu mudah (P=${difficultyIndex.toFixed(2)})`);
      decisionReason = `Butir soal perlu direvisi pada redaksi/indikator karena ${issues.join(' & ')}.`;
    } else if (
      distractorApplicable &&
      totalDistractorCount > 0 &&
      effectiveDistractorCount < totalDistractorCount
    ) {
      decision = 'Revisi Pengecoh';
      const deadCount = totalDistractorCount - effectiveDistractorCount;
      decisionReason = `Kesukaran dan daya pembeda sudah baik, namun ${deadCount} opsi pengecoh dipilih <5% peserta sehingga perlu diperbaiki.`;
    } else {
      decision = 'Diterima';
      decisionReason =
        'Tingkat kesukaran seimbang, daya pembeda baik, pengecoh berfungsi, dan mendukung reliabilitas tes. Layak dipertahankan di bank soal.';
    }

    items.push({
      questionId: bucket.questionId,
      questionCode: bucket.questionCode,
      questionType: qType,
      cognitiveLevel: bucket.cognitiveLevel,
      questionTextPreview: preview,
      questionHtml: rawHtml,
      correctAnswerDisplay,
      respondentCount: n,
      correctCount,
      wrongCount,
      emptyCount,
      difficultyIndex,
      difficultyPct,
      difficultyCategory,
      upperAccuracy,
      lowerAccuracy,
      discriminationIndex,
      discriminationCategory,
      pointBiserial,
      distractorApplicable,
      distractorOptions,
      effectiveDistractorCount,
      totalDistractorCount,
      distractorSummary,
      itemTotalCorrelation: pointBiserial,
      alphaIfDeleted,
      reliabilityImpact,
      reliabilityNote,
      decision,
      decisionReason,
    });
  }

  // Sort items naturally by questionCode (e.g., FIS-001, FIS-002, ...)
  items.sort((a, b) =>
    a.questionCode.localeCompare(b.questionCode, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Summary counts
  const decisionCounts: Record<DecisionStatus, number> = {
    Diterima: 0,
    'Revisi Pengecoh': 0,
    'Revisi Soal': 0,
    'Dibuang / Diganti': 0,
    'Perlu Data': 0,
  };
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  let goodDiscriminationCount = 0;
  const discValues: number[] = [];

  for (const item of items) {
    decisionCounts[item.decision]++;
    if (item.difficultyCategory === 'Mudah') easyCount++;
    else if (item.difficultyCategory === 'Sedang') mediumCount++;
    else hardCount++;

    if (item.discriminationIndex !== null) {
      discValues.push(item.discriminationIndex);
      if (item.discriminationIndex >= 0.3) goodDiscriminationCount++;
    }
  }

  const avgDifficulty =
    items.length > 0
      ? Number((items.reduce((s, it) => s + it.difficultyIndex, 0) / items.length).toFixed(2))
      : 0;
  const avgDiscrimination =
    discValues.length > 0
      ? Number((discValues.reduce((s, v) => s + v, 0) / discValues.length).toFixed(2))
      : null;

  return {
    examId,
    examTitle,
    participantCount,
    analyzedItemCount: items.length,
    isDynamicSubset: !isCommonSet && participantCount >= 2 && items.length >= 2,
    reliability: {
      alpha: examAlpha,
      methodLabel,
      category: classifyReliability(examAlpha),
      sem,
      note: reliabilityNote,
    },
    summary: {
      avgDifficulty,
      avgDiscrimination,
      easyCount,
      mediumCount,
      hardCount,
      goodDiscriminationCount,
      decisionCounts,
    },
    items,
  };
}
