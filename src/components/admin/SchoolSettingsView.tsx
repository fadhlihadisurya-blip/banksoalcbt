import React, { useState } from 'react';
import {
  Settings,
  School,
  Image as ImageIcon,
  Upload,
  Check,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Eye,
  GraduationCap,
  Save,
  AlertCircle,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

const PRESET_BACKGROUNDS = [
  {
    id: 'default-grid',
    name: 'Default Tech Grid (Gelap)',
    url: '',
    description: 'Pola garis kisi-kisi futuristik biru gelap standar CBT.',
  },
  {
    id: 'campus-photo',
    name: 'Gedung Sekolah Modern',
    url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1600&q=80',
    description: 'Foto gedung sekolah & perpustakaan modern bernuansa akademik.',
  },
  {
    id: 'classroom-tech',
    name: 'Laboratorium Komputer',
    url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80',
    description: 'Foto laboratorium sains & teknologi pembelajaran.',
  },
  {
    id: 'gradient-blue',
    name: 'Gradient Indigo Minimalis',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
    description: 'Latar abstrak gradasi indigo elegan & profesional.',
  },
];

const PRESET_LOGOS = [
  {
    id: 'default-cap',
    name: 'Ikon Toga Pendidikan (Default)',
    url: '',
  },
  {
    id: 'logo-tutwuri',
    name: 'Lambang Pendidikan',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Logo_of_Ministry_of_Education_and_Culture_of_Republic_of_Indonesia.svg',
  },
  {
    id: 'logo-crest',
    name: 'Perisai Mahkota Prestasi',
    url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=200&q=80',
  },
];

export const SchoolSettingsView: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  const [formState, setFormState] = useState({
    schoolName: settings.schoolName || 'SMAN 1 PRESTASI BANGSA',
    schoolLogoUrl: settings.schoolLogoUrl || '',
    loginBackgroundUrl: settings.loginBackgroundUrl || '',
    appSubtitle: settings.appSubtitle || 'CBT Portal · TP 2024/2025 Genap',
  });

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // File Upload Handlers
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran berkas logo maksimal 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormState((prev) => ({
          ...prev,
          schoolLogoUrl: event.target!.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran berkas foto background maksimal 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormState((prev) => ({
          ...prev,
          loginBackgroundUrl: event.target!.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToastMessage(null);
    try {
      await updateSettings(formState);
      setToastMessage('Pengaturan sekolah & identitas visual berhasil diperbarui!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert('Gagal menyimpan pengaturan: ' + (err.message || 'Terjadi kesalahan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Kembalikan semua pengaturan ke standar awal aplikasi?')) {
      const defaults = {
        schoolName: 'SMAN 1 PRESTASI BANGSA',
        schoolLogoUrl: '',
        loginBackgroundUrl: '',
        appSubtitle: 'CBT Portal · TP 2024/2025 Genap',
      };
      setFormState(defaults);
      updateSettings(defaults);
      setToastMessage('Pengaturan telah dikembalikan ke default.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-indigo-600 mb-1">
            <Settings className="w-6 h-6" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Pengaturan Sekolah & Branding Visual
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Kelola nama sekolah, logo sekolah, serta foto latar belakang halaman login portal CBT.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetToDefault}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset ke Default</span>
        </button>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: NAMA SEKOLAH & TEKS HEADER */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
            <School className="w-4 h-4 text-indigo-600" />
            <span>1. Identitas Nama Sekolah</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lengkap Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formState.schoolName}
                onChange={(e) => setFormState({ ...formState, schoolName: e.target.value })}
                placeholder="Contoh: SMAN 1 PRESTASI BANGSA"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Nama ini akan ditampilkan pada header portal utama, halaman ujian, dan kartu hasil.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subtitle / Teks Tahun Ajaran
              </label>
              <input
                type="text"
                value={formState.appSubtitle}
                onChange={(e) => setFormState({ ...formState, appSubtitle: e.target.value })}
                placeholder="Contoh: CBT Portal · TP 2024/2025 Genap"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Teks keterangan tambahan di bawah nama sekolah pada top bar.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: LOGO SEKOLAH */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>2. Logo Sekolah</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unggah Berkas Logo Sekolah (PNG / JPG / SVG)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold cursor-pointer border border-indigo-200 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Pilih Gambar dari Komputer</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                  </label>
                  {formState.schoolLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, schoolLogoUrl: '' })}
                      className="text-xs text-rose-600 hover:underline font-medium"
                    >
                      Hapus Logo Custom
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Atau Masukkan URL Gambar Logo
                </label>
                <input
                  type="text"
                  value={formState.schoolLogoUrl}
                  onChange={(e) => setFormState({ ...formState, schoolLogoUrl: e.target.value })}
                  placeholder="https://domain-sekolah.sch.id/logo.png"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Pilih Preset Logo Pilihan
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_LOGOS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setFormState({ ...formState, schoolLogoUrl: preset.url })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 ${
                        formState.schoolLogoUrl === preset.url
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Preview Logo Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Pratinjau Logo Header
              </span>
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md overflow-hidden mb-2">
                {formState.schoolLogoUrl ? (
                  <img
                    src={formState.schoolLogoUrl}
                    alt="Logo Sekolah"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <GraduationCap className="w-9 h-9" />
                )}
              </div>
              <span className="text-xs font-bold text-slate-800">{formState.schoolName}</span>
              <span className="text-[10px] text-slate-500">{formState.appSubtitle}</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: FOTO BACKGROUND HALAMAN LOGIN */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
            <ImageIcon className="w-4 h-4 text-indigo-600" />
            <span>3. Foto Background Halaman Login</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unggah Berkas Foto Background Login (JPG / PNG)
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold cursor-pointer border border-indigo-200 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Unggah Foto Background</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBgFileUpload}
                    className="hidden"
                  />
                </label>
                {formState.loginBackgroundUrl && (
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, loginBackgroundUrl: '' })}
                    className="text-xs text-rose-600 hover:underline font-medium"
                  >
                    Gunakan Pattern Default
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Atau Masukkan URL Foto Background
              </label>
              <input
                type="text"
                value={formState.loginBackgroundUrl}
                onChange={(e) => setFormState({ ...formState, loginBackgroundUrl: e.target.value })}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Pilihan Preset Background Login
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PRESET_BACKGROUNDS.map((preset) => {
                  const isSelected = formState.loginBackgroundUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setFormState({ ...formState, loginBackgroundUrl: preset.url })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/30'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="h-20 rounded-lg bg-slate-900 relative overflow-hidden mb-2 border border-slate-700/50">
                        {preset.url ? (
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover opacity-60" />
                        ) : (
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:1rem_1rem] opacity-50" />
                        )}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white p-1 rounded-full shadow-xs">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">{preset.name}</div>
                      <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{preset.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Preview Box of Login View */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  Pratinjau Tampilan Halaman Login
                </span>
                <span className="text-[11px] text-slate-400">Live Preview</span>
              </div>

              <div className="relative rounded-2xl h-64 bg-slate-900 overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center p-4">
                {/* Background Image / Overlay */}
                {formState.loginBackgroundUrl ? (
                  <>
                    <img
                      src={formState.loginBackgroundUrl}
                      alt="Login Background Preview"
                      className="absolute inset-0 w-full h-full object-cover opacity-40 scale-105"
                    />
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-50" />
                )}

                {/* Mock Login Card Inside Preview */}
                <div className="relative z-10 bg-slate-800/90 border border-slate-700 rounded-xl p-4 max-w-xs w-full text-center shadow-xl backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 mx-auto flex items-center justify-center text-white mb-2 shadow-md">
                    {formState.schoolLogoUrl ? (
                      <img src={formState.schoolLogoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <GraduationCap className="w-6 h-6" />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">{formState.schoolName}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Portal Ujian Berbasis Komputer</p>

                  <div className="mt-3 space-y-1.5">
                    <div className="h-7 bg-slate-900/80 rounded-md border border-slate-700 px-2 text-[10px] text-slate-500 flex items-center">
                      NIS / Username Siswa
                    </div>
                    <div className="h-7 bg-slate-900/80 rounded-md border border-slate-700 px-2 text-[10px] text-slate-500 flex items-center">
                      Kata Sandi (Password)
                    </div>
                    <div className="h-7 bg-indigo-600 rounded-md text-white text-[10px] font-bold flex items-center justify-center">
                      Masuk ke Portal Ujian
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan Pengaturan...' : 'Simpan Perubahan Pengaturan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
