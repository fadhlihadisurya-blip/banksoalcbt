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
  StudentExamInfo,
  ExamSession,
  StudentQuestionItem,
  MonitoringPayload,
  ExamResultItem,
  AIIndividualAnalytics,
  AIClassicalAnalytics,
} from '../types/cbt';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Terjadi kesalahan pada server.');
  }
  return data;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ success: boolean; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  changePassword: (userId: string, oldPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ userId, oldPassword, newPassword }),
    }),

  // Admin users & classes
  getUsers: () => request<{ users: User[] }>('/admin/users'),

  createUser: (userData: Partial<User> & { password: string }) =>
    request<{ success: boolean; user: User }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  resetPassword: (userId: string, newPassword?: string) =>
    request<{ success: boolean; message: string }>('/admin/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    }),

  toggleUserStatus: (userId: string) =>
    request<{ success: boolean; isActive: boolean }>('/admin/users/toggle-status', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  bulkImportStudents: (students: any[]) =>
    request<{ success: boolean; count: number; message: string }>('/admin/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ students }),
    }),

  getClasses: () =>
    request<{ classes: ClassGroup[]; academicYears: AcademicYear[] }>('/classes'),

  createClass: (classData: { gradeLevel: string; name: string; academicYearId?: string; homeroomTeacher?: string }) =>
    request<{ success: boolean; class: ClassGroup }>('/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    }),

  // Taxonomy
  getTaxonomy: () =>
    request<{
      subjects: Subject[];
      chapters: Chapter[];
      subchapters: Subchapter[];
      competencies: Competency[];
    }>('/taxonomy'),

  createChapter: (subjectId: string, name: string) =>
    request<{ success: boolean; chapter: Chapter }>('/taxonomy/chapter', {
      method: 'POST',
      body: JSON.stringify({ subjectId, name }),
    }),

  // Questions
  getQuestions: (params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params || {});
    return request<{ questions: Question[] }>(`/questions?${searchParams.toString()}`);
  },

  createQuestion: (question: Partial<Question>) =>
    request<{ success: boolean; question: Question }>('/questions', {
      method: 'POST',
      body: JSON.stringify(question),
    }),

  updateQuestion: (id: string, question: Partial<Question>) =>
    request<{ success: boolean; question: Question }>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(question),
    }),

  deleteQuestion: (id: string) =>
    request<{ success: boolean }>(`/questions/${id}`, {
      method: 'DELETE',
    }),

  bulkImportQuestions: (questions: Partial<Question>[]) =>
    request<{ success: boolean; count: number; message: string }>('/questions/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ questions }),
    }),

  // Exams & Generator
  getExams: () => request<{ exams: Exam[] }>('/exams'),

  validateAvailability: (payload: {
    subjectId: string;
    selectedChapterIds?: string[];
    cognitiveTarget: { lotsCount: number; motsCount: number; hotsCount: number };
  }) =>
    request<{
      isValid: boolean;
      totalAvailable: number;
      lots: { available: number; required: number; sufficient: boolean };
      mots: { available: number; required: number; sufficient: boolean };
      hots: { available: number; required: number; sufficient: boolean };
    }>('/exams/validate-availability', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createExam: (examData: Partial<Exam> & { teacherId?: string }) =>
    request<{ success: boolean; exam: Exam }>('/exams', {
      method: 'POST',
      body: JSON.stringify(examData),
    }),

  updateExam: (id: string, examData: Partial<Exam>) =>
    request<{ success: boolean; exam: Exam }>(`/exams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(examData),
    }),

  togglePublishResults: (examId: string) =>
    request<{ success: boolean; isPublishedResults: boolean }>(`/exams/${examId}/publish`, {
      method: 'POST',
    }),

  regenerateToken: (examId: string) =>
    request<{ success: boolean; token: string; tokenUpdatedAt: string }>(`/exams/${examId}/token/regenerate`, {
      method: 'POST',
    }),

  updateTokenSettings: (examId: string, settings: { tokenAutoRotate?: boolean; tokenIntervalMinutes?: number; isTokenActive?: boolean }) =>
    request<{ success: boolean; exam: Exam }>(`/exams/${examId}/token/update-settings`, {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // Student CBT Flow
  getStudentExams: (studentId: string) =>
    request<{ exams: StudentExamInfo[] }>(`/student/exams?studentId=${studentId}`),

  startExam: (examId: string, studentId: string, inputToken?: string) =>
    request<{
      success: boolean;
      session: ExamSession;
      exam: { id: string; title: string; subjectName: string; durationMinutes: number; antiCheating: any };
      questions: StudentQuestionItem[];
    }>(`/exams/${examId}/start`, {
      method: 'POST',
      body: JSON.stringify({ studentId, inputToken }),
    }),

  autosaveExam: (
    examId: string,
    studentId: string,
    payload: {
      answers?: Record<string, any>;
      doubtfulFlags?: Record<string, boolean>;
      currentQuestionIndex?: number;
      remainingSeconds?: number;
    }
  ) =>
    request<{ success: boolean; savedAt: string; answeredCount: number }>(`/exams/${examId}/autosave`, {
      method: 'POST',
      body: JSON.stringify({ studentId, ...payload }),
    }),

  recordViolation: (examId: string, studentId: string, type: string, description: string) =>
    request<{ success: boolean; violationCount: number; level: 1 | 2 | 3; entry: any }>(`/exams/${examId}/violation`, {
      method: 'POST',
      body: JSON.stringify({ studentId, type, description }),
    }),

  submitExam: (examId: string, studentId: string, answers?: Record<string, any>) =>
    request<{ success: boolean; result: any }>(`/exams/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ studentId, answers }),
    }),

  // Live Monitoring
  getMonitoringData: (examId: string) =>
    request<MonitoringPayload>(`/exams/${examId}/monitoring`),

  manageStudentSession: (examId: string, studentId: string, action: 'ADD_TIME' | 'RESET_SESSION', additionalMinutes?: number) =>
    request<{ success: boolean; message: string }>(`/exams/${examId}/manage-student`, {
      method: 'POST',
      body: JSON.stringify({ studentId, action, additionalMinutes }),
    }),

  // Results & AI Analytics
  getExamResults: (examId: string) =>
    request<{
      exam: Exam;
      results: ExamResultItem[];
      stats: {
        totalParticipants: number;
        highest: number;
        lowest: number;
        average: number;
        median: number;
        passedCount: number;
        failedCount: number;
        passingRate: number;
      };
    }>(`/exams/${examId}/results`),

  runIndividualAIAnalytics: (examId: string, studentId: string) =>
    request<{ success: boolean; analytics: AIIndividualAnalytics }>('/analytics/individual', {
      method: 'POST',
      body: JSON.stringify({ examId, studentId }),
    }),

  runClassicalAIAnalytics: (examId: string) =>
    request<{ success: boolean; analytics: AIClassicalAnalytics }>('/analytics/classical', {
      method: 'POST',
      body: JSON.stringify({ examId }),
    }),
};
