import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileDown, KeyRound, Loader2, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";

import { coerceAssistantText, subscribeAssistantPrefill } from "../lib/assistant";
import { canCreateUsers, canManageMember, canManageUsers, getAssignableRoles, getManagedRoleForActor, getRoleLabel } from "../lib/access";
import { parseBulkUserUploadFile } from "../lib/member-bulk-upload";
import type { AppUser, BulkUserUploadResult, BulkUserUploadRow, BusinessRole } from "../lib/types";
import { useAppContext } from "../store/AppContext";

const roleBadgeClass: Record<BusinessRole, string> = {
  super_admin: "bg-indigo-100 text-indigo-700",
  admin: "bg-blue-100 text-blue-700",
  staff: "bg-slate-100 text-slate-700",
};

const CREATE_NEW_BUSINESS_OPTION = "__new_business__";

const bulkUploadTemplateCsv = `email,password,business_name
admin@alphakitchen.com,AdminAlpha123,Alpha Kitchen
admin@betabites.com,AdminBeta123,Beta Bites`;

const getBulkRowNumbersLabel = (rows: BulkUserUploadRow[]) => rows.slice(0, 5).map((row) => row.rowNumber).join(", ");

const getBulkUploadValidationError = (rows: BulkUserUploadRow[]) => {
  const missingPasswordRows = rows.filter((row) => !row.password);
  if (missingPasswordRows.length > 0) {
    return `Password wajib diisi agar akun hasil bulk upload langsung aktif. Periksa baris ${getBulkRowNumbersLabel(missingPasswordRows)}.`;
  }

  const invalidRoleRows = rows.filter((row) => row.role && row.role !== "admin");
  if (invalidRoleRows.length > 0) {
    return `Bulk upload ini khusus admin bisnis. Kolom role hanya boleh berisi admin. Periksa baris ${getBulkRowNumbersLabel(invalidRoleRows)}.`;
  }

  return null;
};

