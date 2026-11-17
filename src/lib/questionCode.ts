export interface QuestionCodeSubject {
  id: string;
  name?: string;
  code?: string;
}

export interface QuestionCodeItem {
  id?: string;
  subjectId?: string;
  code?: string;
  createdAt?: string;
}

export function normalizeSubjectPrefix(subject?: QuestionCodeSubject | null): string {
  const rawCode = (subject?.code || '').trim().toUpperCase();
  if (rawCode) {
    const cleaned = rawCode.replace(/[^A-Z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (cleaned) return cleaned;
  }

  const rawName = (subject?.name || '').trim().toUpperCase();
  if (rawName) {
    const words = rawName.split(/\s+/).filter(Boolean);
    const alphaPart = (words[0] || '').replace(/[^A-Z]/g, '').slice(0, 3);
    const numPart = words.slice(1).find((w) => /^\d+$/.test(w));
    if (alphaPart && numPart) return `${alphaPart}-${numPart}`;
    if (alphaPart) return alphaPart;
  }

  return 'SOAL';
}

export function getSubjectCodePrefix(
  subjectId: string | undefined,
  subjects: QuestionCodeSubject[]
): string {
  if (!subjectId) return 'SOAL';
  const subject = subjects.find((s) => s.id === subjectId);
  return normalizeSubjectPrefix(subject);
}

export function formatQuestionCode(prefix: string, seq: number): string {
  const safeSeq = Math.max(1, Math.floor(seq));
  return `${prefix}-${String(safeSeq).padStart(4, '0')}`;
}

export function generateNextQuestionCode(
  subjectId: string | undefined,
  existingQuestions: QuestionCodeItem[],
  subjects: QuestionCodeSubject[],
  excludeQuestionId?: string
): string {
  const prefix = getSubjectCodePrefix(subjectId, subjects);
  const existingCodesUpper = new Set<string>();
  const takenSeqs = new Set<number>();

  const prefixPattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');

  for (const q of existingQuestions) {
    if (excludeQuestionId && q.id === excludeQuestionId) continue;
    const raw = (q.code || '').trim().toUpperCase();
    if (!raw) continue;
    existingCodesUpper.add(raw);
    const match = raw.match(prefixPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num >= 1) {
        takenSeqs.add(num);
      }
    }
  }

  let seq = 1;
  while (takenSeqs.has(seq) || existingCodesUpper.has(formatQuestionCode(prefix, seq))) {
    seq++;
  }
  return formatQuestionCode(prefix, seq);
}

export function isQuestionCodeDuplicate(
  code: string,
  existingQuestions: QuestionCodeItem[],
  excludeQuestionId?: string
): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return existingQuestions.some((q) => {
    if (excludeQuestionId && q.id === excludeQuestionId) return false;
    return (q.code || '').trim().toUpperCase() === normalized;
  });
}

export function assignMissingQuestionCodes<T extends QuestionCodeItem>(
  questions: T[],
  subjects: QuestionCodeSubject[]
): { questions: T[]; updatedQuestions: T[] } {
  const usedCodes = new Set<string>();
  const needsCodeIds = new Set<string>();

  // Sort deterministically so oldest/lowest-id items retain or receive the smallest numbers
  const indexed = questions.map((q, idx) => ({ q, idx }));
  const chronological = [...indexed].sort((a, b) => {
    const timeA = a.q.createdAt || '';
    const timeB = b.q.createdAt || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return (a.q.id || '').localeCompare(b.q.id || '');
  });

  const normalizedByIdx = new Map<number, T>();
  for (const { q, idx } of chronological) {
    const cleanCode = (q.code || '').trim().toUpperCase();
    if (cleanCode && !usedCodes.has(cleanCode)) {
      usedCodes.add(cleanCode);
      normalizedByIdx.set(idx, cleanCode === q.code ? q : { ...q, code: cleanCode });
    } else {
      needsCodeIds.add(q.id || String(idx));
      normalizedByIdx.set(idx, { ...q, code: '' });
    }
  }

  const updatedQuestions: T[] = [];
  const runningPool: QuestionCodeItem[] = Array.from(normalizedByIdx.values());

  for (const { q, idx } of chronological) {
    const current = normalizedByIdx.get(idx)!;
    if (!current.code) {
      const nextCode = generateNextQuestionCode(q.subjectId, runningPool, subjects, q.id);
      const updated = { ...current, code: nextCode };
      normalizedByIdx.set(idx, updated);
      runningPool.push({ id: q.id, subjectId: q.subjectId, code: nextCode });
      updatedQuestions.push(updated);
    } else if (current.code !== q.code) {
      updatedQuestions.push(current);
    }
  }

  const finalQuestions = questions.map((_, idx) => normalizedByIdx.get(idx)!);
  return { questions: finalQuestions, updatedQuestions };
}
