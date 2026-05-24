import React, { useState } from "react";
import { useAppContext } from "../store/AppContext";
import { Settings, ExternalLink, LogOut, DownloadCloud, Users, Plus, Trash2 } from "lucide-react";

export default function UserView() {
  const { user, spreadsheetId, setCustomSpreadsheetId, logout, appUsers, addAppUser, deleteAppUser } = useAppContext();
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("Staff");
  const [userToDelete, setUserToDelete] = useState<{id: string, email: string} | null>(null);

  const isSuperAdmin = user?.email === "bayu.respatih@gmail.com";

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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Akun & Pengaturan User</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="space-y-6 lg:col-span-1">
          {/* User Information */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center mb-4">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mr-3">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Info Akses Anda</h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Email</label>
                <p className="font-medium text-slate-900">{user?.email}</p>
              </div>
            </div>
            
            {/* Database & Sinkronisasi */}
            <div className="mt-8 pt-6 border-t border-slate-100">
               <div className="flex items-center mb-4">
                 <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600 mr-3">
                   <DownloadCloud className="w-5 h-5" />
                 </div>
                 <h3 className="text-sm font-bold text-slate-900">Database & Sinkronisasi</h3>
               </div>
               
               <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                 Masukkan ID Spreadsheet (dari file Google Sheets) Anda agar sistem terkoneksi ke template database Anda.
               </p>
               <div className="flex flex-col gap-2">
                 <input 
                   key={spreadsheetId || "empty"}
                   type="text" 
                   id="custom-sp-id-user"
                   placeholder="Contoh: 1BxiMVs0XRY..." 
                   defaultValue={spreadsheetId && spreadsheetId !== "LOCAL_STORAGE_DB" ? spreadsheetId : ""}
                   className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                 />
                 <button 
                   onClick={() => {
                     const val = (document.getElementById("custom-sp-id-user") as HTMLInputElement).value;
                     setCustomSpreadsheetId(val || null);
                     alert("ID Spreadsheet berhasil diperbarui.");
                   }}
                   className="w-full bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wide px-3 py-2 rounded-lg hover:bg-emerald-500 transition-colors"
                 >
                   Simpan & Tautkan
                 </button>
               </div>
               {spreadsheetId && spreadsheetId !== "LOCAL_STORAGE_DB" && (
                 <div className="mt-3 text-center">
                   <a 
                     href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="inline-flex items-center text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                   >
                     Buka Google Sheets Anda <ExternalLink className="ml-1 w-3 h-3" />
                   </a>
                 </div>
               )}
            </div>
          </div>
          
          {/* Logout Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center">
            <button
              onClick={logout}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Keluar dari Sistem
            </button>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* User Management */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="bg-purple-50 p-2 rounded-lg text-purple-600 mr-3">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Manajemen Pengguna Staf</h2>
              </div>
              <button
                onClick={() => setIsAddingUser(!isAddingUser)}
                disabled={!isSuperAdmin && appUsers.length >= 2}
                className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-bold transition-colors ${!isSuperAdmin && appUsers.length >= 2 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                <Plus className="mr-1 h-4 w-4" /> Tambah User
              </button>
            </div>

            {!isSuperAdmin && appUsers.length >= 2 && (
              <div className="mb-4 text-xs font-semibold text-orange-600 bg-orange-50 p-3 rounded-lg border border-orange-100">
                Batas maksimal penambahan user tercapai (maksimal 2 user).
              </div>
            )}

            {isAddingUser && (
              <form onSubmit={handleAddUser} className="mb-6 p-4 border border-blue-100 bg-blue-50/50 rounded-xl">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Tambah Staf Baru</h3>
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
                  User ini hanya akan ditambahkan pada Google Sheet / Database Anda saja.
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
                  {!isSuperAdmin && (
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 break-words flex items-center gap-2">{user?.email} <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-sm font-bold">You</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">Owner</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500">-</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Cabut Hak Akses?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus akses untuk pengguna <strong>{userToDelete.email}</strong>? Mereka tidak akan bisa lagi mencatat data.
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
