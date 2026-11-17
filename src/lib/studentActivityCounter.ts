import { useEffect, useState } from 'react';

export interface StudentActivityCounters {
  clickCount: number;
  loadingCount: number;
  saveCount: number;
}

const DEFAULT_COUNTERS: StudentActivityCounters = {
  clickCount: 0,
  loadingCount: 0,
  saveCount: 0,
};

const STORAGE_PREFIX = 'cbt_student_activity_v1_';
const listeners = new Set<(studentId: string) => void>();

function getStorageKey(studentId: string): string {
  return `${STORAGE_PREFIX}${studentId}`;
}

export function getStudentActivityCounters(studentId?: string): StudentActivityCounters {
  if (!studentId || typeof window === 'undefined') {
    return { ...DEFAULT_COUNTERS };
  }
  try {
    const raw = localStorage.getItem(getStorageKey(studentId));
    if (!raw) return { ...DEFAULT_COUNTERS };
    const parsed = JSON.parse(raw);
    return {
      clickCount: Math.max(0, Number(parsed?.clickCount) || 0),
      loadingCount: Math.max(0, Number(parsed?.loadingCount) || 0),
      saveCount: Math.max(0, Number(parsed?.saveCount) || 0),
    };
  } catch {
    return { ...DEFAULT_COUNTERS };
  }
}

function writeStudentActivityCounters(studentId: string, next: StudentActivityCounters) {
  if (!studentId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(studentId), JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  listeners.forEach((fn) => {
    try {
      fn(studentId);
    } catch {
      // ignore listener errors
    }
  });
}

export function incrementStudentClick(studentId?: string) {
  if (!studentId) return;
  const curr = getStudentActivityCounters(studentId);
  writeStudentActivityCounters(studentId, {
    ...curr,
    clickCount: curr.clickCount + 1,
  });
}

export function incrementStudentLoading(studentId?: string) {
  if (!studentId) return;
  const curr = getStudentActivityCounters(studentId);
  writeStudentActivityCounters(studentId, {
    ...curr,
    loadingCount: curr.loadingCount + 1,
  });
}

export function incrementStudentSave(studentId?: string) {
  if (!studentId) return;
  const curr = getStudentActivityCounters(studentId);
  writeStudentActivityCounters(studentId, {
    ...curr,
    saveCount: curr.saveCount + 1,
  });
}

export function resetStudentActivityCounters(studentId?: string) {
  if (!studentId) return;
  writeStudentActivityCounters(studentId, { ...DEFAULT_COUNTERS });
}

export function useStudentActivityCounters(studentId?: string): StudentActivityCounters {
  const [counters, setCounters] = useState<StudentActivityCounters>(() =>
    getStudentActivityCounters(studentId)
  );

  useEffect(() => {
    setCounters(getStudentActivityCounters(studentId));
    if (!studentId) return;

    const handleUpdate = (updatedId: string) => {
      if (updatedId === studentId) {
        setCounters(getStudentActivityCounters(studentId));
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === getStorageKey(studentId)) {
        setCounters(getStudentActivityCounters(studentId));
      }
    };

    listeners.add(handleUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [studentId]);

  return counters;
}
