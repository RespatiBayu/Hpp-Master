import React, { useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";

import { canManageMember, canManageUsers, getAssignableRoles, getRoleLabel } from "../lib/access";
import type { AppUser, BusinessRole } from "../lib/types";
import { useAppContext } from "../store/AppContext";

const roleBadgeClass: Record<BusinessRole, string> = {
  super_admin: "bg-indigo-100 text-indigo-700",
  admin: "bg-blue-100 text-blue-700",
  staff: "bg-slate-100 text-slate-700",
};

export default function UserManagementSection() {
  const { businessId, businessName, businessRole, businesses, appUsers, addAppUser, updateAppUser, deleteAppUser } = useAppContext();

  const canManageBusinessUsers = canManageUsers(businessRole);
  const isGlobalUserList = businessRole === "super_admin";
  const assignableRoles = useMemo(() => getAssignableRoles(businessRole), [businessRole]);
  const defaultRole = assignableRoles[0] || "staff";
  const availableBusinesses = useMemo(() => {
    if (businesses.length > 0) return businesses;
    const mapped = new Map<string, string>();

    for (const member of appUsers) {
      if (member.businessId && member.businessName && !mapped.has(member.businessId)) {
        mapped.set(member.businessId, member.businessName);
      }
    }

    if (businessId && businessName && !mapped.has(businessId)) {
      mapped.set(businessId, businessName);
    }

    return Array.from(mapped.entries()).map(([id, name]) => ({ id, name }));
  }, [appUsers, businessId, businessName, businesses]);

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<BusinessRole>(defaultRole);
  const [newBusinessId, setNewBusinessId] = useState(businessId || "");
  const [newPassword, setNewPassword] = useState("");
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editRole, setEditRole] = useState<BusinessRole>(defaultRole);
  const [editPassword, setEditPassword] = useState("");
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    setNewRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    if (!isGlobalUserList) {
      setNewBusinessId(businessId || "");
      return;
    }

    const preferredBusinessId = businessId || availableBusinesses[0]?.id || "";
    setNewBusinessId((current) => (current && availableBusinesses.some((business) => business.id === current) ? current : preferredBusinessId));
  }, [availableBusinesses, businessId, isGlobalUserList]);

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newEmail) return;
    if (isGlobalUserList && !newBusinessId) return;

    await addAppUser(newEmail, newRole, newPassword || undefined, isGlobalUserList ? newBusinessId : undefined);
    setNewEmail("");
    setNewRole(defaultRole);
    setNewBusinessId(businessId || availableBusinesses[0]?.id || "");
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
    <>
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start">
            <div className="mr-3 rounded-lg bg-purple-50 p-2 text-purple-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{isGlobalUserList ? "Manajemen User Lintas Bisnis" : "Manajemen User"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isGlobalUserList
                  ? "Super admin sebagai pemilik platform bisa membuat, mengubah, dan menghapus user di semua bisnis."
                  : "Super admin bisa mengelola admin dan staff. Admin hanya bisa mengelola staff."}
              </p>
            </div>
          </div>

          {canManageBusinessUsers && (
            <button
              type="button"
              onClick={() => setIsAddingUser((current) => !current)}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100 sm:w-auto"
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
            <div
              className={`grid grid-cols-1 gap-3 ${
                isGlobalUserList
                  ? "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
                  : "md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
              }`}
            >
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
              {isGlobalUserList ? (
                <select
                  required
                  value={newBusinessId}
                  onChange={(event) => setNewBusinessId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="" disabled>
                    Pilih Bisnis
                  </option>
                  {availableBusinesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Password opsional"
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 md:w-auto">
                Simpan
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Isi password jika akun ingin langsung aktif. Jika dikosongkan, user akan tersimpan sebagai undangan dan bisa diaktifkan nanti dari panel ini.
              {isGlobalUserList
                ? ` User baru akan ditambahkan ke bisnis ${availableBusinesses.find((business) => business.id === newBusinessId)?.name || "yang dipilih"}.`
                : businessName
                  ? ` User baru akan ditambahkan ke bisnis aktif: ${businessName}.`
                  : ""}
            </p>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className={`divide-y divide-slate-100 ${isGlobalUserList ? "min-w-[920px]" : "min-w-[760px]"}`}>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                {isGlobalUserList ? (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bisnis</th>
                ) : null}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tgl Ditambahkan</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {appUsers.length === 0 ? (
                <tr>
                  <td colSpan={isGlobalUserList ? 6 : 5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada user terdaftar.
                  </td>
                </tr>
              ) : (
                appUsers.map((member) => {
                  const isCurrentBusinessMember = !member.businessId || member.businessId === businessId;
                  const canManageThisMember = canManageMember(businessRole, member.role);

                  return (
                    <tr key={member.id}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{member.email}</td>
                      {isGlobalUserList ? (
                        <td className="px-4 py-3 text-sm text-slate-500">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{member.businessName || "-"}</span>
                            {isCurrentBusinessMember ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                                Bisnis Aktif
                              </span>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
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
                              type="button"
                              onClick={() => startEditUser(member)}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                              title="Ubah user"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setUserToDelete({ id: member.id, email: member.email })}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Cabut hak akses"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-300">-</span>
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

      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Ubah User</h3>
            <p className="mb-6 text-sm text-slate-600">
              Perbarui role atau password untuk <strong>{editingUser.email}</strong>.
            </p>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              {editingUser.businessName ? (
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Bisnis</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                    {editingUser.businessName}
                  </div>
                </div>
              ) : null}
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

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
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
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
              >
                Ya, Cabut Akses
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
