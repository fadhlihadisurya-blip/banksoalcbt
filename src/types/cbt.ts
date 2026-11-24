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
  code?: string;
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

export interface NodeCognitiveComposition {
  scopeType: 'competency' | 'subchapter' | 'chapter';
  scopeId: string;
  chapterId: string;
  subchapterId?: string;
  competencyId?: string;
  label?: string;
  lotsCount: number;
  motsCount: number;
  hotsCount: number;
}

export interface CognitiveTarget {
  lotsCount: number;
  motsCount: number;
  hotsCount: number;
  totalQuestions: number;
  perScopeTargets?: NodeCognitiveComposition[];
}

export type PgKompleksScoringMode = 'partial' | 'exact';

export interface ExamScoringConfig {
  pgKompleksMode?: PgKompleksScoringMode;
  useMinusSystem: boolean;
  minusValue: number;
  weights: {
    LOTS: number;
    MOTS: number;
    HOTS: number;
  };
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
  scoringConfig?: ExamScoringConfig;
  token: string;
  tokenAutoRotate: boolean;
  tokenIntervalMinutes: number;
  tokenUpdatedAt: string;
  isTokenActive: boolean;
  antiCheating: AntiCheatingSettings;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
  isPublishedResults: boolean;
  showLiveScore?: boolean;
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
  violationCount?: number;
  isRemedial?: boolean;
  sourceExamId?: string;
  remedialMode?: RemedialMode;
  baseScore?: number;
  addedScore?: number;
  remedialQuestionCount?: number;
  attemptCount?: number;
  isRemedialPassed?: boolean;
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
  maxSelectable?: number;
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
  liveScore?: number | null;
  liveCorrectCount?: number;
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
    maxScore?: number;
    showLiveScore?: boolean;
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
  isRemedialPassed?: boolean;
  kktpStatusLabel?: string;
  kktpScore: number;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  totalQuestions: number;
  breakdownByCognitive: Record<CognitiveLevel, { total: number; correct: number }>;
  questionDetails: any[];
  violationsRecorded: ViolationEntry[];
}

export interface StudentResultItem {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  className: string;
  completedAt: string;
  correctCount: number | null;
  wrongCount: number | null;
  emptyCount: number;
  totalQuestions: number;
  isPublishedResults: boolean;
  finalScore: number | null;
  isRemedial?: boolean;
  baseScore?: number;
  addedScore?: number;
  kktpScore?: number;
  attemptCount?: number;
  isRemedialPassed?: boolean;
}

export interface StudentResultsPayload {
  results: StudentResultItem[];
  stats: {
    totalCompleted: number;
    hasHiddenScores: boolean;
    average: number | null;
    highest: number | null;
    lowest: number | null;
    median: number | null;
  };
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

export type RemedialMode = 'same_wrong' | 'random_same_competency';

export interface RemedialWrongQuestionMeta {
  questionId: string;
  questionCode?: string;
  competencyId?: string | null;
  subchapterId?: string | null;
  chapterId?: string | null;
  cognitiveLevel?: CognitiveLevel;
  maxPoints?: number;
}

export interface RemedialAttemptRecord {
  attempt: number;
  mode: RemedialMode;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  finalCappedScore: number;
  isPassed: boolean;
  completedAt: string;
}

export interface RemedialAssignment {
  id: string;
  sourceExamId: string;
  sourceExamTitle: string;
  subjectId: string;
  subjectName?: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  className: string;
  mode: RemedialMode;
  questionIds: string[];
  wrongQuestions?: RemedialWrongQuestionMeta[];
  originalTotalQuestions: number;
  baseScore: number;
  kktpScore: number;
  maxScore: number;
  pointsPerCorrect: number;
  durationMinutes: number;
  durationSeconds?: number;
  attemptCount?: number;
  attemptHistory?: RemedialAttemptRecord[];
  status: 'assigned' | 'in_progress' | 'completed';
  remedialCorrectCount?: number;
  remedialWrongCount?: number;
  remedialEmptyCount?: number;
  addedScore?: number;
  finalCappedScore?: number;
  isPassed?: boolean;
  fallbackUsedCount?: number;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface RemedialExamStudentRow {
  studentId: string;
  studentName: string;
  studentNis: string;
  className: string;
  originalScore: number;
  kktpScore: number;
  isPassedOriginal: boolean;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  totalQuestions: number;
  wrongSubchapterNames?: string[];
  wrongCompetencyCodes?: string[];
  remedial: RemedialAssignment | null;
  effectiveScore: number;
  effectivePassed: boolean;
}

export interface RemedialOverviewPayload {
  completedExams: Array<{
    id: string;
    title: string;
    subjectName: string;
    kktpScore: number;
    maxScore: number;
    participantCount: number;
    remedialNeededCount: number;
    remedialAssignedCount: number;
    remedialCompletedCount: number;
  }>;
  selectedExam: {
    id: string;
    title: string;
    subjectName: string;
    kktpScore: number;
    maxScore: number;
    durationMinutes: number;
  } | null;
  students: RemedialExamStudentRow[];
  summary: {
    totalParticipants: number;
    passedCount: number;
    remedialCount: number;
    generatedCount: number;
    completedRemedialCount: number;
    passedAfterRemedialCount: number;
  };
}

export type TeacherMenuKey =
  | 'classes'
  | 'users'
  | 'bank'
  | 'taxonomy'
  | 'exams'
  | 'monitoring'
  | 'results'
  | 'remedial'
  | 'anbuso';

export type TeacherMenuVisibility = Record<TeacherMenuKey, boolean>;

export const DEFAULT_TEACHER_MENUS: TeacherMenuVisibility = {
  classes: true,
  users: false,
  bank: true,
  taxonomy: false,
  exams: true,
  monitoring: true,
  results: true,
  remedial: true,
  anbuso: true,
};

export function normalizeTeacherMenus(raw?: Partial<Record<TeacherMenuKey, boolean>> | null): TeacherMenuVisibility {
  return {
    classes: raw?.classes !== undefined ? Boolean(raw.classes) : DEFAULT_TEACHER_MENUS.classes,
    users: raw?.users !== undefined ? Boolean(raw.users) : DEFAULT_TEACHER_MENUS.users,
    bank: raw?.bank !== undefined ? Boolean(raw.bank) : DEFAULT_TEACHER_MENUS.bank,
    taxonomy: raw?.taxonomy !== undefined ? Boolean(raw.taxonomy) : DEFAULT_TEACHER_MENUS.taxonomy,
    exams: raw?.exams !== undefined ? Boolean(raw.exams) : DEFAULT_TEACHER_MENUS.exams,
    monitoring: raw?.monitoring !== undefined ? Boolean(raw.monitoring) : DEFAULT_TEACHER_MENUS.monitoring,
    results: raw?.results !== undefined ? Boolean(raw.results) : DEFAULT_TEACHER_MENUS.results,
    remedial: raw?.remedial !== undefined ? Boolean(raw.remedial) : DEFAULT_TEACHER_MENUS.remedial,
    anbuso: raw?.anbuso !== undefined ? Boolean(raw.anbuso) : DEFAULT_TEACHER_MENUS.anbuso,
  };
}

export interface SchoolSettings {
  schoolName: string;
  schoolLogoUrl: string;
  loginBackgroundUrl: string;
  appSubtitle?: string;
  academicYearText?: string;
  teacherMenus?: TeacherMenuVisibility;
  showDeleteExamAction?: boolean;
}

