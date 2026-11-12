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
  FileSpreadsheet,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  HelpCircle,
  FileText,
  Layers,
  Sparkles,
  Download,
  Upload,
  X,
} from 'lucide-react';

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
  const [filterCognitive, setFilterCognitive] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');

  // Form states
  const [formData, setFormData] = useState<{
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

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setFormData({
      subjectId: taxonomy.subjects[0]?.id || '',
      chapterId: taxonomy.chapters[0]?.id || '',
      subchapterId: taxonomy.subchapters[0]?.id || '',
      competencyId: taxonomy.competencies[0]?.id || '',
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
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setFormData({
      subjectId: q.subjectId,
      chapterId: q.chapterId,
      subchapterId: q.subchapterId,
      competencyId: q.competencyId,
      cognitiveLevel: q.cognitiveLevel,
      type: q.type,
      questionText: q.questionText,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      rubric: q.rubric || '',
      points: q.points || 10,
      status: q.status,
    });
    setShowAddEditModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleImportSample = () => {
    const sample = `subjectId,chapterId,cognitiveLevel,type,questionText,correctAnswer,points
sbj-fisika,ch-termo,LOTS,pg,"Satuan Standar Internasional (SI) dari kalor adalah ...",Joule,10
sbj-fisika,ch-termo,MOTS,pg,"Gas memuai pada tekanan konstan 1 atm dari 1 L ke 3 L. Usaha yang dilakukan gas adalah ...",202.6 Joule,10
sbj-fisika,ch-termo,HOTS,pg_kompleks,"Pernyataan yang tepat mengenai efisiensi mesin Carnot ...","A,B",15`;
    setCsvContent(sample);
  };

  const handleExecuteImport = async () => {
    if (!csvContent.trim()) return;
    try {
      const lines = csvContent.trim().split('\n');
      const parsedQuestions: Partial<Question>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length >= 5) {
          parsedQuestions.push({
            subjectId: parts[0]?.trim() || taxonomy.subjects[0]?.id,
            chapterId: parts[1]?.trim() || '',
            cognitiveLevel: (parts[2]?.trim() as CognitiveLevel) || 'MOTS',
            type: (parts[3]?.trim() as QuestionType) || 'pg',
            questionText: parts[4]?.replace(/^"|"$/g, '').trim(),
            options: [
              { id: 'A', text: 'Pilihan Jawaban A' },
              { id: 'B', text: 'Pilihan Jawaban B' },
              { id: 'C', text: 'Pilihan Jawaban C' },
              { id: 'D', text: 'Pilihan Jawaban D' },
            ],
            correctAnswer: parts[5]?.replace(/^"|"$/g, '').trim() || 'A',
            points: Number(parts[6]) || 10,
            status: 'active',
          });
        }
      }

      await api.bulkImportQuestions(parsedQuestions);
      setShowImportModal(false);
      setCsvContent('');
      loadAll();
      alert(`Berhasil mengimpor ${parsedQuestions.length} butir soal ke bank soal.`);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses impor CSV.');
    }
  };

  // Filter logic
  const filteredQuestions = questions.filter((q) => {
    if (filterSubject && q.subjectId !== filterSubject) return false;
    if (filterChapter && q.chapterId !== filterChapter) return false;
    if (filterCognitive && q.cognitiveLevel !== filterCognitive) return false;
    if (filterType && q.type !== filterType) return false;
    if (filterStatus && q.status !== filterStatus) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      if (!q.questionText.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Bank Soal & Taksonomi Kompetensi
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Kurikulum Merdeka SMA</span>
            <span>·</span>
            <span>Klasifikasi LOTS/MOTS/HOTS</span>
            <span>·</span>
            <span className="font-semibold text-slate-700">{questions.length} Butir Soal Terdaftar</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor Massal (Excel/CSV)</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Butir Soal</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search query */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari teks soal, rumus, atau konsep..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
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

          {/* Cognitive Level Filter */}
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

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif (Bisa Dipakai Ujian)</option>
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

            return (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  {/* Clean unboxed metadata with separators (Strict Zero-Pill) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-indigo-600">{subject?.name || 'Mata Pelajaran'}</span>
                    <span>·</span>
                    <span>{chapter?.name || 'Bab'}</span>
                    {subchapter && (
                      <>
                        <span>·</span>
                        <span>{subchapter.name}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="font-mono font-bold text-slate-700">Level: {q.cognitiveLevel}</span>
                    <span>·</span>
                    <span className="uppercase text-[11px] font-semibold text-slate-600">
                      Tipe: {q.type === 'pg' ? 'Pilihan Ganda' : q.type === 'pg_kompleks' ? 'PG Kompleks' : q.type === 'benar_salah' ? 'Benar-Salah' : 'Esai'}
                    </span>
                    <span>·</span>
                    <span className="font-mono">{q.points} Poin</span>
                    <span>·</span>
                    <span className={`font-semibold ${q.status === 'active' ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {q.status === 'active' ? 'Status: Aktif' : 'Status: Nonaktif'}
                    </span>
                  </div>

                  {/* Question Text */}
                  <div className="text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {idx + 1}. {q.questionText}
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
                            className={`p-2 rounded-lg border flex items-center gap-2 ${
                              isCorrect
                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-medium'
                                : 'bg-slate-50/70 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-white border border-slate-200 shrink-0">
                              {opt.id}
                            </span>
                            <span className="truncate">{opt.text}</span>
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 ml-auto shrink-0">
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
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
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as QuestionType })
                    }
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
                  Konten / Teks Pertanyaan (Mendukung Formula & Format Teks)
                </label>
                <textarea
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  rows={4}
                  placeholder="Ketikkan teks soal di sini... Contoh: Sebuah mesin Carnot beroperasi pada suhu T1 = 500 K dan T2 = 300 K..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Options Builder for PG & PG Kompleks */}
              {(formData.type === 'pg' || formData.type === 'pg_kompleks') && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Opsi Jawaban & Kunci Jawaban
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Tandai pilihan yang merupakan kunci jawaban
                    </span>
                  </div>

                  {formData.options.map((opt, i) => {
                    const isSelected =
                      formData.type === 'pg'
                        ? formData.correctAnswer === opt.id
                        : Array.isArray(formData.correctAnswer) && formData.correctAnswer.includes(opt.id);

                    return (
                      <div key={opt.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.type === 'pg') {
                              setFormData({ ...formData, correctAnswer: opt.id });
                            } else {
                              const curr = Array.isArray(formData.correctAnswer) ? [...formData.correctAnswer] : [];
                              if (curr.includes(opt.id)) {
                                setFormData({
                                  ...formData,
                                  correctAnswer: curr.filter((x) => x !== opt.id),
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  correctAnswer: [...curr, opt.id],
                                });
                              }
                            }
                          }}
                          className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {opt.id}
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const newOpts = [...formData.options];
                            newOpts[i].text = e.target.value;
                            setFormData({ ...formData, options: newOpts });
                          }}
                          placeholder={`Teks pilihan ${opt.id}...`}
                          className="flex-1 p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          required
                        />
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

              {/* Points & Status */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bobot Nilai / Poin
                  </label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg font-mono"
                    min={1}
                    max={100}
                    required
                  />
                </div>

                <div>
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

      {/* Bulk CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Impor Soal Massal (CSV/Excel)</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Tempelkan data format CSV di bawah atau unduh contoh:</span>
                <button
                  onClick={handleImportSample}
                  className="text-indigo-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Muat Contoh Format</span>
                </button>
              </div>

              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                rows={8}
                placeholder="subjectId,chapterId,cognitiveLevel,type,questionText,correctAnswer,points..."
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 leading-relaxed">
                <strong>Catatan Generator:</strong> Soal yang berhasil diimpor otomatis berstatus <em>Aktif</em> dan langsung siap diacak dalam generator ujian per siswa.
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={!csvContent.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                Proses Impor Soal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
