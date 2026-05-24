import React from "react";
import { ActivitySquare, Users } from "lucide-react";

import { useAppContext } from "../store/AppContext";

export default function AdminPanel() {
  const { businessName, businessRole, appUsers, activities } = useAppContext();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-500">
            {businessName || "Bisnis"} • role Anda: <span className="font-semibold capitalize">{businessRole || "-"}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center">
            <div className="mr-3 rounded-lg bg-purple-50 p-2 text-purple-600">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Ringkasan Pengguna</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Total User</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{appUsers.length}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-blue-500">Admin</div>
              <div className="mt-2 text-2xl font-bold text-blue-700">{appUsers.filter((user) => user.role === "admin").length}</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-500">Undangan Pending</div>
              <div className="mt-2 text-2xl font-bold text-amber-700">{appUsers.filter((user) => user.status === "invited").length}</div>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Log</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{activities.length}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 sm:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-500">Aktivitas Terakhir</div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {activities.length > 0 ? activities[activities.length - 1].details : "Belum ada aktivitas tercatat."}
              </div>
            </div>
          </div>
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
          <table className="min-w-full divide-y divide-slate-100">
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
