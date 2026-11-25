import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Question,
  Subject,
  Chapter,
  Subchapter,
  Competency,
  CognitiveLevel,
  QuestionType,
} from '../../types/cbt';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  HelpCircle,
  Layers,
  Sparkles,
  X,
  RotateCcw,
} from 'lucide-react';
import { RichQuestionEditor } from './RichQuestionEditor';
import { RichContent } from '../common/RichContent';
import { hasMeaningfulRichContent, stripHtmlToText } from '../../lib/richContent';
import { generateNextQuestionCode } from '../../lib/questionCode';

export const QuestionBankView: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [taxonomy, setTaxonomy] = useState<{
    subjects: Subject[];
    chapters: Chapter[];
    subchapters: Subchapter[];
    competencies: Competency[];
  }>({
    subjects: [],
    chapters: [],
    subchapters: [],
    competencies: [],
  });

  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSubject, setFilterSubject] = useState('');
  const [filterChapter, setFilterChapter] = useState('');
  const [filterSubchapter, setFilterSubchapter] = useState('');
  const [filterCompetency, setFilterCompetency] = useState('');
  const [filterCognitive, setFilterCognitive] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Form states
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [formData, setFormData] = useState<{
    code: string;
    subjectId: string;
    chapterId: string;
    subchapterId: string;
    competencyId: string;
    cognitiveLevel: CognitiveLevel;
    type: QuestionType;
    questionText: string;
    options: { id: string; text: string }[];
    correctAnswer: any;
    rubric: string;
    points: number;
    status: 'active' | 'inactive';
  }>({
    code: '',
    subjectId: '',
    chapterId: '',
    subchapterId: '',
    competencyId: '',
    cognitiveLevel: 'MOTS',
    type: 'pg',
    questionText: '',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
      { id: 'E', text: '' },
    ],
    correctAnswer: 'A',
    rubric: '',
    points: 10,
    status: 'active',
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [qRes, tRes] = await Promise.all([
        api.getQuestions(),
        api.getTaxonomy(),
      ]);
      setQuestions(qRes.questions || []);
      setTaxonomy(tRes);
      if (tRes.subjects.length > 0 && !formData.subjectId) {
        setFormData((prev) => ({
          ...prev,
          subjectId: tRes.subjects[0].id,
          chapterId: tRes.chapters[0]?.id || '',
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultOptions = () => [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
    { id: 'E', text: '' },
  ];

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    const initialSubject = filterSubject || taxonomy.subjects[0]?.id || '';
    const initialChapters = initialSubject
      ? taxonomy.chapters.filter((c) => c.subjectId === initialSubject)
      : taxonomy.chapters;
    const initialChapter = filterChapter || initialChapters[0]?.id || '';
    const initialSubchapters = initialChapter
      ? taxonomy.subchapters.filter((sc) => sc.chapterId === initialChapter)
      : taxonomy.subchapters;
    const initialSubchapter = filterSubchapter || initialSubchapters[0]?.id || '';
    const initialCompetencies = initialSubchapter
      ? taxonomy.competencies.filter((cmp) => cmp.subchapterId === initialSubchapter)
      : taxonomy.competencies;
    const initialCompetency = filterCompetency || initialCompetencies[0]?.id || '';

    const autoCode = generateNextQuestionCode(initialSubject, questions, taxonomy.subjects);
    setCodeManuallyEdited(false);
    setFormData({
      code: autoCode,
      subjectId: initialSubject,
      chapterId: initialChapter,
      subchapterId: initialSubchapter,
      competencyId: initialCompetency,
      cognitiveLevel: (filterCognitive as CognitiveLevel) || 'MOTS',
      type: 'pg',
      questionText: '',
      options: createDefaultOptions(),
      correctAnswer: 'A',
      rubric: '',
      points: 10,
      status: 'active',
    });
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setCodeManuallyEdited(false);
    const existingOptions =
      Array.isArray(q.options) && q.options.length > 0
        ? q.options
        : q.type === 'pg' || q.type === 'pg_kompleks'
        ? createDefaultOptions()
        : [];
    setFormData({
      code: q.code || generateNextQuestionCode(q.subjectId, questions, taxonomy.subjects, q.id),
      subjectId: q.subjectId,
      chapterId: q.chapterId,
      subchapterId: q.subchapterId,
      competencyId: q.competencyId,
      cognitiveLevel: q.cognitiveLevel,
      type: q.type,
      questionText: q.questionText,
      options: existingOptions,
      correctAnswer: q.correctAnswer,
      rubric: q.rubric || '',
      points: q.points || 10,
      status: q.status,
    });
    setShowAddEditModal(true);
  };

  const handleAddOption = () => {
    setFormData((prev) => {
      if (prev.options.length >= 26) return prev;
      const nextId = String.fromCharCode(65 + prev.options.length);
      return {
        ...prev,
        options: [...prev.options, { id: nextId, text: '' }],
      };
    });
  };

  const handleRemoveOption = (removeIdx: number) => {
    setFormData((prev) => {
      if (prev.options.length <= 3) return prev;
      const oldCorrectSet = new Set<string>(
        prev.type === 'pg'
          ? typeof prev.correctAnswer === 'string'
            ? [prev.correctAnswer]
            : []
          : Array.isArray(prev.correctAnswer)
          ? prev.correctAnswer.map(String)
          : []
      );
      const remaining = prev.options.filter((_, idx) => idx !== removeIdx);
      const newCorrectIds: string[] = [];
      const reindexedOptions = remaining.map((opt, idx) => {
        const newId = String.fromCharCode(65 + idx);
        if (oldCorrectSet.has(opt.id)) {
          newCorrectIds.push(newId);
        }
        return { ...opt, id: newId };
      });

      const nextCorrect =
        prev.type === 'pg'
          ? newCorrectIds[0] || reindexedOptions[0]?.id || 'A'
          : newCorrectIds;

      return {
        ...prev,
        options: reindexedOptions,
        correctAnswer: nextCorrect,
      };
    });
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasMeaningfulRichContent(formData.questionText)) {
      alert('Konten pertanyaan tidak boleh kosong.');
      return;
    }

    if (formData.type === 'pg' || formData.type === 'pg_kompleks') {
      if (formData.options.length < 3) {
        alert('Pilihan ganda minimal harus memiliki 3 opsi jawaban.');
        return;
      }
      const emptyOpt = formData.options.find((opt) => !hasMeaningfulRichContent(opt.text));
      if (emptyOpt) {
        alert(`Opsi jawaban ${emptyOpt.id} tidak boleh kosong.`);
        return;
      }
      if (formData.type === 'pg_kompleks') {
        const validIds = new Set(formData.options.map((o) => o.id));
        const selectedKeys = Array.isArray(formData.correctAnswer)
          ? formData.correctAnswer.filter((id: string) => validIds.has(id))
          : [];
        if (selectedKeys.length === 0) {
          alert('Pilih minimal 1 kunci jawaban benar untuk Pilihan Ganda Kompleks.');
          return;
        }
      }
    }

    // Guard against Firestore 1MB document limit when questions contain multiple pasted images
    const payloadBytes = new Blob([JSON.stringify(formData)]).size;
    if (payloadBytes > 900_000) {
      alert('Ukuran konten soal dan gambar terlalu besar (melebihi 900 KB). Gunakan gambar dengan ukuran lebih kecil.');
      return;
    }

    try {
      if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, formData);
      } else {
        await api.createQuestion(formData);
      }
      setShowAddEditModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan soal.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus butir soal ini dari bank soal?')) return;
    try {
      await api.deleteQuestion(id);
      loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Cascading chapters, subchapters, and sub-subchapters for filters
  const availableChapters = filterSubject
    ? taxonomy.chapters.filter((c) => c.subjectId === filterSubject)
    : taxonomy.chapters;

  const availableSubchapters = filterChapter
    ? taxonomy.subchapters.filter((sc) => sc.chapterId === filterChapter)
    : filterSubject
    ? taxonomy.subchapters.filter((sc) => availableChapters.some((c) => c.id === sc.chapterId))
    : taxonomy.subchapters;

  const availableCompetencies = filterSubchapter
    ? taxonomy.competencies.filter((cmp) => cmp.subchapterId === filterSubchapter)
    : filterChapter || filterSubject
    ? taxonomy.competencies.filter((cmp) => availableSubchapters.some((sc) => sc.id === cmp.subchapterId))
    : taxonomy.competencies;

  // Cascading taxonomy for form modal
  const formAvailableChapters = formData.subjectId
    ? taxonomy.chapters.filter((c) => c.subjectId === formData.subjectId)
    : taxonomy.chapters;

  const formAvailableSubchapters = formData.chapterId
    ? taxonomy.subchapters.filter((sc) => sc.chapterId === formData.chapterId)
    : formData.subjectId
    ? taxonomy.subchapters.filter((sc) => formAvailableChapters.some((c) => c.id === sc.chapterId))
    : taxonomy.subchapters;

  const formAvailableCompetencies = formData.subchapterId
    ? taxonomy.competencies.filter((cmp) => cmp.subchapterId === formData.subchapterId)
    : taxonomy.competencies;

  // Filter & sort logic (ordered by unique code ascending from smallest index)
  const filteredQuestions = questions
    .filter((q) => {
      if (filterSubject && q.subjectId !== filterSubject) return false;
      if (filterChapter && q.chapterId !== filterChapter) return false;
      if (filterSubchapter && q.subchapterId !== filterSubchapter) return false;
      if (filterCompetency && q.competencyId !== filterCompetency) return false;
      if (filterCognitive && q.cognitiveLevel !== filterCognitive) return false;
      if (filterType && q.type !== filterType) return false;
      if (filterStatus && q.status !== filterStatus) return false;
      if (searchQuery) {
        const s = searchQuery.toLowerCase();
        const matchText = stripHtmlToText(q.questionText || '').toLowerCase().includes(s);
        const matchCode = (q.code || '').toLowerCase().includes(s);
        if (!matchText && !matchCode) return false;
      }
      return true;
    })
    .sort((a, b) =>
      (a.code || a.id || '').localeCompare(b.code || b.id || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );

  const isAnyFilterActive =
    !!filterSubject ||
    !!filterChapter ||
    !!filterSubchapter ||
    !!filterCompetency ||
    !!filterCognitive ||
    !!filterType ||
    !!filterStatus ||
    !!searchQuery;

  const handleResetFilters = () => {
    setFilterSubject('');
    setFilterChapter('');
    setFilterSubchapter('');
    setFilterCompetency('');
    setFilterCognitive('');
    setFilterType('');
    setFilterStatus('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Bank Soal & Taksonomi Kompetensi
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Klasifikasi LOTS/MOTS/HOTS</span>
            <span>·</span>
            <span className="font-semibold text-slate-700">{questions.length} Butir Soal Terdaftar</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Butir Soal</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar (Search, Mapel, Bab, Sub Bab, Sub-Sub Bab, Level Kognitif, Status) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filter & Pencarian Bank Soal:</span>
          </span>
          {isAnyFilterActive && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Reset Semua Filter</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* 1. Search Query */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode soal / teks soal..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 2. Subject Filter */}
          <div>
            <select
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value);
                setFilterChapter('');
                setFilterSubchapter('');
                setFilterCompetency('');
              }}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Semua Mata Pelajaran</option>
              {taxonomy.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Chapter Filter (Bab) */}
          <div>
            <select
              value={filterChapter}
              onChange={(e) => {
                setFilterChapter(e.target.value);
                setFilterSubchapter('');
                setFilterCompetency('');
              }}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Semua Bab</option>
              {availableChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Subchapter Filter (Sub Bab) */}
          <div>
            <select
              value={filterSubchapter}
              onChange={(e) => {
                setFilterSubchapter(e.target.value);
                setFilterCompetency('');
              }}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Semua Sub Bab</option>
              {availableSubchapters.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Sub-Subchapter Filter (Sub-Sub Bab) */}
          <div>
            <select
              value={filterCompetency}
              onChange={(e) => setFilterCompetency(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Semua Sub-Sub Bab</option>
              {availableCompetencies.map((cmp) => (
                <option key={cmp.id} value={cmp.id}>
                  {cmp.code ? `${cmp.code} - ${cmp.description}` : cmp.description}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Cognitive Level Filter */}
          <div>
            <select
              value={filterCognitive}
              onChange={(e) => setFilterCognitive(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Semua Level Kognitif</option>
              <option value="LOTS">LOTS (Mengingat/Memahami)</option>
              <option value="MOTS">MOTS (Menerapkan/Analisis)</option>
              <option value="HOTS">HOTS (Evaluasi/Kreasi)</option>
            </select>
          </div>

          {/* 7. Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Memuat bank soal...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
            Tidak ada soal yang memenuhi kriteria filter saat ini.
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const subject = taxonomy.subjects.find((s) => s.id === q.subjectId);
            const chapter = taxonomy.chapters.find((c) => c.id === q.chapterId);
            const subchapter = taxonomy.subchapters.find((sc) => sc.id === q.subchapterId);
            const subSubChapter = taxonomy.competencies.find((cmp) => cmp.id === q.competencyId);

            return (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  {/* Clean unboxed metadata with separators */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {q.code && (
                      <>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {q.code}
                        </span>
                        <span>·</span>
                      </>
                    )}
                    <span className="font-semibold text-indigo-600">{subject?.name || 'Mata Pelajaran'}</span>
                    <span>·</span>
                    <span>{chapter?.name || 'Bab'}</span>
                    {subchapter && (
                      <>
                        <span>·</span>
                        <span>{subchapter.name}</span>
                      </>
                    )}
                    {subSubChapter && (
                      <>
                        <span>·</span>
                        <span>{subSubChapter.code ? `${subSubChapter.code} - ${subSubChapter.description}` : subSubChapter.description}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="font-mono font-bold text-slate-700">Level: {q.cognitiveLevel}</span>
                    <span>·</span>
                    <span className="uppercase text-[11px] font-semibold text-slate-600">
                      Tipe: {q.type === 'pg' ? 'Pilihan Ganda' : q.type === 'pg_kompleks' ? 'PG Kompleks' : q.type === 'benar_salah' ? 'Benar-Salah' : 'Esai'}
                    </span>
                    <span>·</span>
                    <span className={`font-semibold ${q.status === 'active' ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {q.status === 'active' ? 'Status: Aktif' : 'Status: Nonaktif'}
                    </span>
                  </div>

                  {/* Question Text */}
                  <div className="text-sm font-medium text-slate-900 leading-relaxed flex items-start gap-2">
                    <span className="font-bold shrink-0">{idx + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <RichContent html={q.questionText} />
                    </div>
                  </div>

                  {/* Options List Preview */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 text-xs">
                      {q.options.map((opt) => {
                        const isCorrect = Array.isArray(q.correctAnswer)
                          ? q.correctAnswer.includes(opt.id)
                          : q.correctAnswer === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2 rounded-lg border flex items-start gap-2 ${
                              isCorrect
                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-medium'
                                : 'bg-slate-50/70 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-white border border-slate-200 shrink-0 mt-0.5">
                              {opt.id}
                            </span>
                            <div className="min-w-0 flex-1 break-words">
                              <RichContent html={opt.text} inline />
                            </div>
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 ml-auto shrink-0 mt-0.5">
                                Kunci
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rubric for essay */}
                  {q.type === 'esai' && q.rubric && (
                    <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200">
                      <strong>Rubrik Penilaian:</strong> {q.rubric}
                    </div>
                  )}
                </div>

                {/* Question Actions */}
                <div className="flex md:flex-col items-center gap-1.5 shrink-0 self-end md:self-auto">
                  <button
                    onClick={() => handleOpenEdit(q)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Soal"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus Soal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Question Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingQuestion ? 'Edit Butir Soal' : 'Tambah Butir Soal Baru'}
              </h3>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 mt-4">
              {/* Row 0: Kode Unik Soal */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Unik Soal (Otomatis mulai dari nilai terkecil per Mapel)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => {
                        setCodeManuallyEdited(true);
                        setFormData({ ...formData, code: e.target.value.toUpperCase() });
                      }}
                      placeholder="Contoh: FIS-10-0001"
                      className="flex-1 p-2 text-xs font-mono font-bold text-indigo-700 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCodeManuallyEdited(false);
                        setFormData((prev) => ({
                          ...prev,
                          code: generateNextQuestionCode(
                            prev.subjectId,
                            questions,
                            taxonomy.subjects,
                            editingQuestion?.id
                          ),
                        }));
                      }}
                      className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shrink-0"
                      title="Generate kode terkecil yang tersedia"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Otomatis</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 1: Mata Pelajaran, Bab, Sub Bab */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => {
                      const newSubj = e.target.value;
                      const chs = taxonomy.chapters.filter((c) => c.subjectId === newSubj);
                      const newCh = chs[0]?.id || '';
                      const scs = newCh ? taxonomy.subchapters.filter((sc) => sc.chapterId === newCh) : [];
                      const newSc = scs[0]?.id || '';
                      const cmps = newSc ? taxonomy.competencies.filter((cmp) => cmp.subchapterId === newSc) : [];

                      let nextCode = formData.code;
                      if (!codeManuallyEdited) {
                        if (editingQuestion && editingQuestion.subjectId === newSubj && editingQuestion.code) {
                          nextCode = editingQuestion.code;
                        } else {
                          nextCode = generateNextQuestionCode(
                            newSubj,
                            questions,
                            taxonomy.subjects,
                            editingQuestion?.id
                          );
                        }
                      }

                      setFormData({
                        ...formData,
                        code: nextCode,
                        subjectId: newSubj,
                        chapterId: newCh,
                        subchapterId: newSc,
                        competencyId: cmps[0]?.id || '',
                      });
                    }}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                    required
                  >
                    {taxonomy.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chapter (Bab) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bab
                  </label>
                  <select
                    value={formData.chapterId}
                    onChange={(e) => {
                      const newCh = e.target.value;
                      const scs = taxonomy.subchapters.filter((sc) => sc.chapterId === newCh);
                      const newSc = scs[0]?.id || '';
                      const cmps = newSc ? taxonomy.competencies.filter((cmp) => cmp.subchapterId === newSc) : [];
                      setFormData({
                        ...formData,
                        chapterId: newCh,
                        subchapterId: newSc,
                        competencyId: cmps[0]?.id || '',
                      });
                    }}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Bab --</option>
                    {formAvailableChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subchapter (Sub Bab) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub Bab
                  </label>
                  <select
                    value={formData.subchapterId}
                    onChange={(e) => {
                      const newSc = e.target.value;
                      const cmps = taxonomy.competencies.filter((cmp) => cmp.subchapterId === newSc);
                      setFormData({
                        ...formData,
                        subchapterId: newSc,
                        competencyId: cmps[0]?.id || '',
                      });
                    }}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Sub Bab --</option>
                    {formAvailableSubchapters.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Sub-Sub Bab, Level Kognitif, Tipe Soal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Sub-Sub Bab */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub-Sub Bab
                  </label>
                  <select
                    value={formData.competencyId}
                    onChange={(e) => setFormData({ ...formData, competencyId: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Sub-Sub Bab --</option>
                    {formAvailableCompetencies.map((cmp) => (
                      <option key={cmp.id} value={cmp.id}>
                        {cmp.code ? `${cmp.code} - ${cmp.description}` : cmp.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cognitive Level */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Level Kognitif (Bloom)
                  </label>
                  <select
                    value={formData.cognitiveLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, cognitiveLevel: e.target.value as CognitiveLevel })
                    }
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="LOTS">LOTS (Mengingat / Memahami)</option>
                    <option value="MOTS">MOTS (Menerapkan / Menganalisis)</option>
                    <option value="HOTS">HOTS (Mengevaluasi / Kreasi)</option>
                  </select>
                </div>

                {/* Question Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipe Soal
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      setFormData((prev) => {
                        let nextOptions = prev.options;
                        if ((nextType === 'pg' || nextType === 'pg_kompleks') && prev.options.length < 3) {
                          nextOptions = createDefaultOptions();
                        }
                        const validIds = new Set(nextOptions.map((o) => o.id));
                        let nextCorrect = prev.correctAnswer;
                        if (nextType === 'pg') {
                          const candidate = Array.isArray(prev.correctAnswer)
                            ? prev.correctAnswer[0]
                            : prev.correctAnswer;
                          nextCorrect = candidate && validIds.has(candidate) ? candidate : nextOptions[0]?.id || 'A';
                        } else if (nextType === 'pg_kompleks') {
                          const arr = Array.isArray(prev.correctAnswer)
                            ? prev.correctAnswer.filter((id) => validIds.has(id))
                            : typeof prev.correctAnswer === 'string' && validIds.has(prev.correctAnswer)
                            ? [prev.correctAnswer]
                            : [];
                          nextCorrect = arr;
                        } else if (nextType === 'benar_salah') {
                          nextCorrect = prev.correctAnswer === 'false' ? 'false' : 'true';
                        }
                        return {
                          ...prev,
                          type: nextType,
                          options: nextOptions,
                          correctAnswer: nextCorrect,
                        };
                      });
                    }}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="pg">Pilihan Ganda (Single Choice)</option>
                    <option value="pg_kompleks">Pilihan Ganda Kompleks (Multi)</option>
                    <option value="benar_salah">Benar-Salah</option>
                    <option value="esai">Esai / Uraian</option>
                  </select>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Konten / Teks Pertanyaan (Bisa langsung Copy-Paste Equation & Gambar dari MS Word)
                </label>
                <RichQuestionEditor
                  value={formData.questionText}
                  onChange={(val) => setFormData((prev) => ({ ...prev, questionText: val }))}
                  placeholder="Ketikkan teks soal atau langsung Copy-Paste teks, Equation MS Word, maupun Gambar ke sini..."
                />
              </div>

              {/* Options Builder for PG & PG Kompleks */}
              {(formData.type === 'pg' || formData.type === 'pg_kompleks') && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block">
                        Opsi Jawaban & Kunci Jawaban (Mendukung Equation MS Word & Gambar)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Tandai huruf di kiri sebagai kunci jawaban · Standar 5 opsi (minimal 3 opsi)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                        {formData.options.length} Opsi
                      </span>
                      <button
                        type="button"
                        onClick={handleAddOption}
                        disabled={formData.options.length >= 26}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Opsi</span>
                      </button>
                    </div>
                  </div>

                  {formData.options.map((opt, i) => {
                    const isSelected =
                      formData.type === 'pg'
                        ? formData.correctAnswer === opt.id
                        : Array.isArray(formData.correctAnswer) && formData.correctAnswer.includes(opt.id);
                    const canRemove = formData.options.length > 3;

                    return (
                      <div key={opt.id} className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.type === 'pg') {
                              setFormData((prev) => ({ ...prev, correctAnswer: opt.id }));
                            } else {
                              setFormData((prev) => {
                                const curr = Array.isArray(prev.correctAnswer) ? [...prev.correctAnswer] : [];
                                return {
                                  ...prev,
                                  correctAnswer: curr.includes(opt.id)
                                    ? curr.filter((x) => x !== opt.id)
                                    : [...curr, opt.id],
                                };
                              });
                            }
                          }}
                          title="Klik untuk menandai sebagai kunci jawaban"
                          className={`w-8 h-8 mt-0.5 rounded-lg font-bold text-xs flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {opt.id}
                        </button>
                        <div className="flex-1 min-w-0">
                          <RichQuestionEditor
                            variant="compact"
                            value={opt.text}
                            onChange={(val) =>
                              setFormData((prev) => ({
                                ...prev,
                                options: prev.options.map((o, idx2) =>
                                  idx2 === i ? { ...o, text: val } : o
                                ),
                              }))
                            }
                            placeholder={`Ketik atau paste teks / Equation / Gambar pilihan ${opt.id}...`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          disabled={!canRemove}
                          title={
                            canRemove
                              ? `Hapus opsi ${opt.id}`
                              : 'Minimal harus tersedia 3 opsi jawaban'
                          }
                          className={`w-8 h-8 mt-0.5 rounded-lg flex items-center justify-center transition-colors shrink-0 border ${
                            canRemove
                              ? 'text-rose-600 border-rose-200 bg-rose-50/60 hover:bg-rose-100'
                              : 'text-slate-300 border-slate-200 bg-slate-50 cursor-not-allowed'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* True/False selection */}
              {formData.type === 'benar_salah' && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kunci Jawaban Pernyataan
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, correctAnswer: 'true' })}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        formData.correctAnswer === 'true'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      BENAR
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, correctAnswer: 'false' })}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        formData.correctAnswer === 'false'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      SALAH
                    </button>
                  </div>
                </div>
              )}

              {/* Essay Rubric */}
              {formData.type === 'esai' && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rubrik / Kriteria Penilaian Guru
                  </label>
                  <textarea
                    value={formData.rubric}
                    onChange={(e) => setFormData({ ...formData, rubric: e.target.value })}
                    rows={2}
                    placeholder="Pedoman skor: 1. Penjelasan konsep (40%), 2. Rumus dan perhitungan (30%), 3. Kesimpulan (30%)..."
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {/* Status */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Soal
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })
                  }
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="active">Aktif (Bisa Diambil Generator Ujian)</option>
                  <option value="inactive">Nonaktif (Diarsipkan)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
                >
                  Simpan Butir Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