export default function UserManagementSection() {
  const { businessId, businessName, businessRole, businesses, appUsers, addAppUser, bulkAddAppUsers, updateAppUser, deleteAppUser } = useAppContext();

  const canManageBusinessUsers = canManageUsers(businessRole);
  const isGlobalUserList = businessRole === "super_admin";
  const managedRole = useMemo(() => getManagedRoleForActor(businessRole), [businessRole]);
  const assignableRoles = useMemo(() => getAssignableRoles(businessRole), [businessRole]);
  const defaultRole = assignableRoles[0] || "staff";
  const currentBusiness = useMemo(
    () => businesses.find((business) => business.id === businessId) || null,
    [businessId, businesses]
  );
  const canCreateManagedUsers = canCreateUsers(businessRole, Boolean(currentBusiness?.allowAdminCreateStaff));
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

    return Array.from(mapped.entries()).map(([id, name]) => ({ id, name, allowAdminCreateStaff: true }));
  }, [appUsers, businessId, businessName, businesses]);

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<BusinessRole>(defaultRole);
  const [newBusinessId, setNewBusinessId] = useState(businessId || "");
  const [newPassword, setNewPassword] = useState("");
  const [newBusinessNameInput, setNewBusinessNameInput] = useState("");
  const [addUserError, setAddUserError] = useState<string | null>(null);
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
    setNewBusinessId((current) => {
      if (current === CREATE_NEW_BUSINESS_OPTION) return current;
      return current && availableBusinesses.some((business) => business.id === current) ? current : preferredBusinessId;
    });
    setBulkDefaultBusinessId((current) => (current && availableBusinesses.some((business) => business.id === current) ? current : preferredBusinessId));
  }, [availableBusinesses, businessId, isGlobalUserList]);

  useEffect(() => {
    if (!canCreateManagedUsers) {
      setIsAddingUser(false);
      setAddUserError(null);
    }
  }, [canCreateManagedUsers]);

  useEffect(() => {
    return subscribeAssistantPrefill((payload) => {
      if (payload.targetMenu !== "admin" || payload.formId !== "member_create") return;

      if (!canManageBusinessUsers || !canCreateManagedUsers) {
        payload.respond({
          appliedFields: [],
          missingFields: [],
          note: "Role Anda belum diizinkan membuat user baru dari panel admin.",
        });
        return;
      }

      const nextEmail = coerceAssistantText(payload.fields.email);
      const nextPassword = coerceAssistantText(payload.fields.password);
      const requestedBusinessId = coerceAssistantText(payload.fields.businessId);
      const nextBusinessName = coerceAssistantText(payload.fields.businessName);
      const wantsNewBusiness = payload.fields.createBusinessOnRequestedName === true;
      const validBusinessId = availableBusinesses.some((business) => business.id === requestedBusinessId) ? requestedBusinessId : "";
      const appliedFields: string[] = [];

      setIsAddingUser(true);
      setAddUserError(null);
      setNewEmail(nextEmail);
      setNewPassword(nextPassword);

      if (nextEmail.trim()) appliedFields.push("email");
      if (nextPassword.trim()) appliedFields.push("password");

      if (isGlobalUserList) {
        if (wantsNewBusiness) {
          setNewBusinessId(CREATE_NEW_BUSINESS_OPTION);
          setNewBusinessNameInput(nextBusinessName);
          if (nextBusinessName.trim()) appliedFields.push("businessName");
        } else {
          setNewBusinessId(validBusinessId || businessId || availableBusinesses[0]?.id || "");
          setNewBusinessNameInput("");
          if (validBusinessId) appliedFields.push("businessId");
        }
      } else {
        setNewBusinessId(businessId || "");
        setNewBusinessNameInput("");
      }

      payload.respond({
        appliedFields,
        missingFields: [],
        note:
          appliedFields.length > 0
            ? "Form tambah user sudah dibuka dan data yang jelas sudah diisi."
            : "Form tambah user sudah dibuka, tetapi email atau bisnis target masih belum cukup jelas.",
      });
    });
  }, [availableBusinesses, businessId, canCreateManagedUsers, canManageBusinessUsers, isGlobalUserList]);

  const previewBulkRows = bulkRows.slice(0, 5);
  const isCreatingNewBusiness = isGlobalUserList && newBusinessId === CREATE_NEW_BUSINESS_OPTION;
  const selectedBulkBusinessName =
    availableBusinesses.find((business) => business.id === bulkDefaultBusinessId)?.name || businessName || "bisnis default yang dipilih";
  const selectedSingleBusinessName = isCreatingNewBusiness
    ? newBusinessNameInput.trim() || "bisnis baru"
    : availableBusinesses.find((business) => business.id === newBusinessId)?.name || "yang dipilih";

  const getBulkRoleLabel = (role?: string) => {
    if (!role) return `${getRoleLabel("admin")} (default)`;
    if (role === "admin") {
      return getRoleLabel(role);
    }

    return role;
  };

  const getBusinessLabel = (businessIdForRow?: string, businessNameForRow?: string) => {
    if (businessNameForRow) return businessNameForRow;
    if (businessIdForRow) return availableBusinesses.find((business) => business.id === businessIdForRow)?.name || businessIdForRow;
    return selectedBulkBusinessName;
  };

  const sectionTitle = isGlobalUserList ? "Manajemen Admin Bisnis" : "Manajemen Staff";
  const sectionDescription = isGlobalUserList
    ? "Super admin hanya bisa membuat, melihat, mengubah, dan menghapus admin untuk setiap bisnis."
    : currentBusiness?.allowAdminCreateStaff
      ? "Admin bisnis hanya bisa membuat, melihat, mengubah, dan menghapus staff untuk bisnis ini."
      : "Pembuatan staff sedang dinonaktifkan oleh super admin. Anda masih bisa melihat, mengubah, dan menghapus staff bisnis ini.";
  const addFormTitle = isGlobalUserList ? "Tambah Admin Bisnis" : "Tambah Staff Baru";
  const addButtonLabel = isGlobalUserList ? "Tambah Admin" : "Tambah Staff";
  const emptyStateLabel = isGlobalUserList ? "Belum ada admin bisnis terdaftar." : "Belum ada staff terdaftar.";
  const editTitle = editingUser?.role === "admin" ? "Ubah Admin Bisnis" : "Ubah Staff";

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddUserError(null);
    if (!newEmail || !managedRole || !canCreateManagedUsers) return;
    if (isGlobalUserList && !newBusinessId) return;
    if (isCreatingNewBusiness && !newBusinessNameInput.trim()) {
      setAddUserError("Nama bisnis baru wajib diisi.");
      return;
    }

    try {
      await addAppUser(newEmail, managedRole, {
        password: newPassword || undefined,
        businessId: isGlobalUserList && !isCreatingNewBusiness ? newBusinessId : undefined,
        businessName: isCreatingNewBusiness ? newBusinessNameInput.trim() : undefined,
        createBusinessOnRequestedName: isCreatingNewBusiness,
      });
      setNewEmail("");
      setNewRole(defaultRole);
      setNewBusinessId(businessId || availableBusinesses[0]?.id || "");
      setNewBusinessNameInput("");
      setNewPassword("");
      setIsAddingUser(false);
    } catch (error: any) {
      setAddUserError(error.message || "User baru gagal disimpan.");
    }
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
      const validationError = getBulkUploadValidationError(parsedRows);
      setBulkRows(parsedRows);
      setBulkFileName(file.name);
      setBulkParseError(validationError);
    } catch (error: any) {
      setBulkRows([]);
      setBulkFileName(file.name);
      setBulkParseError(error.message || "File upload gagal dibaca.");
    }
  };

  const handleBulkUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isGlobalUserList || bulkRows.length === 0 || !bulkDefaultBusinessId || bulkParseError) return;

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
              <h2 className="text-lg font-bold text-slate-900">{sectionTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{sectionDescription}</p>
            </div>
          </div>

          {canManageBusinessUsers ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {isGlobalUserList ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingUser(false);
                    setAddUserError(null);
                    setIsBulkUploadOpen((current) => !current);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 sm:w-auto"
                >
                  <Upload className="mr-1 h-4 w-4" /> Bulk Upload
                </button>
              ) : null}
              {canCreateManagedUsers ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkUploadOpen(false);
                    setAddUserError(null);
                    setIsAddingUser((current) => !current);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100 sm:w-auto"
                >
                  <Plus className="mr-1 h-4 w-4" /> {addButtonLabel}
                </button>
              ) : (
                <div className="inline-flex items-center justify-center rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                  Pembuatan staff dinonaktifkan
                </div>
              )}
            </div>
          ) : null}
        </div>

        {!canManageBusinessUsers && (
          <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
            Hanya super admin atau admin yang bisa mengelola akses user bisnis.
          </div>
        )}

        {isAddingUser && canManageBusinessUsers && canCreateManagedUsers && (
          <form onSubmit={handleAddUser} className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-900">{addFormTitle}</h3>
            {addUserError ? (
              <div className="mb-3 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{addUserError}</span>
              </div>
            ) : null}
            <div
              className={`grid grid-cols-1 gap-3 ${
                isGlobalUserList
                  ? isCreatingNewBusiness
                    ? "md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                    : "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
                  : "md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
              }`}
            >
              <input
                type="email"
                required
                value={newEmail}
                onChange={(event) => {
                  setNewEmail(event.target.value);
                  setAddUserError(null);
                }}
                placeholder="Alamat Email User"
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
                {getRoleLabel(managedRole)}
              </div>
              {isGlobalUserList ? (
                <>
                  <select
                    required
                    value={newBusinessId}
                    onChange={(event) => {
                      setNewBusinessId(event.target.value);
                      setAddUserError(null);
                      if (event.target.value !== CREATE_NEW_BUSINESS_OPTION) {
                        setNewBusinessNameInput("");
                      }
                    }}
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
                    <option value={CREATE_NEW_BUSINESS_OPTION}>+ Buat Bisnis Baru</option>
                  </select>
                  {isCreatingNewBusiness ? (
                    <input
                      type="text"
                      required
                      value={newBusinessNameInput}
                      onChange={(event) => {
                        setNewBusinessNameInput(event.target.value);
                        setAddUserError(null);
                      }}
                      placeholder="Nama Bisnis Baru"
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  ) : null}
                </>
              ) : null}
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setAddUserError(null);
                }}
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
                ? ` Admin baru akan ditambahkan ke bisnis ${selectedSingleBusinessName}. Setiap bisnis hanya bisa memiliki 1 admin.`
                : businessName
                  ? ` Staff baru akan ditambahkan ke bisnis aktif: ${businessName}.`
                  : ""}
            </p>
          </form>
        )}

        {isBulkUploadOpen && isGlobalUserList && canManageBusinessUsers ? (
          <form onSubmit={handleBulkUpload} className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Bulk Upload Admin Bisnis</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
                  Upload file CSV atau TSV untuk membuat banyak admin bisnis sekaligus. Kolom wajib adalah <strong>email</strong> dan
                  <strong> password</strong>. Kolom <strong>business_name</strong> bersifat opsional. Jika kolom bisnis dikosongkan, sistem
                  memakai bisnis default yang Anda pilih di bawah. Kolom <strong>role</strong> tetap didukung, tetapi hanya menerima nilai
                  <strong>admin</strong>.
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
                Role kosong: {getRoleLabel("admin")}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">
                Password wajib di setiap baris
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">
                Bisnis default: {selectedBulkBusinessName}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">1 bisnis hanya 1 admin</span>
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
                          <td className="px-3 py-2 text-sm text-slate-500">{getBulkRoleLabel(row.role)}</td>
                          <td className="px-3 py-2 text-sm text-slate-500">{getBusinessLabel(undefined, row.businessName)}</td>
                          <td className="px-3 py-2 text-sm text-slate-500">{row.password ? "Aktif" : "Password wajib"}</td>
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
                            <td className="px-3 py-2 text-sm text-slate-600">{getBusinessLabel(error.businessId, error.businessName)}</td>
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
                    {emptyStateLabel}
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
            <h3 className="mb-2 text-lg font-bold text-slate-900">{editTitle}</h3>
            <p className="mb-6 text-sm text-slate-600">
              Perbarui password atau aktivasi akun untuk <strong>{editingUser.email}</strong>.
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
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                  {getRoleLabel(editRole)}
                </div>
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
                    : "Kosongkan bila Anda tidak ingin mengganti password."}
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
