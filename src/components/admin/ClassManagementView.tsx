import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ClassGroup, AcademicYear, User } from '../../types/cbt';
import { School, Users, Plus, Edit2, ArrowRight, UserCheck, Check, X } from 'lucide-react';

export const ClassManagementView: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Class Form
  const [newGrade, setNewGrade] = useState<'X' | 'XI' | 'XII'>('XII');
  const [newName, setNewName] = useState('');
  const [newHomeroom, setNewHomeroom] = useState('');

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
      setClasses(clsRes.classes || []);
      setAcademicYears(clsRes.academicYears || []);
      setUsers(usersRes.users || []);
      if (!selectedClass && clsRes.classes.length > 0) {
        setSelectedClass(clsRes.classes[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await api.createClass({
        gradeLevel: newGrade,
        name: newName.trim(),
        homeroomTeacher: newHomeroom.trim(),
        academicYearId: academicYears[0]?.id,
      });
      setShowAddModal(false);
      setNewName('');
      setNewHomeroom('');
      loadData();
      alert(`Kelas ${res.class.name} berhasil ditambahkan.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan kelas.');
    }
  };

  const classStudents = users.filter((u) => u.role === 'student' && u.classId === selectedClass?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Manajemen Kelas & Rombongan Belajar
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Kurikulum Merdeka (Fase E & Fase F)</span>
            <span>·</span>
            <span>Tingkat X, XI, dan XII</span>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kelas / Rombel</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Classes List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Daftar Kelas ({classes.length})
          </h3>

          <div className="space-y-2">
            {classes.map((cls) => {
              const count = users.filter((u) => u.role === 'student' && u.classId === cls.id).length;
              const isSelected = selectedClass?.id === cls.id;

              return (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm text-slate-900">{cls.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Wali: {cls.homeroomTeacher || 'Belum Ditentukan'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded">
                      {count} Siswa
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Class Student Roster */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Siswa Terdaftar: {selectedClass?.name || 'Pilih Kelas'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Wali Kelas: {selectedClass?.homeroomTeacher || '-'} · Tingkat {selectedClass?.gradeLevel}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700">
              Total: {classStudents.length} Siswa
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">Nama Lengkap</th>
                  <th className="py-2.5 px-3">NIS</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada siswa yang dialokasikan ke kelas ini.
                    </td>
                  </tr>
                ) : (
                  classStudents.map((st, i) => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{st.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{st.nis || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-600">{st.username}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[11px] font-semibold ${st.isActive ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {st.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Tambah Kelas Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
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
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
