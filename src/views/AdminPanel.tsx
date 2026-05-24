import React, { useState } from "react";
import { useAppContext } from "../store/AppContext";
import { Settings, ExternalLink, LogOut, DownloadCloud, Users, ActivitySquare, Plus, Trash2 } from "lucide-react";

export default function AdminPanel() {
  const { user, appUsers, activities, addAppUser, deleteAppUser } = useAppContext();
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("Staff");

  const [userToDelete, setUserToDelete] = useState<{id: string, email: string} | null>(null);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    await addAppUser(newEmail, newRole);
    setNewEmail("");
    setNewRole("Staff");
    setIsAddingUser(false);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      await deleteAppUser(userToDelete.id);
      setUserToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Admin Panel (Super Admin)
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        
        <div className="space-y-6">
          {/* User Management */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="bg-purple-50 p-2 rounded-lg text-purple-600 mr-3">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Semua Pengguna Terdaftar</h2>
              </div>
              <button
                onClick={() => setIsAddingUser(!isAddingUser)}
                className="inline-flex items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Plus className="mr-1 h-4 w-4" /> Tambah User
              </button>
            </div>

            {isAddingUser && (
              <form onSubmit={handleAddUser} className="mb-6 p-4 border border-blue-100 bg-blue-50/50 rounded-xl">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Tambah Pengguna Baru</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Alamat Email User"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-blue-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-blue-500 transition-colors">
                    Simpan
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  User yang ditambahkan di sini memiliki izin akses untuk mendata inventori. Harap informasikan password secara manual (jika menggunakan email/password) atau minta log in dengan akun Google.
                </p>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-100 flex-1">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tgl Ditambahkan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {appUsers.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">Belum ada user terdaftar.</td></tr>
                  ) : appUsers.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-500"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${u.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>{u.role}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(u.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          onClick={() => setUserToDelete({id: u.id, email: u.email})}
                          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Hak Akses"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Selalu tambahkan admin utama agar tidak bisa dihapus aksidental via panel */}
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 break-words flex items-center gap-2">bayu.respatih@gmail.com <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-sm font-bold">App Owner</span></td>
                    <td className="px-4 py-3 text-sm text-slate-500"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">Super Admin</span></td>
                    <td className="px-4 py-3 text-sm text-slate-500">System</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-300">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log Dashboard */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mt-6">
        <div className="flex items-center mb-6">
          <div className="bg-orange-50 p-2 rounded-lg text-orange-600 mr-3">
            <ActivitySquare className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Log Aktivitas Sistem</h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Waktu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Pengguna</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Aksi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {activities.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">Belum ada aktivitas tercatat.</td></tr>
              ) : [...activities].reverse().map(act => (
                <tr key={act.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(act.timestamp).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{act.userEmail}</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-sm">{act.action}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{act.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Cabut Hak Akses?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin menghabus akses untuk pengguna <strong>{userToDelete.email}</strong>? Mereka tidak akan bisa lagi mencatat data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-sm"
              >
                Ya, Cabut Akses
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
