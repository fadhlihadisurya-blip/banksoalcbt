import { RemedialMode, RemedialWrongQuestionMeta } from '../types/cbt';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function extractWrongQuestionDetails(
  result: any,
  allQuestions: any[]
): RemedialWrongQuestionMeta[] {
  const qMap = new Map<string, any>(
    (allQuestions || []).map((q: any) => [String(q.id), q])
  );
  const details = Array.isArray(result?.questionDetails) ? result.questionDetails : [];
  const wrongDetails = details.filter((qd: any) => !qd?.isCorrect);

  return wrongDetails.map((qd: any) => {
    const qId = String(qd?.questionId || '');
    const master = qMap.get(qId);
    return {
      questionId: qId,
      questionCode: qd?.questionCode || master?.code || '',
      competencyId: master?.competencyId ?? qd?.competencyId ?? null,
      subchapterId: master?.subchapterId ?? qd?.subchapterId ?? null,
      chapterId: master?.chapterId ?? null,
      cognitiveLevel: master?.cognitiveLevel || qd?.cognitiveLevel || 'MOTS',
      maxPoints: Number(qd?.maxPoints) || Number(master?.points) || 10,
    };
  });
}

export function selectRemedialQuestions(params: {
  mode: RemedialMode;
  wrongQuestions: RemedialWrongQuestionMeta[];
  originalQuestionDetails: any[];
  allQuestions: any[];
  examSubjectId: string;
  requiredCount?: number;
  previousQuestionIds?: string[];
}): { questionIds: string[]; fallbackUsedCount: number } {
  const {
    mode,
    wrongQuestions,
    originalQuestionDetails,
    allQuestions,
    examSubjectId,
    requiredCount,
    previousQuestionIds,
  } = params;
  const activeQuestions = (allQuestions || []).filter((q: any) => q.status !== 'inactive');
  const allQuestionMap = new Map<string, any>((allQuestions || []).map((q: any) => [String(q.id), q]));

  const originalQuestionIds = new Set<string>(
    (originalQuestionDetails || [])
      .map((qd: any) => String(qd?.questionId || ''))
      .filter(Boolean)
  );
  const previousSet = new Set<string>((previousQuestionIds || []).map((id) => String(id)));

  // Fallback target items if wrongQuestions empty (edge case)
  const targetItems: RemedialWrongQuestionMeta[] =
    wrongQuestions.length > 0
      ? wrongQuestions
      : (originalQuestionDetails || []).slice(0, 3).map((qd: any) => {
          const master = allQuestionMap.get(String(qd?.questionId || ''));
          return {
            questionId: String(qd?.questionId || ''),
            questionCode: qd?.questionCode || master?.code || '',
            competencyId: master?.competencyId ?? qd?.competencyId ?? null,
            subchapterId: master?.subchapterId ?? qd?.subchapterId ?? null,
            chapterId: master?.chapterId ?? null,
          };
        });

  const enforceExactCount = (ids: string[]) => {
    if (!requiredCount || requiredCount <= 0) return ids;
    const out = [...ids];
    if (out.length > requiredCount) return out.slice(0, requiredCount);
    const padPool = [
      ...(previousQuestionIds || []),
      ...targetItems.map((item) => item.questionId),
    ].filter((qid) => allQuestionMap.has(qid));
    for (const qid of padPool) {
      if (out.length >= requiredCount) break;
      if (!out.includes(qid)) out.push(qid);
    }
    let idx = 0;
    while (out.length < requiredCount && padPool.length > 0) {
      out.push(padPool[idx % padPool.length]);
      idx++;
    }
    return out;
  };

  if (mode === 'same_wrong') {
    const validIds = targetItems
      .map((item) => item.questionId)
      .filter((qid) => allQuestionMap.has(qid));
    return {
      questionIds: enforceExactCount(validIds),
      fallbackUsedCount: 0,
    };
  }

  // Mode: 'random_same_competency'
  // For each wrong item, pick 1 random active question from the exact same sub-sub-bab (competencyId)
  const pickedIds: string[] = [];
  const pickedSet = new Set<string>();
  let fallbackUsedCount = 0;

  for (const wrongItem of targetItems) {
    const master = allQuestionMap.get(wrongItem.questionId);
    const compId = wrongItem.competencyId || master?.competencyId || null;
    const subId = wrongItem.subchapterId || master?.subchapterId || null;
    const chapId = wrongItem.chapterId || master?.chapterId || null;
    const subjId = master?.subjectId || examSubjectId || '';

    const matchSameCompetency = (q: any) =>
      compId ? q.competencyId === compId : subId ? q.subchapterId === subId : chapId ? q.chapterId === chapId : q.subjectId === subjId;

    // Tier 1: Same sub-sub-bab, NOT in original exam, NOT in previous remedial attempt, NOT yet picked
    let candidates = activeQuestions.filter(
      (q: any) =>
        matchSameCompetency(q) &&
        !originalQuestionIds.has(q.id) &&
        !previousSet.has(q.id) &&
        !pickedSet.has(q.id)
    );

    // Tier 1b: Same sub-sub-bab, NOT in original exam, NOT yet picked
    if (candidates.length === 0) {
      candidates = activeQuestions.filter(
        (q: any) => matchSameCompetency(q) && !originalQuestionIds.has(q.id) && !pickedSet.has(q.id)
      );
    }

    // Tier 2: Same sub-sub-bab, NOT yet picked (may overlap original if bank has no other unused question)
    if (candidates.length === 0) {
      candidates = activeQuestions.filter(
        (q: any) => matchSameCompetency(q) && !pickedSet.has(q.id)
      );
      if (candidates.length > 0) fallbackUsedCount += 1;
    }

    // Tier 3: Same sub-bab (not yet picked)
    if (candidates.length === 0 && subId) {
      candidates = activeQuestions.filter(
        (q: any) => q.subchapterId === subId && !pickedSet.has(q.id)
      );
      if (candidates.length > 0) fallbackUsedCount += 1;
    }

    // Tier 4: Same chapter / subject (not yet picked)
    if (candidates.length === 0 && subjId) {
      candidates = activeQuestions.filter(
        (q: any) =>
          (chapId ? q.chapterId === chapId : q.subjectId === subjId) && !pickedSet.has(q.id)
      );
      if (candidates.length > 0) fallbackUsedCount += 1;
    }

    // Tier 5: Exact same sub-sub-bab including already picked or original question to keep exact count
    if (candidates.length === 0) {
      candidates = activeQuestions.filter((q: any) => matchSameCompetency(q));
      if (candidates.length > 0) fallbackUsedCount += 1;
    }

    if (candidates.length > 0) {
      const chosen = shuffleArray(candidates)[0];
      pickedIds.push(String(chosen.id));
      pickedSet.add(String(chosen.id));
    } else if (allQuestionMap.has(wrongItem.questionId)) {
      pickedIds.push(wrongItem.questionId);
      fallbackUsedCount += 1;
    }
  }

  return {
    questionIds: enforceExactCount(pickedIds),
    fallbackUsedCount,
  };
}

