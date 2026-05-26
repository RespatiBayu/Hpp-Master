import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, LayoutDashboard, type LucideIcon, UserCircle, Settings, LogOut, Loader2, Package, ShoppingCart, Activity, FilePlus, Receipt, Calculator, Menu, PanelLeftClose, PanelLeftOpen, Store, X } from "lucide-react";

import FloatingAssistant from "./components/FloatingAssistant";
import { isAssistantSupportedMenu, type AssistantMenuTarget } from "./lib/assistant";
import { getRoleLabel } from "./lib/access";
import { businessMenuDefinitions } from "./lib/menu-config";
import type { AppMenuKey } from "./lib/types";
import { useAppContext } from "./store/AppContext";
import Dashboard from "./views/Dashboard";
import InventoryView from "./views/InventoryView";
import PurchasesView from "./views/PurchasesView";
import ProductionsView from "./views/ProductionsView";
import SalesView from "./views/SalesView";
import PosView from "./views/PosView";
import ExpensesView from "./views/ExpensesView";
import AdminPanel from "./views/AdminPanel";
import LoginView from "./views/LoginView";
import BusinessCalculatorView from "./views/BusinessCalculatorView";

type MainTabKey = AppMenuKey | "admin";

export default function MainApp() {
  const { user, businessName, businessRole, menuVisibility, needsAuth, isLoading, logout } = useAppContext();
  const [activeTab, setActiveTab] = useState<MainTabKey>("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("hpp-sidebar-collapsed") === "1";
  });
  const accountPanelRef = useRef<HTMLDivElement | null>(null);

  const menuIcons: Record<AppMenuKey, LucideIcon> = {
    dashboard: LayoutDashboard,
    inventory: Package,
    purchases: ShoppingCart,
    productions: Activity,
    sales: FilePlus,
    pos: Store,
    expenses: Receipt,
    calculator: Calculator,
  } as const;

  const tabs = useMemo(() => {
    const businessTabs: Array<{ id: MainTabKey; label: string; icon: LucideIcon }> = businessMenuDefinitions
      .filter((menu) => menuVisibility[menu.id])
      .map((menu) => ({
        id: menu.id,
        label: menu.label,
        icon: menuIcons[menu.id],
      }));
    const nextTabs = [...businessTabs];

    if (businessRole === "super_admin" || businessRole === "admin") {
      nextTabs.push({ id: "admin", label: "Admin Panel", icon: Settings });
    }

    return nextTabs;
  }, [businessRole, menuVisibility]);

  const activeTabMeta = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) || tabs[0] || null,
    [activeTab, tabs]
  );
  const assistantVisibleMenus = useMemo(
    () =>
      tabs
        .filter((tab) => isAssistantSupportedMenu(tab.id))
        .map((tab) => ({ id: tab.id as AssistantMenuTarget, label: tab.label })),
    [tabs]
  );

  useEffect(() => {
    if (tabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab(tabs[0]?.id || "dashboard");
  }, [activeTab, tabs]);

  useEffect(() => {
    window.localStorage.setItem("hpp-sidebar-collapsed", isSidebarCollapsed ? "1" : "0");
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
    setIsAccountPanelOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isMobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (!isAccountPanelOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountPanelRef.current?.contains(event.target as Node)) {
        setIsAccountPanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountPanelOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountPanelOpen]);

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
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900 font-sans">
      {isMobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex max-w-[85vw] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl transition-all duration-300 lg:static lg:z-auto lg:max-w-none lg:shadow-none ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isSidebarCollapsed ? "w-72 lg:w-24" : "w-72 lg:w-64"}`}
      >
        <div className={`flex h-16 shrink-0 items-center border-b border-slate-100 px-4 ${isSidebarCollapsed ? "justify-between lg:justify-center" : "justify-between gap-3"}`}>
          <div className={`flex min-w-0 items-center gap-3 ${isSidebarCollapsed ? "lg:justify-center" : ""}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">H</div>
            <div className={isSidebarCollapsed ? "lg:hidden" : ""}>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">HPP Master</h1>
              <p className="text-xs text-slate-400">Manajemen laba rugi UMKM</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
              aria-label={isSidebarCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  title={isSidebarCollapsed ? tab.label : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  } ${isSidebarCollapsed ? "lg:justify-center lg:px-3" : ""}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-emerald-700" : "text-slate-400"} ${isSidebarCollapsed ? "" : "mr-3"}`} />
                  <span className={`truncate ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className={`shrink-0 border-t border-slate-100 bg-white p-5 ${isSidebarCollapsed ? "lg:p-3" : ""}`}>
            <div className={`flex items-center gap-3 rounded-xl bg-slate-100 p-3 ${isSidebarCollapsed ? "lg:justify-center lg:px-3 lg:py-3" : ""}`}>
              <div className="h-2 w-2 shrink-0 rounded-full bg-green-500 animate-pulse" />
              <span className={`text-xs font-semibold text-slate-600 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>Terhubung ke Postgres</span>
            </div>

            {businessName ? (
              <div className={`mt-3 text-[11px] font-semibold text-slate-400 ${isSidebarCollapsed ? "lg:hidden" : "truncate"}`}>
                {businessName}
              </div>
            ) : null}

          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 lg:hidden"
                aria-label="Buka menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 lg:inline-flex"
                aria-label={isSidebarCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {businessName || "HPP Master"}
                </p>
                <h2 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                  {activeTabMeta?.label || "Dashboard"}
                </h2>
              </div>
            </div>

            <div ref={accountPanelRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsAccountPanelOpen((current) => !current)}
                className={`flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-slate-50 ${
                  isAccountPanelOpen ? "bg-slate-50" : ""
                }`}
                title="Akun & Pengaturan"
                aria-label="Akun & Pengaturan"
                aria-expanded={isAccountPanelOpen}
              >
                <div className="hidden min-w-0 text-right sm:block">
                  <div className="truncate text-sm font-medium text-slate-800">{user?.displayName || "User UMKM"}</div>
                  <div className="truncate text-xs text-slate-400">{user?.email || "-"}</div>
                </div>
                <UserCircle className="h-8 w-8 shrink-0 text-slate-400" />
                <ChevronUp className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isAccountPanelOpen ? "" : "rotate-180"}`} />
              </button>

              {isAccountPanelOpen ? (
                <div className="absolute right-0 top-full z-40 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-bold text-slate-900">Akun & Pengaturan</div>
                    <div className="mt-1 text-xs text-slate-500">Kelola akses akun Anda dari panel ini.</div>
                  </div>

                  <div className="space-y-4 px-4 py-4">
                    <div className="rounded-xl border border-slate-100 bg-white p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <UserCircle className="h-10 w-10 text-slate-300" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{user?.displayName || "User UMKM"}</div>
                          <div className="truncate text-sm text-slate-500">{user?.email || "-"}</div>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Bisnis Aktif</div>
                          <div className="mt-1 font-medium text-slate-800">{businessName || "-"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Peran</div>
                          <div className="mt-1 font-medium text-slate-800">{getRoleLabel(businessRole)}</div>
                        </div>
                      </div>
                    </div>

                    {businessRole === "super_admin" || businessRole === "admin" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("admin");
                          setIsAccountPanelOpen(false);
                        }}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Buka Admin Panel
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={logout}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Keluar dari Sistem
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "inventory" && <InventoryView />}
            {activeTab === "purchases" && <PurchasesView />}
            {activeTab === "productions" && <ProductionsView />}
            {activeTab === "sales" && <SalesView />}
            {activeTab === "pos" && <PosView />}
            {activeTab === "expenses" && <ExpensesView />}
            {activeTab === "calculator" && <BusinessCalculatorView />}
            {activeTab === "admin" && <AdminPanel />}
          </div>
        </div>
      </main>

      <FloatingAssistant
        activeMenu={activeTab}
        activeMenuLabel={activeTabMeta?.label || "Halaman"}
        visibleMenus={assistantVisibleMenus}
        onNavigate={(menu) => setActiveTab(menu)}
      />
    </div>
  );
}
