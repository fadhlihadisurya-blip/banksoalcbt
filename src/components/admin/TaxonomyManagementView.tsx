import React, { useState, useEffect } from 'react';
import {
  Layers,
  BookOpen,
  FolderTree,
  FileCheck2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Check,
  AlertTriangle,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Subject, Chapter, Subchapter, Competency } from '../../types/cbt';
import { api } from '../../lib/api';

type TaxonomyTab = 'subjects' | 'chapters' | 'subchapters' | 'competencies';

export const TaxonomyManagementView: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subchapters, setSubchapters] = useState<Subchapter[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TaxonomyTab>('subjects');

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedSubchapterId, setSelectedSubchapterId] = useState<string>('');

  // Modals state
  const [modalType, setModalType] = useState<TaxonomyTab | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '' });
  const [chapterForm, setChapterForm] = useState({ subjectId: '', name: '' });
  const [subchapterForm, setSubchapterForm] = useState({ chapterId: '', name: '' });
  const [competencyForm, setCompetencyForm] = useState({ subchapterId: '', code: '', description: '' });

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: TaxonomyTab; id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadTaxonomy = async () => {
    setLoading(true);
    try {
      const res = await api.getTaxonomy();
      setSubjects(res.subjects || []);
      setChapters(res.chapters || []);
      setSubchapters(res.subchapters || []);
      setCompetencies(res.competencies || []);

      if (res.subjects && res.subjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(res.subjects[0].id);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal memuat data taksonomi.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxonomy();
  }, []);

  // Filter helpers
  const filteredChapters = selectedSubjectId
    ? chapters.filter((c) => c.subjectId === selectedSubjectId)
    : chapters;

  const filteredSubchapters = selectedChapterId
    ? subchapters.filter((sc) => sc.chapterId === selectedChapterId)
    : selectedSubjectId
    ? subchapters.filter((sc) => filteredChapters.some((c) => c.id === sc.chapterId))
    : subchapters;

  const filteredCompetencies = selectedSubchapterId
    ? competencies.filter((cmp) => cmp.subchapterId === selectedSubchapterId)
    : selectedChapterId
    ? competencies.filter((cmp) => filteredSubchapters.some((sc) => sc.id === cmp.subchapterId))
    : competencies;

  // Modals opening handlers
  const handleOpenAddSubject = () => {
    setEditingId(null);
    setSubjectForm({ name: '', code: '' });
    setModalType('subjects');
  };

  const handleOpenEditSubject = (sbj: Subject) => {
    setEditingId(sbj.id);
    setSubjectForm({ name: sbj.name, code: sbj.code || '' });
    setModalType('subjects');
  };

  const handleOpenAddChapter = () => {
    setEditingId(null);
    setChapterForm({
      subjectId: selectedSubjectId || (subjects[0]?.id || ''),
      name: '',
    });
    setModalType('chapters');
  };

  const handleOpenEditChapter = (ch: Chapter) => {
    setEditingId(ch.id);
    setChapterForm({ subjectId: ch.subjectId, name: ch.name });
    setModalType('chapters');
  };

  const handleOpenAddSubchapter = () => {
    setEditingId(null);
    setSubchapterForm({
      chapterId: selectedChapterId || (filteredChapters[0]?.id || chapters[0]?.id || ''),
      name: '',
    });
    setModalType('subchapters');
  };

  const handleOpenEditSubchapter = (sc: Subchapter) => {
    setEditingId(sc.id);
    setSubchapterForm({ chapterId: sc.chapterId, name: sc.name });
    setModalType('subchapters');
  };

  const handleOpenAddCompetency = () => {
    setEditingId(null);
    setCompetencyForm({
      subchapterId: selectedSubchapterId || (filteredSubchapters[0]?.id || subchapters[0]?.id || ''),
      code: '',
      description: '',
    });
    setModalType('competencies');
  };

  const handleOpenEditCompetency = (cmp: Competency) => {
    setEditingId(cmp.id);
    setCompetencyForm({
      subchapterId: cmp.subchapterId,
      code: cmp.code,
      description: cmp.description,
    });
    setModalType('competencies');
  };

  // Submit handlers
  const handleSubmitSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingId) {
        await api.updateSubject(editingId, subjectForm);
        setFeedback({ type: 'success', message: 'Mata pelajaran berhasil diperbarui.' });
      } else {
        await api.createSubject(subjectForm);
        setFeedback({ type: 'success', message: 'Mata pelajaran baru berhasil ditambahkan.' });
      }
      setModalType(null);
      await loadTaxonomy();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan mata pelajaran.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterForm.subjectId || !chapterForm.name) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingId) {
        await api.updateChapter(editingId, chapterForm);
        setFeedback({ type: 'success', message: 'Bab berhasil diperbarui.' });
      } else {
        await api.createChapter(chapterForm.subjectId, chapterForm.name);
        setFeedback({ type: 'success', message: 'Bab baru berhasil ditambahkan.' });
      }
      setModalType(null);
      await loadTaxonomy();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan Bab.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSubchapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subchapterForm.chapterId || !subchapterForm.name) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingId) {
        await api.updateSubchapter(editingId, subchapterForm);
        setFeedback({ type: 'success', message: 'Sub Bab berhasil diperbarui.' });
      } else {
        await api.createSubchapter(subchapterForm.chapterId, subchapterForm.name);
        setFeedback({ type: 'success', message: 'Sub Bab baru berhasil ditambahkan.' });
      }
      setModalType(null);
      await loadTaxonomy();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan Sub Bab.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCompetency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competencyForm.subchapterId || !competencyForm.code || !competencyForm.description) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingId) {
        await api.updateCompetency(editingId, competencyForm);
        setFeedback({ type: 'success', message: 'Kompetensi / Indikator berhasil diperbarui.' });
      } else {
        await api.createCompetency(competencyForm);
        setFeedback({ type: 'success', message: 'Indikator baru berhasil ditambahkan.' });
      }
      setModalType(null);
      await loadTaxonomy();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan Kompetensi.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (deleteTarget.type === 'subjects') {
        await api.deleteSubject(deleteTarget.id);
      } else if (deleteTarget.type === 'chapters') {
        await api.deleteChapter(deleteTarget.id);
      } else if (deleteTarget.type === 'subchapters') {
        await api.deleteSubchapter(deleteTarget.id);
      } else if (deleteTarget.type === 'competencies') {
        await api.deleteCompetency(deleteTarget.id);
      }
      setFeedback({ type: 'success', message: `Berhasil menghapus ${deleteTarget.name}.` });
      setDeleteTarget(null);
      await loadTaxonomy();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menghapus data.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-indigo-600 mb-1">
            <Layers className="w-6 h-6" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Taksonomi Soal & Kurikulum
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Kelola struktur hirarki Mata Pelajaran, Bab, Sub Bab, dan Indikator Kompetensi (IPK) untuk Bank Soal CBT.
          </p>
        </div>

        <button
          onClick={loadTaxonomy}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang Data</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{subjects.length}</div>
            <div className="text-xs text-slate-500 font-medium">Mata Pelajaran</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{chapters.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Bab</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{subchapters.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Sub Bab</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{competencies.length}</div>
            <div className="text-xs text-slate-500 font-medium">Indikator (IPK)</div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-5 py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'subjects'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>1. Mata Pelajaran ({subjects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('chapters')}
            className={`px-5 py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'chapters'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>2. Bab ({chapters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subchapters')}
            className={`px-5 py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'subchapters'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Sub Bab ({subchapters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('competencies')}
            className={`px-5 py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'competencies'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>4. Indikator / IPK ({competencies.length})</span>
          </button>
        </div>

        {/* Tab 1: Subjects */}
        {activeTab === 'subjects' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari mata pelajaran atau kode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleOpenAddSubject}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Mata Pelajaran</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Kode Mapel</th>
                    <th className="py-3 px-4">Nama Mata Pelajaran</th>
                    <th className="py-3 px-4">Jumlah Bab</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {subjects
                    .filter(
                      (s) =>
                        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (s.code || '').toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((sbj, idx) => {
                      const countBab = chapters.filter((c) => c.subjectId === sbj.id).length;
                      return (
                        <tr key={sbj.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono text-indigo-600 font-semibold">
                            {sbj.code || '-'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{sbj.name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {countBab} Bab
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditSubject(sbj)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Mata Pelajaran"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'subjects',
                                    id: sbj.id,
                                    name: sbj.name,
                                  })
                                }
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Mata Pelajaran"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Chapters */}
        {activeTab === 'chapters' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-xl">
                <div className="w-48">
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Semua Mapel --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari bab..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={handleOpenAddChapter}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Bab Baru</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Mata Pelajaran</th>
                    <th className="py-3 px-4">Nama Bab</th>
                    <th className="py-3 px-4">Sub Bab</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredChapters
                    .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((ch, idx) => {
                      const sbj = subjects.find((s) => s.id === ch.subjectId);
                      const subCount = subchapters.filter((sc) => sc.chapterId === ch.id).length;
                      return (
                        <tr key={ch.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-semibold text-indigo-700">
                            {sbj?.name || '-'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{ch.name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {subCount} Sub Bab
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditChapter(ch)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Bab"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'chapters',
                                    id: ch.id,
                                    name: ch.name,
                                  })
                                }
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Bab"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Subchapters */}
        {activeTab === 'subchapters' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedChapterId('');
                  }}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Semua Mapel --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Semua Bab --</option>
                  {filteredChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari sub bab..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={handleOpenAddSubchapter}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Sub Bab</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Induk Bab</th>
                    <th className="py-3 px-4">Nama Sub Bab</th>
                    <th className="py-3 px-4">Indikator IPK</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredSubchapters
                    .filter((sc) => sc.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((sc, idx) => {
                      const ch = chapters.find((c) => c.id === sc.chapterId);
                      const cmpCount = competencies.filter((cmp) => cmp.subchapterId === sc.id).length;
                      return (
                        <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-medium text-slate-700">{ch?.name || '-'}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{sc.name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                              {cmpCount} Indikator
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditSubchapter(sc)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Sub Bab"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'subchapters',
                                    id: sc.id,
                                    name: sc.name,
                                  })
                                }
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Sub Bab"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Competencies */}
        {activeTab === 'competencies' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedChapterId('');
                    setSelectedSubchapterId('');
                  }}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Semua Mapel --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedChapterId}
                  onChange={(e) => {
                    setSelectedChapterId(e.target.value);
                    setSelectedSubchapterId('');
                  }}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Semua Bab --</option>
                  {filteredChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSubchapterId}
                  onChange={(e) => setSelectedSubchapterId(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Semua Sub Bab --</option>
                  {filteredSubchapters.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari kode KD atau deskripsi..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={handleOpenAddCompetency}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Indikator / IPK</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Kode KD</th>
                    <th className="py-3 px-4">Deskripsi Kompetensi / IPK</th>
                    <th className="py-3 px-4">Sub Bab</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredCompetencies
                    .filter(
                      (cmp) =>
                        cmp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        cmp.description.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((cmp, idx) => {
                      const sc = subchapters.find((s) => s.id === cmp.subchapterId);
                      return (
                        <tr key={cmp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-600">{cmp.code}</td>
                          <td className="py-3 px-4 font-medium text-slate-900 max-w-md">
                            {cmp.description}
                          </td>
                          <td className="py-3 px-4 text-slate-500">{sc?.name || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditCompetency(cmp)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Indikator"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'competencies',
                                    id: cmp.id,
                                    name: `${cmp.code} - ${cmp.description}`,
                                  })
                                }
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Indikator"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Subject */}
      {modalType === 'subjects' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Fisika, Matematika Peminatan..."
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Singkatan Mapel
                </label>
                <input
                  type="text"
                  placeholder="Contoh: FIS-SMA-XII"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Mapel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chapter */}
      {modalType === 'chapters' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Bab' : 'Tambah Bab Baru'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={chapterForm.subjectId}
                  onChange={(e) => setChapterForm({ ...chapterForm, subjectId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Bab <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Termodinamika dan Hukum Gas Ideal"
                  value={chapterForm.name}
                  onChange={(e) => setChapterForm({ ...chapterForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Bab'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Subchapter */}
      {modalType === 'subchapters' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Sub Bab' : 'Tambah Sub Bab Baru'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSubchapter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Induk Bab <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={subchapterForm.chapterId}
                  onChange={(e) => setSubchapterForm({ ...subchapterForm, chapterId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- Pilih Bab --</option>
                  {chapters.map((c) => {
                    const sbj = subjects.find((s) => s.id === c.subjectId);
                    return (
                      <option key={c.id} value={c.id}>
                        {sbj ? `[${sbj.name}] ` : ''}
                        {c.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Sub Bab <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Siklus Carnot dan Efisiensi Mesin"
                  value={subchapterForm.name}
                  onChange={(e) => setSubchapterForm({ ...subchapterForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Sub Bab'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Competency */}
      {modalType === 'competencies' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Indikator / IPK' : 'Tambah Indikator / IPK Baru'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCompetency} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub Bab Terkait <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={competencyForm.subchapterId}
                  onChange={(e) => setCompetencyForm({ ...competencyForm, subchapterId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- Pilih Sub Bab --</option>
                  {subchapters.map((sc) => {
                    const ch = chapters.find((c) => c.id === sc.chapterId);
                    return (
                      <option key={sc.id} value={sc.id}>
                        {ch ? `[${ch.name}] ` : ''}
                        {sc.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Kompetensi / KD <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: KD 3.6.1"
                  value={competencyForm.code}
                  onChange={(e) => setCompetencyForm({ ...competencyForm, code: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Indikator / IPK <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Deskripsi pencapaian kompetensi..."
                  value={competencyForm.description}
                  onChange={(e) => setCompetencyForm({ ...competencyForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Indikator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Konfirmasi Hapus Data</h3>
            <p className="text-xs text-slate-600 mb-4">
              Apakah Anda yakin ingin menghapus <strong className="text-slate-900">{deleteTarget.name}</strong>?
              Seluruh data taksonomi di bawahnya juga akan terhapus.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