export function computePointsPerCorrectForRemedial(params: {
  baseScore: number;
  kktpScore: number;
  maxScore: number;
  originalTotalQuestions: number;
  remedialQuestionCount: number;
}): number {
  const maxScore = Number(params.maxScore) || 100;
  const kktpScore = Number(params.kktpScore) || 75;
  const baseScore = Number(params.baseScore) || 0;
  const totalOrig = Math.max(1, Number(params.originalTotalQuestions) || 1);
  const remCount = Math.max(1, Number(params.remedialQuestionCount) || 1);

  const perOriginalQuestion = maxScore / totalOrig;
  const minNeededPerRemedial = baseScore < kktpScore ? (kktpScore - baseScore) / remCount : 0;

  return Number(Math.max(perOriginalQuestion, minNeededPerRemedial).toFixed(4));
}

export function computeRemedialFinalScore(params: {
  baseScore: number;
  kktpScore: number;
  pointsPerCorrect: number;
  correctUnits: number;
}): {
  rawAddedScore: number;
  addedScore: number;
  finalCappedScore: number;
  isPassed: boolean;
} {
  const baseScore = Number(params.baseScore) || 0;
  const kktpScore = Number(params.kktpScore) || 75;
  const pointsPerCorrect = Math.max(0, Number(params.pointsPerCorrect) || 0);
  const correctUnits = Math.max(0, Number(params.correctUnits) || 0);

  const rawAddedScore = Math.round(correctUnits * pointsPerCorrect * 100) / 100;
  const uncappedTotal = Math.round(baseScore + rawAddedScore);
  const finalCappedScore = Math.min(kktpScore, Math.max(baseScore, uncappedTotal));
  const addedScore = Math.max(0, finalCappedScore - baseScore);
  const isPassed = finalCappedScore >= kktpScore;

  return {
    rawAddedScore,
    addedScore,
    finalCappedScore,
    isPassed,
  };
}

export function computeRemedialDuration(params: {
  examDurationMinutes: number;
  examTotalQuestions: number;
  remedialQuestionCount: number;
}): {
  durationMinutes: number;
  durationSeconds: number;
} {
  const totalMinutes = Math.max(1, Number(params.examDurationMinutes) || 60);
  const totalQuestions = Math.max(1, Number(params.examTotalQuestions) || 1);
  const remedialCount = Math.max(1, Number(params.remedialQuestionCount) || 1);

  const exactMinutes = (totalMinutes / totalQuestions) * remedialCount;
  const durationSeconds = Math.max(60, Math.round(exactMinutes * 60));
  const durationMinutes = Math.max(1, Math.round((durationSeconds / 60) * 10) / 10);

  return {
    durationMinutes,
    durationSeconds,
  };
}

