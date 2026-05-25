import React, { useEffect, useMemo, useState } from "react";
import { KeyRound, LogOut, Pencil, Plus, Settings, Trash2, Users } from "lucide-react";

import { canManageMember, canManageUsers, getAssignableRoles, getRoleLabel } from "../lib/access";
import type { AppUser, BusinessRole } from "../lib/types";
import { useAppContext } from "../store/AppContext";

const roleBadgeClass: Record<BusinessRole, string> = {
  super_admin: "bg-indigo-100 text-indigo-700",
  admin: "bg-blue-100 text-blue-700",
  staff: "bg-slate-100 text-slate-700",
};

export default function UserView() {
  const { user, businessName, businessRole, logout, appUsers, addAppUser, updateAppUser, deleteAppUser } = useAppContext();

  const canManageBusinessUsers = canManageUsers(businessRole);
  const assignableRoles = useMemo(() => getAssignableRoles(businessRole), [businessRole]);
  const defaultRole = assignableRoles[0] || "staff";

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<BusinessRole>(defaultRole);
  const [newPassword, setNewPassword] = useState("");
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editRole, setEditRole] = useState<BusinessRole>(defaultRole);
  const [editPassword, setEditPassword] = useState("");
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    setNewRole(defaultRole);
  }, [defaultRole]);

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newEmail) return;

    await addAppUser(newEmail, newRole, newPassword || undefined);
    setNewEmail("");
    setNewRole(defaultRole);
    setNewPassword("");
    setIsAddingUser(false);
  };

  const startEditUser = (member: AppUser) => {
    setEditingUser(member);
    setEditRole(member.role);
    setEditPassword("");
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    await updateAppUser(editingUser.id, editRole, editPassword || undefined);
    setEditingUser(null);
    setEditPassword("");
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    await deleteAppUser(userToDelete.id);
    setUserToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Akun & Pengaturan</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center">
              <div className="mr-3 rounded-lg bg-blue-50 p-2 text-blue-600">
                <Settings className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Info Akses Anda</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Email</label>
                <p className="font-medium text-slate-900">{user?.email}</p>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Bisnis Aktif</label>
                <p className="font-medium text-slate-900">{businessName || "-"}</p>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Peran</label>
                <p className="font-medium text-slate-900">{getRoleLabel(businessRole)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <button
              onClick={logout}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-50 px-6 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Keluar dari Sistem
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="mr-3 rounded-lg bg-purple-50 p-2 text-purple-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Pengguna Bisnis</h2>
                  <p className="mt-1 text-sm text-slate-500">Super admin bisa mengelola admin dan staff. Admin hanya bisa mengelola staff.</p>
                </div>
              </div>

              {canManageBusinessUsers && (
                <button
                  onClick={() => setIsAddingUser((current) => !current)}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100"
                >
                  <Plus className="mr-1 h-4 w-4" /> Tambah User
                </button>
              )}
            </div>

            {!canManageBusinessUsers && (
              <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                Hanya super admin atau admin yang bisa mengelola akses user bisnis.
              </div>
            )}

            {isAddingUser && canManageBusinessUsers && (
              <form onSubmit={handleAddUser} className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-900">Tambah User Baru</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="Alamat Email User"
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <select
                    value={newRole}
                    onChange={(event) => setNewRole(event.target.value as BusinessRole)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {getRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="password"
                    minLength={6}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Password opsional"
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500">
                    Simpan
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Isi password jika akun ingin langsung aktif. Jika dikosongkan, user akan tersimpan sebagai undangan dan bisa diaktifkan nanti dari panel ini.
                </p>
              </form>
            )}

            <div className="flex-1 overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tgl Ditambahkan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {appUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        Belum ada user terdaftar.
                      </td>
                    </tr>
                  ) : (
                    appUsers.map((member) => {
                      const canManageThisMember = canManageMember(businessRole, member.role);

                      return (
                        <tr key={member.id}>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{member.email}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${roleBadgeClass[member.role]}`}>
                              {getRoleLabel(member.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                member.status === "invited" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {member.status === "invited" ? "Menunggu Aktivasi" : "Aktif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{new Date(member.createdAt).toLocaleDateString("id-ID")}</td>
                          <td className="px-4 py-3 text-right text-sm">
                            {canManageThisMember ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => startEditUser(member)}
                                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                  title="Ubah user"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setUserToDelete({ id: member.id, email: member.email })}
                                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title="Cabut hak akses"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Ubah User</h3>
            <p className="mb-6 text-sm text-slate-600">
              Perbarui role atau password untuk <strong>{editingUser.email}</strong>.
            </p>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Role</label>
                <select
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value as BusinessRole)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <KeyRound className="h-3.5 w-3.5" />
                  Password Baru
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  placeholder={editingUser.status === "invited" ? "Isi untuk aktivasi akun" : "Kosongkan jika tidak diubah"}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {editingUser.status === "invited"
                    ? "Mengisi password akan langsung mengaktifkan akun undangan ini."
                    : "Kosongkan bila Anda hanya ingin mengganti role tanpa reset password."}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Cabut Hak Akses?</h3>
            <p className="mb-6 text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus akses untuk pengguna <strong>{userToDelete.email}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
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
