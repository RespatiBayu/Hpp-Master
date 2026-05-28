import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { appApi, type BootstrapPayload } from "../lib/api";
import { type AuthUser, emailPasswordSignIn, initAuth, logout as logoutAuth } from "../lib/auth";
import { getBusinessMenuLabel, createDefaultMenuVisibility } from "../lib/menu-config";
import type {
  AppMenuKey,
  AppUser,
  Category,
  BulkUserUploadResult,
  BulkUserUploadRow,
  BusinessMenuPackage,
  BusinessRole,
  BusinessSummary,
  Expense,
  Item,
  MenuVisibility,
  PosCheckoutLine,
  PosCheckoutResult,
  PosSettings,
  Production,
  Purchase,
  Sale,
  TelegramLinkResult,
  UserActivity,
} from "../lib/types";

interface AppState {
  items: Item[];
  categories: Category[];
  purchases: Purchase[];
  productions: Production[];
  sales: Sale[];
  expenses: Expense[];
  appUsers: AppUser[];
  activities: UserActivity[];
  user: AuthUser | null;
  businessId: string | null;
  businessName: string | null;
  businessRole: BusinessRole | null;
  businesses: BusinessSummary[];
  menuVisibility: MenuVisibility;
  menuPackages: BusinessMenuPackage[];
  posSettings: PosSettings;
  needsAuth: boolean;
  isLoading: boolean;
  error: string | null;
  loginError: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  addItem: (item: Omit<Item, "id">) => Promise<Item>;
  editItem: (id: string, updatedItem: Partial<Item>) => Promise<Item | undefined>;
  uploadItemPhoto: (id: string, dataUrl: string) => Promise<void>;
  deleteItemPhoto: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  createCategory: (name: string) => Promise<Category>;
  updateCategory: (id: string, name: string) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, "id">) => Promise<void>;
  editPurchase: (id: string, updatedPurchase: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  addProduction: (production: Omit<Production, "id">) => Promise<void>;
  addSale: (sale: Omit<Sale, "id">) => Promise<void>;
  checkoutPosSale: (payload: { date: string; lines: PosCheckoutLine[] }) => Promise<PosCheckoutResult>;
  editSale: (id: string, updatedSale: Partial<Sale>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  editExpense: (id: string, updatedExpense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  addAppUser: (
    email: string,
    role: BusinessRole,
    options?: {
      password?: string;
      businessId?: string;
      businessName?: string;
      createBusinessOnRequestedName?: boolean;
    }
  ) => Promise<void>;
  bulkAddAppUsers: (rows: BulkUserUploadRow[], defaultBusinessId?: string) => Promise<BulkUserUploadResult>;
  updateAppUser: (id: string, role: BusinessRole, password?: string) => Promise<void>;
  deleteAppUser: (id: string) => Promise<void>;
  updateBusinessStaffCreationAccess: (businessId: string, allowAdminCreateStaff: boolean) => Promise<void>;
  updateMenuVisibility: (menuKey: AppMenuKey, isEnabled: boolean) => Promise<void>;
  createMenuPackage: (payload: { name: string; description?: string; menuVisibility: MenuVisibility }) => Promise<void>;
  updateMenuPackage: (id: string, payload: { name: string; description?: string; menuVisibility: MenuVisibility }) => Promise<void>;
  deleteMenuPackage: (id: string) => Promise<void>;
  applyMenuPackage: (id: string) => Promise<void>;
  updatePosSettings: (payload: PosSettings) => Promise<void>;
  createTelegramLink: () => Promise<TelegramLinkResult>;
  logActivity: (action: string, details: string) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

const emptyCollections = {
  items: [] as Item[],
  categories: [] as Category[],
  purchases: [] as Purchase[],
  productions: [] as Production[],
  sales: [] as Sale[],
  expenses: [] as Expense[],
  appUsers: [] as AppUser[],
  activities: [] as UserActivity[],
  businesses: [] as BusinessSummary[],
  menuPackages: [] as BusinessMenuPackage[],
};

const emptyMenuVisibility = createDefaultMenuVisibility();
const defaultPosSettings: PosSettings = {
  paperWidth: "58mm",
  headerText: "",
  footerText: "",
  showCashier: true,
  showPaymentMethod: true,
};
const normalizeItemRecord = (item: Item): Item => ({
  ...item,
  category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : "Umum",
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessRole, setBusinessRole] = useState<BusinessRole | null>(null);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility>(emptyMenuVisibility);
  const [categories, setCategories] = useState<Category[]>([]);
  const [posSettings, setPosSettings] = useState<PosSettings>(defaultPosSettings);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [menuPackages, setMenuPackages] = useState<BusinessMenuPackage[]>([]);

  const resetState = () => {
    setUser(null);
    setBusinessId(null);
    setBusinessName(null);
    setBusinessRole(null);
    setBusinesses(emptyCollections.businesses);
    setItems(emptyCollections.items);
    setCategories(emptyCollections.categories);
    setPurchases(emptyCollections.purchases);
    setProductions(emptyCollections.productions);
    setSales(emptyCollections.sales);
    setExpenses(emptyCollections.expenses);
    setAppUsers(emptyCollections.appUsers);
    setActivities(emptyCollections.activities);
    setMenuPackages(emptyCollections.menuPackages);
    setMenuVisibility(emptyMenuVisibility);
    setPosSettings(defaultPosSettings);
  };

  const applyBootstrap = (payload: BootstrapPayload) => {
    setUser(payload.user);
    setBusinessId(payload.business.id);
    setBusinessName(payload.business.name);
    setBusinessRole(payload.business.role);
    setBusinesses(payload.businesses);
    setCategories(payload.categories || emptyCollections.categories);
    setItems(payload.items.map(normalizeItemRecord));
    setPurchases(payload.purchases);
    setProductions(payload.productions);
    setSales(payload.sales);
    setExpenses(payload.expenses);
    setAppUsers(payload.appUsers);
    setActivities(payload.activities);
    setMenuPackages(payload.menuPackages || emptyCollections.menuPackages);
    setMenuVisibility(payload.menuVisibility || emptyMenuVisibility);
    setPosSettings(payload.posSettings || defaultPosSettings);
  };

  const initializeData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await appApi.bootstrap();
      applyBootstrap(payload);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal memuat data bisnis.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      async (loggedInUser) => {
        setUser(loggedInUser);
        setNeedsAuth(false);
        setLoginError(null);
        await initializeData();
      },
      (message) => {
        resetState();
        setNeedsAuth(true);
        setLoginError(message || null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await appApi.bootstrap();
      applyBootstrap(payload);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menyegarkan data bisnis.");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setLoginError(null);
      const result = await emailPasswordSignIn(email, password);
      if (!result) return;

      setUser(result.user);
      setNeedsAuth(false);
      await initializeData();
    } catch (err: any) {
      console.error("Email login failed:", err);
      setLoginError(err.message || "Gagal masuk ke sistem.");
    }
  };

  const logout = async () => {
    await logoutAuth();
    resetState();
    setNeedsAuth(true);
    setError(null);
    setLoginError(null);
  };

  const logActivity = async (action: string, details: string) => {
    const activity = await appApi.activity.create(action, details);
    setActivities((prev) => [...prev, activity]);
  };

  const addItem = async (item: Omit<Item, "id">) => {
    const created = await appApi.items.create(item);
    const normalized = normalizeItemRecord(created);
    setItems((prev) => [...prev, normalized]);
    setCategories((prev) => {
      if (prev.some((entry) => entry.name === normalized.category)) return prev;
      return [...prev, { id: `tmp-${normalized.category}`, name: normalized.category, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
        .sort((left, right) => left.name.localeCompare(right.name));
    });
    await logActivity("ADD_ITEM", `Menambahkan barang: ${normalized.name} (${normalized.category})`);
    return normalized;
  };

  const editItem = async (id: string, updatedItem: Partial<Item>) => {
    const current = items.find((item) => item.id === id);
    if (!current) return undefined;
    const nextSellingPrice = Object.prototype.hasOwnProperty.call(updatedItem, "sellingPrice")
      ? updatedItem.sellingPrice
      : current.sellingPrice;

    const saved = normalizeItemRecord(
      await appApi.items.update(id, {
        name: updatedItem.name ?? current.name,
        category: updatedItem.category ?? current.category,
        type: updatedItem.type ?? current.type,
        unit: updatedItem.unit ?? current.unit,
        minQty: updatedItem.minQty ?? current.minQty,
        sellingPrice: nextSellingPrice,
      })
    );

    setItems((prev) => prev.map((item) => (item.id === id ? saved : item)));
    await logActivity("EDIT_ITEM", `Mengubah barang: ${saved.name} (${saved.category})`);
    return saved;
  };

  const uploadItemPhoto = async (id: string, dataUrl: string) => {
    const result = await appApi.items.uploadPhoto(id, dataUrl);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, hasPhoto: result.hasPhoto, photoUrl: result.photoUrl } : item)));
    const item = items.find((entry) => entry.id === id);
    await logActivity("UPLOAD_ITEM_PHOTO", `Mengunggah foto produk untuk ${item?.name || id}`);
  };

  const deleteItemPhoto = async (id: string) => {
    await appApi.items.removePhoto(id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, hasPhoto: false, photoUrl: undefined } : item)));
    const item = items.find((entry) => entry.id === id);
    await logActivity("DELETE_ITEM_PHOTO", `Menghapus foto produk untuk ${item?.name || id}`);
  };

  const deleteItem = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;

    await appApi.items.remove(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    await logActivity("DELETE_ITEM", `Menghapus barang: ${current.name}`);
  };

  const createCategory = async (name: string) => {
    const created = await appApi.categories.create(name);
    setCategories((prev) => [...prev, created].sort((left, right) => left.name.localeCompare(right.name)));
    await logActivity("CREATE_CATEGORY", `Membuat kategori baru: ${created.name}`);
    return created;
  };

  const updateCategory = async (id: string, name: string) => {
    const previous = categories.find((entry) => entry.id === id);
    const updated = await appApi.categories.update(id, name);
    setCategories((prev) => prev.map((entry) => (entry.id === id ? updated : entry)).sort((left, right) => left.name.localeCompare(right.name)));
    setItems((prev) => prev.map((item) => (item.category === previous?.name ? { ...item, category: updated.name } : item)));
    await logActivity("UPDATE_CATEGORY", `Mengubah kategori ${previous?.name || id} menjadi ${updated.name}`);
    return updated;
  };

  const deleteCategory = async (id: string) => {
    const current = categories.find((entry) => entry.id === id);
    await appApi.categories.remove(id);
    setCategories((prev) => prev.filter((entry) => entry.id !== id));
    await logActivity("DELETE_CATEGORY", `Menghapus kategori: ${current?.name || id}`);
  };

  const addPurchase = async (purchase: Omit<Purchase, "id">) => {
    const created = await appApi.purchases.create(purchase);
    setPurchases((prev) => [created, ...prev]);
    const item = items.find((entry) => entry.id === created.itemId);
    await logActivity("ADD_PURCHASE", `Pembelian ${item?.name || created.itemId} x${created.qty}`);
  };

  const editPurchase = async (id: string, updatedPurchase: Partial<Purchase>) => {
    const current = purchases.find((purchase) => purchase.id === id);
    if (!current) return;

    const saved = await appApi.purchases.update(id, {
      date: updatedPurchase.date ?? current.date,
      itemId: updatedPurchase.itemId ?? current.itemId,
      qty: updatedPurchase.qty ?? current.qty,
      totalCost: updatedPurchase.totalCost ?? current.totalCost,
    });

    setPurchases((prev) => prev.map((purchase) => (purchase.id === id ? saved : purchase)));
    await logActivity("EDIT_PURCHASE", `Mengubah pembelian ID: ${saved.id}`);
  };

  const deletePurchase = async (id: string) => {
    await appApi.purchases.remove(id);
    setPurchases((prev) => prev.filter((purchase) => purchase.id !== id));
    await logActivity("DELETE_PURCHASE", `Menghapus pembelian ID: ${id}`);
  };

  const addProduction = async (production: Omit<Production, "id">) => {
    const created = await appApi.productions.create(production);
    setProductions((prev) => [created, ...prev]);
    const item = items.find((entry) => entry.id === created.finishedItemId);
    await logActivity("ADD_PRODUCTION", `Produksi ${item?.name || created.finishedItemId} x${created.finishedQty}`);
  };

  const addSale = async (sale: Omit<Sale, "id">) => {
    const created = await appApi.sales.create(sale);
    setSales((prev) => [created, ...prev]);
    const item = items.find((entry) => entry.id === created.itemId);
    await logActivity("ADD_SALE", `Penjualan ${item?.name || created.itemId} x${created.qty}`);
  };

  const checkoutPosSale = async (payload: { date: string; lines: PosCheckoutLine[] }) => {
    const response = await appApi.pos.checkout(payload);
    setSales((prev) => [...response.sales.slice().reverse(), ...prev]);

    await logActivity(
      "POS_CHECKOUT",
      `Checkout PoS ${response.summary.totalLines} produk, ${response.summary.totalQty} item, total Rp ${response.summary.totalRevenue.toLocaleString()}`
    );

    return response;
  };

  const editSale = async (id: string, updatedSale: Partial<Sale>) => {
    const current = sales.find((sale) => sale.id === id);
    if (!current) return;

    const saved = await appApi.sales.update(id, {
      date: updatedSale.date ?? current.date,
      itemId: updatedSale.itemId ?? current.itemId,
      qty: updatedSale.qty ?? current.qty,
      totalRevenue: updatedSale.totalRevenue ?? current.totalRevenue,
    });

    setSales((prev) => prev.map((sale) => (sale.id === id ? saved : sale)));
    await logActivity("EDIT_SALE", `Mengubah penjualan ID: ${saved.id}`);
  };

  const deleteSale = async (id: string) => {
    await appApi.sales.remove(id);
    setSales((prev) => prev.filter((sale) => sale.id !== id));
    await logActivity("DELETE_SALE", `Menghapus penjualan ID: ${id}`);
  };

  const addExpense = async (expense: Omit<Expense, "id">) => {
    const created = await appApi.expenses.create(expense);
    setExpenses((prev) => [created, ...prev]);
    await logActivity("ADD_EXPENSE", `Mencatat beban: ${created.description}`);
  };

  const editExpense = async (id: string, updatedExpense: Partial<Expense>) => {
    const current = expenses.find((expense) => expense.id === id);
    if (!current) return;

    const saved = await appApi.expenses.update(id, {
      date: updatedExpense.date ?? current.date,
      description: updatedExpense.description ?? current.description,
      amount: updatedExpense.amount ?? current.amount,
    });

    setExpenses((prev) => prev.map((expense) => (expense.id === id ? saved : expense)));
    await logActivity("EDIT_EXPENSE", `Mengubah beban: ${saved.description}`);
  };

  const deleteExpense = async (id: string) => {
    const current = expenses.find((expense) => expense.id === id);
    await appApi.expenses.remove(id);
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    await logActivity("DELETE_EXPENSE", `Menghapus beban: ${current?.description || id}`);
  };

  const addAppUser = async (
    email: string,
    role: BusinessRole,
    options?: {
      password?: string;
      businessId?: string;
      businessName?: string;
      createBusinessOnRequestedName?: boolean;
    }
  ) => {
    const created = await appApi.members.create(email, role, options);
    setAppUsers((prev) => [...prev, created]);
    setBusinesses((prev) => {
      if (!created.businessId || !created.businessName || prev.some((business) => business.id === created.businessId)) {
        return prev;
      }

      return [...prev, { id: created.businessId, name: created.businessName, allowAdminCreateStaff: true }];
    });
    const targetBusinessSuffix = created.businessName ? ` di bisnis ${created.businessName}` : "";
    await logActivity(
      "ADD_USER",
      created.status === "invited"
        ? `Membuat undangan user: ${created.email} (${created.role})${targetBusinessSuffix}`
        : `Menambahkan user baru: ${created.email} (${created.role})${targetBusinessSuffix}`
    );
  };

  const bulkAddAppUsers = async (rows: BulkUserUploadRow[], defaultBusinessId?: string) => {
    const result = await appApi.members.bulkCreate(rows, defaultBusinessId);
    const defaultBusinessName = defaultBusinessId
      ? businesses.find((business) => business.id === defaultBusinessId)?.name || defaultBusinessId
      : businessName || undefined;

    if (result.created.length > 0) {
      setAppUsers((prev) => [...prev, ...result.created]);
      setBusinesses((prev) => {
        const next = [...prev];
        const seen = new Set(prev.map((business) => business.id));

        for (const member of result.created) {
          if (member.businessId && member.businessName && !seen.has(member.businessId)) {
            next.push({ id: member.businessId, name: member.businessName, allowAdminCreateStaff: true });
            seen.add(member.businessId);
          }
        }

        return next;
      });
    }

    await logActivity(
      "BULK_ADD_USERS",
      `Bulk upload user: ${result.createdCount} berhasil, ${result.failedCount} gagal${defaultBusinessName ? ` (default bisnis ${defaultBusinessName})` : ""}`
    );

    return result;
  };

  const updateAppUser = async (id: string, role: BusinessRole, password?: string) => {
    const current = appUsers.find((member) => member.id === id);
    if (!current) return;

    const updated = await appApi.members.update(id, role, password);
    setAppUsers((prev) => prev.map((member) => (member.id === id ? updated : member)));

    const details =
      current.role !== updated.role
        ? `Mengubah role user ${updated.email} dari ${current.role} menjadi ${updated.role}${updated.businessName ? ` di bisnis ${updated.businessName}` : ""}`
        : password
          ? `Memperbarui data akun user: ${updated.email}${updated.businessName ? ` di bisnis ${updated.businessName}` : ""}`
          : `Memperbarui data user: ${updated.email}${updated.businessName ? ` di bisnis ${updated.businessName}` : ""}`;

    await logActivity("UPDATE_USER", details);
  };

  const deleteAppUser = async (id: string) => {
    const current = appUsers.find((member) => member.id === id);
    if (!current) return;

    await appApi.members.remove(id);
    setAppUsers((prev) => prev.filter((member) => member.id !== id));
    await logActivity("DELETE_USER", `Mencabut akses user: ${current.email}${current.businessName ? ` dari bisnis ${current.businessName}` : ""}`);
  };

  const updateBusinessStaffCreationAccess = async (targetBusinessId: string, allowAdminCreateStaff: boolean) => {
    const currentBusiness = businesses.find((business) => business.id === targetBusinessId);
    const updated = await appApi.business.updateStaffCreationAccess(targetBusinessId, allowAdminCreateStaff);

    setBusinesses((prev) => prev.map((business) => (business.id === targetBusinessId ? updated : business)));

    await logActivity(
      "UPDATE_STAFF_CREATION_ACCESS",
      `${allowAdminCreateStaff ? "Mengizinkan" : "Menonaktifkan izin"} admin bisnis ${updated.name || currentBusiness?.name || targetBusinessId} untuk membuat staff`
    );
  };

  const updateMenuVisibility = async (menuKey: AppMenuKey, isEnabled: boolean) => {
    const response = await appApi.business.updateMenuVisibility(menuKey, isEnabled);
    setMenuVisibility(response.menuVisibility);
    setMenuPackages(response.menuPackages);
    await logActivity("UPDATE_MENU_VISIBILITY", `${isEnabled ? "Menampilkan" : "Menyembunyikan"} menu ${getBusinessMenuLabel(menuKey)}`);
  };

  const createMenuPackage = async (payload: { name: string; description?: string; menuVisibility: MenuVisibility }) => {
    const response = await appApi.business.createMenuPackage(payload);
    setMenuVisibility(response.menuVisibility);
    setMenuPackages(response.menuPackages);
    await logActivity("CREATE_MENU_PACKAGE", `Membuat user role: ${payload.name}`);
  };

  const updateMenuPackage = async (id: string, payload: { name: string; description?: string; menuVisibility: MenuVisibility }) => {
    const previousPackage = menuPackages.find((menuPackage) => menuPackage.id === id);
    const response = await appApi.business.updateMenuPackage(id, payload);
    setMenuVisibility(response.menuVisibility);
    setMenuPackages(response.menuPackages);
    await logActivity(
      "UPDATE_MENU_PACKAGE",
      `Memperbarui user role: ${previousPackage?.name || payload.name} menjadi ${payload.name}`
    );
  };

  const deleteMenuPackage = async (id: string) => {
    const currentPackage = menuPackages.find((menuPackage) => menuPackage.id === id);
    const response = await appApi.business.deleteMenuPackage(id);
    setMenuVisibility(response.menuVisibility);
    setMenuPackages(response.menuPackages);
    await logActivity("DELETE_MENU_PACKAGE", `Menghapus user role: ${currentPackage?.name || id}`);
  };

  const applyMenuPackage = async (id: string) => {
    const currentPackage = menuPackages.find((menuPackage) => menuPackage.id === id);
    const response = await appApi.business.applyMenuPackage(id);
    setMenuVisibility(response.menuVisibility);
    setMenuPackages(response.menuPackages);
    await logActivity("APPLY_MENU_PACKAGE", `Menerapkan user role: ${currentPackage?.name || id}`);
  };

  const updatePosSettings = async (payload: PosSettings) => {
    const updated = await appApi.pos.settings.update(payload);
    setPosSettings(updated);
    await logActivity("UPDATE_POS_SETTINGS", `Memperbarui pengaturan PoS (${updated.paperWidth})`);
  };

  const createTelegramLink = async () => {
    const result = await appApi.telegram.createLink();
    await logActivity("CREATE_TELEGRAM_LINK", `Membuat kode link Telegram baru: ${result.linkCode}`);
    return result;
  };

  return (
    <AppContext.Provider
      value={{
        items,
        categories,
        purchases,
        productions,
        sales,
        expenses,
        appUsers,
        activities,
        user,
        businessId,
        businessName,
        businessRole,
        businesses,
        menuVisibility,
        menuPackages,
        posSettings,
        needsAuth,
        isLoading,
        error,
        loginError,
        loginWithEmail,
        logout,
        addItem,
        editItem,
        uploadItemPhoto,
        deleteItemPhoto,
        deleteItem,
        createCategory,
        updateCategory,
        deleteCategory,
        addPurchase,
        editPurchase,
        deletePurchase,
        addProduction,
        addSale,
        checkoutPosSale,
        editSale,
        deleteSale,
        addExpense,
        editExpense,
        deleteExpense,
        refreshData,
        addAppUser,
        bulkAddAppUsers,
        updateAppUser,
        deleteAppUser,
        updateBusinessStaffCreationAccess,
        updateMenuVisibility,
        createMenuPackage,
        updateMenuPackage,
        deleteMenuPackage,
        applyMenuPackage,
        updatePosSettings,
        createTelegramLink,
        logActivity,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
