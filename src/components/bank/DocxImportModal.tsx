import React, { useState } from 'react';
import mammoth from 'mammoth';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  HelpCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { Question, Subject, Chapter, Subchapter, Competency, CognitiveLevel, QuestionType } from '../../types/cbt';
import { api } from '../../lib/api';

interface DocxImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  chapters: Chapter[];
  subchapters: Subchapter[];
  competencies: Competency[];
  defaultSubjectId?: string;
  defaultChapterId?: string;
  onSuccess: () => void;
}

export const DocxImportModal: React.FC<DocxImportModalProps> = ({
  isOpen,
  onClose,
  subjects,
  chapters,
  subchapters,
  competencies,
  defaultSubjectId,
  defaultChapterId,
  onSuccess,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState(defaultSubjectId || subjects[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState(
    defaultChapterId || (chapters.filter((c) => c.subjectId === (defaultSubjectId || subjects[0]?.id))[0]?.id || '')
  );

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<Partial<Question>[]>([]);
  const [rawText, setRawText] = useState('');
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const availableChapters = selectedSubjectId
    ? chapters.filter((c) => c.subjectId === selectedSubjectId)
    : chapters;

  // Generate and download standard Word .docx template
  const handleDownloadDocxTemplate = () => {
    const templateHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Template Import Soal CBT</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
          h1 { color: #4338ca; font-size: 16pt; border-bottom: 2px solid #4338ca; padding-bottom: 4px; }
          .instructions { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; margin-bottom: 15px; font-size: 10pt; }
          .question-block { margin-bottom: 20px; border-left: 3px solid #6366f1; padding-left: 10px; }
          .meta { color: #64748b; font-size: 9.5pt; font-weight: bold; }
          .option { margin-left: 15px; }
        </style>
      </head>
      <body>
        <h1>TEMPLATE IMPORT SOAL CBT SMA PRO</h1>
        <div class="instructions">
          <strong>PETUNJUK PENGISIAN SOAL:</strong><br>
          1. Tulislah soal secara berurutan dengan format <strong>[SOAL 1]</strong>, <strong>[SOAL 2]</strong> dst.<br>
          2. Untuk pilihan ganda, tuliskan opsi dengan huruf kapital <strong>A.</strong>, <strong>B.</strong>, <strong>C.</strong>, <strong>D.</strong>, <strong>E.</strong><br>
          3. Tuliskan kunci jawaban pada baris tersendiri dengan format <strong>Kunci: A</strong>.<br>
          4. (Opsional) Tuliskan level kognitif dengan format <strong>Level: LOTS</strong> / <strong>MOTS</strong> / <strong>HOTS</strong>.<br>
          5. (Opsional) Tuliskan tipe soal dengan format <strong>Tipe: PG</strong> / <strong>Esai</strong> / <strong>Benar-Salah</strong>.
        </div>

        <div class="question-block">
          <p><strong>[SOAL 1]</strong></p>
          <p>Pada proses termodinamika di mana volume sistem gas dijaga konstan (isokhorik), berapakah besar usaha (W) yang dilakukan oleh gas ideal?</p>
          <p class="option">A. W = P . ΔV</p>
          <p class="option">B. W = 0</p>
          <p class="option">C. W = n . R . T . ln(V2/V1)</p>
          <p class="option">D. W = Q - ΔU</p>
          <p class="option">E. W = Tak hingga</p>
          <p class="meta">Kunci: B</p>
          <p class="meta">Level: LOTS</p>
          <p class="meta">Tipe: PG</p>
        </div>

        <div class="question-block">
          <p><strong>[SOAL 2]</strong></p>
          <p>Suatu gas ideal berada dalam ruang tertutup bertekanan tetap 2 × 10⁵ Pa. Jika gas dipanaskan sehingga memuai dari volume 1,5 m³ menjadi 2,5 m³, berapa besar usaha yang dilakukan gas?</p>
          <p class="option">A. 1,0 × 10⁵ Joule</p>
          <p class="option">B. 2,0 × 10⁵ Joule</p>
          <p class="option">C. 3,0 × 10⁵ Joule</p>
          <p class="option">D. 4,0 × 10⁵ Joule</p>
          <p class="option">E. 5,0 × 10⁵ Joule</p>
          <p class="meta">Kunci: B</p>
          <p class="meta">Level: MOTS</p>
          <p class="meta">Tipe: PG</p>
        </div>

        <div class="question-block">
          <p><strong>[SOAL 3]</strong></p>
          <p>Jelaskan secara singkat minimal 2 strategi termodinamika realistis untuk meningkatkan efisiensi mesin Carnot!</p>
          <p class="meta">Kunci: Kenaikan suhu reservoir tinggi T1 dan penurunan suhu reservoir rendah T2.</p>
          <p class="meta">Level: HOTS</p>
          <p class="meta">Tipe: Esai</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + templateHTML], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_Import_Soal_CBT.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse DOCX file content into structured Questions
  const parseDocxContent = async (fileObj: File) => {
    setParsing(true);
    setErrorMsg('');
    setParsedQuestions([]);
    try {
      const arrayBuffer = await fileObj.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || '';
      setRawText(text);

      if (!text.trim()) {
        throw new Error('Dokumen Word kosong atau tidak dapat dibaca teksnya.');
      }

      const questionsList = parseTextToQuestions(text);
      if (questionsList.length === 0) {
        throw new Error(
          'Tidak dapat memformat soal dari dokumen ini. Pastikan penulisan nomor soal (seperti [SOAL 1] atau 1.), opsi (A, B, C), dan Kunci: A tertera.'
        );
      }

      setParsedQuestions(questionsList);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membaca dokumen Word (.docx).');
    } finally {
      setParsing(false);
    }
  };

  // Helper parser for raw text extracted from DOCX
  const parseTextToQuestions = (fullText: string): Partial<Question>[] => {
    // Normalize newlines
    const lines = fullText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const questions: Partial<Question>[] = [];
    let currentBlock: string[] = [];

    const isHeaderLine = (line: string) => {
      const lower = line.toLowerCase();
      return (
        /^\[soal\s*\d+\]/i.test(line) ||
        /^soal\s*\d+[\s:]/i.test(line) ||
        /^\d+[\.\)]\s+/.test(line) ||
        lower.startsWith('soal nomor')
      );
    };

    lines.forEach((line) => {
      if (isHeaderLine(line) && currentBlock.length > 0) {
        const q = buildQuestionFromBlock(currentBlock);
        if (q) questions.push(q);
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    });

    if (currentBlock.length > 0) {
      const q = buildQuestionFromBlock(currentBlock);
      if (q) questions.push(q);
    }

    return questions;
  };

  const buildQuestionFromBlock = (blockLines: string[]): Partial<Question> | null => {
    if (blockLines.length === 0) return null;

    let questionText = '';
    const options: { id: string; text: string }[] = [];
    let correctAnswer: any = 'A';
    let cognitiveLevel: CognitiveLevel = 'MOTS';
    let type: QuestionType = 'pg';
    let rubric = '';

    // First line header cleanup (e.g. "[SOAL 1] Apa itu..." or "1. Apa itu...")
    let firstLine = blockLines[0];
    firstLine = firstLine.replace(/^\[soal\s*\d+\]\s*/i, '');
    firstLine = firstLine.replace(/^soal\s*\d+[\s:]\s*/i, '');
    firstLine = firstLine.replace(/^\d+[\.\)]\s*/, '');

    const textBuffer: string[] = [firstLine];

    for (let i = 1; i < blockLines.length; i++) {
      const line = blockLines[i];
      const lower = line.toLowerCase();

      // Check key (Kunci: A)
      if (lower.startsWith('kunci:') || lower.startsWith('kunci jawaban:') || lower.startsWith('jawaban:')) {
        const val = line.split(':')[1]?.trim() || 'A';
        correctAnswer = val.toUpperCase().charAt(0);
        if (type === 'esai') correctAnswer = val;
        continue;
      }

      // Check Cognitive Level
      if (lower.startsWith('level:') || lower.startsWith('tingkat:')) {
        const val = line.split(':')[1]?.trim().toUpperCase();
        if (val?.includes('LOTS')) cognitiveLevel = 'LOTS';
        else if (val?.includes('HOTS')) cognitiveLevel = 'HOTS';
        else cognitiveLevel = 'MOTS';
        continue;
      }

      // Check Question Type
      if (lower.startsWith('tipe:') || lower.startsWith('jenis:')) {
        const val = line.split(':')[1]?.trim().toLowerCase();
        if (val?.includes('esai') || val?.includes('essay')) type = 'esai';
        else if (val?.includes('kompleks')) type = 'pg_kompleks';
        else if (val?.includes('benar')) type = 'benar_salah';
        else type = 'pg';
        continue;
      }

      // Check Option (A. / B. / C. / D. / E. / A) / B))
      const optionMatch = line.match(/^([A-E])[\.\)]\s*(.+)/i);
      if (optionMatch) {
        const key = optionMatch[1].toUpperCase();
        const optText = optionMatch[2].trim();
        options.push({ id: key, text: optText });
        continue;
      }

      // Default line buffer for question body
      if (options.length === 0) {
        textBuffer.push(line);
      } else {
        // If after options, treated as rubric or description
        rubric += line + ' ';
      }
    }

    questionText = textBuffer.join(' ').trim();
    if (!questionText) return null;

    // If no options found but type was default pg, adjust to essay if needed
    if (options.length === 0 && type === 'pg') {
      type = 'esai';
    }

    // Ensure 5 options for PG if fewer parsed
    if (type === 'pg' && options.length > 0 && options.length < 5) {
      const keys = ['A', 'B', 'C', 'D', 'E'];
      for (const k of keys) {
        if (!options.some((o) => o.id === k)) {
          options.push({ id: k, text: '-' });
        }
      }
      options.sort((a, b) => a.id.localeCompare(b.id));
    }

    return {
      questionText,
      options: options.length > 0 ? options : undefined,
      correctAnswer,
      cognitiveLevel,
      type,
      rubric: rubric.trim() || undefined,
      points: type === 'esai' ? 20 : 10,
      status: 'active',
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (
      !selectedFile.name.endsWith('.docx') &&
      !selectedFile.type.includes('wordprocessingml') &&
      !selectedFile.type.includes('msword')
    ) {
      setErrorMsg('Format file harus berupa dokumen Word (.docx).');
      return;
    }

    setFile(selectedFile);
    parseDocxContent(selectedFile);
  };

  const handleConfirmImport = async () => {
    if (parsedQuestions.length === 0) return;
    if (!selectedSubjectId) {
      alert('Pilih Mata Pelajaran tujuan sebelum mengimpor.');
      return;
    }

    setImporting(true);
    try {
      const subChs = selectedChapterId
        ? subchapters.filter((sc) => sc.chapterId === selectedChapterId)
        : subchapters;
      const defaultSubchapterId = subChs[0]?.id || '';
      const cmps = defaultSubchapterId
        ? competencies.filter((cmp) => cmp.subchapterId === defaultSubchapterId)
        : competencies;
      const defaultCompetencyId = cmps[0]?.id || '';

      const payload = parsedQuestions.map((q) => ({
        ...q,
        subjectId: selectedSubjectId,
        chapterId: selectedChapterId || (availableChapters[0]?.id || ''),
        subchapterId: defaultSubchapterId,
        competencyId: defaultCompetencyId,
        status: 'active' as const,
        author: 'Impor Docx Guru',
      }));

      const res = await api.bulkImportQuestions(payload);
      alert(res.message || `Berhasil mengimpor ${payload.length} soal dari dokumen DOCX.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Gagal mengimpor soal: ' + (err.message || 'Terjadi kesalahan.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Impor Soal via Template Word (.docx)</h3>
              <p className="text-xs text-slate-500">Unggah berkas Microsoft Word untuk mengekstrak butir soal secara otomatis.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* Target Placement Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  const relatedCh = chapters.filter((c) => c.subjectId === e.target.value);
                  setSelectedChapterId(relatedCh[0]?.id || '');
                }}
                className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Bab
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="">-- Pilih Bab --</option>
                {availableChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Download Template Bar */}
          <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-indigo-900">Unduh Format Template Word (.docx)</div>
                <div className="text-[11px] text-indigo-700">Format standar penulisan soal untuk diimpor otomatis tanpa kendala.</div>
              </div>
            </div>
            <button
              onClick={handleDownloadDocxTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template DOCX</span>
            </button>
          </div>

          {/* File Drag & Drop Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Pilih Berkas Dokumen Word (.docx)
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 rounded-2xl p-6 text-center transition-all cursor-pointer">
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
                id="docx-file-input"
              />
              <label htmlFor="docx-file-input" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 text-indigo-500 mb-2" />
                <span className="text-xs font-bold text-slate-800">
                  {file ? file.name : 'Klik untuk memilih berkas Word (.docx)'}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  Mendukung berkas Microsoft Word (.docx) dengan format standar CBT
                </span>
              </label>
            </div>
          </div>

          {parsing && (
            <div className="p-4 rounded-xl bg-slate-100 text-slate-700 text-xs flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Mengekstrak dan menganalisis butir soal dari dokumen Word...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Parsed Questions */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Berhasil Mengekstrak {parsedQuestions.length} Butir Soal</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Status: Siap diimpor</span>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {parsedQuestions.map((q, idx) => (
                  <div key={idx} className="p-3 bg-white text-xs hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-indigo-600 shrink-0">Soal #{idx + 1}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-[10px] text-slate-700 uppercase">
                          {q.type}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-50 font-bold text-[10px] text-amber-700">
                          {q.cognitiveLevel}
                        </span>
                      </div>
                    </div>
                    <p className="font-medium text-slate-900 mt-1 line-clamp-2">{q.questionText}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`truncate px-2 py-0.5 rounded ${
                              opt.id === q.correctAnswer ? 'bg-emerald-100 text-emerald-800 font-bold' : ''
                            }`}
                          >
                            <strong>{opt.id}.</strong> {opt.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.correctAnswer && (
                      <div className="mt-1 text-[11px] text-indigo-700 font-semibold">
                        Kunci Jawaban: {q.correctAnswer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={parsedQuestions.length === 0 || importing}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <span>{importing ? 'Mengimpor...' : `Simpan ${parsedQuestions.length} Soal ke Bank Soal`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
