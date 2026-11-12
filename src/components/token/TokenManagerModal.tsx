import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Exam } from '../../types/cbt';
import { KeyRound, RefreshCw, Clock, CheckCircle, ShieldCheck, X } from 'lucide-react';

interface TokenManagerModalProps {
  exam: Exam | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const TokenManagerModal: React.FC<TokenManagerModalProps> = ({
  exam,
  isOpen,
  onClose,
  onUpdate,
}) => {
  if (!isOpen || !exam) return null;

  const [token, setToken] = useState(exam.token || 'SMA7X9');
  const [tokenAutoRotate, setTokenAutoRotate] = useState(exam.tokenAutoRotate ?? true);
  const [tokenIntervalMinutes, setTokenIntervalMinutes] = useState(exam.tokenIntervalMinutes || 15);
  const [isTokenActive, setIsTokenActive] = useState(exam.isTokenActive ?? true);
  const [loading, setLoading] = useState(false);
  const [secondsUntilNextRotate, setSecondsUntilNextRotate] = useState(60 * (exam.tokenIntervalMinutes || 15));

  // Countdown timer simulation for token rotation
  useEffect(() => {
    if (!tokenAutoRotate) return;
    const interval = setInterval(() => {
      setSecondsUntilNextRotate((prev) => (prev <= 1 ? tokenIntervalMinutes * 60 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [tokenAutoRotate, tokenIntervalMinutes]);

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const res = await api.regenerateToken(exam.id);
      setToken(res.token);
      setSecondsUntilNextRotate(tokenIntervalMinutes * 60);
      onUpdate();
    } catch (err: any) {
      alert(err.message || 'Gagal meregenerasi token.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await api.updateTokenSettings(exam.id, {
        tokenAutoRotate,
        tokenIntervalMinutes,
        isTokenActive,
      });
      onUpdate();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan token.');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Manajemen Token Ujian</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="text-xs text-slate-500">
            Ujian: <strong className="text-slate-800">{exam.title}</strong>
          </div>

          {/* Current Big Token Box */}
          <div className="p-5 bg-gradient-to-b from-indigo-50/50 to-slate-50 border border-indigo-200 rounded-2xl text-center">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest block">
              TOKEN AKTIF SAAT INI
            </span>
            <div className="text-4xl font-extrabold font-mono tracking-widest text-slate-900 my-2 select-all">
              {token}
            </div>

            {tokenAutoRotate && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-mono mt-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Rotasi berikutnya dalam: <strong>{formatCountdown(secondsUntilNextRotate)}</strong></span>
              </div>
            )}

            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Regenerasi Token Sekarang</span>
            </button>
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer">
              <span className="font-semibold text-slate-700">Wajibkan Token untuk Masuk Ujian</span>
              <input
                type="checkbox"
                checked={isTokenActive}
                onChange={(e) => setIsTokenActive(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer">
              <div>
                <span className="font-semibold text-slate-700 block">Rotasi Token Otomatis</span>
                <span className="text-[11px] text-slate-400">Ganti token secara berkala untuk mencegah kebocoran</span>
              </div>
              <input
                type="checkbox"
                checked={tokenAutoRotate}
                onChange={(e) => setTokenAutoRotate(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {tokenAutoRotate && (
              <div>
                <span className="block font-semibold text-slate-700 mb-1.5">
                  Interval Pergantian Token:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTokenIntervalMinutes(mins)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        tokenIntervalMinutes === mins
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Security Policy Reminder */}
          <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 leading-relaxed border border-slate-200">
            <strong>Integritas Sesi:</strong> Siswa yang sudah berada di dalam ruang ujian tidak akan dikeluarkan ketika token berganti. Token baru hanya berlaku bagi peserta yang belum memulai ujian.
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};
