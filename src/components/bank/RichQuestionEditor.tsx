import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Subscript,
  Superscript,
  ImagePlus,
  Sigma,
} from 'lucide-react';
import {
  compressImageToDataUrl,
  isRichHtml,
  escapeHtmlText,
  processClipboardPaste,
  sanitizeRichHtml,
} from '../../lib/richContent';

interface RichQuestionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'full' | 'compact';
  minHeightClass?: string;
}

const MATH_TEMPLATES = [
  {
    label: 'Pecahan (a/b)',
    preview: 'a/b',
    html: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>&nbsp;',
  },
  {
    label: 'Akar (√x)',
    preview: '√x',
    html: '<math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mi>x</mi></msqrt></math>&nbsp;',
  },
  {
    label: 'Pangkat (xⁿ)',
    preview: 'xⁿ',
    html: '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mi>n</mi></msup></math>&nbsp;',
  },
  {
    label: 'Indeks (x₁)',
    preview: 'x₁',
    html: '<math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>x</mi><mn>1</mn></msub></math>&nbsp;',
  },
  {
    label: 'Integral (∫)',
    preview: '∫ f(x) dx',
    html: '<math xmlns="http://www.w3.org/1998/Math/MathML"><msubsup><mo>∫</mo><mi>a</mi><mi>b</mi></msubsup><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mspace width="0.2em"/><mi>d</mi><mi>x</mi></math>&nbsp;',
  },
  {
    label: 'Sigma (∑)',
    preview: '∑',
    html: '<math xmlns="http://www.w3.org/1998/Math/MathML"><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>x</mi><mi>i</mi></msub></math>&nbsp;',
  },
  {
    label: 'Vektor (v⃗)',
    preview: 'v⃗',
    html: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mover accent="true"><mi>v</mi><mo>→</mo></mover></math>&nbsp;',
  },
];

const QUICK_SYMBOLS = [
  '±',
  '×',
  '÷',
  '·',
  '≤',
  '≥',
  '≠',
  '≈',
  '∞',
  '→',
  '⇌',
  '°',
  'α',
  'β',
  'γ',
  'Δ',
  'θ',
  'λ',
  'μ',
  'π',
  'ρ',
  'σ',
  'ω',
  'Ω',
];

function toEditableHtml(val: string): string {
  if (!val) return '';
  if (isRichHtml(val)) return sanitizeRichHtml(val);
  return escapeHtmlText(val).replace(/\r?\n/g, '<br>');
}

