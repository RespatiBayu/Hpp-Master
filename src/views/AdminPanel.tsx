import React, { useMemo, useState } from "react";
import { ActivitySquare, Check, Loader2, Pencil, Plus, Settings2, ShieldCheck, Trash2, Users } from "lucide-react";

import UserManagementSection from "../components/UserManagementSection";
import { canManageMenus, getRoleLabel } from "../lib/access";
import { businessMenuDefinitions } from "../lib/menu-config";
import type { AppMenuKey, BusinessMenuPackage, MenuVisibility } from "../lib/types";
import { useAppContext } from "../store/AppContext";

export default function AdminPanel() {
  const {
    businessId,
    businessName,
    businessRole,
    appUsers,
    activities,
    menuVisibility,
    menuPackages,
    updateMenuVisibility,
    createMenuPackage,
    updateMenuPackage,
    deleteMenuPackage,
    applyMenuPackage,
  } = useAppContext();

  const [savingMenuKey, setSavingMenuKey] = useState<AppMenuKey | null>(null);
  const [isPackageFormOpen, setIsPackageFormOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageName, setPackageName] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageVisibility, setPackageVisibility] = useState<MenuVisibility>(menuVisibility);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [applyingPackageId, setApplyingPackageId] = useState<string | null>(null);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);

  const activeMenuPackage = useMemo(() => menuPackages.find((menuPackage) => menuPackage.isActive) || null, [menuPackages]);
  const totalVisibleBusinesses = useMemo(() => {
    const ids = appUsers.map((user) => user.businessId || businessId || user.businessName || user.id);
    return new Set(ids).size;
  }, [appUsers, businessId]);

  const totalAdmins = appUsers.filter((user) => user.role === "admin").length;
  const totalSuperAdmins = appUsers.filter((user) => user.role === "super_admin").length;
  const totalPendingUsers = appUsers.filter((user) => user.status === "invited").length;

  const openCreatePackageForm = () => {
    setEditingPackageId(null);
    setPackageName("");
    setPackageDescription("");
    setPackageVisibility(menuVisibility);
    setIsPackageFormOpen(true);
  };

  const openEditPackageForm = (menuPackage: BusinessMenuPackage) => {
    setEditingPackageId(menuPackage.id);
    setPackageName(menuPackage.name);
    setPackageDescription(menuPackage.description || "");
    setPackageVisibility(menuPackage.menuVisibility);
    setIsPackageFormOpen(true);
  };

  const closePackageForm = () => {
    setEditingPackageId(null);
    setPackageName("");
    setPackageDescription("");
    setPackageVisibility(menuVisibility);
    setIsPackageFormOpen(false);
    setIsSavingPackage(false);
  };

  const handleToggleMenu = async (menuKey: AppMenuKey, nextValue: boolean) => {
    setSavingMenuKey(menuKey);

    try {
      await updateMenuVisibility(menuKey, nextValue);
    } finally {
      setSavingMenuKey(null);
    }
  };

  const handleTogglePackageMenu = (menuKey: AppMenuKey) => {
    setPackageVisibility((current) => ({
      ...current,
      [menuKey]: !current[menuKey],
    }));
  };

  const handleSubmitPackage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!packageName.trim()) return;

    setIsSavingPackage(true);

    try {
      const payload = {
        name: packageName.trim(),
        description: packageDescription.trim() || undefined,
        menuVisibility: packageVisibility,
      };

      if (editingPackageId) {
        await updateMenuPackage(editingPackageId, payload);
      } else {
        await createMenuPackage(payload);
      }

      closePackageForm();
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleApplyPackage = async (menuPackageId: string) => {
    setApplyingPackageId(menuPackageId);

    try {
      await applyMenuPackage(menuPackageId);
    } finally {
      setApplyingPackageId(null);
    }
  };

  const handleDeletePackage = async (menuPackage: BusinessMenuPackage) => {
    const confirmed = window.confirm(`Hapus paket menu "${menuPackage.name}"?`);
    if (!confirmed) return;

    setDeletingPackageId(menuPackage.id);

    try {
      await deleteMenuPackage(menuPackage.id);
      if (editingPackageId === menuPackage.id) {
        closePackageForm();
      }
    } finally {
      setDeletingPackageId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-500">
            {businessName || "Bisnis"} • role Anda: <span className="font-semibold text-slate-700">{getRoleLabel(businessRole)}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6 flex items-center">
            <div className="mr-3 rounded-lg bg-purple-50 p-2 text-purple-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{businessRole === "super_admin" ? "Ringkasan Pengguna Lintas Bisnis" : "Ringkasan Pengguna"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {businessRole === "super_admin"
                  ? `Karena role Anda Super Admin, data pengguna dirangkum dari ${totalVisibleBusinesses} bisnis yang dapat Anda lihat.`
                  : "Ringkasan ini hanya menampilkan user dalam bisnis aktif."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Total User</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{appUsers.length}</div>
            </div>
            <div className="rounded-xl bg-indigo-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-indigo-500">Super Admin</div>
              <div className="mt-2 text-2xl font-bold text-indigo-700">{totalSuperAdmins}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-blue-500">Admin</div>
              <div className="mt-2 text-2xl font-bold text-blue-700">{totalAdmins}</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-500">Pending</div>
              <div className="mt-2 text-2xl font-bold text-amber-700">{totalPendingUsers}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center">
            <div className="mr-3 rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ActivitySquare className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Ringkasan Aktivitas</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Log</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{activities.length}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-500">Aktivitas Terakhir</div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {activities.length > 0 ? activities[activities.length - 1].details : "Belum ada aktivitas tercatat."}
              </div>
            </div>
          </div>
        </div>
      </div>

      <UserManagementSection />

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start">
            <div className="mr-3 rounded-lg bg-sky-50 p-2 text-sky-600">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Paket Menu</h2>
              <p className="mt-1 text-sm text-slate-500">
                Super admin bisa membuat paket akses menu agar bisnis tidak perlu dibuka-tutup satu per satu.
              </p>
            </div>
          </div>
          {canManageMenus(businessRole) ? (
            <button
              type="button"
              onClick={openCreatePackageForm}
              className="inline-flex w-full items-center justify-center rounded-lg bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition-colors hover:bg-sky-100 sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" /> Buat Paket
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Hanya super admin
            </div>
          )}
        </div>

        {activeMenuPackage ? (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Check className="h-4 w-4" />
              Paket aktif saat ini: {activeMenuPackage.name}
            </div>
            <p className="mt-1 text-sm text-emerald-900/80">
              Jika Anda melakukan override manual per menu di bawah, status paket aktif akan dilepas otomatis.
            </p>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
            Belum ada paket menu yang aktif. Anda masih bisa mengatur akses manual per menu.
          </div>
        )}

        {isPackageFormOpen && canManageMenus(businessRole) && (
          <form onSubmit={handleSubmitPackage} className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/60 p-5">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{editingPackageId ? "Ubah Paket Menu" : "Buat Paket Menu Baru"}</h3>
                <p className="mt-1 text-sm text-slate-500">Pilih kombinasi menu yang akan dibundel dalam satu paket akses.</p>
              </div>
              <button
                type="button"
                onClick={closePackageForm}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-white"
              >
                Batal
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Nama Paket</label>
                <input
                  type="text"
                  required
                  value={packageName}
                  onChange={(event) => setPackageName(event.target.value)}
                  placeholder="Contoh: Paket Starter"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Deskripsi</label>
                <input
                  type="text"
                  value={packageDescription}
                  onChange={(event) => setPackageDescription(event.target.value)}
                  placeholder="Misalnya untuk bisnis yang hanya butuh penjualan dasar"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {businessMenuDefinitions.map((menu) => {
                const isChecked = packageVisibility[menu.id];

                return (
                  <label
                    key={menu.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                      isChecked ? "border-sky-300 bg-white" : "border-slate-200 bg-white/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleTogglePackageMenu(menu.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-900">{menu.label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-slate-500">{menu.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex sm:justify-end">
              <button
                type="submit"
                disabled={isSavingPackage}
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {isSavingPackage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingPackageId ? "Simpan Perubahan Paket" : "Simpan Paket Menu"}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {menuPackages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 lg:col-span-2">
              Belum ada paket menu. Buat paket pertama agar pengaturan akses bisnis lebih cepat.
            </div>
          ) : (
            menuPackages.map((menuPackage) => {
              const enabledMenus = businessMenuDefinitions.filter((menu) => menuPackage.menuVisibility[menu.id]);
              const isApplying = applyingPackageId === menuPackage.id;
              const isDeleting = deletingPackageId === menuPackage.id;

              return (
                <div key={menuPackage.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{menuPackage.name}</h3>
                        {menuPackage.isActive ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                            Aktif
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">
                        {menuPackage.description || "Tanpa deskripsi paket."}
                      </p>
                    </div>

                    {canManageMenus(businessRole) ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditPackageForm(menuPackage)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-sky-600"
                          title="Ubah paket"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleDeletePackage(menuPackage)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                          title="Hapus paket"
                        >
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {enabledMenus.length} dari {businessMenuDefinitions.length} menu aktif
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {enabledMenus.length === 0 ? (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">Tidak ada menu aktif</span>
                    ) : (
                      enabledMenus.map((menu) => (
                        <span key={menu.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                          {menu.label}
                        </span>
                      ))
                    )}
                  </div>

                  {canManageMenus(businessRole) ? (
                    <div className="mt-5 flex sm:justify-end">
                      <button
                        type="button"
                        disabled={menuPackage.isActive || isApplying}
                        onClick={() => void handleApplyPackage(menuPackage.id)}
                        className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors sm:w-auto ${
                          menuPackage.isActive
                            ? "cursor-default bg-emerald-100 text-emerald-700"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : menuPackage.isActive ? <Check className="mr-2 h-4 w-4" /> : null}
                        {menuPackage.isActive ? "Paket Sedang Aktif" : "Terapkan Paket"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start">
            <div className="mr-3 rounded-lg bg-sky-50 p-2 text-sky-600">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Override Per Menu</h2>
              <p className="mt-1 text-sm text-slate-500">Gunakan hanya jika Anda perlu penyesuaian akses di luar paket menu yang tersedia.</p>
            </div>
          </div>
          {!canManageMenus(businessRole) && (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Hanya super admin
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {businessMenuDefinitions.map((menu) => {
            const isEnabled = menuVisibility[menu.id];
            const isSaving = savingMenuKey === menu.id;

            return (
              <div key={menu.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{menu.label}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{menu.description}</p>
                  </div>

                  <button
                    type="button"
                    disabled={!canManageMenus(businessRole) || isSaving}
                    onClick={() => void handleToggleMenu(menu.id, !isEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors ${
                      isEnabled ? "bg-emerald-500" : "bg-slate-300"
                    } ${!canManageMenus(businessRole) ? "cursor-not-allowed opacity-60" : ""}`}
                    aria-label={`Toggle ${menu.label}`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                        isEnabled ? "translate-x-7" : "translate-x-1"
                      }`}
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" /> : null}
                    </span>
                  </button>
                </div>

                <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status: <span className={isEnabled ? "text-emerald-600" : "text-slate-500"}>{isEnabled ? "Tampil" : "Disembunyikan"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center">
          <div className="mr-3 rounded-lg bg-orange-50 p-2 text-orange-600">
            <ActivitySquare className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Log Aktivitas Sistem</h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-[820px] divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Waktu</th>
                <th className="w-48 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pengguna</th>
                <th className="w-32 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada aktivitas tercatat.
                  </td>
                </tr>
              ) : (
                [...activities].reverse().map((activity) => (
                  <tr key={activity.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(activity.timestamp).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{activity.userEmail}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600">
                      <span className="rounded-sm bg-slate-100 px-2 py-0.5">{activity.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{activity.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
