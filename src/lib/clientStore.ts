import initialDb from '../../data/cbt_database.json';
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
  // Initialize with initialDb clone
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
    const db = getStoredDb();
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
        return { classes: db.classes || [], academicYears: db.academicYears || [] } as T;
      }
      if (method === 'POST') {
        const { gradeLevel, name, academicYearId, homeroomTeacher } = body;
        const newClass: ClassGroup = {
          id: `cls-${Date.now()}`,
          gradeLevel: gradeLevel || 'XII',
          name: name || 'Kelas Baru',
          academicYearId: academicYearId || db.academicYears?.[0]?.id || 'ay-2024-genap',
          homeroomTeacher: homeroomTeacher || '',
        };
        db.classes = db.classes || [];
        db.classes.push(newClass);
        saveStoredDb(db);
        return { success: true, class: newClass } as T;
      }
    }

    // Classes by ID: /classes/:id
    if (endpoint.startsWith('/classes/')) {
      const classId = endpoint.replace('/classes/', '');
      const clsIndex = (db.classes || []).findIndex((c: any) => c.id === classId);

      if (method === 'PUT') {
        if (clsIndex === -1) throw new Error('Kelas tidak ditemukan.');
        const cls = db.classes[clsIndex];
        if (body.name !== undefined) cls.name = body.name.trim();
        if (body.gradeLevel !== undefined) cls.gradeLevel = body.gradeLevel;
        if (body.homeroomTeacher !== undefined) cls.homeroomTeacher = body.homeroomTeacher.trim();
        if (body.academicYearId !== undefined) cls.academicYearId = body.academicYearId;
        saveStoredDb(db);
        return { success: true, class: cls, message: 'Data kelas berhasil diperbarui.' } as T;
      }

      if (method === 'DELETE') {
        if (clsIndex === -1) throw new Error('Kelas tidak ditemukan.');
        db.users = (db.users || []).map((u: any) => {
          if (u.classId === classId) return { ...u, classId: '' };
          return u;
        });
        db.classes.splice(clsIndex, 1);
        saveStoredDb(db);
        return { success: true, message: 'Kelas berhasil dihapus.' } as T;
      }
    }

    // 2. Admin Users: /admin/users
    if (endpoint === '/admin/users') {
      if (method === 'GET') {
        const safeUsers = (db.users || []).map((u: any) => {
          const copy = { ...u };
          delete copy.passwordHash;
          return copy;
        });
        return { users: safeUsers } as T;
      }
      if (method === 'POST') {
        const { username, password, name, role, email, nis, classId, nip, subjectSpecialty } = body;
        if (db.users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
          throw new Error('Username sudah digunakan.');
        }
        const newUser: any = {
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
        db.users = db.users || [];
        db.users.push(newUser);
        saveStoredDb(db);
        return { success: true, user: newUser } as T;
      }
    }

    // Admin Users by ID: /admin/users/:id
    if (endpoint.startsWith('/admin/users/')) {
      const rest = endpoint.replace('/admin/users/', '');

      if (rest === 'reset-password' && method === 'POST') {
        const { userId, newPassword } = body;
        const user = (db.users || []).find((u: any) => u.id === userId);
        if (!user) throw new Error('User tidak ditemukan.');
        saveStoredDb(db);
        return { success: true, message: 'Password berhasil direset.' } as T;
      }

      if (rest === 'toggle-status' && method === 'POST') {
        const { userId } = body;
        const user = (db.users || []).find((u: any) => u.id === userId);
        if (!user) throw new Error('User tidak ditemukan.');
        user.isActive = !user.isActive;
        saveStoredDb(db);
        return { success: true, isActive: user.isActive } as T;
      }

      const userId = rest;
      const userIndex = (db.users || []).findIndex((u: any) => u.id === userId);

      if (method === 'PUT') {
        if (userIndex === -1) throw new Error('User tidak ditemukan.');
        const user = db.users[userIndex];
        if (body.name !== undefined) user.name = body.name.trim();
        if (body.username !== undefined) user.username = body.username.trim();
        if (body.role !== undefined) user.role = body.role;
        if (body.email !== undefined) user.email = body.email.trim();
        if (body.isActive !== undefined) user.isActive = Boolean(body.isActive);
        if (body.nis !== undefined) user.nis = body.nis;
        if (body.classId !== undefined) user.classId = body.classId;
        if (body.nip !== undefined) user.nip = body.nip;
        if (body.subjectSpecialty !== undefined) user.subjectSpecialty = body.subjectSpecialty;
        saveStoredDb(db);
        const safe = { ...user };
        delete safe.passwordHash;
        return { success: true, user: safe, message: 'Data akun berhasil diperbarui.' } as T;
      }

      if (method === 'DELETE') {
        if (userIndex === -1) throw new Error('User tidak ditemukan.');
        const user = db.users[userIndex];
        if (user.role === 'admin') {
          throw new Error('Akun Administrator tidak dapat dihapus demi keamanan sistem.');
        }
        db.users.splice(userIndex, 1);
        saveStoredDb(db);
        return { success: true, message: 'Akun berhasil dihapus.' } as T;
      }
    }

    // Bulk Import Students: /admin/students/bulk-import
    if (endpoint === '/admin/students/bulk-import' && method === 'POST') {
      const { students } = body;
      let count = 0;
      db.users = db.users || [];
      for (const s of (students || [])) {
        const username = s.username || s.nis;
        if (!username || db.users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
          continue;
        }
        db.users.push({
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
      saveStoredDb(db);
      return { success: true, count, message: `Berhasil mengimpor ${count} akun siswa.` } as T;
    }

    // 3. Auth Login: /auth/login
    if (endpoint === '/auth/login' && method === 'POST') {
      const { username } = body;
      const user = (db.users || []).find((u: any) => u.username.toLowerCase() === (username || '').toLowerCase());
      if (user) {
        user.lastLogin = new Date().toISOString();
        saveStoredDb(db);
        const safe = { ...user };
        delete safe.passwordHash;
        return { success: true, user: safe } as T;
      }
      throw new Error('Username atau password salah.');
    }

    // 4. Questions: /questions
    if (endpoint.startsWith('/questions')) {
      if (method === 'GET') {
        return { questions: db.questions || [] } as T;
      }
      if (method === 'POST') {
        if (endpoint === '/questions/bulk-import') {
          const { questions } = body;
          db.questions = db.questions || [];
          for (const q of (questions || [])) {
            db.questions.push({
              ...q,
              id: q.id || `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              status: q.status || 'Aktif',
              createdAt: new Date().toISOString(),
            });
          }
          saveStoredDb(db);
          return { success: true, count: questions?.length || 0, message: 'Impor soal berhasil.' } as T;
        }
        const newQ = {
          ...body,
          id: `q-${Date.now()}`,
          status: body.status || 'Aktif',
          createdAt: new Date().toISOString(),
        };
        db.questions = db.questions || [];
        db.questions.push(newQ);
        saveStoredDb(db);
        return { success: true, question: newQ } as T;
      }
      if (method === 'PUT') {
        const qId = endpoint.replace('/questions/', '');
        const qIndex = (db.questions || []).findIndex((q: any) => q.id === qId);
        if (qIndex !== -1) {
          db.questions[qIndex] = { ...db.questions[qIndex], ...body };
          saveStoredDb(db);
          return { success: true, question: db.questions[qIndex] } as T;
        }
      }
      if (method === 'DELETE') {
        const qId = endpoint.replace('/questions/', '');
        db.questions = (db.questions || []).filter((q: any) => q.id !== qId);
        saveStoredDb(db);
        return { success: true } as T;
      }
    }

    // 5. Taxonomy: /taxonomy
    if (endpoint.startsWith('/taxonomy')) {
      if (method === 'GET') {
        return {
          subjects: db.subjects || [],
          chapters: db.chapters || [],
          subchapters: db.subchapters || [],
          competencies: db.competencies || [],
        } as T;
      }
      if (endpoint === '/taxonomy/chapter' && method === 'POST') {
        const { subjectId, name } = body;
        const chapter = { id: `ch-${Date.now()}`, subjectId, name };
        db.chapters = db.chapters || [];
        db.chapters.push(chapter);
        saveStoredDb(db);
        return { success: true, chapter } as T;
      }
    }

    // 6. Exams: /exams
    if (endpoint === '/exams') {
      if (method === 'GET') {
        return { exams: db.exams || [] } as T;
      }
      if (method === 'POST') {
        const newExam: any = {
          id: `ex-${Date.now()}`,
          title: body.title || 'Ujian Baru',
          subjectId: body.subjectId || 'sub-fisika',
          academicYearId: body.academicYearId || 'ay-2024-genap',
          semester: body.semester || 'Genap',
          targetClassIds: body.targetClassIds || [],
          scheduleStart: body.scheduleStart || new Date().toISOString(),
          scheduleEnd: body.scheduleEnd || new Date(Date.now() + 86400000).toISOString(),
          durationMinutes: body.durationMinutes || 60,
          maxScore: body.maxScore || 100,
          kktpScore: body.kktpScore || 75,
          selectedChapterIds: body.selectedChapterIds || [],
          selectedSubchapterIds: body.selectedSubchapterIds || [],
          selectedCompetencyIds: body.selectedCompetencyIds || [],
          cognitiveTarget: body.cognitiveTarget || {
            lotsCount: body.lotsCount || 5,
            motsCount: body.motsCount || 10,
            hotsCount: body.hotsCount || 5,
            totalQuestions: body.totalQuestions || 20,
          },
          status: 'draft',
          token: body.token || Math.random().toString(36).substring(2, 8).toUpperCase(),
          tokenAutoRotate: Boolean(body.tokenAutoRotate),
          tokenIntervalMinutes: body.tokenIntervalMinutes || 15,
          tokenUpdatedAt: new Date().toISOString(),
          isTokenActive: true,
          antiCheating: body.antiCheating || {
            blockTabSwitch: true,
            forceFullscreen: true,
            blockClipboard: true,
            warningLimit: 3,
            autoSubmitOnLimit: true,
          },
          isPublishedResults: false,
          createdTeacherId: body.createdTeacherId || 'usr-teacher-1',
          createdAt: new Date().toISOString(),
        };
        db.exams = db.exams || [];
        db.exams.push(newExam);
        saveStoredDb(db);
        return { success: true, exam: newExam } as T;
      }
    }

    // Default fallback
    return {} as T;
  },
};
