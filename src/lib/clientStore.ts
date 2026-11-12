import initialDb from '../../data/cbt_database.json';
import { firestoreStore } from './firestoreStore';
import {
  User,
  ClassGroup,
  AcademicYear,
  Subject,
  Chapter,
  Subchapter,
  Competency,
  Question,
  Exam,
  ExamSession,
  ExamResultItem,
  MonitoringPayload,
  StudentExamInfo,
} from '../types/cbt';

const STORAGE_KEY = 'cbt_database_v1';

function getStoredDb(): any {
  if (typeof window === 'undefined') {
    return initialDb;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
  }
  const clone = JSON.parse(JSON.stringify(initialDb));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
  } catch {}
  return clone;
}

function saveStoredDb(db: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export const clientStore = {
  handleRequest: async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const dbLocal = getStoredDb();
    const method = (options.method || 'GET').toUpperCase();
    let body: any = {};
    if (options.body && typeof options.body === 'string') {
      try {
        body = JSON.parse(options.body);
      } catch {}
    }

    // 1. Classes: /classes
    if (endpoint === '/classes') {
      if (method === 'GET') {
        try {
          const fsRes = await firestoreStore.getClasses();
          if (fsRes && fsRes.classes && fsRes.classes.length > 0) {
            dbLocal.classes = fsRes.classes;
            saveStoredDb(dbLocal);
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Falling back to local cache for /classes:', e);
        }
        return { classes: dbLocal.classes || [], academicYears: dbLocal.academicYears || [] } as T;
      }
      if (method === 'POST') {
        let newClass: any = null;
        try {
          const fsRes = await firestoreStore.createClass(body);
          if (fsRes && fsRes.class) newClass = fsRes.class;
        } catch (e) {
          console.warn('[Firestore] Falling back to local create for /classes:', e);
        }

        if (!newClass) {
          const { gradeLevel, name, academicYearId, homeroomTeacher } = body;
          newClass = {
            id: `cls-${Date.now()}`,
            gradeLevel: gradeLevel || 'XII',
            name: name || 'Kelas Baru',
            academicYearId: academicYearId || dbLocal.academicYears?.[0]?.id || 'ay-2024-genap',
            homeroomTeacher: homeroomTeacher || '',
          };
        }

        dbLocal.classes = dbLocal.classes || [];
        dbLocal.classes.push(newClass);
        saveStoredDb(dbLocal);
        return { success: true, class: newClass } as T;
      }
    }

    // Classes by ID: /classes/:id
    if (endpoint.startsWith('/classes/')) {
      const classId = endpoint.replace('/classes/', '');

      if (method === 'PUT') {
        try {
          const fsRes = await firestoreStore.updateClass(classId, body);
          if (fsRes) {
            const clsIndex = (dbLocal.classes || []).findIndex((c: any) => c.id === classId);
            if (clsIndex !== -1) {
              dbLocal.classes[clsIndex] = { ...dbLocal.classes[clsIndex], ...body };
              saveStoredDb(dbLocal);
            }
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Falling back to local update for /classes:', e);
        }

        const clsIndex = (dbLocal.classes || []).findIndex((c: any) => c.id === classId);
        if (clsIndex === -1) throw new Error('Kelas tidak ditemukan.');
        const cls = dbLocal.classes[clsIndex];
        if (body.name !== undefined) cls.name = body.name.trim();
        if (body.gradeLevel !== undefined) cls.gradeLevel = body.gradeLevel;
        if (body.homeroomTeacher !== undefined) cls.homeroomTeacher = body.homeroomTeacher.trim();
        if (body.academicYearId !== undefined) cls.academicYearId = body.academicYearId;
        saveStoredDb(dbLocal);
        return { success: true, class: cls, message: 'Data kelas berhasil diperbarui.' } as T;
      }

      if (method === 'DELETE') {
        try {
          await firestoreStore.deleteClass(classId);
        } catch (e) {
          console.warn('[Firestore] Falling back to local delete for /classes:', e);
        }

        const clsIndex = (dbLocal.classes || []).findIndex((c: any) => c.id === classId);
        if (clsIndex !== -1) {
          dbLocal.users = (dbLocal.users || []).map((u: any) => {
            if (u.classId === classId) return { ...u, classId: '' };
            return u;
          });
          dbLocal.classes.splice(clsIndex, 1);
          saveStoredDb(dbLocal);
        }
        return { success: true, message: 'Kelas berhasil dihapus.' } as T;
      }
    }

    // 2. Admin Users: /admin/users
    if (endpoint === '/admin/users') {
      if (method === 'GET') {
        try {
          const fsRes = await firestoreStore.getUsers();
          if (fsRes && fsRes.users && fsRes.users.length > 0) {
            dbLocal.users = fsRes.users;
            saveStoredDb(dbLocal);
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Falling back to local cache for /admin/users:', e);
        }
        const safeUsers = (dbLocal.users || []).map((u: any) => {
          const copy = { ...u };
          delete copy.passwordHash;
          return copy;
        });
        return { users: safeUsers } as T;
      }

      if (method === 'POST') {
        let newUser: any = null;
        try {
          const fsRes = await firestoreStore.createUser(body);
          if (fsRes && fsRes.user) newUser = fsRes.user;
        } catch (e) {
          console.warn('[Firestore] Falling back to local create for /admin/users:', e);
        }

        if (!newUser) {
          const { username, name, role, email, nis, classId, nip, subjectSpecialty } = body;
          newUser = {
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            username,
            name,
            role,
            email: email || '',
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          if (role === 'student') {
            newUser.nis = nis || username;
            newUser.classId = classId || '';
          } else if (role === 'teacher') {
            newUser.nip = nip || '';
            newUser.subjectSpecialty = subjectSpecialty || '';
          }
        }

        dbLocal.users = dbLocal.users || [];
        dbLocal.users.push(newUser);
        saveStoredDb(dbLocal);
        return { success: true, user: newUser } as T;
      }
    }

    // Admin Users by ID: /admin/users/:id
    if (endpoint.startsWith('/admin/users/')) {
      const rest = endpoint.replace('/admin/users/', '');

      if (rest === 'reset-password' && method === 'POST') {
        saveStoredDb(dbLocal);
        return { success: true, message: 'Password berhasil direset.' } as T;
      }

      if (rest === 'toggle-status' && method === 'POST') {
        const { userId } = body;
        const user = (dbLocal.users || []).find((u: any) => u.id === userId);
        if (user) {
          user.isActive = !user.isActive;
          try {
            await firestoreStore.updateUser(userId, { isActive: user.isActive });
          } catch (e) {
            console.warn('[Firestore] Toggle status sync error:', e);
          }
          saveStoredDb(dbLocal);
          return { success: true, isActive: user.isActive } as T;
        }
        throw new Error('User tidak ditemukan.');
      }

      const userId = rest;

      if (method === 'PUT') {
        try {
          const fsRes = await firestoreStore.updateUser(userId, body);
          if (fsRes) {
            const userIndex = (dbLocal.users || []).findIndex((u: any) => u.id === userId);
            if (userIndex !== -1) {
              dbLocal.users[userIndex] = { ...dbLocal.users[userIndex], ...body };
              saveStoredDb(dbLocal);
            }
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Falling back to local update for user:', e);
        }

        const userIndex = (dbLocal.users || []).findIndex((u: any) => u.id === userId);
        if (userIndex === -1) throw new Error('User tidak ditemukan.');
        const user = dbLocal.users[userIndex];
        if (body.name !== undefined) user.name = body.name.trim();
        if (body.username !== undefined) user.username = body.username.trim();
        if (body.role !== undefined) user.role = body.role;
        if (body.email !== undefined) user.email = body.email.trim();
        if (body.isActive !== undefined) user.isActive = Boolean(body.isActive);
        if (body.nis !== undefined) user.nis = body.nis;
        if (body.classId !== undefined) user.classId = body.classId;
        if (body.nip !== undefined) user.nip = body.nip;
        if (body.subjectSpecialty !== undefined) user.subjectSpecialty = body.subjectSpecialty;
        saveStoredDb(dbLocal);
        const safe = { ...user };
        delete safe.passwordHash;
        return { success: true, user: safe, message: 'Data akun berhasil diperbarui.' } as T;
      }

      if (method === 'DELETE') {
        try {
          await firestoreStore.deleteUser(userId);
        } catch (e) {
          console.warn('[Firestore] Falling back to local delete for user:', e);
        }

        const userIndex = (dbLocal.users || []).findIndex((u: any) => u.id === userId);
        if (userIndex !== -1) {
          const user = dbLocal.users[userIndex];
          if (user.role === 'admin') {
            throw new Error('Akun Administrator tidak dapat dihapus demi keamanan sistem.');
          }
          dbLocal.users.splice(userIndex, 1);
          saveStoredDb(dbLocal);
        }
        return { success: true, message: 'Akun berhasil dihapus.' } as T;
      }
    }

    // Bulk Import Students: /admin/students/bulk-import
    if (endpoint === '/admin/students/bulk-import' && method === 'POST') {
      const { students } = body;
      try {
        const fsRes = await firestoreStore.bulkImportStudents(students || []);
        if (fsRes) {
          await firestoreStore.getUsers().then((res) => {
            if (res && res.users) {
              dbLocal.users = res.users;
              saveStoredDb(dbLocal);
            }
          });
          return fsRes as unknown as T;
        }
      } catch (e) {
        console.warn('[Firestore] Bulk import fallback:', e);
      }

      let count = 0;
      dbLocal.users = dbLocal.users || [];
      for (const s of (students || [])) {
        const username = s.username || s.nis;
        if (!username || dbLocal.users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
          continue;
        }
        dbLocal.users.push({
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
      saveStoredDb(dbLocal);
      return { success: true, count, message: `Berhasil mengimpor ${count} akun siswa.` } as T;
    }

    // 3. Auth Login: /auth/login
    if (endpoint === '/auth/login' && method === 'POST') {
      const { username } = body;
      try {
        const fsUsers = await firestoreStore.getUsers();
        if (fsUsers && fsUsers.users) {
          const match = fsUsers.users.find((u: any) => u.username.toLowerCase() === (username || '').toLowerCase());
          if (match) {
            return { success: true, user: match } as T;
          }
        }
      } catch (e) {
        console.warn('[Firestore] Login lookup fallback:', e);
      }

      const user = (dbLocal.users || []).find((u: any) => u.username.toLowerCase() === (username || '').toLowerCase());
      if (user) {
        user.lastLogin = new Date().toISOString();
        saveStoredDb(dbLocal);
        const safe = { ...user };
        delete safe.passwordHash;
        return { success: true, user: safe } as T;
      }
      throw new Error('Username atau password salah.');
    }

    // 4. Questions: /questions
    if (endpoint.startsWith('/questions')) {
      if (method === 'GET') {
        try {
          const fsRes = await firestoreStore.getQuestions();
          if (fsRes && fsRes.questions && fsRes.questions.length > 0) {
            dbLocal.questions = fsRes.questions;
            saveStoredDb(dbLocal);
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Questions fetch fallback:', e);
        }
        return { questions: dbLocal.questions || [] } as T;
      }

      if (method === 'POST') {
        try {
          const fsRes = await firestoreStore.createQuestion(body);
          if (fsRes && fsRes.question) {
            dbLocal.questions = dbLocal.questions || [];
            dbLocal.questions.push(fsRes.question);
            saveStoredDb(dbLocal);
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Question creation fallback:', e);
        }

        const newQ = {
          ...body,
          id: `q-${Date.now()}`,
          status: body.status || 'Aktif',
          createdAt: new Date().toISOString(),
        };
        dbLocal.questions = dbLocal.questions || [];
        dbLocal.questions.push(newQ);
        saveStoredDb(dbLocal);
        return { success: true, question: newQ } as T;
      }

      if (method === 'PUT') {
        const qId = endpoint.replace('/questions/', '');
        try {
          const fsRes = await firestoreStore.updateQuestion(qId, body);
          if (fsRes) {
            const qIndex = (dbLocal.questions || []).findIndex((q: any) => q.id === qId);
            if (qIndex !== -1) dbLocal.questions[qIndex] = { ...dbLocal.questions[qIndex], ...body };
            saveStoredDb(dbLocal);
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Question update fallback:', e);
        }

        const qIndex = (dbLocal.questions || []).findIndex((q: any) => q.id === qId);
        if (qIndex !== -1) {
          dbLocal.questions[qIndex] = { ...dbLocal.questions[qIndex], ...body };
          saveStoredDb(dbLocal);
          return { success: true, question: dbLocal.questions[qIndex] } as T;
        }
      }

      if (method === 'DELETE') {
        const qId = endpoint.replace('/questions/', '');
        try {
          await firestoreStore.deleteQuestion(qId);
        } catch (e) {
          console.warn('[Firestore] Question delete fallback:', e);
        }
        dbLocal.questions = (dbLocal.questions || []).filter((q: any) => q.id !== qId);
        saveStoredDb(dbLocal);
        return { success: true } as T;
      }
    }

    // 5. Taxonomy: /taxonomy
    if (endpoint.startsWith('/taxonomy')) {
      if (method === 'GET') {
        try {
          const fsRes = await firestoreStore.getTaxonomy();
          if (fsRes && fsRes.subjects && fsRes.subjects.length > 0) {
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Taxonomy fetch fallback:', e);
        }
        return {
          subjects: dbLocal.subjects || [],
          chapters: dbLocal.chapters || [],
          subchapters: dbLocal.subchapters || [],
          competencies: dbLocal.competencies || [],
        } as T;
      }
    }

    // 6. Exams: /exams
    if (endpoint === '/exams') {
      if (method === 'GET') {
        try {
          const fsRes = await firestoreStore.getExams();
          if (fsRes && fsRes.exams && fsRes.exams.length > 0) {
            dbLocal.exams = fsRes.exams;
            saveStoredDb(dbLocal);
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Exams fetch fallback:', e);
        }
        return { exams: dbLocal.exams || [] } as T;
      }

      if (method === 'POST') {
        try {
          const fsRes = await firestoreStore.createExam(body);
          if (fsRes && fsRes.exam) {
            dbLocal.exams = dbLocal.exams || [];
            dbLocal.exams.push(fsRes.exam);
            saveStoredDb(dbLocal);
            return fsRes as unknown as T;
          }
        } catch (e) {
          console.warn('[Firestore] Exam create fallback:', e);
        }
      }
    }

    return {} as T;
  },
};
