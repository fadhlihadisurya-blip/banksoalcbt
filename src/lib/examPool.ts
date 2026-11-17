export interface ExamTaxonomyScope {
  subjectId?: string;
  selectedChapterIds?: string[];
  selectedSubchapterIds?: string[];
  selectedCompetencyIds?: string[];
}

export interface TaxonomyDataset {
  subchapters?: Array<{ id: string; chapterId: string }>;
  competencies?: Array<{ id: string; subchapterId: string }>;
}

export function isQuestionInExamScope(
  question: any,
  scope: ExamTaxonomyScope,
  taxonomy?: TaxonomyDataset
): boolean {
  if (!question || question.status !== 'active') return false;
  if (scope.subjectId && question.subjectId !== scope.subjectId) return false;

  const chIds = Array.isArray(scope.selectedChapterIds) ? scope.selectedChapterIds : undefined;
  const subIds = Array.isArray(scope.selectedSubchapterIds) ? scope.selectedSubchapterIds : undefined;
  const cmpIds = Array.isArray(scope.selectedCompetencyIds) ? scope.selectedCompetencyIds : undefined;

  // Legacy exam without any taxonomy scope arrays
  if (!chIds && !subIds && !cmpIds) return true;

  const hasAnySelection =
    (chIds && chIds.length > 0) ||
    (subIds && subIds.length > 0) ||
    (cmpIds && cmpIds.length > 0);

  if (!hasAnySelection) return false;

  const subSet = new Set(subIds || []);
  const cmpSet = new Set(cmpIds || []);
  const chSet = new Set(chIds || []);

  // Legacy mode: only selectedChapterIds was populated
  if (subSet.size === 0 && cmpSet.size === 0 && chSet.size > 0) {
    return chSet.has(question.chapterId);
  }

  // Direct competency match takes highest precedence when competency is set on the question
  if (question.competencyId) {
    const subHasCompetencies =
      taxonomy?.competencies?.some((c) => c.subchapterId === question.subchapterId) ?? cmpSet.size > 0;
    if (subHasCompetencies || cmpSet.size > 0) {
      return cmpSet.has(question.competencyId);
    }
  }

  // Subchapter match when question has a subchapterId
  if (question.subchapterId) {
    const chapterHasSubchapters =
      taxonomy?.subchapters?.some((s) => s.chapterId === question.chapterId) ?? subSet.size > 0;
    if (chapterHasSubchapters || subSet.size > 0) {
      return subSet.has(question.subchapterId);
    }
  }

  // Fallback to chapter match (e.g. chapter has no subchapters yet or question only tagged to chapter)
  return chSet.has(question.chapterId);
}

export function getQuestionWeightForExam(question: any, exam?: any): number {
  const cog = question?.cognitiveLevel;
  const target = exam?.cognitiveTarget;
  if (target) {
    if (cog === 'LOTS' && typeof target.lotsWeight === 'number' && !Number.isNaN(target.lotsWeight)) {
      return Math.max(0, target.lotsWeight);
    }
    if (cog === 'MOTS' && typeof target.motsWeight === 'number' && !Number.isNaN(target.motsWeight)) {
      return Math.max(0, target.motsWeight);
    }
    if (cog === 'HOTS' && typeof target.hotsWeight === 'number' && !Number.isNaN(target.hotsWeight)) {
      return Math.max(0, target.hotsWeight);
    }
  }
  return Number(question?.points) || 10;
}

export interface ScopeTargetUnit {
  scopeType: 'competency' | 'subchapter' | 'chapter';
  scopeId: string;
  chapterId: string;
  subchapterId?: string;
  competencyId?: string;
  label?: string;
  lotsCount: number;
  motsCount: number;
  hotsCount: number;
}

export function questionMatchesScopeUnit(question: any, unit: ScopeTargetUnit): boolean {
  if (!question) return false;
  if (unit.scopeType === 'competency') {
    return question.competencyId === (unit.competencyId || unit.scopeId);
  }
  if (unit.scopeType === 'subchapter') {
    return question.subchapterId === (unit.subchapterId || unit.scopeId);
  }
  return question.chapterId === (unit.chapterId || unit.scopeId);
}

export function evaluateScopeAvailability(
  activePool: any[],
  cognitiveTarget?: {
    lotsCount?: number;
    motsCount?: number;
    hotsCount?: number;
    perScopeTargets?: ScopeTargetUnit[];
  }
) {
  const availableLots = activePool.filter((q: any) => q.cognitiveLevel === 'LOTS').length;
  const availableMots = activePool.filter((q: any) => q.cognitiveLevel === 'MOTS').length;
  const availableHots = activePool.filter((q: any) => q.cognitiveLevel === 'HOTS').length;

  const targetLots = Number(cognitiveTarget?.lotsCount || 0);
  const targetMots = Number(cognitiveTarget?.motsCount || 0);
  const targetHots = Number(cognitiveTarget?.hotsCount || 0);

  const perScope: Record<
    string,
    {
      label?: string;
      lots: { available: number; required: number; sufficient: boolean };
      mots: { available: number; required: number; sufficient: boolean };
      hots: { available: number; required: number; sufficient: boolean };
      isValid: boolean;
    }
  > = {};

  const units = Array.isArray(cognitiveTarget?.perScopeTargets)
    ? cognitiveTarget!.perScopeTargets!
    : [];

  for (const unit of units) {
    const key = `${unit.scopeType}:${unit.scopeId}`;
    const unitPool = activePool.filter((q) => questionMatchesScopeUnit(q, unit));
    const uLotsAvail = unitPool.filter((q) => q.cognitiveLevel === 'LOTS').length;
    const uMotsAvail = unitPool.filter((q) => q.cognitiveLevel === 'MOTS').length;
    const uHotsAvail = unitPool.filter((q) => q.cognitiveLevel === 'HOTS').length;

    const uLotsReq = Number(unit.lotsCount || 0);
    const uMotsReq = Number(unit.motsCount || 0);
    const uHotsReq = Number(unit.hotsCount || 0);

    const lotsSufficient = uLotsAvail >= uLotsReq;
    const motsSufficient = uMotsAvail >= uMotsReq;
    const hotsSufficient = uHotsAvail >= uHotsReq;

    perScope[key] = {
      label: unit.label,
      lots: { available: uLotsAvail, required: uLotsReq, sufficient: lotsSufficient },
      mots: { available: uMotsAvail, required: uMotsReq, sufficient: motsSufficient },
      hots: { available: uHotsAvail, required: uHotsReq, sufficient: hotsSufficient },
      isValid: lotsSufficient && motsSufficient && hotsSufficient,
    };
  }

  const allNodesValid =
    units.length === 0 ? true : Object.values(perScope).every((node) => node.isValid);

  const isValid =
    allNodesValid &&
    availableLots >= targetLots &&
    availableMots >= targetMots &&
    availableHots >= targetHots;

  return {
    isValid,
    totalAvailable: activePool.length,
    lots: { available: availableLots, required: targetLots, sufficient: availableLots >= targetLots },
    mots: { available: availableMots, required: targetMots, sufficient: availableMots >= targetMots },
    hots: { available: availableHots, required: targetHots, sufficient: availableHots >= targetHots },
    perScope,
  };
}
