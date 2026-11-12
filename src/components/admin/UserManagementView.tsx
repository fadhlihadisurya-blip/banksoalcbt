import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { User, ClassGroup } from '../../types/cbt';
import {
  Users,
  Search,
  Filter,
  Plus,
  RotateCcw,
  KeyRound,
  CheckCircle,
  XCircle,
  Upload,
  Download,
  X,
  FileSpreadsheet,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Edit User State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [editEmail, setEditEmail] = useState('');
  const [editNis, setEditNis] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editSubjectSpecialty, setEditSubjectSpecialty] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete User State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New User Form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('siswa123');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [newNis, setNewNis] = useState('');
  const [newClassId, setNewClassId] = useState('');

  // Bulk CSV
  const [csvContent, setCsvContent] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [uRes, cRes] = await Promise.all([
        api.getUsers(),
        api.getClasses(),
      ]);
      setUsers(uRes.users || []);
      setClasses(cRes.classes || []);
      if (cRes.classes.length > 0 && !newClassId) {
        setNewClassId(cRes.classes[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        name: newName.trim(),
        role: newRole,
        nis: newRole === 'student' ? newNis.trim() || newUsername.trim() : undefined,
        classId: newRole === 'student' ? newClassId : undefined,
      });

      setShowAddModal(false);
      setNewUsername('');
      setNewName('');
      setNewNis('');
      loadAll();
      alert('Akun berhasil dibuat.');
    } catch (err: any) {
      alert(err.message || 'Gagal membuat akun.');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await api.toggleUserStatus(userId);
      loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserForReset) return;
    try {
      await api.resetPassword(selectedUserForReset.id, newPasswordInput || 'sma12345');
      setShowResetModal(false);
      setSelectedUserForReset(null);
      setNewPasswordInput('');
      alert(`Password untuk ${selectedUserForReset.username} berhasil direset.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEditModal = (u: User) => {
    setSelectedUserForEdit(u);
    setEditName(u.name || '');
    setEditUsername(u.username || '');
    setEditRole(u.role);
    setEditEmail(u.email || '');
    setEditNis(u.nis || '');
    setEditClassId(u.classId || (classes[0]?.id || ''));
    setEditNip(u.nip || '');
    setEditSubjectSpecialty(u.subjectSpecialty || '');
    setEditPassword('');
    setEditIsActive(u.isActive !== false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    if (!editName.trim() || !editUsername.trim()) {
      alert('Nama lengkap dan username wajib diisi.');
      return;
    }

    try {
      setIsSavingEdit(true);
      await api.updateUser(selectedUserForEdit.id, {
        name: editName.trim(),
        username: editUsername.trim(),
        role: editRole,
        email: editEmail.trim(),
        isActive: editIsActive,
        nis: editRole === 'student' ? (editNis.trim() || editUsername.trim()) : undefined,
        classId: editRole === 'student' ? editClassId : undefined,
        nip: editRole === 'teacher' ? editNip.trim() : undefined,
        subjectSpecialty: editRole === 'teacher' ? editSubjectSpecialty.trim() : undefined,
        password: editPassword.trim() ? editPassword.trim() : undefined,
      });

      setShowEditModal(false);
      setSelectedUserForEdit(null);
      await loadAll();
      alert('Data akun berhasil diperbarui.');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui data akun.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenDeleteModal = (u: User) => {
    if (u.role === 'admin') {
      alert('Akun Administrator tidak dapat dihapus demi keamanan sistem.');
      return;
    }
    setSelectedUserForDelete(u);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUserForDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteUser(selectedUserForDelete.id);
      setShowDeleteModal(false);
      setSelectedUserForDelete(null);
      await loadAll();
      alert('Akun berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus akun.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportSample = () => {
    const sample = `nomor,nis,nama lengkap
1,20241031,Andi Pratama
2,20241032,Bunga Citra
3,20241033,Cahyo Utomo`;
    setCsvContent(sample);
  };

  const handleProcessImport = async () => {
    if (!csvContent.trim()) return;
    try {
      const lines = csvContent.trim().split('\n');
      const students: any[] = [];
      const defaultClassId = classes[0]?.id || '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
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
          const firstWord = rawName.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_]/gi, '') || '';
          const rawUsername = firstWord || rawNis;

          if (rawName) {
            students.push({
              name: rawName,
              nis: rawNis,
              classId: defaultClassId,
              username: rawUsername,
              password: 'siswa123',
            });
          }
        } else if (parts.length === 2) {
          const rawNis = parts[0]?.trim() || '';
          const rawName = parts[1]?.replace(/^"|"$/g, '').trim();
          const firstWord = rawName.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_]/gi, '') || '';
          const rawUsername = firstWord || rawNis;

          if (rawName) {
            students.push({
              name: rawName,
              nis: rawNis,
              classId: defaultClassId,
              username: rawUsername,
              password: 'siswa123',
            });
          }
        }
      }

      if (students.length === 0) {
        alert('Tidak ada data siswa valid yang dapat diimpor.');
        return;
      }

      const res = await api.bulkImportStudents(students);
      setShowImportModal(false);
      setCsvContent('');
      loadAll();
      alert(res.message);
    } catch (err: any) {
      alert(err.message || 'Gagal impor data siswa.');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchUsername = u.username.toLowerCase().includes(q);
      const matchNis = u.nis?.toLowerCase().includes(q);
      return matchName || matchUsername || matchNis;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Manajemen Akun & Akses Pengguna
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Enkripsi Hash SHA-256 Server</span>
            <span>·</span>
            <span>Kontrol Hak Akses Tiga Role (Admin, Guru, Siswa)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor Akun Massal</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, username, atau NIS..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto py-2 px-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Role Pengguna</option>
            <option value="student">Siswa Saja</option>
            <option value="teacher">Guru Saja</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Username & Identitas</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Kelas / Mapel</th>
                <th className="py-3 px-4">Status Akun</th>
                <th className="py-3 px-4">Login Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Tidak ada akun yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const studentClass = classes.find((c) => c.id === u.classId);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        {u.email && <div className="text-[11px] text-slate-400">{u.email}</div>}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="text-indigo-600 font-semibold">{u.username}</div>
                        {u.nis && <div className="text-[11px] text-slate-500">NIS: {u.nis}</div>}
                        {u.nip && <div className="text-[11px] text-slate-500">NIP: {u.nip}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-700">
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700">
                        {u.role === 'student'
                          ? studentClass?.name || '-'
                          : u.role === 'teacher'
                          ? u.subjectSpecialty || 'Guru Mapel'
                          : 'Seluruh Sistem'}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          className={`font-semibold text-[11px] hover:underline cursor-pointer flex items-center gap-1 ${
                            u.isActive ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                          title="Klik untuk mengubah status aktif"
                        >
                          {u.isActive ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Nonaktif</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Belum pernah'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Edit: Tersedia untuk semua akun termasuk Admin */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded transition-colors inline-flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Edit Akun"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Tombol Reset Password */}
                          <button
                            onClick={() => {
                              setSelectedUserForReset(u);
                              setNewPasswordInput('');
                              setShowResetModal(true);
                            }}
                            className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors inline-flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Tombol Hapus: Ditampilkan hanya untuk Siswa dan Guru (Admin tidak ada tombol hapus) */}
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleOpenDeleteModal(u)}
                              className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded transition-colors inline-flex items-center justify-center shadow-2xs cursor-pointer"
                              title="Hapus Akun"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Tambah Akun Pengguna</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Peran (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="student">Siswa</option>
                  <option value="teacher">Guru</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Muhammad Farhan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Bisa berupa NIS atau ID unik"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi Awal</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              {newRole === 'student' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor Induk Siswa (NIS)</label>
                    <input
                      type="text"
                      value={newNis}
                      onChange={(e) => setNewNis(e.target.value)}
                      placeholder="Contoh: 20241020"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alokasi Kelas</label>
                    <select
                      value={newClassId}
                      onChange={(e) => setNewClassId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

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
                  Buat Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUserForReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Reset Kata Sandi</h3>
            <p className="text-slate-500 mb-4">
              Pengguna: <strong className="text-slate-800">{selectedUserForReset.name}</strong> ({selectedUserForReset.username})
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Masukkan Password Baru (Default: sma12345)
                </label>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="sma12345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="px-4 py-1.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
              >
                Konfirmasi Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Students Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Impor Akun Siswa Massal (CSV)</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Tempelkan data CSV (nomor, nis, nama lengkap):</span>
                <button
                  onClick={handleImportSample}
                  className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Muat Format Contoh (3 Kolom)</span>
                </button>
              </div>

              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                rows={6}
                placeholder={`nomor,nis,nama lengkap\n1,20241031,Andi Pratama\n2,20241032,Bunga Citra\n3,20241033,Cahyo Utomo`}
                className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-[11px] leading-relaxed">
                <strong>Catatan:</strong> Cukup 3 kolom: <code>nomor, nis, nama lengkap</code>. Username otomatis diambil dari kata pertama nama lengkap (huruf kecil), dan password default: <code>siswa123</code>.
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleProcessImport}
                disabled={!csvContent.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs disabled:opacity-50"
              >
                Impor Siswa Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUserForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit Akun Pengguna</h3>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUserForEdit(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Peran (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={selectedUserForEdit.role === 'admin'}
                >
                  <option value="student">Siswa</option>
                  <option value="teacher">Guru</option>
                  <option value="admin">Administrator</option>
                </select>
                {selectedUserForEdit.role === 'admin' && (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Peran Administrator sistem terkunci untuk keamanan akun.
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {editRole === 'student' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor Induk Siswa (NIS)</label>
                    <input
                      type="text"
                      value={editNis}
                      onChange={(e) => setEditNis(e.target.value)}
                      placeholder="Contoh: 20241020"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alokasi Kelas</label>
                    <select
                      value={editClassId}
                      onChange={(e) => setEditClassId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {editRole === 'teacher' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIP (Opsional)</label>
                    <input
                      type="text"
                      value={editNip}
                      onChange={(e) => setEditNip(e.target.value)}
                      placeholder="Contoh: 198003152005011002"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Spesialisasi Mata Pelajaran</label>
                    <input
                      type="text"
                      value={editSubjectSpecialty}
                      onChange={(e) => setEditSubjectSpecialty(e.target.value)}
                      placeholder="Contoh: Fisika / Kimia"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kata Sandi Baru (Opsional)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Akun</label>
                <select
                  value={editIsActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditIsActive(e.target.value === 'active')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Aktif (Dapat Login)</option>
                  <option value="inactive">Nonaktif (Akses Dinonaktifkan)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUserForEdit(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={isSavingEdit}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && selectedUserForDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Akun Pengguna</h3>
                <p className="text-slate-500 text-[11px]">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus akun <strong className="text-slate-900">{selectedUserForDelete.name}</strong> (@{selectedUserForDelete.username}) dengan peran <strong className="uppercase">{selectedUserForDelete.role}</strong>?
            </p>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUserForDelete(null);
                }}
                disabled={isDeleting}
                className="px-3.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Hapus Akun'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
