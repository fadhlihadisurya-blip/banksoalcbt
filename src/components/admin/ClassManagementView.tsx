import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ClassGroup, AcademicYear, User } from '../../types/cbt';
import {
  School,
  Users,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  X,
  Search,
} from 'lucide-react';

export function getFirstWordUsername(fullName: string): string {
  if (!fullName) return '';
  const firstWord = fullName.trim().split(/\s+/)[0] || '';
  return firstWord.toLowerCase().replace(/[^a-z0-9_]/gi, '');
}

export const ClassManagementView: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  // 1. New Class Modal
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newGrade, setNewGrade] = useState<'X' | 'XI' | 'XII'>('XII');
  const [newName, setNewName] = useState('');
  const [newHomeroom, setNewHomeroom] = useState('');

  // 2. Edit Class Modal
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassGrade, setEditClassGrade] = useState<'X' | 'XI' | 'XII'>('XII');
  const [editClassHomeroom, setEditClassHomeroom] = useState('');

  // 3. Delete Class Modal
  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassGroup | null>(null);

  // 4. Edit Student Modal
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentNis, setEditStudentNis] = useState('');
  const [editStudentUsername, setEditStudentUsername] = useState('');
  const [editStudentClassId, setEditStudentClassId] = useState('');
  const [editStudentIsActive, setEditStudentIsActive] = useState(true);

  // 5. Delete Student Modal
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<User | null>(null);

  // 6. Import Students Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetClassId, setImportTargetClassId] = useState('');
  const [csvContent, setCsvContent] = useState('');

  // Operation loading state
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clsRes, usersRes] = await Promise.all([
        api.getClasses(),
        api.getUsers(),
      ]);
      const fetchedClasses = clsRes.classes || [];
      setClasses(fetchedClasses);
      setAcademicYears(clsRes.academicYears || []);
      setUsers(usersRes.users || []);

      if (fetchedClasses.length > 0) {
        setSelectedClass((prev) => {
          if (!prev) return fetchedClasses[0];
          const exists = fetchedClasses.find((c) => c.id === prev.id);
          return exists || fetchedClasses[0];
        });
      } else {
        setSelectedClass(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- CLASS ACTIONS ---

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsProcessing(true);
      const res = await api.createClass({
        gradeLevel: newGrade,
        name: newName.trim(),
        homeroomTeacher: newHomeroom.trim(),
        academicYearId: academicYears[0]?.id,
      });
      setShowAddClassModal(false);
      setNewName('');
      setNewHomeroom('');
      await loadData();
      if (res.class) setSelectedClass(res.class);
      alert(`Kelas ${res.class.name} berhasil ditambahkan.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan kelas.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditClass = (cls: ClassGroup, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingClass(cls);
    setEditClassName(cls.name || '');
    setEditClassGrade((cls.gradeLevel as 'X' | 'XI' | 'XII') || 'XII');
    setEditClassHomeroom(cls.homeroomTeacher || '');
    setShowEditClassModal(true);
  };

  const handleSaveEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editClassName.trim()) return;

    try {
      setIsProcessing(true);
      await api.updateClass(editingClass.id, {
        name: editClassName.trim(),
        gradeLevel: editClassGrade,
        homeroomTeacher: editClassHomeroom.trim(),
      });
      setShowEditClassModal(false);
      setEditingClass(null);
      await loadData();
      alert('Nama & data kelas berhasil diperbarui.');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui kelas.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDeleteClass = (cls: ClassGroup, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingClass(cls);
    setShowDeleteClassModal(true);
  };

  const handleConfirmDeleteClass = async () => {
    if (!deletingClass) return;

    try {
      setIsProcessing(true);
      await api.deleteClass(deletingClass.id);
      setShowDeleteClassModal(false);
      setDeletingClass(null);
      await loadData();
      alert('Kelas berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kelas.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- STUDENT ACTIONS ---

  const handleOpenEditStudent = (st: User) => {
    setEditingStudent(st);
    setEditStudentName(st.name || '');
    setEditStudentNis(st.nis || '');
    setEditStudentUsername(st.username || '');
    setEditStudentClassId(st.classId || selectedClass?.id || '');
    setEditStudentIsActive(st.isActive !== false);
    setShowEditStudentModal(true);
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editStudentName.trim() || !editStudentUsername.trim()) {
      alert('Nama dan Username siswa wajib diisi.');
      return;
    }

    try {
      setIsProcessing(true);
      await api.updateUser(editingStudent.id, {
        name: editStudentName.trim(),
        nis: editStudentNis.trim() || editStudentUsername.trim(),
        username: editStudentUsername.trim(),
        classId: editStudentClassId,
        isActive: editStudentIsActive,
      });
      setShowEditStudentModal(false);
      setEditingStudent(null);
      await loadData();
      alert('Data siswa berhasil diperbarui.');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui data siswa.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDeleteStudent = (st: User) => {
    setDeletingStudent(st);
    setShowDeleteStudentModal(true);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;

    try {
      setIsProcessing(true);
      await api.deleteUser(deletingStudent.id);
      setShowDeleteStudentModal(false);
      setDeletingStudent(null);
      await loadData();
      alert('Siswa berhasil dihapus dari sistem.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus siswa.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- IMPORT ACTIONS ---

  const handleOpenImport = () => {
    setImportTargetClassId(selectedClass?.id || classes[0]?.id || '');
    setCsvContent('');
    setShowImportModal(true);
  };

  const handleImportSample = () => {
    const sample = `nomor,nis,nama lengkap
1,20241031,Andi Pratama
2,20241032,Bunga Citra
3,20241033,Cahyo Utomo`;
    setCsvContent(sample);
  };

  const handleProcessImport = async () => {
    if (!csvContent.trim() || !importTargetClassId) {
      alert('Mohon pilih kelas tujuan dan isi data CSV siswa.');
      return;
    }

    try {
      setIsProcessing(true);
      const lines = csvContent.trim().split('\n');
      const students: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Skip header row if present
        if (
          i === 0 &&
          (line.toLowerCase().includes('nomor') ||
            line.toLowerCase().includes('nama') ||
            line.toLowerCase().includes('nis'))
        ) {
          continue;
        }

        const parts = line.split(',');
        if (parts.length >= 3) {
          const rawNis = parts[1]?.trim() || '';
          const rawName = parts.slice(2).join(',').replace(/^"|"$/g, '').trim();
          const firstWordUser = getFirstWordUsername(rawName);
          const rawUsername = firstWordUser || rawNis;
          const rawPassword = 'siswa123';

          if (rawName) {
            students.push({
              name: rawName,
              nis: rawNis,
              username: rawUsername,
              password: rawPassword,
              classId: importTargetClassId,
            });
          }
        } else if (parts.length === 2) {
          // Fallback if user omitted number column: nis, nama
          const rawNis = parts[0]?.trim() || '';
          const rawName = parts[1]?.replace(/^"|"$/g, '').trim();
          const firstWordUser = getFirstWordUsername(rawName);
          const rawUsername = firstWordUser || rawNis;

          if (rawName) {
            students.push({
              name: rawName,
              nis: rawNis,
              username: rawUsername,
              password: 'siswa123',
              classId: importTargetClassId,
            });
          }
        }
      }

      if (students.length === 0) {
        alert('Tidak ada baris siswa valid yang ditemukan.');
        return;
      }

      const res = await api.bulkImportStudents(students);
      setShowImportModal(false);
      setCsvContent('');
      await loadData();
      alert(res.message);
    } catch (err: any) {
      alert(err.message || 'Gagal mengimpor data siswa.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter students for selected class and search
  const classStudentsAll = users.filter((u) => u.role === 'student' && u.classId === selectedClass?.id);
  const classStudents = classStudentsAll.filter((st) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      st.name.toLowerCase().includes(q) ||
      (st.nis && st.nis.toLowerCase().includes(q)) ||
      st.username.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Manajemen Kelas & Rombongan Belajar
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Kurikulum Merdeka (Fase E & Fase F)</span>
            <span>·</span>
            <span>Total {classes.length} Kelas Rombel Terdaftar</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Tambah Kelas Baru */}
          <button
            onClick={() => setShowAddClassModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kelas Baru</span>
          </button>
        </div>
      </div>

      {/* DROPDOWN PEMILIHAN KELAS UTAMA */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
            <School className="w-4 h-4 text-indigo-600" />
            <span>Pilih Kelas / Rombongan Belajar (Dropdown):</span>
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select
              value={selectedClass?.id || ''}
              onChange={(e) => {
                const cls = classes.find((c) => c.id === e.target.value);
                if (cls) setSelectedClass(cls);
              }}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-2xs cursor-pointer"
            >
              {loading ? (
                <option value="">Memuat data kelas...</option>
              ) : classes.length === 0 ? (
                <option value="">Belum ada kelas terdaftar (Klik &quot;Tambah Kelas Baru&quot;)</option>
              ) : (
                classes.map((c) => {
                  const count = users.filter((u) => u.role === 'student' && u.classId === c.id).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} — {count} Siswa · {c.homeroomTeacher || 'Belum Ditentukan'}
                    </option>
                  );
                })
              )}
            </select>

            {selectedClass && (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Tombol Edit Nama Kelas */}
                <button
                  onClick={() => handleOpenEditClass(selectedClass)}
                  className="p-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Edit Nama / Wali Kelas Ini"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {/* Tombol Hapus Kelas */}
                <button
                  onClick={() => handleOpenDeleteClass(selectedClass)}
                  className="p-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Hapus Kelas Ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RINCIAN SISWA DALAM KELAS TERPILIH */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900">
                Daftar Siswa Terdaftar: {selectedClass?.name || 'Pilih Kelas'}
              </h3>
              {selectedClass && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  Tingkat {selectedClass.gradeLevel}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Wali Kelas: <strong>{selectedClass?.homeroomTeacher || 'Belum Ditentukan'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {selectedClass && (
              <button
                onClick={() => {
                  setImportTargetClassId(selectedClass.id);
                  setCsvContent('');
                  setShowImportModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition-colors shadow-2xs cursor-pointer"
                title="Impor data siswa 3 kolom (nomor, nis, nama lengkap)"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Impor Siswa (3 Kolom CSV)</span>
              </button>
            )}
            <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
              Total: {classStudentsAll.length} Siswa
            </span>
          </div>
        </div>

        {/* Search Filter for Students */}
        {classStudentsAll.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Cari siswa berdasarkan nama atau NIS..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Student Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">NIS</th>
                <th className="py-2.5 px-3">Nama Lengkap</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Aksi Siswa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classStudentsAll.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Belum ada siswa yang dialokasikan ke kelas ini. Gunakan tombol &quot;Impor Siswa (3 Kolom CSV)&quot; di atas untuk mengimpor data.
                  </td>
                </tr>
              ) : classStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada siswa yang cocok dengan kata kunci pencarian.
                  </td>
                </tr>
              ) : (
                classStudents.map((st, i) => {
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 font-semibold">{st.nis || '-'}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{st.name}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            st.isActive ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {st.isActive ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Nonaktif</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Edit Siswa */}
                          <button
                            onClick={() => handleOpenEditStudent(st)}
                            className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded transition-colors inline-flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Edit Data Siswa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Tombol Hapus Siswa */}
                          <button
                            onClick={() => handleOpenDeleteStudent(st)}
                            className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded transition-colors inline-flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Tambah Kelas Baru</h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tingkat Kelas</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['X', 'XI', 'XII'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setNewGrade(g)}
                      className={`py-2 text-center font-bold rounded-lg border transition-colors ${
                        newGrade === g
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Kelas {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Rombongan Belajar</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: XII MIPA 3 atau X-4"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Wali Kelas</label>
                <input
                  type="text"
                  value={newHomeroom}
                  onChange={(e) => setNewHomeroom(e.target.value)}
                  placeholder="Contoh: Dra. Nurhasanah, M.Pd."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={isProcessing}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isProcessing ? 'Menyimpan...' : 'Simpan Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Class Modal */}
      {showEditClassModal && editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit Nama & Data Kelas</h3>
              </div>
              <button
                onClick={() => {
                  setShowEditClassModal(false);
                  setEditingClass(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClass} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tingkat Kelas</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['X', 'XI', 'XII'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setEditClassGrade(g)}
                      className={`py-2 text-center font-bold rounded-lg border transition-colors ${
                        editClassGrade === g
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Kelas {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Rombongan Belajar</label>
                <input
                  type="text"
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  placeholder="Contoh: XII MIPA 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Wali Kelas</label>
                <input
                  type="text"
                  value={editClassHomeroom}
                  onChange={(e) => setEditClassHomeroom(e.target.value)}
                  placeholder="Contoh: Dra. Nurhasanah, M.Pd."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditClassModal(false);
                    setEditingClass(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={isProcessing}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isProcessing ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Delete Class Confirmation Modal */}
      {showDeleteClassModal && deletingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Kelas</h3>
                <p className="text-slate-500 text-[11px]">Konfirmasi penghapusan rombel</p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus kelas <strong className="text-slate-900">{deletingClass.name}</strong>? Siswa yang terdaftar pada kelas ini akan dialihkan ke status tanpa kelas.
            </p>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteClassModal(false);
                  setDeletingClass(null);
                }}
                disabled={isProcessing}
                className="px-3.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClass}
                disabled={isProcessing}
                className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Menghapus...' : 'Hapus Kelas'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Edit Student Modal */}
      {showEditStudentModal && editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit Data Siswa</h3>
              </div>
              <button
                onClick={() => {
                  setShowEditStudentModal(false);
                  setEditingStudent(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Induk Siswa (NIS)</label>
                <input
                  type="text"
                  value={editStudentNis}
                  onChange={(e) => setEditStudentNis(e.target.value)}
                  placeholder="Contoh: 20241021"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username Login</label>
                <input
                  type="text"
                  value={editStudentUsername}
                  onChange={(e) => setEditStudentUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alokasi Rombongan Belajar (Kelas)</label>
                <select
                  value={editStudentClassId}
                  onChange={(e) => setEditStudentClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Tanpa Kelas (Belum Dialokasikan)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Tingkat {c.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Keaktifan</label>
                <select
                  value={editStudentIsActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditStudentIsActive(e.target.value === 'active')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Aktif (Dapat Mengikuti Ujian)</option>
                  <option value="inactive">Nonaktif (Akses Diblokir)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStudentModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={isProcessing}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isProcessing ? 'Menyimpan...' : 'Simpan Data Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Student Confirmation Modal */}
      {showDeleteStudentModal && deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Siswa</h3>
                <p className="text-slate-500 text-[11px]">Konfirmasi penghapusan data</p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus siswa <strong className="text-slate-900">{deletingStudent.name}</strong> (NIS: {deletingStudent.nis || '-'}, Username: {deletingStudent.username})? Tindakan ini akan menghapus akun siswa secara permanen.
            </p>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteStudentModal(false);
                  setDeletingStudent(null);
                }}
                disabled={isProcessing}
                className="px-3.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                disabled={isProcessing}
                className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Menghapus...' : 'Hapus Siswa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Import Students Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Impor Data Siswa Massal (CSV)</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Kelas Rombel Tujuan:
                </label>
                <select
                  value={importTargetClassId}
                  onChange={(e) => setImportTargetClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.homeroomTeacher || 'Belum Ditentukan'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span>Tempelkan data CSV (nomor, nis, nama lengkap):</span>
                  <button
                    onClick={handleImportSample}
                    className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Muat Contoh Format (3 Kolom)</span>
                  </button>
                </div>

                <textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={6}
                  placeholder={`nomor,nis,nama lengkap\n1,20241031,Andi Pratama\n2,20241032,Bunga Citra\n3,20241033,Cahyo Utomo`}
                  className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-[11px] leading-relaxed">
                <strong>Catatan:</strong> Cukup 3 kolom: <code>nomor, nis, nama lengkap</code>. Username otomatis dibuat dari kata pertama nama lengkap (huruf kecil), dan kata sandi awal default: <code>siswa123</code>.
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={isProcessing}
              >
                Batal
              </button>
              <button
                onClick={handleProcessImport}
                disabled={isProcessing || !csvContent.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Mengimpor...' : 'Impor Siswa Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
