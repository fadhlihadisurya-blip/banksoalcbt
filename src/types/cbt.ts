export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  email?: string;
  nis?: string;
  nisn?: string;
  classId?: string;
  nip?: string;
  subjectSpecialty?: string;
  gender?: 'L' | 'P';
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
  plainPassword?: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  semester: 'Ganjil' | 'Genap';
  isActive: boolean;
}

export interface ClassGroup {
  id: string;
  gradeLevel: 'X' | 'XI' | 'XII';
  name: string;
  academicYearId: string;
  homeroomTeacher: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
}

export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
}

export interface Subchapter {
  id: string;
  chapterId: string;
  name: string;
}

export interface Competency {
  id: string;
  subchapterId: string;
  code: string;
  description: string;
}

export type CognitiveLevel = 'LOTS' | 'MOTS' | 'HOTS';
export type QuestionType = 'pg' | 'pg_kompleks' | 'benar_salah' | 'esai';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  subjectId: string;
  chapterId: string;
  subchapterId: string;
  competencyId: string;
  cognitiveLevel: CognitiveLevel;
  type: QuestionType;
  questionText: string;
  options?: QuestionOption[];
  correctAnswer?: any; // Only on backend or teacher bank
  rubric?: string;
  points: number;
  status: 'active' | 'inactive';
  author: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AntiCheatingSettings {
  forceFullscreen: boolean;
  detectTabSwitch: boolean;
  blockRightClick: boolean;
  blockCopyPaste: boolean;
  maxToleranceViolations: number;
  autoSubmitOnViolationLimit: boolean;
}

export interface CognitiveTarget {
  lotsCount: number;
  motsCount: number;
  hotsCount: number;
  totalQuestions: number;
}

export interface Exam {
  id: string;
  title: string;
  subjectId: string;
  academicYearId: string;
  semester: 'Ganjil' | 'Genap';
  targetClassIds: string[];
  scheduleStart: string;
  scheduleEnd: string;
  durationMinutes: number;
  maxScore: number;
  kktpScore: number;
  selectedChapterIds: string[];
  selectedSubchapterIds: string[];
  selectedCompetencyIds: string[];
  cognitiveTarget: CognitiveTarget;
  token: string;
  tokenAutoRotate: boolean;
  tokenIntervalMinutes: number;
  tokenUpdatedAt: string;
  isTokenActive: boolean;
  antiCheating: AntiCheatingSettings;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
  isPublishedResults: boolean;
  createdTeacherId: string;
  createdAt?: string;
}

export interface StudentExamInfo {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  scheduleStart: string;
  scheduleEnd: string;
  isTokenActive: boolean;
  isPublishedResults: boolean;
  studentStatus: 'not_started' | 'in_progress' | 'completed';
  hasResult: boolean;
  score: number | null;
  kktpScore: number;
}

export interface ViolationEntry {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  level: 1 | 2 | 3;
}

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  className: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'disconnected' | 'suspicious';
  startedAt: string;
  durationSeconds: number;
  remainingSeconds: number;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  doubtfulFlags: Record<string, boolean>;
  violationCount: number;
  violations: ViolationEntry[];
  lastHeartbeat: string;
}

export interface StudentQuestionItem {
  number: number;
  id: string;
  subjectId: string;
  chapterId: string;
  subchapterId: string;
  competencyId: string;
  cognitiveLevel: CognitiveLevel;
  type: QuestionType;
  questionText: string;
  options?: QuestionOption[];
  points: number;
}

export interface MonitoringStudent {
  studentId: string;
  name: string;
  nis: string;
  classId: string;
  className: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'disconnected' | 'suspicious';
  remainingSeconds: number;
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  violationCount: number;
  violations: ViolationEntry[];
  hasFinished: boolean;
  finalScore: number | null;
  isPassed: boolean | null;
}

export interface MonitoringPayload {
  exam: {
    id: string;
    title: string;
    token: string;
    isTokenActive: boolean;
    durationMinutes: number;
    scheduleEnd: string;
    kktpScore: number;
  };
  summary: {
    totalStudents: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    disconnected: number;
    suspicious: number;
  };
  students: MonitoringStudent[];
}

export interface ExamResultItem {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  className: string;
  completedAt: string;
  finalScore: number;
  isPassed: boolean;
  kktpScore: number;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  totalQuestions: number;
  breakdownByCognitive: Record<CognitiveLevel, { total: number; correct: number }>;
  questionDetails: any[];
  violationsRecorded: ViolationEntry[];
}

export interface AIIndividualAnalytics {
  summary: string;
  masteredTopics: string[];
  weakTopics: string[];
  cognitiveDiagnosis: {
    lots: string;
    mots: string;
    hots: string;
  };
  remediationPlan: string[];
  enrichmentPlan: string[];
}

export interface AIClassicalAnalytics {
  executiveSummary: string;
  overallCognitiveProficiency: {
    lotsPercent: number;
    motsPercent: number;
    hotsPercent: number;
    insight: string;
  };
  highestWeaknessTopics: string[];
  masteredTopics: string[];
  studentClusters: {
    remedial: string[];
    reinforcement: string[];
    enrichment: string[];
  };
  teacherActionPlan: string[];
}
