import React, { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Users, UserCircle, Settings, LogOut, Loader2, Package, ShoppingCart, Activity, FilePlus, Receipt, Calculator } from "lucide-react";

import { businessMenuDefinitions } from "./lib/menu-config";
import { useAppContext } from "./store/AppContext";
import Dashboard from "./views/Dashboard";
import InventoryView from "./views/InventoryView";
import PurchasesView from "./views/PurchasesView";
import ProductionsView from "./views/ProductionsView";
import SalesView from "./views/SalesView";
import ExpensesView from "./views/ExpensesView";
import AdminPanel from "./views/AdminPanel";
import UserView from "./views/UserView";
import LoginView from "./views/LoginView";
import BusinessCalculatorView from "./views/BusinessCalculatorView";

export default function MainApp() {
  const { user, businessName, businessRole, menuVisibility, needsAuth, isLoading, logout } = useAppContext();
  const [activeTab, setActiveTab] = useState("dashboard");

  const menuIcons = {
    dashboard: LayoutDashboard,
    inventory: Package,
    purchases: ShoppingCart,
    productions: Activity,
    sales: FilePlus,
    expenses: Receipt,
    calculator: Calculator,
  } as const;

  const tabs = useMemo(() => {
    const businessTabs = businessMenuDefinitions
      .filter((menu) => menuVisibility[menu.id])
      .map((menu) => ({
        id: menu.id,
        label: menu.label,
        icon: menuIcons[menu.id],
      }));

    const nextTabs = [...businessTabs, { id: "user", label: "User", icon: Users }];

    if (businessRole === "super_admin" || businessRole === "admin") {
      nextTabs.push({ id: "admin", label: "Admin Panel", icon: Settings });
    }

    return nextTabs;
  }, [businessRole, menuVisibility]);

  useEffect(() => {
    if (tabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab(tabs[0]?.id || "user");
  }, [activeTab, tabs]);

  if (needsAuth) {
    return <LoginView />
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Memuat data bisnis dari database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
        <div className="flex h-16 shrink-0 items-center px-6 gap-2 border-b border-slate-100">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">H</div>
          <h1 className="text-xl font-bold tracking-tight">HPP Master</h1>
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
            <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                    <Icon className={`mr-3 h-5 w-5 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                    {tab.label}
                </button>
                );
            })}
            </nav>
            <div className="p-6 border-t border-slate-100 shrink-0 bg-white">
                <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold text-slate-600">Terhubung ke Postgres</span>
                </div>
                {businessName && <div className="text-[11px] font-semibold text-slate-400 mb-3 truncate">{businessName}</div>}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-slate-600">
                        <UserCircle className="w-8 h-8 text-slate-400 shrink-0 mr-2" />
                        <span className="truncate w-32 font-medium">{user?.displayName || user?.email || "User UMKM"}</span>
                    </div>
                    <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors shrink-0" title="Keluar">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-auto p-8">
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "inventory" && <InventoryView />}
            {activeTab === "purchases" && <PurchasesView />}
            {activeTab === "productions" && <ProductionsView />}
            {activeTab === "sales" && <SalesView />}
            {activeTab === "expenses" && <ExpensesView />}
            {activeTab === "calculator" && <BusinessCalculatorView />}
            {activeTab === "admin" && <AdminPanel />}
            {activeTab === "user" && <UserView />}
        </div>
      </main>
    </div>
  );
}
