import React, { useState } from 'react';
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
import { AIAnalyticsView } from './components/analytics/AIAnalyticsView';
import { ClassManagementView } from './components/admin/ClassManagementView';
import { UserManagementView } from './components/admin/UserManagementView';
import { TaxonomyManagementView } from './components/admin/TaxonomyManagementView';
import { SchoolSettingsView } from './components/admin/SchoolSettingsView';
import { ExamTakingView } from './components/exam/ExamTakingView';
import { Exam, ExamSession, StudentQuestionItem } from './types/cbt';
import { api } from './lib/api';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Exam Generator Modal
  const [showExamGenerator, setShowExamGenerator] = useState(false);

  // Token Modal
  const [selectedExamForToken, setSelectedExamForToken] = useState<Exam | null>(null);

  // Live Monitoring Selected Exam
  const [monitoringExamId, setMonitoringExamId] = useState<string>('');

  // Analytics Selected Exam
  const [analyticsExamId, setAnalyticsExamId] = useState<string>('');

  // Active Student Exam Session State
  const [activeExamSession, setActiveExamSession] = useState<{
    examId: string;
    session: ExamSession;
    questions: StudentQuestionItem[];
    examMeta: any;
  } | null>(null);

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
        onFinish={() => {
          setActiveExamSession(null);
          setCurrentTab('results');
        }}
      />
    );
  }

  // Student starts exam
  const handleStartExam = async (examId: string, inputToken?: string) => {
    try {
      const res = await api.startExam(examId, user.id, inputToken);
      setActiveExamSession({
        examId,
        session: res.session,
        questions: res.questions,
        examMeta: res.exam,
      });
    } catch (err: any) {
      alert(err.message || 'Gagal memulai ujian.');
    }
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
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForAnalytics={(id) => {
                setAnalyticsExamId(id);
                setCurrentTab('analytics');
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
        default:
          return <AdminDashboard onNavigate={(tab) => setCurrentTab(tab)} />;
      }
    }

    if (user.role === 'teacher') {
      switch (currentTab) {
        case 'dashboard':
          return (
            <TeacherDashboard
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForAnalytics={(id) => {
                setAnalyticsExamId(id);
                setCurrentTab('analytics');
              }}
            />
          );
        case 'bank':
          return <QuestionBankView />;
        case 'exams':
          return (
            <TeacherDashboard
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForAnalytics={(id) => {
                setAnalyticsExamId(id);
                setCurrentTab('analytics');
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
              initialExamId={analyticsExamId || monitoringExamId}
              onOpenAnalytics={(id) => {
                setAnalyticsExamId(id);
                setCurrentTab('analytics');
              }}
            />
          );
        case 'analytics':
          return <AIAnalyticsView initialExamId={analyticsExamId} />;
        default:
          return (
            <TeacherDashboard
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenExamGenerator={() => setShowExamGenerator(true)}
              onOpenTokenModal={(exam) => setSelectedExamForToken(exam)}
              onSelectExamForMonitoring={(id) => {
                setMonitoringExamId(id);
                setCurrentTab('monitoring');
              }}
              onSelectExamForAnalytics={(id) => {
                setAnalyticsExamId(id);
                setCurrentTab('analytics');
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
        return (
          <ExamResultsView
            initialExamId=""
            onOpenAnalytics={(id) => {
              setAnalyticsExamId(id);
              setCurrentTab('analytics');
            }}
          />
        );
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
          onUpdate={() => {}}
        />
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </SettingsProvider>
  );
}
