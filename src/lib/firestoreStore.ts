import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  assignMissingQuestionCodes,
  generateNextQuestionCode,
  getSubjectCodePrefix,
  isQuestionCodeDuplicate,
} from './questionCode';
import { generateRandomPassword, hashPasswordAsync } from './passwordUtils';
import { computeLiveStudentScore } from './liveScore';
import { isQuestionInExamScope, questionMatchesScopeUnit, evaluateScopeAvailability } from './examPool';
import { DEFAULT_TEACHER_MENUS, normalizeTeacherMenus, RemedialMode } from '../types/cbt';
import {
  extractWrongQuestionDetails,
  selectRemedialQuestions,
  computePointsPerCorrectForRemedial,
  computeRemedialFinalScore,
  computeRemedialDuration,
  computeRemedialQuestionCount,
} from './remedialHelper';

class DomainValidationError extends Error {}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        result[k] = stripUndefinedDeep(v);
      }
    }
    return result as T;
  }
  return value;
}

const DEFAULT_ACADEMIC_YEARS = [
  { id: 'ay-2024-genap', name: '2024/2025', semester: 'Genap', isActive: true },
  { id: 'ay-2024-ganjil', name: '2024/2025', semester: 'Ganjil', isActive: false },
];

const DEFAULT_SETTINGS = {
  schoolName: '',
  schoolLogoUrl: '',
  loginBackgroundUrl: '',
  appSubtitle: '',
  academicYearText: '2024/2025 Genap',
  teacherMenus: { ...DEFAULT_TEACHER_MENUS },
  showDeleteExamAction: true,
};

async function findTaxonomyDocRef(type: string, id: string) {
  const directId = `${type}-${id}`;
  const directRef = doc(db, 'taxonomy', directId);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) return directRef;

  const altRef = doc(db, 'taxonomy', id);
  const altSnap = await getDoc(altRef);
  if (altSnap.exists()) return altRef;

  const snap = await getDocs(
    query(collection(db, 'taxonomy'), where('type', '==', type), where('id', '==', id))
  );
  if (!snap.empty) return snap.docs[0].ref;
  return directRef;
}

