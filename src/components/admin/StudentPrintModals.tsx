import React, { useMemo, useState } from 'react';
import { ClassGroup, SchoolSettings, User } from '../../types/cbt';
import {
  Printer,
  X,
  IdCard,
  FileSpreadsheet,
  GraduationCap,
  CheckSquare,
  Square,
  KeyRound,
} from 'lucide-react';

export type StudentPrintMode = 'cards' | 'a4_roster' | null;

interface StudentPrintModalsProps {
  mode: StudentPrintMode;
  onClose: () => void;
  selectedClass: ClassGroup | null;
  classes: ClassGroup[];
  allStudents: User[];
  settings: SchoolSettings;
  onGeneratePasswords?: (targetScope: 'class' | 'all') => Promise<void>;
  isGeneratingPasswords?: boolean;
}

export function getStudentDisplayPassword(st: User): string {
  if (st.plainPassword && st.plainPassword.trim().length > 0) {
    return st.plainPassword;
  }
  const anyUser = st as any;
  if (!anyUser.passwordCustom) {
    return 'siswa123';
  }
  return '•••••••• (Diubah)';
}

export const StudentPrintModals: React.FC<StudentPrintModalsProps> = ({
  mode,
  onClose,
  selectedClass,
  classes,
  allStudents,
  settings,
  onGeneratePasswords,
  isGeneratingPasswords = false,
}) => {
  const [scope, setScope] = useState<'class' | 'all'>(selectedClass ? 'class' : 'all');
  const [columnMode, setColumnMode] = useState<'auto' | 1 | 2 | 3>('auto');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [filterSelectedOnly, setFilterSelectedOnly] = useState(false);

  const classMap = useMemo(() => {
    const map = new Map<string, ClassGroup>();
    for (const c of classes) map.set(c.id, c);
    return map;
  }, [classes]);

  const scopedStudents = useMemo(() => {
    const base =
      scope === 'class' && selectedClass
        ? allStudents.filter((s) => s.classId === selectedClass.id)
        : allStudents;

    return [...base].sort((a, b) => {
      if (scope === 'all') {
        const clsA = classMap.get(a.classId || '')?.name || 'ZZZ';
        const clsB = classMap.get(b.classId || '')?.name || 'ZZZ';
        const clsCmp = clsA.localeCompare(clsB, undefined, { numeric: true });
        if (clsCmp !== 0) return clsCmp;
      }
      return (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
    });
  }, [allStudents, scope, selectedClass, classMap]);

  if (!mode) return null;

  const cardsStudents =
    mode === 'cards' && filterSelectedOnly
      ? scopedStudents.filter((s) => selectedIds[s.id])
      : scopedStudents;

  const selectedCount = scopedStudents.filter((s) => selectedIds[s.id]).length;

  const toggleSelectStudent = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of scopedStudents) next[s.id] = true;
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds({});
    setFilterSelectedOnly(false);
  };

  // Auto-determine optimal column count so all students fit onto 1 single A4 portrait sheet
  const totalRosterCount = scopedStudents.length;
  const resolvedColumns: 1 | 2 | 3 =
    columnMode === 'auto'
      ? totalRosterCount <= 38
        ? 1
        : totalRosterCount <= 84
        ? 2
        : 3
      : columnMode;

  // Split roster rows evenly across 1, 2, or 3 columns
  const columnChunks = useMemo(() => {
    const chunks: { student: User; index: number }[][] = [];
    const total = scopedStudents.length;
    if (total === 0) return [[]];
    const perCol = Math.ceil(total / resolvedColumns);
    for (let col = 0; col < resolvedColumns; col++) {
      const start = col * perCol;
      const slice = scopedStudents
        .slice(start, start + perCol)
        .map((student, idx) => ({ student, index: start + idx + 1 }));
      if (slice.length > 0) chunks.push(slice);
    }
    return chunks;
  }, [scopedStudents, resolvedColumns]);

  // Compute dense typography scale for 1-sheet A4 fit
  const maxRowsInColumn = Math.max(1, ...columnChunks.map((c) => c.length));
  const denseFontSize =
    maxRowsInColumn <= 30
      ? 'text-[10.5px]'
      : maxRowsInColumn <= 42
      ? 'text-[9.5px]'
      : maxRowsInColumn <= 54
      ? 'text-[8.5px]'
      : 'text-[7.5px]';
  const denseCellPad =
    maxRowsInColumn <= 30
      ? 'py-1 px-2'
      : maxRowsInColumn <= 42
      ? 'py-0.5 px-1.5'
      : 'py-[1.5px] px-1';

  const schoolTitle = settings.schoolName || 'Portal CBT Sekolah';
  const academicYear = settings.academicYearText || '2024/2025';
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handleTriggerPrint = () => {
    window.print();
  };

  // --- RENDERABLE KARTU SISWA CONTENT (shared between preview & print-only) ---
  const renderCardsGrid = () => {
    if (cardsStudents.length === 0) {
      return (
        <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl bg-slate-50">
          Tidak ada siswa yang dipilih untuk dicetak.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 print:gap-2.5">
        {cardsStudents.map((st) => {
          const cls = classMap.get(st.classId || '');
          const isPicked = Boolean(selectedIds[st.id]);

          return (
            <div
              key={st.id}
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              className="border border-dashed border-slate-400 rounded-lg bg-white overflow-hidden shadow-2xs print:shadow-none flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between gap-2 print:bg-slate-900">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    {settings.schoolLogoUrl ? (
                      <img
                        src={settings.schoolLogoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain p-0.5"
                      />
                    ) : (
                      <GraduationCap className="w-4 h-4 text-indigo-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold leading-tight truncate uppercase tracking-wide">
                      {schoolTitle}
                    </div>
                    <div className="text-[9px] text-slate-300 leading-tight truncate">
                      KARTU PESERTA UJIAN CBT · {academicYear}
                    </div>
                  </div>
                </div>

                {/* Screen-only checkbox for selective card printing */}
                <button
                  type="button"
                  onClick={() => toggleSelectStudent(st.id)}
                  className="no-print text-slate-300 hover:text-white shrink-0"
                  title="Pilih / Batal pilih kartu ini"
                >
                  {isPicked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Card Body: NIS, Nama, Username, Password */}
              <div className="p-3 space-y-1.5 text-[11px] text-slate-800">
                <div className="grid grid-cols-[78px_10px_1fr] items-baseline">
                  <span className="font-semibold text-slate-500">NIS</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-mono font-bold text-slate-900">{st.nis || '-'}</span>
                </div>
                <div className="grid grid-cols-[78px_10px_1fr] items-baseline">
                  <span className="font-semibold text-slate-500">Nama</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-bold text-slate-900 uppercase leading-snug">{st.name}</span>
                </div>
                <div className="grid grid-cols-[78px_10px_1fr] items-baseline">
                  <span className="font-semibold text-slate-500">Kelas</span>
                  <span className="text-slate-400">:</span>
                  <span className="font-semibold text-slate-700">{cls?.name || '-'}</span>
                </div>

                <div className="pt-1.5 mt-1.5 border-t border-slate-200 grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Username
                    </div>
                    <div className="font-mono font-bold text-xs text-indigo-800 break-all">
                      {st.username}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Password
                    </div>
                    <div className="font-mono font-bold text-xs text-slate-900 break-all">
                      {getStudentDisplayPassword(st)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                <span>Login melalui Portal Siswa CBT</span>
                <span className={`font-bold ${st.isActive !== false ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {st.isActive !== false ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- RENDERABLE 1-SHEET A4 ROSTER CONTENT ---
  const renderA4RosterSheet = () => {
    const scopeLabel =
      scope === 'class' && selectedClass
        ? `Kelas ${selectedClass.name} (Tingkat ${selectedClass.gradeLevel}) · Wali Kelas: ${
            selectedClass.homeroomTeacher || '-'
          }`
        : `Seluruh Kelas (${classes.length} Rombongan Belajar)`;

    return (
      <div className="bg-white text-slate-900 w-full mx-auto print:w-full print:max-h-[279mm] print:overflow-hidden">
        {/* School Kop Header */}
        <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b-2 border-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
              {settings.schoolLogoUrl ? (
                <img
                  src={settings.schoolLogoUrl}
                  alt="Logo Sekolah"
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <GraduationCap className="w-5 h-5 text-indigo-700" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 leading-tight">
                {schoolTitle}
              </h1>
              <p className="text-[10px] font-bold text-slate-700 uppercase leading-tight">
                Daftar Data Keseluruhan Akun Siswa (Peserta CBT) · TA {academicYear}
              </p>
              <p className="text-[9.5px] text-slate-600 leading-tight mt-0.5">{scopeLabel}</p>
            </div>
          </div>

          <div className="text-right shrink-0 text-[9.5px] leading-tight">
            <div className="font-bold text-slate-900">Total: {scopedStudents.length} Siswa</div>
            <div className="text-slate-500">Dicetak: {todayFormatted}</div>
          </div>
        </div>

        {/* Multi-column A4 single-page table grid */}
        {scopedStudents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg">
            Belum ada data siswa pada cakupan yang dipilih.
          </div>
        ) : (
          <div
            className={`grid gap-2 items-start ${
              resolvedColumns === 1
                ? 'grid-cols-1'
                : resolvedColumns === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'
            }`}
          >
            {columnChunks.map((chunk, colIdx) => (
              <table
                key={colIdx}
                className={`w-full border-collapse border border-slate-400 ${denseFontSize}`}
              >
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold">
                    <th className={`border border-slate-400 text-center w-6 ${denseCellPad}`}>No</th>
                    <th className={`border border-slate-400 text-left ${denseCellPad}`}>NIS</th>
                    <th className={`border border-slate-400 text-left ${denseCellPad}`}>Nama Lengkap</th>
                    {scope === 'all' && (
                      <th className={`border border-slate-400 text-left ${denseCellPad}`}>Kelas</th>
                    )}
                    <th className={`border border-slate-400 text-left ${denseCellPad}`}>Username</th>
                    <th className={`border border-slate-400 text-left ${denseCellPad}`}>Password</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map(({ student: st, index }) => {
                    const cls = classMap.get(st.classId || '');
                    return (
                      <tr key={st.id} className="even:bg-slate-50">
                        <td className={`border border-slate-300 text-center font-mono tabular-nums ${denseCellPad}`}>
                          {index}
                        </td>
                        <td className={`border border-slate-300 font-mono tabular-nums whitespace-nowrap ${denseCellPad}`}>
                          {st.nis || '-'}
                        </td>
                        <td className={`border border-slate-300 font-medium leading-tight ${denseCellPad}`}>
                          {st.name}
                        </td>
                        {scope === 'all' && (
                          <td className={`border border-slate-300 whitespace-nowrap ${denseCellPad}`}>
                            {cls?.name || '-'}
                          </td>
                        )}
                        <td className={`border border-slate-300 font-mono font-semibold text-indigo-900 ${denseCellPad}`}>
                          {st.username}
                        </td>
                        <td className={`border border-slate-300 font-mono font-semibold ${denseCellPad}`}>
                          {getStudentDisplayPassword(st)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 pt-1.5 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-600">
          <span>
            Mode Tampilan: {resolvedColumns} Kolom (Dioptimalkan 1 Lembar A4) · Pastikan siswa segera mengganti/menjaga kerahasiaan akun.
          </span>
          <span className="font-semibold text-slate-800">Operator / Administrator CBT</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* SCREEN PREVIEW MODAL */}
      <div className="no-print fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex flex-col p-3 sm:p-6 overflow-hidden">
        <div className="bg-white rounded-2xl max-w-6xl w-full mx-auto flex flex-col max-h-full shadow-2xl border border-slate-200 overflow-hidden">
          {/* Modal Toolbar */}
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              {mode === 'cards' ? (
                <IdCard className="w-5 h-5 text-indigo-600" />
              ) : (
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              )}
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {mode === 'cards'
                    ? 'Cetak Kartu Akun Siswa (NIS, Nama, Username, Password)'
                    : 'Data Keseluruhan Akun Siswa (1 Lembar A4)'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {mode === 'cards'
                    ? `Menampilkan ${cardsStudents.length} kartu siap cetak (2 kartu per baris A4).`
                    : `Menampilkan ${scopedStudents.length} siswa dalam format padat 1 lembar A4 (${resolvedColumns} kolom).`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Scope Selector */}
              <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
                {selectedClass && (
                  <button
                    type="button"
                    onClick={() => setScope('class')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      scope === 'class'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Kelas {selectedClass.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    scope === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Semua Kelas ({allStudents.length})
                </button>
              </div>

              {/* Card-specific selection controls */}
              {mode === 'cards' && scopedStudents.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                  >
                    Pilih Semua
                  </button>
                  {selectedCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setFilterSelectedOnly((v) => !v)}
                        className={`px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
                          filterSelectedOnly
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {filterSelectedOnly
                          ? `Tampilkan Terpilih (${selectedCount})`
                          : `Filter Terpilih (${selectedCount})`}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="px-2 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* A4 Roster column density selector */}
              {mode === 'a4_roster' && (
                <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
                  <span className="px-2 text-[11px] font-semibold text-slate-400">Kolom A4:</span>
                  {(['auto', 1, 2, 3] as const).map((colOpt) => (
                    <button
                      key={String(colOpt)}
                      type="button"
                      onClick={() => setColumnMode(colOpt)}
                      className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                        columnMode === colOpt
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {colOpt === 'auto' ? 'Auto' : `${colOpt} Kol`}
                    </button>
                  ))}
                </div>
              )}

              {/* Generate random passwords button */}
              {onGeneratePasswords && (
                <button
                  type="button"
                  onClick={() => onGeneratePasswords(scope)}
                  disabled={isGeneratingPasswords || scopedStudents.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                  title="Acak password baru untuk seluruh siswa pada cakupan ini"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isGeneratingPasswords ? 'Mengacak...' : 'Generate Password'}</span>
                </button>
              )}

              {/* Print button */}
              <button
                type="button"
                onClick={handleTriggerPrint}
                disabled={mode === 'cards' ? cardsStudents.length === 0 : scopedStudents.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{mode === 'cards' ? 'Cetak Kartu (Print / PDF)' : 'Cetak 1 Lembar A4'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Paper Preview Area */}
          <div className="flex-1 overflow-y-auto bg-slate-200/70 p-4 sm:p-6">
            {mode === 'cards' ? (
              <div className="max-w-[210mm] mx-auto bg-white p-5 rounded-xl shadow-md border border-slate-200">
                {renderCardsGrid()}
              </div>
            ) : (
              <div className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white p-[8mm] rounded-xl shadow-lg border border-slate-300">
                {renderA4RosterSheet()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DEDICATED PRINT-ONLY LAYER (zero clipping, exact A4 flow) */}
      <div className="hidden print-only">
        {mode === 'cards' ? renderCardsGrid() : renderA4RosterSheet()}
      </div>
    </>
  );
};
