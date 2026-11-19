import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppLayout, NavTab } from './components/layout/AppLayout';
import { LoginView } from './components/auth/LoginView';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { TeacherDashboard } from './components/dashboard/TeacherDashboard';
import { StudentDashboard } from './components/dashboard/StudentDashboard';
import { QuestionBankView } from './components/bank/QuestionBankView';
import { ExamGeneratorModal } from './components/generator/ExamGeneratorModal';
import { TokenManagerModal } from './components/token/TokenManagerModal';
import { LiveMonitoringView } from './components/monitoring/LiveMonitoringView';
import { ExamResultsView } from './components/results/ExamResultsView';
import { AnbusoView } from './components/analytics/AnbusoView';
import { ClassManagementView } from './components/admin/ClassManagementView';
import { UserManagementView } from './components/admin/UserManagementView';
import { TaxonomyManagementView } from './components/admin/TaxonomyManagementView';
import { SchoolSettingsView } from './components/admin/SchoolSettingsView';
import { ExamTakingView } from './components/exam/ExamTakingView';
import { Exam, ExamSession, StudentQuestionItem } from './types/cbt';
import { api } from './lib/api';
import {
  incrementStudentClick,
  incrementStudentLoading,
  incrementStudentSave,
} from './lib/studentActivityCounter';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Exam Generator Modal
  const [showExamGenerator, setShowExamGenerator] = useState(false);

  // Token Modal
  const [selectedExamForToken, setSelectedExamForToken] = useState<Exam | null>(null);

  // Live Monitoring Selected Exam
  const [monitoringExamId, setMonitoringExamId] = useState<string>('');

  // Selected Exam for Results / Anbuso
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Refresh key for TeacherDashboard exam list
  const [examListRefreshKey, setExamListRefreshKey] = useState(0);

  // Active Student Exam Session State
  const [activeExamSession, setActiveExamSession] = useState<{
    examId: string;
    session: ExamSession;
    questions: StudentQuestionItem[];
    examMeta: any;
  } | null>(null);

  useEffect(() => {
    if (user?.role !== 'student' || !user?.id) return;
    const studentId = user.id;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-skip-click-count="true"]')) return;
      incrementStudentClick(studentId);
    };
    window.addEventListener('click', handleClick, true);
    return () => window.removeEventListener('click', handleClick, true);
  }, [user?.id, user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-300 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat Portal CBT SMA...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // If student is currently taking exam, render fullscreen ExamTakingView
  if (activeExamSession) {
    return (
      <ExamTakingView
        examId={activeExamSession.examId}
        initialSession={activeExamSession.session}
        questions={activeExamSession.questions}
        examMeta={activeExamSession.examMeta}
        onExit={() => setActiveExamSession(null)}
        onFinish={() => {
          setActiveExamSession(null);
          setCurrentTab('results');
        }}
      />
    );
  }

  // Student starts exam
  const handleStartExam = async (examId: string, inputToken?: string): Promise<void> => {
    incrementStudentLoading(user.id);
    const res = await api.startExam(examId, user.id, inputToken);
    if (!res || !res.session || !Array.isArray(res.questions) || !res.exam) {
      throw new Error('Gagal memuat paket soal ujian. Silakan coba lagi.');
    }
    const startedMs = res.session.startedAt ? new Date(res.session.startedAt).getTime() : 0;
    if (startedMs && Date.now() - startedMs < 15000) {
      incrementStudentSave(user.id);
    }
    setActiveExamSession({
      examId,
      session: res.session,
      questions: res.questions,
      examMeta: res.exam,
    });
  };

  const renderContent = () => {
    if (user.role === 'admin') {
      switch (currentTab) {
        case 'dashboard':
          return <AdminDashboard onNavigate={(tab) => setCurrentTab(tab)} />;
        case 'classes':
          return <ClassManagementView />;
        case 'users':
          return <UserManagementView />;
        case 'bank':
          return <QuestionBankView />;
        case 'taxonomy':
          return <TaxonomyManagementView />;
        case 'settings':
          return <SchoolSettingsView />;
        case 'exams':
          return (
            <TeacherDashboard
              refreshKey={examListRefreshKey}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForResults={(id) => {
                setSelectedExamId(id);
              }}
            />
          );
        case 'monitoring':
          return (
            <LiveMonitoringView
              selectedExamId={monitoringExamId}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
            />
          );
        case 'results':
          return (
            <ExamResultsView
              initialExamId={selectedExamId || monitoringExamId}
            />
          );
        case 'anbuso':
          return <AnbusoView initialExamId={selectedExamId || monitoringExamId} />;
        default:
          return <AdminDashboard onNavigate={(tab) => setCurrentTab(tab)} />;
      }
    }

    if (user.role === 'teacher') {
      switch (currentTab) {
        case 'dashboard':
          return (
            <TeacherDashboard
              refreshKey={examListRefreshKey}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForResults={(id) => {
                setSelectedExamId(id);
              }}
            />
          );
        case 'classes':
          return <ClassManagementView />;
        case 'bank':
          return <QuestionBankView />;
        case 'exams':
          return (
            <TeacherDashboard
              refreshKey={examListRefreshKey}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForResults={(id) => {
                setSelectedExamId(id);
              }}
            />
          );
        case 'monitoring':
          return (
            <LiveMonitoringView
              selectedExamId={monitoringExamId}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
            />
          );
        case 'results':
          return (
            <ExamResultsView
              initialExamId={selectedExamId || monitoringExamId}
            />
          );
        case 'anbuso':
          return <AnbusoView initialExamId={selectedExamId || monitoringExamId} />;
        default:
          return (
            <TeacherDashboard
              refreshKey={examListRefreshKey}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForResults={(id) => {
                setSelectedExamId(id);
              }}
            />
          );
      }
    }

    // Student
    switch (currentTab) {
      case 'dashboard':
        return <StudentDashboard onStartExam={handleStartExam} />;
      case 'results':
        return <ExamResultsView initialExamId="" />;
      default:
        return <StudentDashboard onStartExam={handleStartExam} />;
    }
  };

  return (
    <AppLayout currentTab={currentTab} onTabChange={(tab) => setCurrentTab(tab)}>
      {renderContent()}

      {/* Dynamic Exam Generator Modal */}
      {showExamGenerator && (
        <ExamGeneratorModal
          isOpen={showExamGenerator}
          onClose={() => setShowExamGenerator(false)}
          onSuccess={() => {
            setExamListRefreshKey((k) => k + 1);
            setCurrentTab('exams');
          }}
        />
      )}

      {/* Token Manager Modal */}
      {selectedExamForToken && (
        <TokenManagerModal
          exam={selectedExamForToken}
          isOpen={!!selectedExamForToken}
          onClose={() => setSelectedExamForToken(null)}
          onUpdate={() => {
            setExamListRefreshKey((k) => k + 1);
          }}
        />
      )}
    </AppLayout>
  );
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan saat menampilkan halaman.',
    };
  }

  componentDidCatch(error: any) {
    console.error('Unhandled application error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-100">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-white">Terjadi Gangguan Tampilan</h2>
            <p className="text-xs text-slate-300 leading-relaxed">{this.state.message}</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition-colors"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
              >
                Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </SettingsProvider>
    </AppErrorBoundary>
  );
}
