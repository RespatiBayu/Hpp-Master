import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileDown, KeyRound, Loader2, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";

import { canManageMember, canManageUsers, getAssignableRoles, getRoleLabel } from "../lib/access";
import { parseBulkUserUploadFile } from "../lib/member-bulk-upload";
import type { AppUser, BulkUserUploadResult, BulkUserUploadRow, BusinessRole } from "../lib/types";
import { useAppContext } from "../store/AppContext";

const roleBadgeClass: Record<BusinessRole, string> = {
  super_admin: "bg-indigo-100 text-indigo-700",
  admin: "bg-blue-100 text-blue-700",
  staff: "bg-slate-100 text-slate-700",
};

const bulkUploadTemplateCsv = `email,role,password,business_name
owner@alphakitchen.com,super_admin,rahasia123,Alpha Kitchen
admin@alphakitchen.com,admin,admin123,Alpha Kitchen
staff@betabites.com,staff,,Beta Bites`;

export default function UserManagementSection() {
  const { businessId, businessName, businessRole, businesses, appUsers, addAppUser, bulkAddAppUsers, updateAppUser, deleteAppUser } = useAppContext();

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
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkUserUploadRow[]>([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);
  const [bulkUploadError, setBulkUploadError] = useState<string | null>(null);
  const [bulkDefaultBusinessId, setBulkDefaultBusinessId] = useState(businessId || "");
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkUserUploadResult | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editRole, setEditRole] = useState<BusinessRole>(defaultRole);
  const [editPassword, setEditPassword] = useState("");
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNewRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    if (!isGlobalUserList) {
      setNewBusinessId(businessId || "");
      setBulkDefaultBusinessId(businessId || "");
      return;
    }

    const preferredBusinessId = businessId || availableBusinesses[0]?.id || "";
    setNewBusinessId((current) => (current && availableBusinesses.some((business) => business.id === current) ? current : preferredBusinessId));
    setBulkDefaultBusinessId((current) => (current && availableBusinesses.some((business) => business.id === current) ? current : preferredBusinessId));
  }, [availableBusinesses, businessId, isGlobalUserList]);

  const previewBulkRows = bulkRows.slice(0, 5);
  const selectedBulkBusinessName =
    availableBusinesses.find((business) => business.id === bulkDefaultBusinessId)?.name || businessName || "bisnis default yang dipilih";

  const getBulkRoleLabel = (role?: string, businessNameForRow?: string) => {
    if (!role) return `${getRoleLabel(businessNameForRow ? "super_admin" : "staff")} (default)`;
    if (role === "super_admin" || role === "admin" || role === "staff") {
      return getRoleLabel(role);
    }

    return role;
  };

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

  const resetBulkUploadSelection = () => {
    setBulkRows([]);
    setBulkFileName("");
    setBulkParseError(null);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([bulkUploadTemplateCsv], { type: "text/csv;charset=utf-8;" });
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = blobUrl;
    anchor.download = "template-bulk-user.csv";
    anchor.click();

    window.URL.revokeObjectURL(blobUrl);
  };

  const handleBulkFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setBulkUploadResult(null);
    setBulkUploadError(null);

    if (!file) {
      resetBulkUploadSelection();
      return;
    }

    try {
      const parsedRows = parseBulkUserUploadFile(await file.text());
      setBulkRows(parsedRows);
      setBulkFileName(file.name);
      setBulkParseError(null);
    } catch (error: any) {
      setBulkRows([]);
      setBulkFileName(file.name);
      setBulkParseError(error.message || "File upload gagal dibaca.");
    }
  };

  const handleBulkUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isGlobalUserList || bulkRows.length === 0 || !bulkDefaultBusinessId) return;

    setIsUploadingBulk(true);
    setBulkUploadError(null);
    setBulkUploadResult(null);

    try {
      const result = await bulkAddAppUsers(bulkRows, bulkDefaultBusinessId);
      setBulkUploadResult(result);

      if (result.failedCount === 0) {
        resetBulkUploadSelection();
      }
    } catch (error: any) {
      setBulkUploadError(error.message || "Bulk upload user gagal diproses.");
    } finally {
      setIsUploadingBulk(false);
    }
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

          {canManageBusinessUsers ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {isGlobalUserList ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingUser(false);
                    setIsBulkUploadOpen((current) => !current);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 sm:w-auto"
                >
                  <Upload className="mr-1 h-4 w-4" /> Bulk Upload
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setIsBulkUploadOpen(false);
                  setIsAddingUser((current) => !current);
                }}
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100 sm:w-auto"
              >
                <Plus className="mr-1 h-4 w-4" /> Tambah User
              </button>
            </div>
          ) : null}
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

        {isBulkUploadOpen && isGlobalUserList && canManageBusinessUsers ? (
          <form onSubmit={handleBulkUpload} className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Bulk Upload User Super Admin</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
                  Upload file CSV atau TSV untuk membuat banyak user sekaligus. Kolom wajib hanya <strong>email</strong>. Kolom
                  <strong> role</strong>, <strong>password</strong>, dan <strong>business_name</strong> bersifat opsional. Jika
                  <strong> business_name</strong> diisi, sistem akan otomatis membuat bisnis baru untuk user tersebut. Jika kosong, sistem
                  memakai bisnis default yang Anda pilih di bawah.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <FileDown className="mr-1 h-4 w-4" /> Download Template
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">File CSV / TSV</span>
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  onChange={handleBulkFileChange}
                  className="block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-700"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Bisnis Default</span>
                <select
                  required
                  value={bulkDefaultBusinessId}
                  onChange={(event) => setBulkDefaultBusinessId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="" disabled>
                    Pilih Bisnis Default
                  </option>
                  {availableBusinesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isUploadingBulk || bulkRows.length === 0 || Boolean(bulkParseError) || !bulkDefaultBusinessId}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300 lg:w-auto"
                >
                  {isUploadingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Proses Upload
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">
                Role kosong: {getRoleLabel("super_admin")} untuk bisnis baru, selain itu {getRoleLabel("staff")}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">
                Password kosong akan membuat undangan user
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">
                Bisnis default: {selectedBulkBusinessName}
              </span>
            </div>

            {bulkFileName ? (
              <div className="mt-4 rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600">
                File terpilih: {bulkFileName}
              </div>
            ) : null}

            {bulkParseError ? (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{bulkParseError}</span>
              </div>
            ) : null}

            {bulkUploadError ? (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{bulkUploadError}</span>
              </div>
            ) : null}

            {bulkRows.length > 0 ? (
              <div className="mt-4 rounded-xl border border-white/80 bg-white/80 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Preview Upload</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Terdeteksi {bulkRows.length} baris data user. Menampilkan {previewBulkRows.length} baris pertama.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetBulkUploadSelection}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Ganti File
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-[720px] divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Baris</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Email</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Role</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Bisnis</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Status Awal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewBulkRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.email}`}>
                          <td className="px-3 py-2 text-sm text-slate-500">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-sm font-medium text-slate-900">{row.email || "-"}</td>
                          <td className="px-3 py-2 text-sm text-slate-500">{getBulkRoleLabel(row.role, row.businessName)}</td>
                          <td className="px-3 py-2 text-sm text-slate-500">
                            {row.businessName ? `Bisnis baru: ${row.businessName}` : selectedBulkBusinessName}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-500">{row.password ? "Aktif" : "Undangan"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {bulkUploadResult ? (
              <div
                className={`mt-4 rounded-xl border p-4 ${
                  bulkUploadResult.failedCount > 0 ? "border-amber-100 bg-amber-50/70" : "border-emerald-100 bg-emerald-50/70"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Hasil Bulk Upload</h4>
                    <p className="mt-1 text-xs text-slate-600">
                      {bulkUploadResult.createdCount} user berhasil dibuat dari {bulkUploadResult.total} baris upload.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-white px-2.5 py-1 text-emerald-700">Berhasil: {bulkUploadResult.createdCount}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-red-600">Gagal: {bulkUploadResult.failedCount}</span>
                  </div>
                </div>

                {bulkUploadResult.errors.length > 0 ? (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-amber-100 bg-white">
                    <table className="min-w-[720px] divide-y divide-slate-100">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-amber-700">Baris</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-amber-700">Email</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-amber-700">Bisnis</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-amber-700">Pesan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkUploadResult.errors.map((error) => (
                          <tr key={`${error.rowNumber}-${error.email}-${error.message}`}>
                            <td className="px-3 py-2 text-sm text-slate-600">{error.rowNumber}</td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-900">{error.email || "-"}</td>
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {error.businessName ? `Bisnis baru: ${error.businessName}` : selectedBulkBusinessName}
                            </td>
                            <td className="px-3 py-2 text-sm text-red-600">{error.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        ) : null}

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
