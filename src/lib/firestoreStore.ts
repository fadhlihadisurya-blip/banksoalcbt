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
import initialDb from '../../data/cbt_database.json';

let isSeedingCompleted = false;

/**
 * Ensures Firestore is populated with initial SMA CBT seed data if Firestore collections are empty.
 */
export async function seedFirestoreIfEmpty() {
  if (isSeedingCompleted) return;
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('[Firestore] Seeding initial CBT database to Cloud Firestore...');

      // Seed Users
      for (const u of initialDb.users || []) {
        await setDoc(doc(db, 'users', u.id), u);
      }

      // Seed Classes
      for (const c of initialDb.classes || []) {
        await setDoc(doc(db, 'classes', c.id), c);
      }

      // Seed Subjects & Taxonomy
      for (const s of initialDb.subjects || []) {
        await setDoc(doc(db, 'taxonomy', `subject-${s.id}`), { type: 'subject', ...s });
      }
      for (const ch of initialDb.chapters || []) {
        await setDoc(doc(db, 'taxonomy', `chapter-${ch.id}`), { type: 'chapter', ...ch });
      }

      // Seed Questions
      for (const q of initialDb.questions || []) {
        await setDoc(doc(db, 'questions', q.id), q);
      }

      // Seed Exams
      for (const ex of initialDb.exams || []) {
        await setDoc(doc(db, 'exams', ex.id), ex);
      }

      console.log('[Firestore] Cloud Firestore database successfully seeded!');
    }
    isSeedingCompleted = true;
  } catch (error) {
    console.warn('[Firestore] Auto-seed warning:', error);
  }
}

export const firestoreStore = {
  // --- CLASSES ---
  getClasses: async () => {
    const path = 'classes';
    try {
      await seedFirestoreIfEmpty();
      const snap = await getDocs(collection(db, path));
      const classes = snap.docs.map((d) => d.data());
      return { classes, academicYears: initialDb.academicYears || [] };
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
      // Unlink users in this class
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
      await seedFirestoreIfEmpty();
      const snap = await getDocs(collection(db, path));
      const users = snap.docs.map((d) => {
        const u = d.data();
        delete u.passwordHash;
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
      const newUser = {
        id,
        username: userData.username,
        name: userData.name,
        role: userData.role || 'student',
        email: userData.email || '',
        nis: userData.role === 'student' ? (userData.nis || userData.username) : undefined,
        classId: userData.role === 'student' ? (userData.classId || '') : undefined,
        nip: userData.role === 'teacher' ? (userData.nip || '') : undefined,
        subjectSpecialty: userData.role === 'teacher' ? (userData.subjectSpecialty || '') : undefined,
        isActive: userData.isActive !== false,
        createdAt: new Date().toISOString(),
      };
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

  // --- QUESTIONS ---
  getQuestions: async () => {
    const path = 'questions';
    try {
      await seedFirestoreIfEmpty();
      const snap = await getDocs(collection(db, path));
      const questions = snap.docs.map((d) => d.data());
      return { questions };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createQuestion: async (question: any) => {
    const path = 'questions';
    try {
      const id = question.id || `q-${Date.now()}`;
      const newQ = {
        ...question,
        id,
        status: question.status || 'Aktif',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, path, id), newQ);
      return { success: true, question: newQ };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateQuestion: async (id: string, question: any) => {
    const path = `questions/${id}`;
    try {
      const ref = doc(db, 'questions', id);
      await updateDoc(ref, {
        ...question,
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
      await seedFirestoreIfEmpty();
      const snap = await getDocs(collection(db, path));
      const exams = snap.docs.map((d) => d.data());
      return { exams };
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
        subjectId: examData.subjectId || 'sub-fisika',
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
        status: 'draft',
        token: examData.token || Math.random().toString(36).substring(2, 8).toUpperCase(),
        tokenAutoRotate: Boolean(examData.tokenAutoRotate),
        tokenIntervalMinutes: examData.tokenIntervalMinutes || 15,
        tokenUpdatedAt: new Date().toISOString(),
        isTokenActive: true,
        antiCheating: examData.antiCheating || {
          blockTabSwitch: true,
          forceFullscreen: true,
          blockClipboard: true,
          warningLimit: 3,
          autoSubmitOnLimit: true,
        },
        isPublishedResults: false,
        createdTeacherId: examData.createdTeacherId || 'usr-teacher-1',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, path, id), newExam);
      return { success: true, exam: newExam };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // --- TAXONOMY ---
  getTaxonomy: async () => {
    const path = 'taxonomy';
    try {
      await seedFirestoreIfEmpty();
      const snap = await getDocs(collection(db, path));
      const items = snap.docs.map((d) => d.data());

      const subjects = items.filter((i) => i.type === 'subject') || initialDb.subjects;
      const chapters = items.filter((i) => i.type === 'chapter') || initialDb.chapters;
      const subchapters = initialDb.subchapters;
      const competencies = initialDb.competencies;

      return {
        subjects: subjects.length ? subjects : initialDb.subjects,
        chapters: chapters.length ? chapters : initialDb.chapters,
        subchapters,
        competencies,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },
};
