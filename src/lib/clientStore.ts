import { firestoreStore } from './firestoreStore';

const STORAGE_KEY = 'cbt_database_cache_v2';

const EMPTY_DB = {
  users: [],
  academicYears: [
    { id: 'ay-2024-genap', name: '2024/2025', semester: 'Genap', isActive: true },
    { id: 'ay-2024-ganjil', name: '2024/2025', semester: 'Ganjil', isActive: false },
  ],
  classes: [],
  subjects: [],
  chapters: [],
  subchapters: [],
  competencies: [],
  questions: [],
  exams: [],
  settings: {
    schoolName: '',
    schoolLogoUrl: '',
    loginBackgroundUrl: '',
    appSubtitle: '',
    academicYearText: '2024/2025 Genap',
  },
  activityLogs: [],
};

function getStoredDb(): any {
  if (typeof window === 'undefined') {
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
  try {
    // Clear legacy dummy cache if present
    if (localStorage.getItem('cbt_database_v1')) {
      localStorage.removeItem('cbt_database_v1');
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
  }
  return JSON.parse(JSON.stringify(EMPTY_DB));
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
    const [cleanPath, queryString] = endpoint.split('?');
    let body: any = {};
    if (options.body && typeof options.body === 'string') {
      try {
        body = JSON.parse(options.body);
      } catch {}
    }

    // 1. Classes: /classes
    if (cleanPath === '/classes') {
      if (method === 'GET') {
        const fsRes = await firestoreStore.getClasses();
        if (fsRes) {
          dbLocal.classes = fsRes.classes;
          saveStoredDb(dbLocal);
          return fsRes as unknown as T;
        }
        return { classes: [], academicYears: EMPTY_DB.academicYears } as T;
      }
      if (method === 'POST') {
        const fsRes = await firestoreStore.createClass(body);
        if (fsRes && fsRes.class) {
          dbLocal.classes = dbLocal.classes || [];
          dbLocal.classes.push(fsRes.class);
          saveStoredDb(dbLocal);
          return fsRes as unknown as T;
        }
      }
    }

    // Classes by ID: /classes/:id
    if (cleanPath.startsWith('/classes/')) {
      const classId = cleanPath.replace('/classes/', '');
      if (method === 'PUT') {
        const fsRes = await firestoreStore.updateClass(classId, body);
        if (fsRes) return fsRes as unknown as T;
      }
      if (method === 'DELETE') {
        const fsRes = await firestoreStore.deleteClass(classId);
        if (fsRes) return fsRes as unknown as T;
      }
    }

    // 2. Admin Users: /admin/users
    if (cleanPath === '/admin/users') {
      if (method === 'GET') {
        const fsRes = await firestoreStore.getUsers();
        if (fsRes) {
          dbLocal.users = fsRes.users;
          saveStoredDb(dbLocal);
          return fsRes as unknown as T;
        }
        return { users: [] } as T;
      }
      if (method === 'POST') {
        const fsRes = await firestoreStore.createUser(body);
        if (fsRes) return fsRes as unknown as T;
      }
    }

    // Admin Users by ID: /admin/users/:id
    if (cleanPath.startsWith('/admin/users/')) {
      const rest = cleanPath.replace('/admin/users/', '');
      if (rest === 'reset-password' && method === 'POST') {
        const { userId, newPassword } = body;
        if (userId) {
          await firestoreStore.updateUser(userId, {
            password: newPassword || 'siswa123',
          });
        }
        return { success: true, message: 'Password berhasil direset.' } as T;
      }
      if (rest === 'toggle-status' && method === 'POST') {
        const { userId } = body;
        const fsUsers = await firestoreStore.getUsers();
        const user = (fsUsers?.users || []).find((u: any) => u.id === userId);
        if (!user) throw new Error('User tidak ditemukan.');
        const nextActive = !user.isActive;
        await firestoreStore.updateUser(userId, { isActive: nextActive });
        return { success: true, isActive: nextActive } as T;
      }

      const userId = rest;
      if (method === 'PUT') {
        const fsRes = await firestoreStore.updateUser(userId, body);
        if (fsRes) return fsRes as unknown as T;
      }
      if (method === 'DELETE') {
        const fsRes = await firestoreStore.deleteUser(userId);
        if (fsRes) return fsRes as unknown as T;
      }
    }

    // Bulk Import Students
    if (cleanPath === '/admin/students/bulk-import' && method === 'POST') {
      const { students } = body;
      const fsRes = await firestoreStore.bulkImportStudents(students || []);
      if (fsRes) return fsRes as unknown as T;
    }

    // Bulk Generate Student Passwords
    if (cleanPath === '/admin/students/generate-passwords' && method === 'POST') {
      const { classId } = body || {};
      const fsRes = await firestoreStore.bulkGenerateStudentPasswords(classId);
      if (fsRes) return fsRes as unknown as T;
    }

    // 3. Auth Login: /auth/login
    if (cleanPath === '/auth/login' && method === 'POST') {
      const { username, password, portal } = body;
      const cleanUser = (username || '').trim().toLowerCase();
      const cleanPass = String(password || '').trim();
      const fsUsers = await firestoreStore.getUsers();
      const usersList = fsUsers?.users || [];

      const matching = usersList.filter((u: any) => {
        const uName = (u.username || '').toLowerCase();
        const uNis = (u.nis || '').toLowerCase();
        const uNip = (u.nip || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        return (
          uName === cleanUser ||
          (u.role === 'student' && uNis && uNis === cleanUser) ||
          ((u.role === 'admin' || u.role === 'teacher') &&
            ((uNip && uNip === cleanUser) || (uEmail && uEmail === cleanUser)))
        );
      });

      const verifyPass = (u: any) => {
        if (u.plainPassword && String(u.plainPassword).trim() === cleanPass) return true;
        if (u.role === 'admin' && (cleanPass === 'admin123' || cleanPass === 'admin') && !u.passwordCustom) return true;
        if (u.role === 'teacher' && cleanPass === 'guru123' && !u.passwordCustom) return true;
        if (u.role === 'student' && cleanPass === 'siswa123' && !u.passwordCustom) return true;
        return false;
      };

      const match = matching.find((u: any) => {
        if (portal === 'student' && u.role !== 'student') return false;
        if (portal === 'staff' && u.role === 'student') return false;
        return verifyPass(u);
      });

      if (!match) {
        const wrongPortal = matching.find((u: any) => verifyPass(u));
        if (wrongPortal) {
          if (portal === 'student' && wrongPortal.role !== 'student') {
            throw new Error('Akun Admin atau Guru tidak dapat masuk melalui halaman login siswa.');
          }
          if (portal === 'staff' && wrongPortal.role === 'student') {
            throw new Error('Akun siswa tidak dapat masuk melalui halaman login Admin / Guru.');
          }
        }
        throw new Error('Username atau password salah.');
      }

      if (match.isActive === false) {
        throw new Error('Akun Anda dinonaktifkan oleh Administrator. Hubungi pihak sekolah.');
      }

      return { success: true, user: match } as T;
    }

    // 4. Questions: /questions
    if (cleanPath === '/questions' || cleanPath.startsWith('/questions/')) {
      if (method === 'GET') {
        const fsRes = await firestoreStore.getQuestions();
        let list = fsRes?.questions || [];
        if (queryString) {
          const params = new URLSearchParams(queryString);
          const subjectId = params.get('subjectId');
          const chapterId = params.get('chapterId');
          const subchapterId = params.get('subchapterId');
          const competencyId = params.get('competencyId');
          const cognitiveLevel = params.get('cognitiveLevel');
          const type = params.get('type');
          const status = params.get('status');
          const search = params.get('search');
          if (subjectId) list = list.filter((q: any) => q.subjectId === subjectId);
          if (chapterId) list = list.filter((q: any) => q.chapterId === chapterId);
          if (subchapterId) list = list.filter((q: any) => q.subchapterId === subchapterId);
          if (competencyId) list = list.filter((q: any) => q.competencyId === competencyId);
          if (cognitiveLevel) list = list.filter((q: any) => q.cognitiveLevel === cognitiveLevel);
          if (type) list = list.filter((q: any) => q.type === type);
          if (status) list = list.filter((q: any) => q.status === status);
          if (search) {
            const s = search.toLowerCase();
            list = list.filter(
              (q: any) =>
                (q.questionText || '').toLowerCase().includes(s) ||
                (q.code || '').toLowerCase().includes(s)
            );
          }
        }
        return { questions: list } as T;
      }
      if (method === 'POST' && cleanPath === '/questions') {
        const fsRes = await firestoreStore.createQuestion(body);
        if (fsRes) return fsRes as unknown as T;
      }
      if (method === 'POST' && cleanPath === '/questions/bulk-import') {
        const fsRes = await firestoreStore.bulkCreateQuestions(body.questions || []);
        if (fsRes) return fsRes as unknown as T;
      }
      if (method === 'PUT') {
        const qId = cleanPath.replace('/questions/', '');
        const fsRes = await firestoreStore.updateQuestion(qId, body);
        if (fsRes) return fsRes as unknown as T;
      }
      if (method === 'DELETE') {
        const qId = cleanPath.replace('/questions/', '');
        const fsRes = await firestoreStore.deleteQuestion(qId);
        if (fsRes) return fsRes as unknown as T;
      }
    }

    // 5. Taxonomy: /taxonomy
    if (cleanPath === '/taxonomy' && method === 'GET') {
      const fsRes = await firestoreStore.getTaxonomy();
      if (fsRes) return fsRes as unknown as T;
      return { subjects: [], chapters: [], subchapters: [], competencies: [] } as T;
    }

    if (cleanPath.startsWith('/taxonomy/')) {
      const parts = cleanPath.split('/');
      const entity = parts[2];
      const id = parts[3];

      if (entity === 'subject') {
        if (method === 'POST') return (await firestoreStore.createSubject(body)) as unknown as T;
        if (method === 'PUT' && id) return (await firestoreStore.updateSubject(id, body)) as unknown as T;
        if (method === 'DELETE' && id) return (await firestoreStore.deleteSubject(id)) as unknown as T;
      }
      if (entity === 'chapter') {
        if (method === 'POST') return (await firestoreStore.createChapter(body)) as unknown as T;
        if (method === 'PUT' && id) return (await firestoreStore.updateChapter(id, body)) as unknown as T;
        if (method === 'DELETE' && id) return (await firestoreStore.deleteChapter(id)) as unknown as T;
      }
      if (entity === 'subchapter') {
        if (method === 'POST') return (await firestoreStore.createSubchapter(body)) as unknown as T;
        if (method === 'PUT' && id) return (await firestoreStore.updateSubchapter(id, body)) as unknown as T;
        if (method === 'DELETE' && id) return (await firestoreStore.deleteSubchapter(id)) as unknown as T;
      }
      if (entity === 'competency') {
        if (method === 'POST') return (await firestoreStore.createCompetency(body)) as unknown as T;
        if (method === 'PUT' && id) return (await firestoreStore.updateCompetency(id, body)) as unknown as T;
        if (method === 'DELETE' && id) return (await firestoreStore.deleteCompetency(id)) as unknown as T;
      }
    }

    // 6. Exams: /exams
    if (cleanPath === '/exams/validate-availability' && method === 'POST') {
      const fsRes = await firestoreStore.validateExamAvailability(body || {});
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath === '/exams') {
      if (method === 'GET') {
        const fsRes = await firestoreStore.getExams();
        return (fsRes || { exams: [] }) as unknown as T;
      }
      if (method === 'POST') {
        const fsRes = await firestoreStore.createExam(body);
        if (fsRes) return fsRes as unknown as T;
      }
    }

    if (cleanPath === '/student/exams' && method === 'GET') {
      const params = new URLSearchParams(queryString || '');
      const studentId = params.get('studentId') || '';
      if (studentId) {
        const fsRes = await firestoreStore.getStudentExams(studentId);
        return (fsRes || { exams: [] }) as unknown as T;
      }
      return { exams: [] } as unknown as T;
    }

    if (cleanPath === '/student/results' && method === 'GET') {
      const params = new URLSearchParams(queryString || '');
      const studentId = params.get('studentId') || '';
      if (studentId) {
        const fsRes = await firestoreStore.getStudentResults(studentId);
        return (
          fsRes || {
            results: [],
            stats: { totalCompleted: 0, hasHiddenScores: false, average: 0, highest: 0, lowest: 0, median: 0 },
          }
        ) as unknown as T;
      }
      return {
        results: [],
        stats: { totalCompleted: 0, hasHiddenScores: false, average: 0, highest: 0, lowest: 0, median: 0 },
      } as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.split('/').length === 3) {
      const examId = cleanPath.replace('/exams/', '');
      if (method === 'PUT') {
        const fsRes = await firestoreStore.updateExam(examId, body);
        if (fsRes) return fsRes as unknown as T;
      }
      if (method === 'DELETE') {
        const fsRes = await firestoreStore.deleteExam(examId);
        if (fsRes) return fsRes as unknown as T;
      }
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/publish') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/publish', '');
      const fsRes = await firestoreStore.togglePublishResults(examId);
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/token/regenerate') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/token/regenerate', '');
      const fsRes = await firestoreStore.regenerateToken(examId);
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/token/update-settings') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/token/update-settings', '');
      const fsRes = await firestoreStore.updateTokenSettings(examId, body || {});
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/results') && method === 'GET') {
      const examId = cleanPath.replace('/exams/', '').replace('/results', '');
      const fsRes = await firestoreStore.getExamResults(examId);
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/monitoring') && method === 'GET') {
      const examId = cleanPath.replace('/exams/', '').replace('/monitoring', '');
      const fsRes = await firestoreStore.getMonitoringData(examId);
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/toggle-live-score') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/toggle-live-score', '');
      const fsRes = await firestoreStore.toggleLiveScore(examId, body?.showLiveScore);
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/manage-student') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/manage-student', '');
      const fsRes = await firestoreStore.manageStudentSession(
        examId,
        body?.studentId,
        body?.action,
        body?.additionalMinutes
      );
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/start') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/start', '');
      const fsRes = await firestoreStore.startExam(examId, body?.studentId, body?.inputToken);
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/autosave') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/autosave', '');
      const fsRes = await firestoreStore.autosaveExam(examId, body?.studentId, body || {});
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/violation') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/violation', '');
      const fsRes = await firestoreStore.recordViolation(
        examId,
        body?.studentId,
        body?.type,
        body?.description
      );
      if (fsRes) return fsRes as unknown as T;
    }

    if (cleanPath.startsWith('/exams/') && cleanPath.endsWith('/submit') && method === 'POST') {
      const examId = cleanPath.replace('/exams/', '').replace('/submit', '');
      const fsRes = await firestoreStore.submitExam(examId, body?.studentId, body?.answers);
      if (fsRes) return fsRes as unknown as T;
    }

    // 7. Settings: /settings
    if (cleanPath === '/settings') {
      if (method === 'GET') {
        const fsRes = await firestoreStore.getSettings();
        return (fsRes || { settings: EMPTY_DB.settings }) as unknown as T;
      }
      if (method === 'PUT') {
        const fsRes = await firestoreStore.updateSettings(body);
        if (fsRes) return fsRes as unknown as T;
      }
    }

    // 8. Activity Logs: /activity-logs
    if (cleanPath === '/activity-logs' && method === 'GET') {
      const fsRes = await firestoreStore.getActivityLogs();
      return (fsRes || { logs: [] }) as unknown as T;
    }

    return {} as T;
  },
};
