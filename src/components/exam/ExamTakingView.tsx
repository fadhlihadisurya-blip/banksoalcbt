import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ExamSession, StudentQuestionItem } from '../../types/cbt';
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Send,
  Save,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ExamTakingViewProps {
  examId: string;
  initialSession: ExamSession;
  questions: StudentQuestionItem[];
  examMeta: { id: string; title: string; subjectName: string; durationMinutes: number; antiCheating: any };
  onFinish: () => void;
}

export const ExamTakingView: React.FC<ExamTakingViewProps> = ({
  examId,
  initialSession,
  questions,
  examMeta,
  onFinish,
}) => {
  const { user } = useAuth();

  // State
  const [currentIndex, setCurrentIndex] = useState(initialSession.currentQuestionIndex || 0);
  const [answers, setAnswers] = useState<Record<string, any>>(initialSession.answers || {});
  const [doubtfulFlags, setDoubtfulFlags] = useState<Record<string, boolean>>(initialSession.doubtfulFlags || {});
  const [remainingSeconds, setRemainingSeconds] = useState(initialSession.remainingSeconds || examMeta.durationMinutes * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving'>('saved');

  // Anti-cheating warnings
  const [warningModal, setWarningModal] = useState<{
    show: boolean;
    level: 1 | 2 | 3;
    title: string;
    message: string;
  }>({
    show: false,
    level: 1,
    title: '',
    message: '',
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // References to avoid stale closures in event listeners
  const remainingSecondsRef = useRef(remainingSeconds);
  const answersRef = useRef(answers);
  const doubtfulFlagsRef = useRef(doubtfulFlags);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    doubtfulFlagsRef.current = doubtfulFlags;
  }, [doubtfulFlags]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Request fullscreen
  const enterFullscreen = () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  };

  // Trigger violation reporting to backend and display tiered warning
  const handleTriggerViolation = async (type: string, desc: string) => {
    if (!user?.id) return;
    try {
      const res = await api.recordViolation(examId, user.id, type, desc);
      const level = res.level || 1;

      let title = 'Peringatan Pelanggaran';
      let message = 'Aktivitas mencurigakan terdeteksi.';

      if (level === 1) {
        title = 'Peringatan 1: Deteksi Perpindahan Jendela';
        message = 'Anda terdeteksi keluar dari layar ujian CBT. Tetap berada di halaman ujian hingga selesai.';
      } else if (level === 2) {
        title = 'Peringatan 2: Aktivitas Dicatat di Server';
        message = 'Pelanggaran kedua dicatat ke dalam log pengawas ujian sekolah. Harap patuhi tata tertib ujian.';
      } else {
        title = 'Peringatan 3: Batas Toleransi Tercapai';
        message = 'Pengawas ujian telah menerima notifikasi insiden mencurigakan pada akun Anda.';
      }

      setWarningModal({
        show: true,
        level,
        title,
        message,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Anti-cheating event listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTriggerViolation('TAB_SWITCH', 'Siswa berpindah tab browser atau meminimalkan jendela ujian.');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        handleTriggerViolation('FULLSCREEN_EXIT', 'Siswa keluar dari mode fullscreen.');
      } else {
        setIsFullscreen(true);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleTriggerViolation('RIGHT_CLICK', 'Siswa mencoba membuka menu klik kanan (inspect).');
      return false;
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      handleTriggerViolation('CLIPBOARD_ACTION', 'Siswa mencoba menyalin atau menempel teks.');
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept Alt+Tab, Ctrl+C, Ctrl+V, F12
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'a')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        handleTriggerViolation('KEYBOARD_SHORTCUT', `Percobaan penekanan tombol kombinasi: ${e.key}`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopyPaste);
    window.addEventListener('paste', handleCopyPaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopyPaste);
      window.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [examId, user?.id]);

  // Countdown timer & periodic autosave
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Periodic autosave to server every 8 seconds
  useEffect(() => {
    const autosaveTimer = setInterval(async () => {
      if (!user?.id) return;
      try {
        setAutosaveStatus('saving');
        await api.autosaveExam(examId, user.id, {
          answers: answersRef.current,
          doubtfulFlags: doubtfulFlagsRef.current,
          currentQuestionIndex: currentIndexRef.current,
          remainingSeconds: remainingSecondsRef.current,
        });
        setAutosaveStatus('saved');
      } catch (err) {
        console.error('Autosave error:', err);
      }
    }, 8000);

    return () => clearInterval(autosaveTimer);
  }, [examId, user?.id]);

  // Handle immediate answer change
  const handleSelectAnswer = async (questionId: string, val: any) => {
    const updated = { ...answers, [questionId]: val };
    setAnswers(updated);

    // Save immediately to backend
    if (user?.id) {
      setAutosaveStatus('saving');
      try {
        await api.autosaveExam(examId, user.id, {
          answers: updated,
          doubtfulFlags,
          currentQuestionIndex: currentIndex,
          remainingSeconds,
        });
        setAutosaveStatus('saved');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleDoubtful = async (questionId: string) => {
    const updated = { ...doubtfulFlags, [questionId]: !doubtfulFlags[questionId] };
    setDoubtfulFlags(updated);
    if (user?.id) {
      api.autosaveExam(examId, user.id, { doubtfulFlags: updated });
    }
  };

  // Final submission
  const handleFinalSubmit = async () => {
    if (!user?.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.submitExam(examId, user.id, answers);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setShowSubmitModal(false);
      onFinish();
    } catch (err: any) {
      alert(err.message || 'Gagal menyerahkan ujian.');
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex];
  if (!currentQ) {
    return <div className="text-center py-20 text-slate-500">Memuat soal ujian...</div>;
  }

  // Format timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isUrgentTime = remainingSeconds < 300; // < 5 minutes
  const answeredCount = Object.keys(answers).length;
  const doubtfulCount = Object.values(doubtfulFlags).filter(Boolean).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col text-slate-100 select-none">
      {/* Fullscreen Enforcer Banner if student exited */}
      {!isFullscreen && (
        <div className="bg-amber-600 px-4 py-2 flex items-center justify-between text-xs font-semibold text-white animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Sistem mendeteksi Anda belum dalam mode Layar Penuh (Fullscreen). Klik tombol untuk mengunci layar:</span>
          </div>
          <button
            onClick={enterFullscreen}
            className="px-3 py-1 bg-white text-slate-900 rounded-md font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            Masuk Fullscreen
          </button>
        </div>
      )}

      {/* CBT Header */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            CBT
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
              {examMeta.title}
            </h1>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>{examMeta.subjectName}</span>
              <span>·</span>
              <span>{user?.name} ({user?.nis})</span>
            </div>
          </div>
        </div>

        {/* Timer & Autosave Status */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <Save className={`w-3.5 h-3.5 ${autosaveStatus === 'saving' ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
            <span>{autosaveStatus === 'saving' ? 'Menyimpan...' : 'Tersimpan otomatis'}</span>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm sm:text-base font-bold border tabular-nums transition-colors ${
              isUrgentTime
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>{formatTime(remainingSeconds)}</span>
          </div>
        </div>
      </header>

      {/* Main CBT Workspace: Split Screen Question & Number Map */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center: Question Viewport */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto bg-slate-900/80 p-4 sm:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto w-full space-y-6">
            {/* Question Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white font-mono">
                  Soal Nomor {currentIndex + 1}
                </span>
                <span>/ {questions.length}</span>
                <span>·</span>
                <span className="font-semibold text-indigo-400 font-mono">
                  Level: {currentQ.cognitiveLevel}
                </span>
              </div>
              <span className="font-mono text-slate-500">{currentQ.points} Poin</span>
            </div>

            {/* Question Text with formula styling */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-6 text-sm sm:text-base leading-relaxed text-slate-100 whitespace-pre-wrap font-sans">
              {currentQ.questionText}
            </div>

            {/* Answer Choices */}
            <div className="space-y-3 pt-2">
              {/* 1. Pilihan Ganda (PG Single) */}
              {currentQ.type === 'pg' && currentQ.options && (
                <div className="space-y-2.5">
                  {currentQ.options.map((opt) => {
                    const isSelected = answers[currentQ.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectAnswer(currentQ.id, opt.id)}
                        className={`w-full p-4 rounded-xl border text-left text-sm transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-white font-medium ring-1 ring-indigo-500'
                            : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <span className="mt-0.5 leading-relaxed">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2. Pilihan Ganda Kompleks (PG Kompleks Multi) */}
              {currentQ.type === 'pg_kompleks' && currentQ.options && (
                <div className="space-y-2.5">
                  <div className="text-xs text-indigo-400 mb-2">
                    *Pilihan Ganda Kompleks: Anda dapat memilih lebih dari satu jawaban yang benar.
                  </div>
                  {currentQ.options.map((opt) => {
                    const currentArr = Array.isArray(answers[currentQ.id]) ? answers[currentQ.id] : [];
                    const isSelected = currentArr.includes(opt.id);

                    const toggle = () => {
                      if (isSelected) {
                        handleSelectAnswer(
                          currentQ.id,
                          currentArr.filter((x: string) => x !== opt.id)
                        );
                      } else {
                        handleSelectAnswer(currentQ.id, [...currentArr, opt.id]);
                      }
                    };

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={toggle}
                        className={`w-full p-4 rounded-xl border text-left text-sm transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-white font-medium ring-1 ring-indigo-500'
                            : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-slate-600 bg-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                        <span className="font-bold text-xs text-slate-400">{opt.id}.</span>
                        <span className="leading-relaxed">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 3. Benar-Salah (True/False) */}
              {currentQ.type === 'benar_salah' && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAnswer(currentQ.id, 'true')}
                    className={`py-4 px-6 rounded-xl border text-center font-bold text-sm transition-all ${
                      answers[currentQ.id] === 'true'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    BENAR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAnswer(currentQ.id, 'false')}
                    className={`py-4 px-6 rounded-xl border text-center font-bold text-sm transition-all ${
                      answers[currentQ.id] === 'false'
                        ? 'bg-rose-600/30 border-rose-500 text-rose-200 ring-1 ring-rose-500'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    SALAH
                  </button>
                </div>
              )}

              {/* 4. Esai / Uraian */}
              {currentQ.type === 'esai' && (
                <div className="space-y-2">
                  <label className="block text-xs text-slate-400">Tuliskan jawaban uraian Anda:</label>
                  <textarea
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                    rows={6}
                    placeholder="Ketikkan argumen dan perhitungan Anda di sini..."
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Strip */}
          <div className="max-w-3xl mx-auto w-full pt-6 mt-6 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            {/* Ragu-ragu checkbox */}
            <label className="flex items-center gap-2 cursor-pointer bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/80 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={!!doubtfulFlags[currentQ.id]}
                onChange={() => handleToggleDoubtful(currentQ.id)}
                className="rounded border-amber-500 text-amber-500 focus:ring-amber-500"
              />
              <span>Ragu-ragu</span>
            </label>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((idx) => idx + 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-900/40"
              >
                <Send className="w-4 h-4" />
                <span>Kumpulkan Ujian</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Sidebar: Number Grid Map */}
        <aside className="hidden lg:flex flex-col w-72 bg-slate-900 border-l border-slate-800 p-5 shrink-0 justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <span className="font-bold text-white uppercase tracking-wider">Navigasi Soal</span>
              <span className="text-slate-400 font-mono">{answeredCount} / {questions.length} Dijawab</span>
            </div>

            {/* Question Grid */}
            <div className="grid grid-cols-5 gap-2 mt-4">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
                const isDoubt = !!doubtfulFlags[q.id];

                let btnClass = 'bg-slate-800 text-slate-400 border-slate-700'; // unanswered default

                if (isDoubt) {
                  btnClass = 'bg-amber-600 text-white border-amber-500 font-bold';
                } else if (isAnswered) {
                  btnClass = 'bg-emerald-600 text-white border-emerald-500 font-bold';
                }

                if (isCurrent) {
                  btnClass += ' ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 scale-105';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-11 rounded-lg border flex items-center justify-center font-mono text-xs transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600" />
                <span>Sudah Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-amber-600" />
                <span>Ragu-ragu ({doubtfulCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700" />
                <span>Belum Dijawab ({unansweredCount})</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Kumpulkan Ujian Sekarang</span>
          </button>
        </aside>
      </div>

      {/* Confirmation Modal Before Final Submission */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700 bg-slate-900 text-slate-100">
            <h3 className="text-base font-bold text-white mb-2">Konfirmasi Pengumpulan Ujian</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Apakah Anda yakin ingin menyelesaikan ujian? Setelah diserahkan, Anda tidak dapat mengubah jawaban lagi.
            </p>

            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl space-y-2 text-xs mb-5">
              <div className="flex justify-between">
                <span className="text-slate-400">Soal Terjawab:</span>
                <span className="font-bold font-mono text-emerald-400">{answeredCount} butir</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Soal Masih Ragu-ragu:</span>
                <span className="font-bold font-mono text-amber-400">{doubtfulCount} butir</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Soal Belum Terjawab:</span>
                <span className="font-bold font-mono text-rose-400">{unansweredCount} butir</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Lanjutkan Mengerjakan
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses Nilai...' : 'Ya, Kumpulkan Jawaban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tiered Anti-Cheating Warning Modal */}
      {warningModal.show && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/60 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-amber-300 mb-1">
              {warningModal.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              {warningModal.message}
            </p>

            <button
              onClick={() => {
                setWarningModal((prev) => ({ ...prev, show: false }));
                enterFullscreen();
              }}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Saya Mengerti, Kembali ke Ujian
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
