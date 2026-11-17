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
import { generateRandomPassword } from './passwordUtils';
import { computeLiveStudentScore } from './liveScore';
import { isQuestionInExamScope, questionMatchesScopeUnit, evaluateScopeAvailability } from './examPool';

class DomainValidationError extends Error {}

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
        return { settings: { ...DEFAULT_SETTINGS, ...snap.data() } };
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
      const current = snap.exists() ? snap.data() : DEFAULT_SETTINGS;
      const updated = {
        ...DEFAULT_SETTINGS,
        ...current,
        ...settingsData,
        updatedAt: new Date().toISOString(),
      };
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
      for (const uDoc of usersSnap.docs) {
        await updateDoc(uDoc.ref, { classId: '' });
      }
      return { success: true, message: 'Kelas berhasil dihapus dari Firestore.' };
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
        const u = d.data();
        delete u.passwordHash;
        if (u.role !== 'student') {
          delete u.plainPassword;
        }
        return u;
      });
      return { users };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createUser: async (userData: any) => {
    const path = 'users';
    try {
      const id = userData.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newUser: any = {
        id,
        username: userData.username,
        name: userData.name,
        role: userData.role || 'student',
        email: userData.email || '',
        isActive: userData.isActive !== false,
        createdAt: new Date().toISOString(),
      };
      if (newUser.role === 'student') {
        newUser.nis = userData.nis || userData.username;
        newUser.classId = userData.classId || '';
        newUser.plainPassword = userData.password || userData.plainPassword || 'siswa123';
      } else if (newUser.role === 'teacher') {
        newUser.nip = userData.nip || '';
        newUser.subjectSpecialty = userData.subjectSpecialty || '';
      }
      await setDoc(doc(db, path, id), newUser);
      return { success: true, user: newUser };
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
      if (userData.password && String(userData.password).trim().length > 0) {
        updatePayload.passwordCustom = true;
        updatePayload.plainPassword = String(userData.password).trim();
      }
      updatePayload.updatedAt = new Date().toISOString();

      await updateDoc(ref, updatePayload);
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
      let count = 0;
      for (const s of students) {
        const username = s.username || s.nis;
        if (!username) continue;
        const id = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, path, id), {
          id,
          username,
          name: s.name,
          role: 'student',
          nis: s.nis || username,
          classId: s.classId || '',
          plainPassword: s.password || 'siswa123',
          email: s.email || '',
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        count++;
      }
      return { success: true, count, message: `Berhasil mengimpor ${count} siswa ke Cloud Firestore.` };
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
          batch.update(d.ref, {
            passwordCustom: true,
            plainPassword: randomPass,
            updatedAt: now,
          });
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
      const newQ = {
        ...question,
        id,
        code: finalCode,
        status: question.status || 'active',
        createdAt: new Date().toISOString(),
      };
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
        const newQ = {
          ...question,
          id,
          code: finalCode,
          subjectId: targetSubjectId,
          status: question.status || 'active',
          createdAt: new Date().toISOString(),
        };
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

      await updateDoc(ref, {
        ...question,
        code: nextCode,
        updatedAt: new Date().toISOString(),
      });
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
      await setDoc(doc(db, path, id), newExam);
      return { success: true, exam: newExam };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateExam: async (id: string, examData: any) => {
    const path = `exams/${id}`;
    try {
      const ref = doc(db, 'exams', id);
      await updateDoc(ref, {
        ...examData,
        updatedAt: new Date().toISOString(),
      });
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
      const [sessionsSnap, resultsSnap] = await Promise.all([
        getDocs(query(collection(db, 'exam_sessions'), where('examId', '==', id))),
        getDocs(query(collection(db, 'exam_results'), where('examId', '==', id))),
      ]);
      for (const sDoc of sessionsSnap.docs) {
        await deleteDoc(sDoc.ref);
      }
      for (const rDoc of resultsSnap.docs) {
        await deleteDoc(rDoc.ref);
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
      const [usersSnap, examsSnap, subjectsSnap, sessionsSnap, resultsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('id', '==', studentId))),
        getDocs(collection(db, 'exams')),
        getDocs(query(collection(db, 'taxonomy'), where('type', '==', 'subject'))),
        getDocs(query(collection(db, 'exam_sessions'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'exam_results'), where('studentId', '==', studentId))),
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

      const exams = examsSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
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
            studentStatus: result ? 'completed' : session ? session.status : 'not_started',
            hasResult: Boolean(result),
            score: e.isPublishedResults && result ? result.finalScore : null,
            kktpScore: e.kktpScore,
          };
        });

      return { exams };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  startExam: async (examId: string, studentId: string, inputToken?: string) => {
    const sessionKey = `${examId}_${studentId}`;
    const path = `exam_sessions/${sessionKey}`;
    try {
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

        await setDoc(doc(db, 'exam_sessions', sessionKey), session);
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

      await updateDoc(ref, {
        answers: nextAnswers,
        doubtfulFlags: nextFlags,
        currentQuestionIndex: nextIndex,
        remainingSeconds: nextRemaining,
        lastHeartbeat,
      });

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
          number: idx + 1,
          cognitiveLevel: cogLevel,
          subchapterId: master?.subchapterId,
          competencyId: master?.competencyId,
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

      const result = {
        id: `res-${Date.now()}`,
        examId,
        studentId,
        studentName: session.studentName,
        studentNis: session.studentNis,
        className: session.className,
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
      };

      await Promise.all([
        updateDoc(doc(db, 'exam_sessions', sessionKey), {
          answers: finalAnswers,
          status: 'completed',
          completedAt,
        }),
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
      const [examSnap, resultsSnap] = await Promise.all([
        getDoc(doc(db, 'exams', examId)),
        getDocs(query(collection(db, path), where('examId', '==', examId))),
      ]);
      const exam = examSnap.exists() ? examSnap.data() : null;
      const results = resultsSnap.docs.map((d) => d.data());
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
      const passedCount = results.filter((r: any) => r.isPassed).length;
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
      const [resultsSnap, examsSnap] = await Promise.all([
        getDocs(query(collection(db, path), where('studentId', '==', studentId))),
        getDocs(collection(db, 'exams')),
      ]);

      const examMap = new Map<string, any>();
      for (const eDoc of examsSnap.docs) {
        const data = eDoc.data() as any;
        examMap.set(data.id || eDoc.id, data);
      }

      const results = resultsSnap.docs
        .map((d) => {
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
            correctCount: Number(r.correctCount) || 0,
            wrongCount: Number(r.wrongCount) || 0,
            emptyCount: Number(r.emptyCount) || 0,
            totalQuestions: Number(r.totalQuestions) || 0,
            isPublishedResults: isPublished,
            finalScore: isPublished ? (r.finalScore ?? 0) : null,
          };
        })
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

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