export const firestoreStore = {
  // --- SETTINGS ---
  getSettings: async () => {
    const path = 'settings/school_info';
    try {
      const snap = await getDoc(doc(db, 'settings', 'school_info'));
      if (snap.exists()) {
        const data = snap.data() as any;
        return {
          settings: {
            ...DEFAULT_SETTINGS,
            ...data,
            teacherMenus: normalizeTeacherMenus(data?.teacherMenus),
            showDeleteExamAction:
              data?.showDeleteExamAction !== undefined ? Boolean(data.showDeleteExamAction) : true,
          },
        };
      }
      return { settings: DEFAULT_SETTINGS };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  updateSettings: async (settingsData: Record<string, any>) => {
    const path = 'settings/school_info';
    try {
      const ref = doc(db, 'settings', 'school_info');
      const snap = await getDoc(ref);
      const current = snap.exists() ? (snap.data() as any) : DEFAULT_SETTINGS;
      const mergedMenus = normalizeTeacherMenus({
        ...(current?.teacherMenus || {}),
        ...(settingsData?.teacherMenus || {}),
      });
      const updated = stripUndefinedDeep({
        ...DEFAULT_SETTINGS,
        ...current,
        ...settingsData,
        teacherMenus: mergedMenus,
        showDeleteExamAction:
          settingsData?.showDeleteExamAction !== undefined
            ? Boolean(settingsData.showDeleteExamAction)
            : current?.showDeleteExamAction !== undefined
            ? Boolean(current.showDeleteExamAction)
            : true,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(ref, updated, { merge: true });
      return { success: true, settings: updated, message: 'Pengaturan sekolah berhasil disimpan ke Firestore.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // --- ACTIVITY LOGS ---
  getActivityLogs: async () => {
    const path = 'activity_logs';
    try {
      const snap = await getDocs(collection(db, path));
      const logs = snap.docs
        .map((d) => d.data())
        .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      return { logs };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  recordActivityLog: async (entry: {
    actorName: string;
    role: string;
    action: string;
    details: string;
  }) => {
    const path = 'activity_logs';
    try {
      const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const logDoc = stripUndefinedDeep({
        id,
        timestamp: new Date().toISOString(),
        actorName: String(entry.actorName || 'Pengguna').trim(),
        role: String(entry.role || 'system').trim(),
        action: String(entry.action || 'ACTIVITY').trim(),
        details: String(entry.details || '').trim(),
      });
      await setDoc(doc(db, path, id), logDoc);
      return { success: true, log: logDoc };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // --- CLASSES ---
  getClasses: async () => {
    const path = 'classes';
    try {
      const snap = await getDocs(collection(db, path));
      const classes = snap.docs.map((d) => d.data());
      return { classes, academicYears: DEFAULT_ACADEMIC_YEARS };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createClass: async (classData: any) => {
    const path = 'classes';
    try {
      const id = classData.id || `cls-${Date.now()}`;
      const newClass = {
        id,
        gradeLevel: classData.gradeLevel || 'XII',
        name: classData.name,
        academicYearId: classData.academicYearId || 'ay-2024-genap',
        homeroomTeacher: classData.homeroomTeacher || '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, path, id), newClass);
      return { success: true, class: newClass };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateClass: async (id: string, classData: any) => {
    const path = `classes/${id}`;
    try {
      const ref = doc(db, 'classes', id);
      await updateDoc(ref, {
        ...classData,
        updatedAt: new Date().toISOString(),
      });
      const updatedSnap = await getDoc(ref);
      return { success: true, class: updatedSnap.data(), message: 'Data kelas berhasil diperbarui di Firestore.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteClass: async (id: string) => {
    const path = `classes/${id}`;
    try {
      await deleteDoc(doc(db, 'classes', id));
      const usersSnap = await getDocs(query(collection(db, 'users'), where('classId', '==', id)));
      const studentRefs: any[] = [];
      for (const uDoc of usersSnap.docs) {
        if (uDoc.data()?.role === 'student') {
          studentRefs.push(uDoc.ref);
        } else {
          await updateDoc(uDoc.ref, { classId: '' });
        }
      }
      const chunkSize = 400;
      for (let i = 0; i < studentRefs.length; i += chunkSize) {
        const batch = writeBatch(db);
        for (const ref of studentRefs.slice(i, i + chunkSize)) {
          batch.delete(ref);
        }
        await batch.commit();
      }
      return {
        success: true,
        deletedStudentsCount: studentRefs.length,
        message:
          studentRefs.length > 0
            ? `Kelas dan ${studentRefs.length} data murid berhasil dihapus dari Firestore.`
            : 'Kelas berhasil dihapus dari Firestore.',
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  deleteClasslessStudents: async () => {
    const path = 'users';
    try {
      const [classesSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'classes')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
      ]);
      const validClassIds = new Set(classesSnap.docs.map((d) => d.id));
      const orphanRefs = usersSnap.docs
        .filter((d) => {
          const cid = d.data()?.classId;
          return !cid || String(cid).trim() === '' || !validClassIds.has(cid);
        })
        .map((d) => d.ref);

      const chunkSize = 400;
      for (let i = 0; i < orphanRefs.length; i += chunkSize) {
        const batch = writeBatch(db);
        for (const ref of orphanRefs.slice(i, i + chunkSize)) {
          batch.delete(ref);
        }
        await batch.commit();
      }
      return {
        success: true,
        count: orphanRefs.length,
        message:
          orphanRefs.length > 0
            ? `Berhasil menghapus ${orphanRefs.length} data murid tanpa kelas dari Firestore.`
            : 'Tidak ada data murid tanpa kelas.',
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- USERS ---
  getUsers: async () => {
    const path = 'users';
    try {
      const snap = await getDocs(collection(db, path));
      const users = snap.docs.map((d) => {
        const u = { id: d.id, ...d.data() } as any;
        delete u.passwordHash;
        return u;
      });
      return { users };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  getUsersForAuth: async () => {
    const path = 'users';
    try {
      const snap = await getDocs(collection(db, path));
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      return { users };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createUser: async (userData: any) => {
    const path = 'users';
    try {
      const id = userData.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const role = userData.role || 'student';
      const defaultPass = role === 'teacher' ? 'guru123' : role === 'admin' ? 'admin123' : 'siswa123';
      const rawPassword = String(userData.password || userData.plainPassword || defaultPass).trim();
      const passwordHash = await hashPasswordAsync(rawPassword);

      const newUser: any = {
        id,
        username: String(userData.username || '').trim(),
        name: String(userData.name || '').trim(),
        role,
        email: userData.email || '',
        isActive: userData.isActive !== false,
        passwordCustom: Boolean(userData.password),
        plainPassword: rawPassword,
        ...(passwordHash ? { passwordHash } : {}),
        createdAt: new Date().toISOString(),
      };
      if (role === 'student') {
        newUser.nis = userData.nis || newUser.username;
        newUser.classId = userData.classId || '';
      } else if (role === 'teacher') {
        newUser.nip = userData.nip || '';
        newUser.subjectSpecialty = userData.subjectSpecialty || '';
      }
      await setDoc(doc(db, path, id), stripUndefinedDeep(newUser));
      const safe = { ...newUser };
      delete safe.passwordHash;
      return { success: true, user: safe };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateUser: async (id: string, userData: any) => {
    const path = `users/${id}`;
    try {
      const ref = doc(db, 'users', id);
      const updatePayload: any = {};
      if (userData.name !== undefined) updatePayload.name = userData.name.trim();
      if (userData.username !== undefined) updatePayload.username = userData.username.trim();
      if (userData.role !== undefined) updatePayload.role = userData.role;
      if (userData.email !== undefined) updatePayload.email = userData.email.trim();
      if (userData.isActive !== undefined) updatePayload.isActive = Boolean(userData.isActive);
      if (userData.nis !== undefined) updatePayload.nis = userData.nis;
      if (userData.classId !== undefined) updatePayload.classId = userData.classId;
      if (userData.nip !== undefined) updatePayload.nip = userData.nip;
      if (userData.subjectSpecialty !== undefined) updatePayload.subjectSpecialty = userData.subjectSpecialty;
      if (userData.lastLogin !== undefined) updatePayload.lastLogin = userData.lastLogin;
      if (userData.password && String(userData.password).trim().length > 0) {
        const cleanPass = String(userData.password).trim();
        const passwordHash = await hashPasswordAsync(cleanPass);
        updatePayload.passwordCustom = true;
        if (passwordHash) updatePayload.passwordHash = passwordHash;
        updatePayload.plainPassword = cleanPass;
      }
      updatePayload.updatedAt = new Date().toISOString();

      await updateDoc(ref, stripUndefinedDeep(updatePayload));
      const updatedSnap = await getDoc(ref);
      const safe = updatedSnap.data() || {};
      delete safe.passwordHash;
      return { success: true, user: safe, message: 'Data pengguna tersimpan di Firestore.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteUser: async (id: string) => {
    const path = `users/${id}`;
    try {
      const userRef = doc(db, 'users', id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data()?.role === 'admin') {
        throw new Error('Akun Administrator tidak dapat dihapus demi keamanan sistem.');
      }
      await deleteDoc(userRef);
      return { success: true, message: 'Akun berhasil dihapus dari Firestore.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  bulkImportStudents: async (students: any[]) => {
    const path = 'users';
    try {
      const existingSnap = await getDocs(collection(db, path));
      const existingUsernames = new Set<string>();
      const existingNis = new Set<string>();

      for (const d of existingSnap.docs) {
        const u = d.data() as any;
        if (u.username) existingUsernames.add(String(u.username).trim().toLowerCase());
        if (u.role === 'student' && u.nis) existingNis.add(String(u.nis).trim().toLowerCase());
      }

      const toInsert: any[] = [];
      let skippedDuplicateNis = 0;

      for (const s of students) {
        const cleanName = String(s.name || '').trim();
        const cleanNis = String(s.nis || '').trim();
        const baseUsername = String(s.username || cleanNis || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/gi, '');
        if (!cleanName || !baseUsername) continue;

        if (cleanNis && existingNis.has(cleanNis.toLowerCase())) {
          skippedDuplicateNis++;
          continue;
        }

        let finalUsername = baseUsername;
        let suffix = 2;
        while (existingUsernames.has(finalUsername.toLowerCase())) {
          finalUsername = `${baseUsername}${suffix}`;
          suffix++;
        }
        existingUsernames.add(finalUsername.toLowerCase());
        if (cleanNis) existingNis.add(cleanNis.toLowerCase());

        const plainPassword = String(s.password || 'siswa123').trim() || 'siswa123';
        const passwordHash = await hashPasswordAsync(plainPassword);
        const id = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${toInsert.length}`;
        toInsert.push(
          stripUndefinedDeep({
            id,
            username: finalUsername,
            name: cleanName,
            role: 'student',
            nis: cleanNis || finalUsername,
            classId: s.classId || '',
            plainPassword,
            ...(passwordHash ? { passwordHash } : {}),
            email: s.email || '',
            isActive: true,
            createdAt: new Date().toISOString(),
          })
        );
      }

      const chunkSize = 400;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const batch = writeBatch(db);
        const slice = toInsert.slice(i, i + chunkSize);
        for (const studentDoc of slice) {
          batch.set(doc(db, path, studentDoc.id), studentDoc);
        }
        await batch.commit();
      }

      const extra =
        skippedDuplicateNis > 0
          ? ` (${skippedDuplicateNis} dilewati karena NIS sudah terdaftar)`
          : '';
      return {
        success: true,
        count: toInsert.length,
        message: `Berhasil mengimpor ${toInsert.length} siswa ke Cloud Firestore.${extra}`,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  bulkGenerateStudentPasswords: async (classId?: string) => {
    const path = 'users';
    try {
      const q = classId
        ? query(collection(db, path), where('role', '==', 'student'), where('classId', '==', classId))
        : query(collection(db, path), where('role', '==', 'student'));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('Tidak ada siswa ditemukan pada cakupan yang dipilih.');
      }

      const now = new Date().toISOString();
      const docs = snap.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const slice = docs.slice(i, i + chunkSize);
        for (const d of slice) {
          const randomPass = generateRandomPassword(6);
          const passwordHash = await hashPasswordAsync(randomPass);
          batch.update(d.ref, stripUndefinedDeep({
            passwordCustom: true,
            plainPassword: randomPass,
            ...(passwordHash ? { passwordHash } : {}),
            updatedAt: now,
          }));
        }
        await batch.commit();
      }

      return {
        success: true,
        count: docs.length,
        message: `Berhasil mengacak password baru untuk ${docs.length} siswa di Cloud Firestore.`,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- QUESTIONS ---
  getQuestions: async () => {
    const path = 'questions';
    try {
      const [qSnap, subjSnap] = await Promise.all([
        getDocs(collection(db, path)),
        getDocs(query(collection(db, 'taxonomy'), where('type', '==', 'subject'))),
      ]);
      const rawQuestions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const subjects = subjSnap.docs.map((d) => d.data()) as any[];
      const codeSync = assignMissingQuestionCodes(rawQuestions, subjects);

      if (codeSync.updatedQuestions.length > 0) {
        for (const uq of codeSync.updatedQuestions) {
          await updateDoc(doc(db, path, uq.id), { code: uq.code });
        }
      }
      return { questions: codeSync.questions };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createQuestion: async (question: any) => {
    const path = 'questions';
    try {
      const [qSnap, subjSnap] = await Promise.all([
        getDocs(collection(db, path)),
        getDocs(query(collection(db, 'taxonomy'), where('type', '==', 'subject'))),
      ]);
      const existingQuestions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const subjects = subjSnap.docs.map((d) => d.data()) as any[];

      let finalCode = typeof question.code === 'string' ? question.code.trim().toUpperCase() : '';
      if (finalCode) {
        if (isQuestionCodeDuplicate(finalCode, existingQuestions)) {
          throw new Error(`Kode soal "${finalCode}" sudah digunakan oleh soal lain.`);
        }
      } else {
        finalCode = generateNextQuestionCode(question.subjectId, existingQuestions, subjects);
      }

      const id = question.id || `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newQ = stripUndefinedDeep({
        ...question,
        id,
        code: finalCode,
        status: question.status || 'active',
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, path, id), newQ);
      return { success: true, question: newQ };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  bulkCreateQuestions: async (items: any[]) => {
    const path = 'questions';
    try {
      const [qSnap, subjSnap] = await Promise.all([
        getDocs(collection(db, path)),
        getDocs(query(collection(db, 'taxonomy'), where('type', '==', 'subject'))),
      ]);
      const runningPool = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const subjects = subjSnap.docs.map((d) => d.data()) as any[];

      let count = 0;
      for (const question of items) {
        const targetSubjectId = question.subjectId || subjects[0]?.id || '';
        const requestedCode = typeof question.code === 'string' ? question.code.trim().toUpperCase() : '';
        const finalCode =
          requestedCode && !isQuestionCodeDuplicate(requestedCode, runningPool)
            ? requestedCode
            : generateNextQuestionCode(targetSubjectId, runningPool, subjects);

        const id = question.id || `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newQ = stripUndefinedDeep({
          ...question,
          id,
          code: finalCode,
          subjectId: targetSubjectId,
          status: question.status || 'active',
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, path, id), newQ);
        runningPool.push(newQ);
        count++;
      }
      return { success: true, count, message: `Berhasil mengimpor ${count} butir soal.` };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateQuestion: async (id: string, question: any) => {
    const path = `questions/${id}`;
    try {
      const ref = doc(db, 'questions', id);
      const [curSnap, qSnap, subjSnap] = await Promise.all([
        getDoc(ref),
        getDocs(collection(db, 'questions')),
        getDocs(query(collection(db, 'taxonomy'), where('type', '==', 'subject'))),
      ]);
      const existing = curSnap.exists() ? (curSnap.data() as any) : {};
      const existingQuestions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const subjects = subjSnap.docs.map((d) => d.data()) as any[];

      const nextSubjectId = question.subjectId !== undefined ? question.subjectId : existing.subjectId;
      const subjectChanged = nextSubjectId !== existing.subjectId;
      let nextCode = existing.code || '';

      if (question.code !== undefined) {
        const requestedCode = String(question.code || '').trim().toUpperCase();
        if (!requestedCode) {
          nextCode = generateNextQuestionCode(nextSubjectId, existingQuestions, subjects, id);
        } else if (
          subjectChanged &&
          requestedCode === (existing.code || '').trim().toUpperCase() &&
          !requestedCode.startsWith(`${getSubjectCodePrefix(nextSubjectId, subjects)}-`)
        ) {
          nextCode = generateNextQuestionCode(nextSubjectId, existingQuestions, subjects, id);
        } else {
          if (isQuestionCodeDuplicate(requestedCode, existingQuestions, id)) {
            throw new Error(`Kode soal "${requestedCode}" sudah digunakan oleh soal lain.`);
          }
          nextCode = requestedCode;
        }
      } else if (!nextCode || (subjectChanged && !nextCode.startsWith(`${getSubjectCodePrefix(nextSubjectId, subjects)}-`))) {
        nextCode = generateNextQuestionCode(nextSubjectId, existingQuestions, subjects, id);
      }

      await updateDoc(ref, stripUndefinedDeep({
        ...question,
        code: nextCode,
        updatedAt: new Date().toISOString(),
      }));
      const updatedSnap = await getDoc(ref);
      return { success: true, question: updatedSnap.data() };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteQuestion: async (id: string) => {
    const path = `questions/${id}`;
    try {
      await deleteDoc(doc(db, 'questions', id));
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- EXAMS & SESSIONS ---
  getExams: async () => {
    const path = 'exams';
    try {
      const snap = await getDocs(collection(db, path));
      const exams = snap.docs.map((d) => d.data());
      return { exams };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  validateExamAvailability: async (payload: {
    subjectId?: string;
    selectedChapterIds?: string[];
    selectedSubchapterIds?: string[];
    selectedCompetencyIds?: string[];
    cognitiveTarget?: {
      lotsCount?: number;
      motsCount?: number;
      hotsCount?: number;
      perScopeTargets?: any[];
    };
  }) => {
    const path = 'questions';
    try {
      const [snap, taxSnap] = await Promise.all([
        getDocs(collection(db, path)),
        getDocs(collection(db, 'taxonomy')),
      ]);
      const questions = snap.docs.map((d) => d.data());
      const taxItems = taxSnap.docs.map((d) => d.data() as any);
      const subchapters: Array<{ id: string; chapterId: string }> = taxItems
        .filter((t) => t.type === 'subchapter')
        .map((t) => ({ id: String(t.id || ''), chapterId: String(t.chapterId || '') }));
      const competencies: Array<{ id: string; subchapterId: string }> = taxItems
        .filter((t) => t.type === 'competency')
        .map((t) => ({ id: String(t.id || ''), subchapterId: String(t.subchapterId || '') }));

      const activePool = questions.filter((q: any) =>
        isQuestionInExamScope(
          q,
          {
            subjectId: payload.subjectId,
            selectedChapterIds: payload.selectedChapterIds,
            selectedSubchapterIds: payload.selectedSubchapterIds,
            selectedCompetencyIds: payload.selectedCompetencyIds,
          },
          { subchapters, competencies }
        )
      );

      return evaluateScopeAvailability(activePool, payload.cognitiveTarget);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createExam: async (examData: any) => {
    const path = 'exams';
    try {
      const id = examData.id || `ex-${Date.now()}`;
      const newExam = {
        id,
        title: examData.title || 'Ujian Baru',
        subjectId: examData.subjectId || '',
        academicYearId: examData.academicYearId || 'ay-2024-genap',
        semester: examData.semester || 'Genap',
        targetClassIds: examData.targetClassIds || [],
        scheduleStart: examData.scheduleStart || new Date().toISOString(),
        scheduleEnd: examData.scheduleEnd || new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: examData.durationMinutes || 60,
        maxScore: examData.maxScore || 100,
        kktpScore: examData.kktpScore || 75,
        selectedChapterIds: examData.selectedChapterIds || [],
        selectedSubchapterIds: examData.selectedSubchapterIds || [],
        selectedCompetencyIds: examData.selectedCompetencyIds || [],
        cognitiveTarget: examData.cognitiveTarget || {
          lotsCount: examData.lotsCount || 5,
          motsCount: examData.motsCount || 10,
          hotsCount: examData.hotsCount || 5,
          totalQuestions: examData.totalQuestions || 20,
        },
        scoringConfig: {
          pgKompleksMode: examData.scoringConfig?.pgKompleksMode === 'exact' ? 'exact' : 'partial',
          useMinusSystem: Boolean(examData.scoringConfig?.useMinusSystem),
          minusValue: Math.max(0, Number(examData.scoringConfig?.minusValue) || 0),
          weights: {
            LOTS: Math.max(0, Number(examData.scoringConfig?.weights?.LOTS ?? 10) || 0),
            MOTS: Math.max(0, Number(examData.scoringConfig?.weights?.MOTS ?? 10) || 0),
            HOTS: Math.max(0, Number(examData.scoringConfig?.weights?.HOTS ?? 10) || 0),
          },
        },
        status: 'active',
        token: examData.token || Math.random().toString(36).substring(2, 8).toUpperCase(),
        tokenAutoRotate: Boolean(examData.tokenAutoRotate),
        tokenIntervalMinutes: examData.tokenIntervalMinutes || 15,
        tokenUpdatedAt: new Date().toISOString(),
        isTokenActive: true,
        antiCheating: examData.antiCheating || {
          forceFullscreen: true,
          detectTabSwitch: true,
          blockRightClick: true,
          blockCopyPaste: true,
          maxToleranceViolations: 3,
          autoSubmitOnViolationLimit: false,
        },
        isPublishedResults: false,
        showLiveScore: Boolean(examData.showLiveScore),
        createdTeacherId: examData.createdTeacherId || examData.teacherId || '',
        createdAt: new Date().toISOString(),
      };
      const [qSnap, taxSnap] = await Promise.all([
        getDocs(collection(db, 'questions')),
        getDocs(collection(db, 'taxonomy')),
      ]);
      const questions = qSnap.docs.map((d) => d.data());
      const taxItems = taxSnap.docs.map((d) => d.data() as any);
      const subchapters = taxItems
        .filter((t) => t.type === 'subchapter')
        .map((t) => ({ id: String(t.id || ''), chapterId: String(t.chapterId || '') }));
      const competencies = taxItems
        .filter((t) => t.type === 'competency')
        .map((t) => ({ id: String(t.id || ''), subchapterId: String(t.subchapterId || '') }));

      const activePool = questions.filter((q: any) =>
        isQuestionInExamScope(
          q,
          {
            subjectId: newExam.subjectId,
            selectedChapterIds: newExam.selectedChapterIds,
            selectedSubchapterIds: newExam.selectedSubchapterIds,
            selectedCompetencyIds: newExam.selectedCompetencyIds,
          },
          { subchapters, competencies }
        )
      );
      const availability = evaluateScopeAvailability(activePool, newExam.cognitiveTarget);
      if (!availability.isValid) {
        throw new DomainValidationError(
          'Jumlah penentuan soal LOTS, MOTS, atau HOTS tidak boleh melebihi jumlah soal aktif yang tersedia di bank soal.'
        );
      }

      await setDoc(doc(db, path, id), stripUndefinedDeep(newExam));
      return { success: true, exam: newExam };
    } catch (error) {
      if (error instanceof DomainValidationError) throw error;
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateExam: async (id: string, examData: any) => {
    const path = `exams/${id}`;
    try {
      const ref = doc(db, 'exams', id);
      await updateDoc(ref, stripUndefinedDeep({
        ...examData,
        updatedAt: new Date().toISOString(),
      }));
      const updatedSnap = await getDoc(ref);
      return { success: true, exam: updatedSnap.data() };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteExam: async (id: string) => {
    const path = `exams/${id}`;
    try {
      await deleteDoc(doc(db, 'exams', id));
      const [sessionsSnap, remSessionsSnap, resultsSnap, remSnap] = await Promise.all([
        getDocs(query(collection(db, 'exam_sessions'), where('examId', '==', id))),
        getDocs(query(collection(db, 'exam_sessions'), where('examId', '==', `rem_${id}`))),
        getDocs(query(collection(db, 'exam_results'), where('examId', '==', id))),
        getDocs(query(collection(db, 'remedial_assignments'), where('sourceExamId', '==', id))),
      ]);
      for (const sDoc of sessionsSnap.docs) {
        await deleteDoc(sDoc.ref);
      }
      for (const sDoc of remSessionsSnap.docs) {
        await deleteDoc(sDoc.ref);
      }
      for (const rDoc of resultsSnap.docs) {
        await deleteDoc(rDoc.ref);
      }
      for (const remDoc of remSnap.docs) {
        await deleteDoc(remDoc.ref);
      }
      return { success: true, message: 'Paket ujian berhasil dihapus.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  toggleLiveScore: async (examId: string, showLiveScore?: boolean) => {
    const path = `exams/${examId}`;
    try {
      const ref = doc(db, 'exams', examId);
      const snap = await getDoc(ref);
      const current = snap.exists() ? Boolean(snap.data()?.showLiveScore) : false;
      const nextValue = typeof showLiveScore === 'boolean' ? showLiveScore : !current;
      await updateDoc(ref, {
        showLiveScore: nextValue,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, showLiveScore: nextValue };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  togglePublishResults: async (examId: string) => {
    const path = `exams/${examId}`;
    try {
      const ref = doc(db, 'exams', examId);
      const snap = await getDoc(ref);
      const current = snap.exists() ? Boolean(snap.data()?.isPublishedResults) : false;
      const nextValue = !current;
      await updateDoc(ref, {
        isPublishedResults: nextValue,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, isPublishedResults: nextValue };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  regenerateToken: async (examId: string) => {
    const path = `exams/${examId}`;
    try {
      const chars = 'ABCDEF0123456789';
      let token = '';
      for (let i = 0; i < 6; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
      }
      const tokenUpdatedAt = new Date().toISOString();
      await updateDoc(doc(db, 'exams', examId), {
        token,
        tokenUpdatedAt,
        updatedAt: tokenUpdatedAt,
      });
      return { success: true, token, tokenUpdatedAt };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updateTokenSettings: async (
    examId: string,
    settings: { tokenAutoRotate?: boolean; tokenIntervalMinutes?: number; isTokenActive?: boolean }
  ) => {
    const path = `exams/${examId}`;
    try {
      const ref = doc(db, 'exams', examId);
      const payload: any = { updatedAt: new Date().toISOString() };
      if (typeof settings.tokenAutoRotate === 'boolean') payload.tokenAutoRotate = settings.tokenAutoRotate;
      if (settings.tokenIntervalMinutes) payload.tokenIntervalMinutes = Number(settings.tokenIntervalMinutes);
      if (typeof settings.isTokenActive === 'boolean') payload.isTokenActive = settings.isTokenActive;
      await updateDoc(ref, payload);
      const snap = await getDoc(ref);
      return { success: true, exam: snap.data() };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  getStudentExams: async (studentId: string) => {
    const path = 'exams';
    try {
      const [usersSnap, examsSnap, subjectsSnap, sessionsSnap, resultsSnap, remSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('id', '==', studentId))),
        getDocs(collection(db, 'exams')),
        getDocs(query(collection(db, 'taxonomy'), where('type', '==', 'subject'))),
        getDocs(query(collection(db, 'exam_sessions'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'exam_results'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'remedial_assignments'), where('studentId', '==', studentId))),
      ]);

      let studentData = !usersSnap.empty ? (usersSnap.docs[0].data() as any) : null;
      if (!studentData) {
        const directSnap = await getDoc(doc(db, 'users', studentId));
        if (directSnap.exists()) {
          studentData = directSnap.data();
        }
      }
      if (!studentData) {
        return { exams: [] };
      }

      const studentClassId = studentData.classId || '';
      const subjectMap = new Map<string, string>();
      for (const s of subjectsSnap.docs) {
        const data = s.data() as any;
        subjectMap.set(data.id || s.id, data.name || 'Mata Pelajaran');
      }

      const examMap = new Map<string, any>();
      for (const e of examsSnap.docs) {
        examMap.set(e.id, { id: e.id, ...(e.data() as any) });
      }

      const sessionMap = new Map<string, any>();
      for (const s of sessionsSnap.docs) {
        const data = s.data() as any;
        if (data.examId) sessionMap.set(data.examId, data);
      }

      const resultMap = new Map<string, any>();
      for (const r of resultsSnap.docs) {
        const data = r.data() as any;
        if (data.examId) resultMap.set(data.examId, data);
      }

      const exams = Array.from(examMap.values())
        .filter((e: any) => Array.isArray(e.targetClassIds) && e.targetClassIds.includes(studentClassId))
        .map((e: any) => {
          const session = sessionMap.get(e.id);
          const result = resultMap.get(e.id);
          return {
            id: e.id,
            title: e.title,
            subject: subjectMap.get(e.subjectId) || 'Mata Pelajaran',
            durationMinutes: e.durationMinutes,
            scheduleStart: e.scheduleStart,
            scheduleEnd: e.scheduleEnd,
            isTokenActive: Boolean(e.isTokenActive),
            isPublishedResults: Boolean(e.isPublishedResults),
            studentStatus: result
              ? 'completed'
              : session
              ? session.status === 'suspicious'
                ? 'in_progress'
                : session.status
              : 'not_started',
            hasResult: Boolean(result),
            score: e.isPublishedResults && result ? result.finalScore : null,
            kktpScore: e.kktpScore,
            violationCount:
              Number(
                session?.violationCount ??
                  (Array.isArray(result?.violationsRecorded) ? result.violationsRecorded.length : 0)
              ) || 0,
          };
        });

      const remedialExams = remSnap.docs.map((rDoc) => {
        const rem = rDoc.data() as any;
        const remExamId = `rem_${rem.sourceExamId}`;
        const session = sessionMap.get(remExamId);
        const sourceExam = examMap.get(rem.sourceExamId);
        const subjectName =
          rem.subjectName ||
          subjectMap.get(rem.subjectId || sourceExam?.subjectId) ||
          'Mata Pelajaran';

        const studentStatus =
          rem.status === 'completed'
            ? 'completed'
            : session && session.status !== 'completed'
            ? 'in_progress'
            : rem.status === 'in_progress'
            ? 'in_progress'
            : 'not_started';

        const computedDuration = rem.durationSeconds
          ? {
              durationMinutes: Number(rem.durationMinutes) || Math.round((Number(rem.durationSeconds) / 60) * 10) / 10,
              durationSeconds: Number(rem.durationSeconds),
            }
          : sourceExam
          ? computeRemedialDuration({
              examDurationMinutes: Number(sourceExam.durationMinutes) || 60,
              examTotalQuestions:
                Number(rem.originalTotalQuestions) ||
                Number(sourceExam.cognitiveTarget?.totalQuestions) ||
                (Array.isArray(rem.questionIds) ? rem.questionIds.length : 1),
              remedialQuestionCount: Array.isArray(rem.questionIds) ? rem.questionIds.length : 1,
            })
          : {
              durationMinutes: Number(rem.durationMinutes) || 45,
              durationSeconds: (Number(rem.durationMinutes) || 45) * 60,
            };

        return {
          id: remExamId,
          title: `[REMEDIAL] ${rem.sourceExamTitle || sourceExam?.title || 'Ujian Sekolah'}`,
          subject: subjectName,
          durationMinutes: computedDuration.durationMinutes,
          scheduleStart: rem.createdAt || sourceExam?.scheduleStart || new Date().toISOString(),
          scheduleEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          isTokenActive: false,
          isPublishedResults: true,
          studentStatus,
          hasResult: rem.status === 'completed',
          score: rem.status === 'completed' ? (rem.finalCappedScore ?? rem.baseScore ?? 0) : null,
          kktpScore: Number(rem.kktpScore) || Number(sourceExam?.kktpScore) || 75,
          violationCount: Number(session?.violationCount) || 0,
          isRemedial: true,
          sourceExamId: rem.sourceExamId,
          remedialMode: rem.mode,
          baseScore: Number(rem.baseScore) || 0,
          addedScore: Number(rem.addedScore) || 0,
          remedialQuestionCount: Array.isArray(rem.questionIds) ? rem.questionIds.length : 0,
          attemptCount: Number(rem.attemptCount) || 1,
          isRemedialPassed: rem.status === 'completed' ? Boolean(rem.isPassed) : false,
        };
      });

      return { exams: [...exams, ...remedialExams] };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  startExam: async (examId: string, studentId: string, inputToken?: string) => {
    const sessionKey = `${examId}_${studentId}`;
    const path = `exam_sessions/${sessionKey}`;
    try {
      if (examId.startsWith('rem_')) {
        const sourceExamId = examId.slice(4);
        const remKey = `${sourceExamId}_${studentId}`;
        const [remSnap, sourceExamSnap, usersSnap, classesSnap, questionsSnap, taxSnap, sessionSnap] =
          await Promise.all([
            getDoc(doc(db, 'remedial_assignments', remKey)),
            getDoc(doc(db, 'exams', sourceExamId)),
            getDocs(query(collection(db, 'users'), where('id', '==', studentId))),
            getDocs(collection(db, 'classes')),
            getDocs(collection(db, 'questions')),
            getDocs(collection(db, 'taxonomy')),
            getDoc(doc(db, 'exam_sessions', sessionKey)),
          ]);

        if (!remSnap.exists()) {
          throw new DomainValidationError('Paket remedial tidak ditemukan untuk akun Anda.');
        }
        const rem = remSnap.data() as any;
        if (rem.status === 'completed') {
          throw new DomainValidationError('Anda sudah menyelesaikan ujian remedial ini.');
        }

        const sourceExam = sourceExamSnap.exists() ? (sourceExamSnap.data() as any) : null;
        let student: any = !usersSnap.empty ? usersSnap.docs[0].data() : null;
        if (!student) {
          const directUser = await getDoc(doc(db, 'users', studentId));
          if (directUser.exists()) student = directUser.data();
        }
        if (!student) throw new DomainValidationError('Siswa tidak ditemukan.');

        const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const qMap = new Map(allQuestions.map((q: any) => [q.id, q]));
        const taxItems = taxSnap.docs.map((d) => d.data() as any);
        const subjects = taxItems.filter((t) => t.type === 'subject');

        const shuffle = <T>(arr: T[]): T[] => {
          const copy = [...arr];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        };

        let session: any = sessionSnap.exists() ? sessionSnap.data() : null;
        let pickedQuestions: any[] = [];

        if (!session) {
          const orderedIds = shuffle<string>(Array.isArray(rem.questionIds) ? rem.questionIds : []);
          pickedQuestions = orderedIds.map((qid) => qMap.get(qid)).filter(Boolean);
          if (pickedQuestions.length === 0) {
            throw new DomainValidationError('Soal remedial tidak ditemukan di bank soal.');
          }
          const computedDuration = rem.durationSeconds
            ? {
                durationMinutes: Number(rem.durationMinutes) || Math.round((Number(rem.durationSeconds) / 60) * 10) / 10,
                durationSeconds: Number(rem.durationSeconds),
              }
            : sourceExam
            ? computeRemedialDuration({
                examDurationMinutes: Number(sourceExam.durationMinutes) || 60,
                examTotalQuestions:
                  Number(rem.originalTotalQuestions) ||
                  Number(sourceExam.cognitiveTarget?.totalQuestions) ||
                  pickedQuestions.length,
                remedialQuestionCount: pickedQuestions.length,
              })
            : {
                durationMinutes: Number(rem.durationMinutes) || 45,
                durationSeconds: (Number(rem.durationMinutes) || 45) * 60,
              };
          const durationSeconds = computedDuration.durationSeconds;
          const classDoc = classesSnap.docs.find((c) => c.id === student.classId || c.data()?.id === student.classId);
          const studentClassName = classDoc?.data()?.name || rem.className || 'Kelas';
          const nowIso = new Date().toISOString();

          session = {
            id: sessionKey,
            examId,
            studentId,
            studentName: student.name,
            studentNis: student.nis || student.username,
            className: studentClassName,
            status: 'in_progress',
            startedAt: nowIso,
            durationSeconds,
            remainingSeconds: durationSeconds,
            currentQuestionIndex: 0,
            answers: {},
            doubtfulFlags: {},
            violationCount: 0,
            violations: [],
            questionIds: pickedQuestions.map((q: any) => q.id),
            lastHeartbeat: nowIso,
          };

          await Promise.all([
            setDoc(doc(db, 'exam_sessions', sessionKey), stripUndefinedDeep(session)),
            updateDoc(doc(db, 'remedial_assignments', remKey), {
              status: 'in_progress',
              updatedAt: nowIso,
            }),
          ]);
        } else {
          if (session.status === 'completed') {
            throw new DomainValidationError('Anda sudah menyelesaikan ujian remedial ini.');
          }
          pickedQuestions = (Array.isArray(session.questionIds) ? session.questionIds : rem.questionIds || [])
            .map((qid: string) => qMap.get(qid))
            .filter(Boolean);
        }

        const sanitizedQuestions = pickedQuestions.map((q: any, idx: number) => {
          let sanitizedOptions: any = undefined;
          if (q.options && Array.isArray(q.options)) {
            if (q.type === 'pg' || q.type === 'pg_kompleks') {
              sanitizedOptions = shuffle(q.options).map((opt: any) => ({ id: opt.id, text: opt.text }));
            } else {
              sanitizedOptions = q.options.map((opt: any) => ({ id: opt.id, text: opt.text }));
            }
          }
          const maxSelectable =
            q.type === 'pg_kompleks' && Array.isArray(q.correctAnswer)
              ? q.correctAnswer.length
              : undefined;
          return {
            number: idx + 1,
            id: q.id,
            subjectId: q.subjectId,
            chapterId: q.chapterId,
            subchapterId: q.subchapterId,
            competencyId: q.competencyId,
            cognitiveLevel: q.cognitiveLevel || 'MOTS',
            type: q.type,
            questionText: q.questionText,
            options: sanitizedOptions,
            points: Number(rem.pointsPerCorrect) || 10,
            ...(maxSelectable !== undefined ? { maxSelectable } : {}),
          };
        });

        const subjectName =
          rem.subjectName ||
          subjects.find((s: any) => s.id === (rem.subjectId || sourceExam?.subjectId))?.name ||
          'Mata Pelajaran';

        return {
          success: true,
          session,
          exam: {
            id: examId,
            title: `[REMEDIAL] ${rem.sourceExamTitle || sourceExam?.title || 'Ujian Sekolah'}`,
            subjectName,
            durationMinutes: rem.durationSeconds
              ? Number(rem.durationMinutes) || Math.round((Number(rem.durationSeconds) / 60) * 10) / 10
              : sourceExam
              ? computeRemedialDuration({
                  examDurationMinutes: Number(sourceExam.durationMinutes) || 60,
                  examTotalQuestions:
                    Number(rem.originalTotalQuestions) ||
                    Number(sourceExam.cognitiveTarget?.totalQuestions) ||
                    (Array.isArray(rem.questionIds) ? rem.questionIds.length : 1),
                  remedialQuestionCount: Array.isArray(rem.questionIds) ? rem.questionIds.length : 1,
                }).durationMinutes
              : Number(rem.durationMinutes) || 45,
            antiCheating: sourceExam?.antiCheating || {
              forceFullscreen: true,
              detectTabSwitch: true,
              blockRightClick: true,
              blockCopyPaste: true,
              maxToleranceViolations: 3,
              autoSubmitOnViolationLimit: false,
            },
            scoringConfig: sourceExam?.scoringConfig || {
              pgKompleksMode: 'partial',
              useMinusSystem: false,
              minusValue: 0,
              weights: { LOTS: 10, MOTS: 10, HOTS: 10 },
            },
          },
          questions: sanitizedQuestions,
        };
      }

      const [examSnap, usersSnap, classesSnap, questionsSnap, taxSnap, sessionSnap] = await Promise.all([
        getDoc(doc(db, 'exams', examId)),
        getDocs(query(collection(db, 'users'), where('id', '==', studentId))),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'questions')),
        getDocs(collection(db, 'taxonomy')),
        getDoc(doc(db, 'exam_sessions', sessionKey)),
      ]);

      const exam = examSnap.exists() ? ({ id: examSnap.id, ...(examSnap.data() as any) }) : null;
      if (!exam) throw new DomainValidationError('Ujian tidak ditemukan.');

      let student: any = !usersSnap.empty ? usersSnap.docs[0].data() : null;
      if (!student) {
        const directUser = await getDoc(doc(db, 'users', studentId));
        if (directUser.exists()) student = directUser.data();
      }
      if (!student) throw new DomainValidationError('Siswa tidak ditemukan.');

      if (!Array.isArray(exam.targetClassIds) || !exam.targetClassIds.includes(student.classId)) {
        throw new DomainValidationError('Kelas Anda tidak terdaftar sebagai peserta ujian ini.');
      }

      const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const taxItems = taxSnap.docs.map((d) => d.data() as any);
      const subjects = taxItems.filter((t) => t.type === 'subject');
      const subchapters = taxItems
        .filter((t) => t.type === 'subchapter')
        .map((t) => ({ id: String(t.id || ''), chapterId: String(t.chapterId || '') }));
      const competencies = taxItems
        .filter((t) => t.type === 'competency')
        .map((t) => ({ id: String(t.id || ''), subchapterId: String(t.subchapterId || '') }));

      const shuffle = <T>(arr: T[]): T[] => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      const sanitizeQuestions = (pickedQuestions: any[]) =>
        pickedQuestions.map((q: any, idx: number) => {
          let sanitizedOptions: any = undefined;
          if (q.options && Array.isArray(q.options)) {
            if (q.type === 'pg' || q.type === 'pg_kompleks') {
              sanitizedOptions = shuffle(q.options).map((opt: any) => ({
                id: opt.id,
                text: opt.text,
              }));
            } else {
              sanitizedOptions = q.options.map((opt: any) => ({
                id: opt.id,
                text: opt.text,
              }));
            }
          }

          const cogLevel = q.cognitiveLevel || 'MOTS';
          const configuredWeight = exam.scoringConfig?.weights?.[cogLevel];
          const resolvedPoints =
            typeof configuredWeight === 'number' && !Number.isNaN(configuredWeight) && configuredWeight >= 0
              ? configuredWeight
              : q.points || 10;

          const maxSelectable =
            q.type === 'pg_kompleks' && Array.isArray(q.correctAnswer)
              ? q.correctAnswer.length
              : undefined;

          return {
            number: idx + 1,
            id: q.id,
            subjectId: q.subjectId,
            chapterId: q.chapterId,
            subchapterId: q.subchapterId,
            competencyId: q.competencyId,
            cognitiveLevel: cogLevel,
            type: q.type,
            questionText: q.questionText,
            options: sanitizedOptions,
            points: resolvedPoints,
            ...(maxSelectable !== undefined ? { maxSelectable } : {}),
          };
        });

      let session: any = sessionSnap.exists() ? sessionSnap.data() : null;
      let pickedQuestions: any[] = [];

      if (!session) {
        if (exam.isTokenActive) {
          if (
            !inputToken ||
            inputToken.trim().toUpperCase() !== String(exam.token || '').trim().toUpperCase()
          ) {
            throw new DomainValidationError('Token ujian tidak valid atau sudah kedaluwarsa.');
          }
        }

        const now = new Date();
        if (exam.scheduleStart && new Date(exam.scheduleStart) > now) {
          throw new DomainValidationError('Ujian belum dimulai sesuai jadwal.');
        }
        if (exam.scheduleEnd && new Date(exam.scheduleEnd) < now) {
          throw new DomainValidationError('Waktu ujian telah berakhir.');
        }

        const eligibleQuestions = allQuestions.filter((q: any) =>
          isQuestionInExamScope(
            q,
            {
              subjectId: exam.subjectId,
              selectedChapterIds: exam.selectedChapterIds,
              selectedSubchapterIds: exam.selectedSubchapterIds,
              selectedCompetencyIds: exam.selectedCompetencyIds,
            },
            { subchapters, competencies }
          )
        );

        const target = exam.cognitiveTarget || { lotsCount: 1, motsCount: 2, hotsCount: 1, totalQuestions: 4 };
        let combined: any[] = [];

        if (Array.isArray(target.perScopeTargets) && target.perScopeTargets.length > 0) {
          const usedIds = new Set<string>();
          for (const unit of target.perScopeTargets) {
            const unitPool: any[] = eligibleQuestions.filter(
              (q: any) => !usedIds.has(q.id) && questionMatchesScopeUnit(q, unit)
            );
            const uLots = shuffle<any>(unitPool.filter((q: any) => q.cognitiveLevel === 'LOTS')).slice(
              0,
              Math.max(0, Number(unit.lotsCount) || 0)
            );
            const uMots = shuffle<any>(unitPool.filter((q: any) => q.cognitiveLevel === 'MOTS')).slice(
              0,
              Math.max(0, Number(unit.motsCount) || 0)
            );
            const uHots = shuffle<any>(unitPool.filter((q: any) => q.cognitiveLevel === 'HOTS')).slice(
              0,
              Math.max(0, Number(unit.hotsCount) || 0)
            );
            for (const picked of [...uLots, ...uMots, ...uHots]) {
              usedIds.add(picked.id);
              combined.push(picked);
            }
          }
        } else {
          const lots = eligibleQuestions.filter((q: any) => q.cognitiveLevel === 'LOTS');
          const mots = eligibleQuestions.filter((q: any) => q.cognitiveLevel === 'MOTS');
          const hots = eligibleQuestions.filter((q: any) => q.cognitiveLevel === 'HOTS');
          combined = [
            ...shuffle(lots).slice(0, target.lotsCount || 1),
            ...shuffle(mots).slice(0, target.motsCount || 2),
            ...shuffle(hots).slice(0, target.hotsCount || 1),
          ];
        }

        if (combined.length === 0) {
          combined = shuffle(eligibleQuestions).slice(0, target.totalQuestions || 5);
        }
        if (combined.length === 0) {
          throw new DomainValidationError('Bank soal untuk cakupan ujian ini masih kosong.');
        }

        pickedQuestions = shuffle(combined);
        const classDoc = classesSnap.docs.find((c) => c.id === student.classId || c.data()?.id === student.classId);
        const studentClassName = classDoc?.data()?.name || 'Kelas';

        session = {
          id: sessionKey,
          examId,
          studentId,
          studentName: student.name,
          studentNis: student.nis || student.username,
          className: studentClassName,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          durationSeconds: (exam.durationMinutes || 60) * 60,
          remainingSeconds: (exam.durationMinutes || 60) * 60,
          currentQuestionIndex: 0,
          answers: {},
          doubtfulFlags: {},
          violationCount: 0,
          violations: [],
          questionIds: pickedQuestions.map((q: any) => q.id),
          lastHeartbeat: new Date().toISOString(),
        };

        await setDoc(doc(db, 'exam_sessions', sessionKey), stripUndefinedDeep(session));
      } else {
        if (session.status === 'completed') {
          throw new DomainValidationError('Anda sudah menyelesaikan ujian ini.');
        }
        const qMap = new Map(allQuestions.map((q: any) => [q.id, q]));
        pickedQuestions = (Array.isArray(session.questionIds) ? session.questionIds : [])
          .map((qid: string) => qMap.get(qid))
          .filter(Boolean);
        if (pickedQuestions.length === 0) {
          throw new DomainValidationError('Paket soal untuk sesi ini tidak ditemukan atau sudah dihapus.');
        }
      }

      const subjectName =
        subjects.find((s: any) => s.id === exam.subjectId)?.name || 'Mata Pelajaran';

      return {
        success: true,
        session,
        exam: {
          id: exam.id,
          title: exam.title,
          subjectName,
          durationMinutes: exam.durationMinutes,
          antiCheating: exam.antiCheating,
          scoringConfig: exam.scoringConfig || {
            pgKompleksMode: 'partial',
            useMinusSystem: false,
            minusValue: 0,
            weights: { LOTS: 10, MOTS: 10, HOTS: 10 },
          },
        },
        questions: sanitizeQuestions(pickedQuestions),
      };
    } catch (error) {
      if (error instanceof DomainValidationError) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  autosaveExam: async (
    examId: string,
    studentId: string,
    payload: {
      answers?: Record<string, any>;
      doubtfulFlags?: Record<string, boolean>;
      currentQuestionIndex?: number;
      remainingSeconds?: number;
    }
  ) => {
    const sessionKey = `${examId}_${studentId}`;
    const path = `exam_sessions/${sessionKey}`;
    try {
      const ref = doc(db, 'exam_sessions', sessionKey);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new DomainValidationError('Sesi ujian tidak aktif.');
      const session = snap.data() as any;
      if (session.status === 'completed') throw new DomainValidationError('Ujian sudah diserahkan.');

      const nextAnswers = payload.answers ? { ...(session.answers || {}), ...payload.answers } : session.answers || {};
      const nextFlags = payload.doubtfulFlags
        ? { ...(session.doubtfulFlags || {}), ...payload.doubtfulFlags }
        : session.doubtfulFlags || {};
      const nextIndex =
        typeof payload.currentQuestionIndex === 'number'
          ? payload.currentQuestionIndex
          : session.currentQuestionIndex || 0;
      const nextRemaining =
        typeof payload.remainingSeconds === 'number'
          ? payload.remainingSeconds
          : session.remainingSeconds;
      const lastHeartbeat = new Date().toISOString();

      await updateDoc(ref, stripUndefinedDeep({
        answers: nextAnswers,
        doubtfulFlags: nextFlags,
        currentQuestionIndex: nextIndex,
        remainingSeconds: nextRemaining,
        lastHeartbeat,
      }));

      const answeredCount = Object.values(nextAnswers).filter(
        (v: any) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      ).length;

      return { success: true, savedAt: lastHeartbeat, answeredCount };
    } catch (error) {
      if (error instanceof DomainValidationError) throw error;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  recordViolation: async (examId: string, studentId: string, type: string, description: string) => {
    const sessionKey = `${examId}_${studentId}`;
    const path = `exam_sessions/${sessionKey}`;
    try {
      const ref = doc(db, 'exam_sessions', sessionKey);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new DomainValidationError('Sesi tidak ditemukan.');
      const session = snap.data() as any;

      const violationCount = (session.violationCount || 0) + 1;
      const level: 1 | 2 | 3 = violationCount === 1 ? 1 : violationCount === 2 ? 2 : 3;
      const entry = {
        id: `v-${Date.now()}`,
        type: type || 'SUSPICIOUS_ACTIVITY',
        description: description || 'Aktivitas mencurigakan terdeteksi.',
        timestamp: new Date().toISOString(),
        level,
      };
      const violations = [...(session.violations || []), entry];
      const nextStatus = violationCount >= 2 && session.status !== 'completed' ? 'suspicious' : session.status;

      await updateDoc(ref, {
        violationCount,
        violations,
        status: nextStatus,
      });

      return { success: true, violationCount, level, entry };
    } catch (error) {
      if (error instanceof DomainValidationError) throw error;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  submitExam: async (examId: string, studentId: string, answers?: Record<string, any>) => {
    const sessionKey = `${examId}_${studentId}`;
    const path = `exam_results/${sessionKey}`;
    try {
      if (examId.startsWith('rem_')) {
        const sourceExamId = examId.slice(4);
        const remKey = `${sourceExamId}_${studentId}`;
        const [remSnap, sourceExamSnap, sessionSnap, questionsSnap] = await Promise.all([
          getDoc(doc(db, 'remedial_assignments', remKey)),
          getDoc(doc(db, 'exams', sourceExamId)),
          getDoc(doc(db, 'exam_sessions', sessionKey)),
          getDocs(collection(db, 'questions')),
        ]);

        if (!remSnap.exists() || !sessionSnap.exists()) {
          throw new DomainValidationError('Data remedial atau sesi tidak ditemukan.');
        }

        const rem = remSnap.data() as any;
        const sourceExam = sourceExamSnap.exists() ? (sourceExamSnap.data() as any) : null;
        const session = sessionSnap.data() as any;
        const finalAnswers = answers ? { ...(session.answers || {}), ...answers } : session.answers || {};
        const completedAt = new Date().toISOString();

        const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const qMap = new Map(allQuestions.map((q: any) => [q.id, q]));
        const qIds: string[] = Array.isArray(session.questionIds)
          ? session.questionIds
          : Array.isArray(rem.questionIds)
          ? rem.questionIds
          : [];

        let correctCount = 0;
        let wrongCount = 0;
        let emptyCount = 0;
        let correctUnits = 0;
        const pgKompleksMode = sourceExam?.scoringConfig?.pgKompleksMode === 'exact' ? 'exact' : 'partial';

        for (const qid of qIds) {
          const master = qMap.get(qid);
          const studentAns = finalAnswers[qid];
          const isUnanswered =
            studentAns === undefined ||
            studentAns === null ||
            studentAns === '' ||
            (Array.isArray(studentAns) && studentAns.length === 0);

          if (isUnanswered) {
            emptyCount++;
          } else if (master?.type === 'pg') {
            if (String(studentAns).trim().toUpperCase() === String(master.correctAnswer).trim().toUpperCase()) {
              correctCount++;
              correctUnits += 1;
            } else {
              wrongCount++;
            }
          } else if (master?.type === 'pg_kompleks') {
            const correctArr = Array.isArray(master.correctAnswer)
              ? Array.from(new Set(master.correctAnswer.map(String))).sort()
              : [];
            const studentArr = Array.isArray(studentAns)
              ? Array.from(new Set(studentAns.map(String))).sort()
              : [];
            if (correctArr.length > 0 && JSON.stringify(correctArr) === JSON.stringify(studentArr)) {
              correctCount++;
              correctUnits += 1;
            } else {
              wrongCount++;
              if (pgKompleksMode === 'partial' && correctArr.length > 0) {
                const matches = studentArr.filter((item: string) => correctArr.includes(item)).length;
                if (matches > 0) {
                  correctUnits += matches / correctArr.length;
                }
              }
            }
          } else if (master?.type === 'benar_salah') {
            if (String(studentAns) === String(master.correctAnswer)) {
              correctCount++;
              correctUnits += 1;
            } else {
              wrongCount++;
            }
          } else if (master?.type === 'esai') {
            correctCount++;
            correctUnits += 0.8;
          }
        }

        const scoring = computeRemedialFinalScore({
          baseScore: Number(rem.baseScore) || 0,
          kktpScore: Number(rem.kktpScore) || Number(sourceExam?.kktpScore) || 75,
          pointsPerCorrect: Number(rem.pointsPerCorrect) || 10,
          correctUnits,
        });

        await Promise.all([
          updateDoc(doc(db, 'exam_sessions', sessionKey), stripUndefinedDeep({
            answers: finalAnswers,
            status: 'completed',
            completedAt,
          })),
          updateDoc(doc(db, 'remedial_assignments', remKey), stripUndefinedDeep({
            status: 'completed',
            remedialCorrectCount: correctCount,
            remedialWrongCount: wrongCount,
            remedialEmptyCount: emptyCount,
            addedScore: scoring.addedScore,
            finalCappedScore: scoring.finalCappedScore,
            isPassed: scoring.isPassed,
            completedAt,
            updatedAt: completedAt,
          })),
        ]);

        return {
          success: true,
          result: {
            finalScore: scoring.finalCappedScore,
            isPassed: scoring.isPassed,
            correctCount,
            wrongCount,
            emptyCount,
            totalQuestions: qIds.length,
            isPublished: true,
            isRemedial: true,
            baseScore: rem.baseScore,
            addedScore: scoring.addedScore,
            kktpScore: rem.kktpScore,
          },
        };
      }

      const [examSnap, sessionSnap, questionsSnap] = await Promise.all([
        getDoc(doc(db, 'exams', examId)),
        getDoc(doc(db, 'exam_sessions', sessionKey)),
        getDocs(collection(db, 'questions')),
      ]);

      const exam = examSnap.exists() ? ({ id: examSnap.id, ...(examSnap.data() as any) }) : null;
      const session = sessionSnap.exists() ? ({ ...(sessionSnap.data() as any) }) : null;
      if (!exam || !session) {
        throw new DomainValidationError('Data ujian atau sesi tidak ditemukan.');
      }

      const finalAnswers = answers ? { ...(session.answers || {}), ...answers } : session.answers || {};
      const completedAt = new Date().toISOString();

      const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const qMap = new Map(allQuestions.map((q: any) => [q.id, q]));
      const questionIds: string[] = Array.isArray(session.questionIds) ? session.questionIds : [];

      let totalPointsEarned = 0;
      let maxPossiblePoints = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let emptyCount = 0;

      const breakdownByCognitive: Record<string, { total: number; correct: number }> = {
        LOTS: { total: 0, correct: 0 },
        MOTS: { total: 0, correct: 0 },
        HOTS: { total: 0, correct: 0 },
      };

      const useMinusSystem = Boolean(exam.scoringConfig?.useMinusSystem);
      const minusValue = useMinusSystem ? Math.abs(Number(exam.scoringConfig?.minusValue) || 0) : 0;
      const pgKompleksMode = exam.scoringConfig?.pgKompleksMode === 'exact' ? 'exact' : 'partial';

      const questionDetails = questionIds.map((qid: string, idx: number) => {
        const master = qMap.get(qid);
        const studentAns = finalAnswers[qid];
        const cogLevel = master?.cognitiveLevel || 'MOTS';
        const configuredWeight = exam.scoringConfig?.weights?.[cogLevel];
        const points =
          typeof configuredWeight === 'number' && !Number.isNaN(configuredWeight) && configuredWeight >= 0
            ? configuredWeight
            : master?.points || 10;
        maxPossiblePoints += points;

        if (!breakdownByCognitive[cogLevel]) {
          breakdownByCognitive[cogLevel] = { total: 0, correct: 0 };
        }
        breakdownByCognitive[cogLevel].total += 1;

        let isCorrect = false;
        let scoreEarned = 0;
        let pendingManualGrade = false;

        const isUnanswered =
          studentAns === undefined ||
          studentAns === null ||
          studentAns === '' ||
          (Array.isArray(studentAns) && studentAns.length === 0);

        if (isUnanswered) {
          emptyCount++;
        } else if (master?.type === 'pg') {
          if (String(studentAns).trim().toUpperCase() === String(master.correctAnswer).trim().toUpperCase()) {
            isCorrect = true;
            scoreEarned = points;
            correctCount++;
            breakdownByCognitive[cogLevel].correct += 1;
          } else {
            wrongCount++;
            if (useMinusSystem) scoreEarned = -minusValue;
          }
        } else if (master?.type === 'pg_kompleks') {
          const correctArr = Array.isArray(master.correctAnswer)
            ? Array.from(new Set(master.correctAnswer.map(String))).sort()
            : [];
          const studentArr = Array.isArray(studentAns)
            ? Array.from(new Set(studentAns.map(String))).sort()
            : [];

          if (correctArr.length > 0 && JSON.stringify(correctArr) === JSON.stringify(studentArr)) {
            isCorrect = true;
            scoreEarned = points;
            correctCount++;
            breakdownByCognitive[cogLevel].correct += 1;
          } else {
            wrongCount++;
            if (pgKompleksMode === 'exact') {
              scoreEarned = useMinusSystem ? -minusValue : 0;
            } else if (correctArr.length > 0) {
              const matches = studentArr.filter((item: string) => correctArr.includes(item)).length;
              const wrongSelected = studentArr.length - matches;
              const partialPoints = matches > 0 ? (matches / correctArr.length) * points : 0;
              const penalty = useMinusSystem ? wrongSelected * minusValue : 0;
              scoreEarned = Number((partialPoints - penalty).toFixed(4));
            }
          }
        } else if (master?.type === 'benar_salah') {
          if (String(studentAns) === String(master.correctAnswer)) {
            isCorrect = true;
            scoreEarned = points;
            correctCount++;
            breakdownByCognitive[cogLevel].correct += 1;
          } else {
            wrongCount++;
            if (useMinusSystem) scoreEarned = -minusValue;
          }
        } else if (master?.type === 'esai') {
          pendingManualGrade = true;
          scoreEarned = Math.round(points * 0.8);
          totalPointsEarned += scoreEarned;
        }

        if (!pendingManualGrade) {
          totalPointsEarned += scoreEarned;
        }

        return {
          questionId: qid,
          questionCode: master?.code || '',
          number: idx + 1,
          cognitiveLevel: cogLevel,
          subchapterId: master?.subchapterId ?? null,
          competencyId: master?.competencyId ?? null,
          studentAnswer: studentAns ?? null,
          isCorrect,
          scoreEarned,
          maxPoints: points,
          pendingManualGrade,
        };
      });

      const finalScore =
        maxPossiblePoints > 0
          ? Math.round((totalPointsEarned / maxPossiblePoints) * (exam.maxScore || 100))
          : 0;
      const isPassed = finalScore >= (exam.kktpScore || 75);

      const result = stripUndefinedDeep({
        id: `res-${Date.now()}`,
        examId,
        studentId,
        studentName: session.studentName || '',
        studentNis: session.studentNis || '',
        className: session.className || '',
        completedAt,
        finalScore,
        isPassed,
        kktpScore: exam.kktpScore || 75,
        correctCount,
        wrongCount,
        emptyCount,
        totalQuestions: questionIds.length,
        breakdownByCognitive,
        questionDetails,
        violationsRecorded: session.violations || [],
      });

      await Promise.all([
        updateDoc(doc(db, 'exam_sessions', sessionKey), stripUndefinedDeep({
          answers: finalAnswers,
          status: 'completed',
          completedAt,
        })),
        setDoc(doc(db, 'exam_results', sessionKey), result),
      ]);

      return {
        success: true,
        result: {
          finalScore: result.finalScore,
          isPassed: result.isPassed,
          correctCount,
          wrongCount,
          emptyCount,
          totalQuestions: questionIds.length,
          isPublished: exam.isPublishedResults,
        },
      };
    } catch (error) {
      if (error instanceof DomainValidationError) throw error;
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  getMonitoringData: async (examId: string) => {
    const path = `exams/${examId}`;
    try {
      const [examSnap, usersSnap, classesSnap, sessionsSnap, resultsSnap, questionsSnap] = await Promise.all([
        getDoc(doc(db, 'exams', examId)),
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(collection(db, 'classes')),
        getDocs(query(collection(db, 'exam_sessions'), where('examId', '==', examId))),
        getDocs(query(collection(db, 'exam_results'), where('examId', '==', examId))),
        getDocs(collection(db, 'questions')),
      ]);

      const exam = examSnap.exists() ? examSnap.data() : null;
      if (!exam) {
        throw new Error('Ujian tidak ditemukan.');
      }

      const targetClassIds: string[] = Array.isArray(exam.targetClassIds) ? exam.targetClassIds : [];
      const students = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u: any) => targetClassIds.includes(u.classId));

      const classMap = new Map<string, string>();
      for (const c of classesSnap.docs) {
        const data = c.data();
        classMap.set(data.id || c.id, data.name || 'Kelas');
      }

      const sessionMap = new Map<string, any>();
      for (const s of sessionsSnap.docs) {
        const data = s.data();
        if (data.studentId) sessionMap.set(data.studentId, data);
      }

      const resultMap = new Map<string, any>();
      for (const r of resultsSnap.docs) {
        const data = r.data();
        if (data.studentId) resultMap.set(data.studentId, data);
      }

      const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const showLiveScore = Boolean(exam.showLiveScore);
      const now = Date.now();

      const monitorData = students.map((student: any) => {
        const session = sessionMap.get(student.id);
        const result = resultMap.get(student.id);

        let status = 'not_started';
        let remainingSeconds = (exam.durationMinutes || 60) * 60;
        let currentQuestionIndex = 0;
        let answeredCount = 0;
        const totalQuestions = session?.questionIds?.length || exam.cognitiveTarget?.totalQuestions || 5;
        let violationCount = 0;
        let violations: any[] = [];

        if (session) {
          status = session.status || 'in_progress';
          remainingSeconds = session.remainingSeconds ?? 0;
          currentQuestionIndex = session.currentQuestionIndex || 0;
          answeredCount = Object.values(session.answers || {}).filter(
            (v: any) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
          ).length;
          violationCount = session.violationCount || 0;
          violations = session.violations || [];

          if (status === 'in_progress' && session.lastHeartbeat) {
            const diff = now - new Date(session.lastHeartbeat).getTime();
            if (diff > 60000) status = 'disconnected';
          }
        }

        const scoreInfo = computeLiveStudentScore({
          session,
          result,
          allQuestions,
          exam,
        });

        return {
          studentId: student.id,
          name: student.name,
          nis: student.nis || student.username,
          classId: student.classId,
          className: classMap.get(student.classId) || 'Kelas',
          status,
          remainingSeconds,
          currentQuestionIndex,
          answeredCount,
          totalQuestions,
          progressPercent: totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0,
          violationCount,
          violations,
          hasFinished: status === 'completed',
          finalScore: showLiveScore && result ? result.finalScore : null,
          liveScore: showLiveScore ? scoreInfo.liveScore : null,
          liveCorrectCount: showLiveScore ? scoreInfo.liveCorrectCount : 0,
          isPassed: result ? result.isPassed : null,
        };
      });

      const summary = {
        totalStudents: students.length,
        notStarted: monitorData.filter((s) => s.status === 'not_started').length,
        inProgress: monitorData.filter((s) => s.status === 'in_progress').length,
        completed: monitorData.filter((s) => s.status === 'completed').length,
        disconnected: monitorData.filter((s) => s.status === 'disconnected').length,
        suspicious: monitorData.filter((s) => s.status === 'suspicious' || s.violationCount > 1).length,
      };

      return {
        exam: {
          id: exam.id,
          title: exam.title,
          token: exam.token,
          isTokenActive: exam.isTokenActive,
          durationMinutes: exam.durationMinutes,
          scheduleEnd: exam.scheduleEnd,
          kktpScore: exam.kktpScore,
          maxScore: exam.maxScore || 100,
          showLiveScore,
        },
        summary,
        students: monitorData,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  manageStudentSession: async (
    examId: string,
    studentId: string,
    action: 'ADD_TIME' | 'RESET_SESSION',
    additionalMinutes?: number
  ) => {
    const sessionKey = `${examId}_${studentId}`;
    const sessionPath = `exam_sessions/${sessionKey}`;
    try {
      if (action === 'ADD_TIME') {
        const ref = doc(db, 'exam_sessions', sessionKey);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Sesi siswa tidak ditemukan.');
        const current = Number(snap.data()?.remainingSeconds) || 0;
        const added = (Number(additionalMinutes) || 10) * 60;
        await updateDoc(ref, { remainingSeconds: current + added });
        return { success: true, message: `Berhasil menambahkan waktu ${additionalMinutes || 10} menit.` };
      }
      if (action === 'RESET_SESSION') {
        await Promise.all([
          deleteDoc(doc(db, 'exam_sessions', sessionKey)),
          deleteDoc(doc(db, 'exam_results', sessionKey)),
        ]);
        return { success: true, message: 'Sesi siswa berhasil direset. Siswa dapat memulai ulang.' };
      }
      throw new Error('Aksi tidak valid.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, sessionPath);
    }
  },

  getExamResults: async (examId: string) => {
    const path = 'exam_results';
    try {
      const [examSnap, resultsSnap, questionsSnap, remSnap] = await Promise.all([
        getDoc(doc(db, 'exams', examId)),
        getDocs(query(collection(db, path), where('examId', '==', examId))),
        getDocs(collection(db, 'questions')),
        getDocs(query(collection(db, 'remedial_assignments'), where('sourceExamId', '==', examId))),
      ]);
      const exam = examSnap.exists() ? examSnap.data() : null;
      const questionCodeMap = new Map<string, string>();
      for (const qDoc of questionsSnap.docs) {
        const qd = qDoc.data() as any;
        questionCodeMap.set(String(qd.id || qDoc.id), String(qd.code || ''));
      }
      const remedialByStudent = new Map<string, any>();
      for (const remDoc of remSnap.docs) {
        const rd = remDoc.data() as any;
        if (rd.studentId) {
          remedialByStudent.set(String(rd.studentId), rd);
        }
      }
      const results = resultsSnap.docs.map((d) => {
        const r = d.data() as any;
        const rem = remedialByStudent.get(String(r.studentId)) || null;
        const isRemedialPassed =
          !Boolean(r.isPassed) && rem?.status === 'completed' && Boolean(rem?.isPassed);
        const kktpStatusLabel = r.isPassed
          ? 'Tuntas'
          : isRemedialPassed
          ? 'Tuntas Remedial'
          : 'Perlu Remedial';

        const enrichedDetails = Array.isArray(r.questionDetails)
          ? r.questionDetails.map((qd: any) => ({
              ...qd,
              questionCode: qd.questionCode || questionCodeMap.get(String(qd.questionId)) || qd.questionId || '-',
            }))
          : [];
        return {
          ...r,
          isRemedialPassed,
          kktpStatusLabel,
          questionDetails: enrichedDetails,
        };
      });
      const scores = results.map((r: any) => r.finalScore || 0);
      const highest = scores.length ? Math.max(...scores) : 0;
      const lowest = scores.length ? Math.min(...scores) : 0;
      const average = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      const sorted = [...scores].sort((a, b) => a - b);
      const median = sorted.length
        ? sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]
        : 0;
      const passedCount = results.filter((r: any) => r.isPassed || r.isRemedialPassed).length;
      const passingRate = results.length ? Math.round((passedCount / results.length) * 100) : 0;

      return {
        exam,
        results,
        stats: {
          totalParticipants: results.length,
          highest,
          lowest,
          average,
          median,
          passedCount,
          failedCount: results.length - passedCount,
          passingRate,
        },
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  getStudentResults: async (studentId: string) => {
    const path = 'exam_results';
    try {
      const [resultsSnap, examsSnap, remSnap] = await Promise.all([
        getDocs(query(collection(db, path), where('studentId', '==', studentId))),
        getDocs(collection(db, 'exams')),
        getDocs(query(collection(db, 'remedial_assignments'), where('studentId', '==', studentId))),
      ]);

      const examMap = new Map<string, any>();
      for (const eDoc of examsSnap.docs) {
        const data = eDoc.data() as any;
        examMap.set(data.id || eDoc.id, data);
      }

      const regularResults = resultsSnap.docs.map((d) => {
        const r = d.data() as any;
        const exam = examMap.get(r.examId);
        const isPublished = Boolean(exam?.isPublishedResults);
        return {
          id: r.id || d.id,
          examId: r.examId,
          examTitle: exam?.title || 'Ujian Sekolah',
          studentId: r.studentId,
          studentName: r.studentName || '-',
          studentNis: r.studentNis || '-',
          className: r.className || '-',
          completedAt: r.completedAt || '',
          correctCount: isPublished ? (Number(r.correctCount) || 0) : null,
          wrongCount: isPublished ? (Number(r.wrongCount) || 0) : null,
          emptyCount: Number(r.emptyCount) || 0,
          totalQuestions: Number(r.totalQuestions) || 0,
          isPublishedResults: isPublished,
          finalScore: isPublished ? (r.finalScore ?? 0) : null,
          isRemedial: false,
        };
      });

      const remedialResults = remSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((rem: any) => rem.status === 'completed')
        .map((rem: any) => ({
          id: `rem-res-${rem.id}`,
          examId: `rem_${rem.sourceExamId}`,
          examTitle: `[REMEDIAL] ${rem.sourceExamTitle || 'Ujian Sekolah'}`,
          studentId: rem.studentId,
          studentName: rem.studentName || '-',
          studentNis: rem.studentNis || '-',
          className: rem.className || '-',
          completedAt: rem.completedAt || rem.updatedAt || rem.createdAt || '',
          correctCount: Number(rem.remedialCorrectCount) || 0,
          wrongCount: Number(rem.remedialWrongCount) || 0,
          emptyCount: Number(rem.remedialEmptyCount) || 0,
          totalQuestions: Array.isArray(rem.questionIds) ? rem.questionIds.length : 0,
          isPublishedResults: true,
          finalScore: rem.finalCappedScore ?? rem.baseScore ?? 0,
          isRemedial: true,
          baseScore: Number(rem.baseScore) || 0,
          addedScore: Number(rem.addedScore) || 0,
          kktpScore: Number(rem.kktpScore) || 75,
          attemptCount: Number(rem.attemptCount) || 1,
          isRemedialPassed: Boolean(rem.isPassed),
        }));

      const results = [...regularResults, ...remedialResults].sort(
        (a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
      );

      const publishedScores = results
        .filter((r) => r.isPublishedResults && typeof r.finalScore === 'number')
        .map((r) => r.finalScore as number);

      const hasHiddenScores = results.some((r) => !r.isPublishedResults);
      const sorted = [...publishedScores].sort((a, b) => a - b);

      const stats =
        results.length === 0
          ? { totalCompleted: 0, hasHiddenScores: false, average: 0, highest: 0, lowest: 0, median: 0 }
          : publishedScores.length === 0
          ? {
              totalCompleted: results.length,
              hasHiddenScores: true,
              average: null,
              highest: null,
              lowest: null,
              median: null,
            }
          : {
              totalCompleted: results.length,
              hasHiddenScores,
              average: Math.round(publishedScores.reduce((a, b) => a + b, 0) / publishedScores.length),
              highest: Math.max(...publishedScores),
              lowest: Math.min(...publishedScores),
              median:
                sorted.length % 2 === 0
                  ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                  : sorted[Math.floor(sorted.length / 2)],
            };

      return { results, stats };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  // --- REMEDIAL ---
  getRemedialOverview: async (requestedExamId?: string) => {
    const path = 'remedial_assignments';
    try {
      const [examsSnap, resultsSnap, remSnap, questionsSnap, taxSnap] = await Promise.all([
        getDocs(collection(db, 'exams')),
        getDocs(collection(db, 'exam_results')),
        getDocs(collection(db, 'remedial_assignments')),
        getDocs(collection(db, 'questions')),
        getDocs(collection(db, 'taxonomy')),
      ]);

      const exams = examsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const allResults = resultsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const allRemedials = remSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const taxItems = taxSnap.docs.map((d) => d.data() as any);

      const subjectMap = new Map<string, string>(
        taxItems.filter((t) => t.type === 'subject').map((s) => [String(s.id), String(s.name || 'Mata Pelajaran')])
      );
      const subchapterMap = new Map<string, string>(
        taxItems.filter((t) => t.type === 'subchapter').map((s) => [String(s.id), String(s.name || '')])
      );
      const compMap = new Map<string, string>(
        taxItems.filter((t) => t.type === 'competency').map((c) => [String(c.id), String(c.code || c.description || '')])
      );

      const completedExams = exams
        .map((exam: any) => {
          const examResults = allResults.filter((r: any) => r.examId === exam.id);
          if (examResults.length === 0) return null;
          const kktp = Number(exam.kktpScore) || 75;
          const examRems = allRemedials.filter((rem: any) => rem.sourceExamId === exam.id);
          return {
            id: exam.id,
            title: exam.title,
            subjectName: subjectMap.get(String(exam.subjectId)) || 'Mata Pelajaran',
            kktpScore: kktp,
            maxScore: Number(exam.maxScore) || 100,
            participantCount: examResults.length,
            remedialNeededCount: examResults.filter((r: any) => (Number(r.finalScore) || 0) < kktp).length,
            remedialAssignedCount: examRems.length,
            remedialCompletedCount: examRems.filter((rem: any) => rem.status === 'completed').length,
          };
        })
        .filter(Boolean) as any[];

      const selectedExamId =
        requestedExamId && completedExams.some((e: any) => e.id === requestedExamId)
          ? requestedExamId
          : completedExams[0]?.id || '';

      const selectedExamObj = selectedExamId
        ? exams.find((e: any) => e.id === selectedExamId) || null
        : null;

      if (!selectedExamObj) {
        return {
          completedExams,
          selectedExam: null,
          students: [],
          summary: {
            totalParticipants: 0,
            passedCount: 0,
            remedialCount: 0,
            generatedCount: 0,
            completedRemedialCount: 0,
            passedAfterRemedialCount: 0,
          },
        };
      }

      const kktpScore = Number(selectedExamObj.kktpScore) || 75;
      const maxScore = Number(selectedExamObj.maxScore) || 100;
      const remByKey = new Map<string, any>(allRemedials.map((rem) => [rem.id, rem]));

      const examResults = allResults
        .filter((r: any) => r.examId === selectedExamId)
        .sort((a: any, b: any) => (Number(a.finalScore) || 0) - (Number(b.finalScore) || 0));

      const students = examResults.map((r: any) => {
        const remKey = `${selectedExamId}_${r.studentId}`;
        const rem = remByKey.get(remKey) || null;
        const originalScore = Number(r.finalScore) || 0;
        const isPassedOriginal = originalScore >= kktpScore;
        const wrongDetails = extractWrongQuestionDetails(r, allQuestions);

        const wrongSubchapterNames = Array.from(
          new Set(
            wrongDetails
              .map((w) => (w.subchapterId ? subchapterMap.get(String(w.subchapterId)) : ''))
              .filter(Boolean)
          )
        ) as string[];

        const wrongCompetencyCodes = Array.from(
          new Set(
            wrongDetails
              .map((w) => (w.competencyId ? compMap.get(String(w.competencyId)) : ''))
              .filter(Boolean)
          )
        ) as string[];

        const effectiveScore =
          rem && rem.status === 'completed' && typeof rem.finalCappedScore === 'number'
            ? rem.finalCappedScore
            : originalScore;
        const effectivePassed = effectiveScore >= kktpScore;

        const normalizedRem = rem
          ? rem.durationSeconds
            ? rem
            : {
                ...rem,
                ...computeRemedialDuration({
                  examDurationMinutes: Number(selectedExamObj.durationMinutes) || 60,
                  examTotalQuestions:
                    Number(r.totalQuestions) ||
                    Number(rem.originalTotalQuestions) ||
                    (Array.isArray(rem.questionIds) ? rem.questionIds.length : 1),
                  remedialQuestionCount: Array.isArray(rem.questionIds) ? rem.questionIds.length : 1,
                }),
              }
          : null;

        return {
          studentId: r.studentId,
          studentName: r.studentName || '-',
          studentNis: r.studentNis || '-',
          className: r.className || '-',
          originalScore,
          kktpScore,
          isPassedOriginal,
          correctCount: Number(r.correctCount) || 0,
          wrongCount: Number(r.wrongCount) || 0,
          emptyCount: Number(r.emptyCount) || 0,
          totalQuestions: Number(r.totalQuestions) || 0,
          wrongSubchapterNames,
          wrongCompetencyCodes,
          remedial: normalizedRem,
          effectiveScore,
          effectivePassed,
        };
      });

      const summary = {
        totalParticipants: students.length,
        passedCount: students.filter((s) => s.isPassedOriginal).length,
        remedialCount: students.filter((s) => !s.isPassedOriginal).length,
        generatedCount: students.filter((s) => Boolean(s.remedial)).length,
        completedRemedialCount: students.filter((s) => s.remedial?.status === 'completed').length,
        passedAfterRemedialCount: students.filter((s) => s.effectivePassed).length,
      };

      return {
        completedExams,
        selectedExam: {
          id: selectedExamObj.id,
          title: selectedExamObj.title,
          subjectName: subjectMap.get(String(selectedExamObj.subjectId)) || 'Mata Pelajaran',
          kktpScore,
          maxScore,
          durationMinutes: Number(selectedExamObj.durationMinutes) || 60,
        },
        students,
        summary,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  generateRemedials: async (payload: {
    examId: string;
    mode: RemedialMode;
    studentIds?: string[];
    durationMinutes?: number;
    actorName?: string;
    actorRole?: string;
  }) => {
    const path = 'remedial_assignments';
    try {
      const { examId, mode, studentIds, actorName, actorRole } = payload;
      if (!examId) throw new DomainValidationError('Pilih paket ujian terlebih dahulu.');
      if (mode !== 'same_wrong' && mode !== 'random_same_competency') {
        throw new DomainValidationError('Mode soal remedial tidak valid.');
      }

      const [examSnap, resultsSnap, questionsSnap, taxSnap, existingRemSnap] = await Promise.all([
        getDoc(doc(db, 'exams', examId)),
        getDocs(query(collection(db, 'exam_results'), where('examId', '==', examId))),
        getDocs(collection(db, 'questions')),
        getDocs(query(collection(db, 'taxonomy'), where('type', '==', 'subject'))),
        getDocs(query(collection(db, 'remedial_assignments'), where('sourceExamId', '==', examId))),
      ]);

      if (!examSnap.exists()) throw new DomainValidationError('Paket ujian tidak ditemukan.');
      const exam = { id: examSnap.id, ...(examSnap.data() as any) };
      const kktpScore = Number(exam.kktpScore) || 75;
      const maxScore = Number(exam.maxScore) || 100;
      const examDurationMinutes = Number(exam.durationMinutes) || 60;
      const subjectDoc = taxSnap.docs.find((s) => (s.data() as any).id === exam.subjectId || s.id === `subject-${exam.subjectId}`);
      const subjectName = (subjectDoc?.data() as any)?.name || 'Mata Pelajaran';

      const existingById = new Map<string, any>();
      for (const rDoc of existingRemSnap.docs) {
        existingById.set(rDoc.id, rDoc.data());
      }

      const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const allTargetResults = resultsSnap.docs
        .map((d) => d.data() as any)
        .filter((r) => {
          if ((Number(r.finalScore) || 0) >= kktpScore) return false;
          if (Array.isArray(studentIds) && studentIds.length > 0) {
            return studentIds.includes(r.studentId);
          }
          return true;
        });

      if (allTargetResults.length === 0) {
        throw new DomainValidationError('Tidak ada murid dengan nilai di bawah KKM untuk dibuatkan soal remedial.');
      }

      let alreadyPassedCount = 0;
      let activePendingCount = 0;
      const targetResults = allTargetResults.filter((r) => {
        const remId = `${examId}_${r.studentId}`;
        const existing = existingById.get(remId);
        if (!existing) return true;
        if (existing.status === 'completed' && existing.isPassed) {
          alreadyPassedCount++;
          return false;
        }
        if (existing.status === 'assigned' || existing.status === 'in_progress') {
          activePendingCount++;
          return false;
        }
        return true;
      });

      if (targetResults.length === 0) {
        if (activePendingCount > 0 && alreadyPassedCount === 0) {
          throw new DomainValidationError(
            'Jadwal remedial hanya untuk 1x pengerjaan. Murid yang dipilih masih memiliki jadwal aktif yang belum diselesaikan.'
          );
        }
        if (alreadyPassedCount > 0 && activePendingCount === 0) {
          throw new DomainValidationError(
            'Murid yang dipilih sudah Tuntas Remedial dan tidak perlu dijadwalkan kembali.'
          );
        }
        throw new DomainValidationError(
          'Tidak ada murid yang memenuhi syarat penjadwalan remedial saat ini (pastikan remedial sebelumnya sudah selesai dan belum lulus).'
        );
      }

      const nowIso = new Date().toISOString();
      const generatedAssignments: any[] = [];

      for (const r of targetResults) {
        const remId = `${examId}_${r.studentId}`;
        const existing = existingById.get(remId) || null;
        const isReschedule = Boolean(existing && existing.status === 'completed' && !existing.isPassed);
        const prevHistory = Array.isArray(existing?.attemptHistory) ? [...existing.attemptHistory] : [];
        if (isReschedule && existing) {
          prevHistory.push({
            attempt: Number(existing.attemptCount) || 1,
            mode: existing.mode,
            questionCount: Array.isArray(existing.questionIds) ? existing.questionIds.length : 0,
            correctCount: Number(existing.remedialCorrectCount) || 0,
            wrongCount: Number(existing.remedialWrongCount) || 0,
            emptyCount: Number(existing.remedialEmptyCount) || 0,
            finalCappedScore: Number(existing.finalCappedScore) || Number(existing.baseScore) || 0,
            isPassed: false,
            completedAt: existing.completedAt || existing.updatedAt || nowIso,
          });
        }
        const nextAttemptCount = isReschedule ? (Number(existing?.attemptCount) || 1) + 1 : 1;
        const baseScore = Number(r.finalScore) || 0;
        const wrongQuestions = extractWrongQuestionDetails(r, allQuestions);
        const originalTotalQuestions =
          Number(r.totalQuestions) ||
          (Array.isArray(r.questionDetails) ? r.questionDetails.length : 0) ||
          Number(exam.cognitiveTarget?.totalQuestions) ||
          Math.max(1, wrongQuestions.length);
        const neededQuestionCount = computeRemedialQuestionCount({
          baseScore,
          kktpScore,
          maxScore,
          originalTotalQuestions,
        });
        const requiredCount =
          isReschedule && Array.isArray(existing?.questionIds) && existing.questionIds.length > 0
            ? existing.questionIds.length
            : neededQuestionCount;
        const previousQuestionIds =
          isReschedule && Array.isArray(existing?.questionIds) ? existing.questionIds : undefined;

        const { questionIds, fallbackUsedCount } = selectRemedialQuestions({
          mode,
          wrongQuestions,
          originalQuestionDetails: Array.isArray(r.questionDetails) ? r.questionDetails : [],
          allQuestions,
          examSubjectId: exam.subjectId || '',
          requiredCount,
          previousQuestionIds,
        });

        if (questionIds.length === 0) continue;

        const pointsPerCorrect = computePointsPerCorrectForRemedial({
          baseScore,
          kktpScore,
          maxScore,
          originalTotalQuestions,
          remedialQuestionCount: questionIds.length,
        });
        const { durationMinutes: remDurationMinutes, durationSeconds: remDurationSeconds } =
          computeRemedialDuration({
            examDurationMinutes,
            examTotalQuestions: originalTotalQuestions,
            remedialQuestionCount: questionIds.length,
          });

        const assignment = stripUndefinedDeep({
          id: remId,
          sourceExamId: examId,
          sourceExamTitle: exam.title,
          subjectId: exam.subjectId || '',
          subjectName,
          studentId: r.studentId,
          studentName: r.studentName || '-',
          studentNis: r.studentNis || '-',
          className: r.className || '-',
          mode,
          questionIds,
          wrongQuestions,
          originalTotalQuestions,
          baseScore,
          kktpScore,
          maxScore,
          pointsPerCorrect,
          durationMinutes: remDurationMinutes,
          durationSeconds: remDurationSeconds,
          attemptCount: nextAttemptCount,
          attemptHistory: prevHistory,
          status: 'assigned',
          remedialCorrectCount: null,
          remedialWrongCount: null,
          remedialEmptyCount: null,
          addedScore: null,
          finalCappedScore: null,
          isPassed: false,
          completedAt: null,
          fallbackUsedCount,
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        });

        await setDoc(doc(db, 'remedial_assignments', remId), assignment);
        const remSessionKey = `rem_${examId}_${r.studentId}`;
        await deleteDoc(doc(db, 'exam_sessions', remSessionKey)).catch(() => {});
        generatedAssignments.push(assignment);
      }

      const modeLabel =
        mode === 'same_wrong'
          ? 'Soal Sama (Salah Dikerjakan)'
          : 'Soal Random (Jumlah & Sub-Sub-Bab Sama)';

      const logId = `log-${Date.now()}`;
      await setDoc(doc(db, 'activity_logs', logId), {
        id: logId,
        timestamp: nowIso,
        actorName: actorName || 'Guru / Admin',
        role: actorRole || 'teacher',
        action: 'GENERATE_REMEDIAL',
        details: `Generate remedial "${exam.title}" untuk ${generatedAssignments.length} murid (${modeLabel})`,
      }).catch(() => {});

      return {
        success: true,
        count: generatedAssignments.length,
        assignments: generatedAssignments,
        message: `Berhasil membuat soal remedial untuk ${generatedAssignments.length} murid (${modeLabel}).`,
      };
    } catch (error) {
      if (error instanceof DomainValidationError) throw error;
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // --- TAXONOMY ---
  getTaxonomy: async () => {
    const path = 'taxonomy';
    try {
      const snap = await getDocs(collection(db, path));
      const items = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));

      const stripMeta = ({ type: _t, docId: _d, ...rest }: any) => rest;
      const subjects = items.filter((i: any) => i.type === 'subject').map(stripMeta);
      const chapters = items.filter((i: any) => i.type === 'chapter').map(stripMeta);
      const subchapters = items.filter((i: any) => i.type === 'subchapter').map(stripMeta);
      const competencies = items.filter((i: any) => i.type === 'competency').map(stripMeta);

      return { subjects, chapters, subchapters, competencies };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createSubject: async (subjectData: { name: string; code?: string }) => {
    const path = 'taxonomy';
    try {
      const id = `sbj-${Date.now()}`;
      const subject = {
        id,
        name: (subjectData.name || '').trim(),
        code: (subjectData.code || subjectData.name.substring(0, 3).toUpperCase()).trim(),
      };
      await setDoc(doc(db, path, `subject-${id}`), { type: 'subject', ...subject });
      return { success: true, subject };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateSubject: async (id: string, subjectData: { name?: string; code?: string }) => {
    const path = `taxonomy/subject-${id}`;
    try {
      const ref = await findTaxonomyDocRef('subject', id);
      const payload: any = {};
      if (subjectData.name !== undefined) payload.name = subjectData.name.trim();
      if (subjectData.code !== undefined) payload.code = subjectData.code.trim();
      await updateDoc(ref, payload);
      const snap = await getDoc(ref);
      const data = snap.data() || {};
      delete data.type;
      return { success: true, subject: data, message: 'Mata pelajaran berhasil diperbarui.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteSubject: async (id: string) => {
    const path = `taxonomy/subject-${id}`;
    try {
      const allSnap = await getDocs(collection(db, 'taxonomy'));
      const allDocs = allSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
      const chapterIds = allDocs
        .filter((d) => d.data.type === 'chapter' && d.data.subjectId === id)
        .map((d) => d.data.id);
      const subchapterIds = allDocs
        .filter((d) => d.data.type === 'subchapter' && chapterIds.includes(d.data.chapterId))
        .map((d) => d.data.id);

      const subjectRef = await findTaxonomyDocRef('subject', id);
      await deleteDoc(subjectRef);

      for (const d of allDocs) {
        if (
          (d.data.type === 'chapter' && d.data.subjectId === id) ||
          (d.data.type === 'subchapter' && chapterIds.includes(d.data.chapterId)) ||
          (d.data.type === 'competency' && subchapterIds.includes(d.data.subchapterId))
        ) {
          await deleteDoc(d.ref);
        }
      }
      return { success: true, message: 'Mata pelajaran dan taksonomi turunannya berhasil dihapus.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  createChapter: async (chapterData: { subjectId: string; name: string }) => {
    const path = 'taxonomy';
    try {
      const id = `ch-${Date.now()}`;
      const chapter = {
        id,
        subjectId: chapterData.subjectId,
        name: (chapterData.name || '').trim(),
      };
      await setDoc(doc(db, path, `chapter-${id}`), { type: 'chapter', ...chapter });
      return { success: true, chapter };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateChapter: async (id: string, chapterData: { name?: string; subjectId?: string }) => {
    const path = `taxonomy/chapter-${id}`;
    try {
      const ref = await findTaxonomyDocRef('chapter', id);
      const payload: any = {};
      if (chapterData.name !== undefined) payload.name = chapterData.name.trim();
      if (chapterData.subjectId !== undefined) payload.subjectId = chapterData.subjectId;
      await updateDoc(ref, payload);
      const snap = await getDoc(ref);
      const data = snap.data() || {};
      delete data.type;
      return { success: true, chapter: data, message: 'Bab berhasil diperbarui.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteChapter: async (id: string) => {
    const path = `taxonomy/chapter-${id}`;
    try {
      const allSnap = await getDocs(collection(db, 'taxonomy'));
      const allDocs = allSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
      const subchapterIds = allDocs
        .filter((d) => d.data.type === 'subchapter' && d.data.chapterId === id)
        .map((d) => d.data.id);

      const chapterRef = await findTaxonomyDocRef('chapter', id);
      await deleteDoc(chapterRef);

      for (const d of allDocs) {
        if (
          (d.data.type === 'subchapter' && d.data.chapterId === id) ||
          (d.data.type === 'competency' && subchapterIds.includes(d.data.subchapterId))
        ) {
          await deleteDoc(d.ref);
        }
      }
      return { success: true, message: 'Bab dan taksonomi turunannya berhasil dihapus.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  createSubchapter: async (subData: { chapterId: string; name: string }) => {
    const path = 'taxonomy';
    try {
      const id = `sub-${Date.now()}`;
      const subchapter = {
        id,
        chapterId: subData.chapterId,
        name: (subData.name || '').trim(),
      };
      await setDoc(doc(db, path, `subchapter-${id}`), { type: 'subchapter', ...subchapter });
      return { success: true, subchapter };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateSubchapter: async (id: string, subData: { name?: string; chapterId?: string }) => {
    const path = `taxonomy/subchapter-${id}`;
    try {
      const ref = await findTaxonomyDocRef('subchapter', id);
      const payload: any = {};
      if (subData.name !== undefined) payload.name = subData.name.trim();
      if (subData.chapterId !== undefined) payload.chapterId = subData.chapterId;
      await updateDoc(ref, payload);
      const snap = await getDoc(ref);
      const data = snap.data() || {};
      delete data.type;
      return { success: true, subchapter: data, message: 'Sub Bab berhasil diperbarui.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteSubchapter: async (id: string) => {
    const path = `taxonomy/subchapter-${id}`;
    try {
      const allSnap = await getDocs(collection(db, 'taxonomy'));
      const subRef = await findTaxonomyDocRef('subchapter', id);
      await deleteDoc(subRef);

      for (const d of allSnap.docs) {
        const data = d.data();
        if (data.type === 'competency' && data.subchapterId === id) {
          await deleteDoc(d.ref);
        }
      }
      return { success: true, message: 'Sub Bab dan indikator turunannya berhasil dihapus.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  createCompetency: async (compData: { subchapterId: string; code: string; description: string }) => {
    const path = 'taxonomy';
    try {
      const id = `cmp-${Date.now()}`;
      const competency = {
        id,
        subchapterId: compData.subchapterId,
        code: (compData.code || '').trim(),
        description: (compData.description || '').trim(),
      };
      await setDoc(doc(db, path, `competency-${id}`), { type: 'competency', ...competency });
      return { success: true, competency };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateCompetency: async (id: string, compData: { code?: string; description?: string; subchapterId?: string }) => {
    const path = `taxonomy/competency-${id}`;
    try {
      const ref = await findTaxonomyDocRef('competency', id);
      const payload: any = {};
      if (compData.code !== undefined) payload.code = compData.code.trim();
      if (compData.description !== undefined) payload.description = compData.description.trim();
      if (compData.subchapterId !== undefined) payload.subchapterId = compData.subchapterId;
      await updateDoc(ref, payload);
      const snap = await getDoc(ref);
      const data = snap.data() || {};
      delete data.type;
      return { success: true, competency: data, message: 'Sub-Sub Bab berhasil diperbarui.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteCompetency: async (id: string) => {
    const path = `taxonomy/competency-${id}`;
    try {
      const ref = await findTaxonomyDocRef('competency', id);
      await deleteDoc(ref);
      return { success: true, message: 'Sub-Sub Bab berhasil dihapus.' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },
};