export const RichQuestionEditor: React.FC<RichQuestionEditorProps> = ({
  value,
  onChange,
  placeholder = 'Ketikkan atau tempel langsung dari MS Word...',
  variant = 'full',
  minHeightClass,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedRef = useRef<string>(value);
  const savedRangeRef = useRef<Range | null>(null);

  const [isEmpty, setIsEmpty] = useState(!value);
  const [showSymbolMenu, setShowSymbolMenu] = useState(false);
  const [pastingImage, setPastingImage] = useState(false);

  // Sync external value changes (e.g. opening Add/Edit modal) without disturbing active typing cursor
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastEmittedRef.current) {
      el.innerHTML = toEditableHtml(value);
      lastEmittedRef.current = value;
    }
    setIsEmpty(!value || value === '<br>');
  }, [value]);

  // Initial mount populate
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML === '' && value) {
      el.innerHTML = toEditableHtml(value);
      lastEmittedRef.current = value;
      setIsEmpty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const raw = el.innerHTML;
    const cleaned = raw === '<br>' || raw === '<div><br></div>' ? '' : raw;
    lastEmittedRef.current = cleaned;
    setIsEmpty(!cleaned);
    onChange(cleaned);
  };

  const insertHtmlAtCursor = (htmlToInsert: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    let range: Range | null = savedRangeRef.current;
    if (!range && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    }

    if (range && el.contains(range.startContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    const ok = document.execCommand('insertHTML', false, htmlToInsert);
    if (!ok && sel) {
      const targetRange = range || document.createRange();
      if (!range) {
        targetRange.selectNodeContents(el);
        targetRange.collapse(false);
      }
      targetRange.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = htmlToInsert;
      const frag = document.createDocumentFragment();
      let lastNode: Node | null = null;
      while (temp.firstChild) {
        lastNode = temp.firstChild;
        frag.appendChild(lastNode);
      }
      targetRange.insertNode(frag);
      if (lastNode) {
        targetRange.setStartAfter(lastNode);
        targetRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(targetRange);
      }
    }

    saveSelection();
    emitChange();
  };

  const handleExecFormat = (command: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false);
    emitChange();
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!e.clipboardData) return;
    e.preventDefault();
    saveSelection();

    setPastingImage(true);
    try {
      const { html } = await processClipboardPaste(e.clipboardData);
      if (html) {
        insertHtmlAtCursor(html);
      }
    } catch (err) {
      console.error('Paste processing error:', err);
    } finally {
      setPastingImage(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) return;

    e.preventDefault();
    setPastingImage(true);
    try {
      for (const file of files) {
        const dataUrl = await compressImageToDataUrl(file);
        insertHtmlAtCursor(`<img src="${dataUrl}" alt="Gambar soal" />`);
      }
    } finally {
      setPastingImage(false);
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPastingImage(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await compressImageToDataUrl(file);
        insertHtmlAtCursor(`<img src="${dataUrl}" alt="Gambar soal" />`);
      }
    } finally {
      setPastingImage(false);
      e.target.value = '';
    }
  };

  const isCompact = variant === 'compact';

  return (
    <div className="relative flex-1">
      <div className="border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
        {/* Toolbar (full mode on top) */}
        {!isCompact && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleExecFormat('bold')}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                title="Tebal (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleExecFormat('italic')}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                title="Miring (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleExecFormat('underline')}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                title="Garis Bawah (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-4 bg-slate-300 mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleExecFormat('subscript')}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                title="Subscript (x₂)"
              >
                <Subscript className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleExecFormat('superscript')}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                title="Superscript (x²)"
              >
                <Superscript className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-4 bg-slate-300 mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                }}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 text-indigo-700 text-[11px] font-semibold transition-colors"
                title="Sisipkan Gambar (atau tekan Ctrl+V langsung)"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Gambar</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                }}
                onClick={() => setShowSymbolMenu((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  showSymbolMenu
                    ? 'bg-indigo-600 text-white'
                    : 'hover:bg-indigo-50 text-indigo-700'
                }`}
                title="Sisipkan Simbol atau Template Equation"
              >
                <Sigma className="w-3.5 h-3.5" />
                <span>Equation / Simbol</span>
              </button>
            </div>

            <span className="text-[10px] text-slate-400">
              {pastingImage ? 'Memproses gambar/equation...' : 'Ctrl+V langsung dari MS Word (Equation & Gambar)'}
            </span>
          </div>
        )}

        {/* Editor body + compact inline action buttons */}
        <div className={`relative flex items-start ${isCompact ? 'pr-16' : ''}`}>
          {isEmpty && (
            <div
              className={`pointer-events-none absolute text-xs text-slate-400 select-none ${
                isCompact ? 'left-2.5 top-2 truncate right-16' : 'left-3 top-2.5 right-3'
              }`}
            >
              {placeholder}
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={emitChange}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onBlur={saveSelection}
            onPaste={handlePaste}
            onDrop={handleDrop}
            className={`rich-content w-full text-xs text-slate-800 focus:outline-none overflow-y-auto ${
              isCompact
                ? `rich-content-inline px-2.5 py-2 ${minHeightClass || 'min-h-[36px] max-h-36'}`
                : `px-3 py-2.5 ${minHeightClass || 'min-h-[108px] max-h-72'}`
            }`}
          />

          {isCompact && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                }}
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Sisipkan Gambar pada Opsi (atau Ctrl+V)"
              >
                <ImagePlus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                }}
                onClick={() => setShowSymbolMenu((prev) => !prev)}
                className={`p-1 rounded transition-colors ${
                  showSymbolMenu
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title="Sisipkan Simbol / Equation"
              >
                <Sigma className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Symbol & Equation Popover */}
      {showSymbolMenu && (
        <div className="mt-1.5 p-2.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 relative space-y-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Template Equation
            </div>
            <div className="flex flex-wrap gap-1">
              {MATH_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    insertHtmlAtCursor(tpl.html);
                    setShowSymbolMenu(false);
                  }}
                  className="px-2 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded transition-colors"
                  title={tpl.label}
                >
                  {tpl.preview}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Simbol Matematika &amp; Fisika
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    insertHtmlAtCursor(escapeHtmlText(sym));
                    setShowSymbolMenu(false);
                  }}
                  className="w-7 h-7 flex items-center justify-center text-xs font-semibold bg-slate-50 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded transition-colors"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageFileSelect}
        className="hidden"
      />
    </div>
  );
};
