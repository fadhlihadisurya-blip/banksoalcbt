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

  const handleImportSample = () => {
    const sample = `name,nis,classId,username,password
"Alifia Maharani",20241010,cls-xii-mipa-1,alifia,siswa123
"Bagas Triadi",20241011,cls-xii-mipa-1,bagas,siswa123
"Citra Lestari",20241012,cls-xii-mipa-2,citra,siswa123`;
    setCsvContent(sample);
  };

  const handleProcessImport = async () => {
    if (!csvContent.trim()) return;
    try {
      const lines = csvContent.trim().split('\n');
      const students: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length >= 3) {
          students.push({
            name: parts[0]?.replace(/^"|"$/g, '').trim(),
            nis: parts[1]?.trim(),
            classId: parts[2]?.trim() || classes[0]?.id,
            username: parts[3]?.trim() || parts[1]?.trim(),
            password: parts[4]?.trim() || 'siswa123',
          });
        }
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
                        <button
                          onClick={() => {
                            setSelectedUserForReset(u);
                            setNewPasswordInput('');
                            setShowResetModal(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Reset Password</span>
                        </button>
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
                <span>Tempelkan data CSV (name, nis, classId, username, password):</span>
                <button
                  onClick={handleImportSample}
                  className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Muat Format Contoh</span>
                </button>
              </div>

              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                rows={6}
                placeholder="name,nis,classId,username,password..."
                className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
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
    </div>
  );
};
