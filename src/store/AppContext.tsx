import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { appApi, type BootstrapPayload } from "../lib/api";
import { type AuthUser, emailPasswordSignIn, emailPasswordSignUp, initAuth, logout as logoutAuth } from "../lib/auth";
import type { AppUser, Expense, Item, Production, Purchase, Sale, UserActivity } from "../lib/types";

interface AppState {
  items: Item[];
  purchases: Purchase[];
  productions: Production[];
  sales: Sale[];
  expenses: Expense[];
  appUsers: AppUser[];
  activities: UserActivity[];
  user: AuthUser | null;
  businessName: string | null;
  businessRole: "owner" | "admin" | "staff" | null;
  needsAuth: boolean;
  isLoading: boolean;
  error: string | null;
  loginError: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, businessName?: string) => Promise<void>;
  logout: () => Promise<void>;
  addItem: (item: Omit<Item, "id">) => Promise<void>;
  editItem: (id: string, updatedItem: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, "id">) => Promise<void>;
  editPurchase: (id: string, updatedPurchase: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  addProduction: (production: Omit<Production, "id">) => Promise<void>;
  addSale: (sale: Omit<Sale, "id">) => Promise<void>;
  editSale: (id: string, updatedSale: Partial<Sale>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  editExpense: (id: string, updatedExpense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  addAppUser: (email: string, role: string) => Promise<void>;
  deleteAppUser: (id: string) => Promise<void>;
  logActivity: (action: string, details: string) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

const emptyCollections = {
  items: [] as Item[],
  purchases: [] as Purchase[],
  productions: [] as Production[],
  sales: [] as Sale[],
  expenses: [] as Expense[],
  appUsers: [] as AppUser[],
  activities: [] as UserActivity[],
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessRole, setBusinessRole] = useState<"owner" | "admin" | "staff" | null>(null);
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

  const resetState = () => {
    setUser(null);
    setBusinessName(null);
    setBusinessRole(null);
    setItems(emptyCollections.items);
    setPurchases(emptyCollections.purchases);
    setProductions(emptyCollections.productions);
    setSales(emptyCollections.sales);
    setExpenses(emptyCollections.expenses);
    setAppUsers(emptyCollections.appUsers);
    setActivities(emptyCollections.activities);
  };

  const applyBootstrap = (payload: BootstrapPayload) => {
    setUser(payload.user);
    setBusinessName(payload.business.name);
    setBusinessRole(payload.business.role);
    setItems(payload.items);
    setPurchases(payload.purchases);
    setProductions(payload.productions);
    setSales(payload.sales);
    setExpenses(payload.expenses);
    setAppUsers(payload.appUsers);
    setActivities(payload.activities);
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

  const signUpWithEmail = async (email: string, password: string, newBusinessName?: string) => {
    try {
      setLoginError(null);
      const result = await emailPasswordSignUp(email, password, newBusinessName);
      if (!result) return;

      setUser(result.user);
      setNeedsAuth(false);
      await initializeData();
    } catch (err: any) {
      console.error("Email signup failed:", err);
      setLoginError(err.message || "Gagal membuat akun bisnis.");
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
    setItems((prev) => [...prev, created]);
    await logActivity("ADD_ITEM", `Menambahkan barang: ${created.name}`);
  };

  const editItem = async (id: string, updatedItem: Partial<Item>) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;

    const saved = await appApi.items.update(id, {
      name: updatedItem.name ?? current.name,
      type: updatedItem.type ?? current.type,
      unit: updatedItem.unit ?? current.unit,
      minQty: updatedItem.minQty ?? current.minQty,
      sellingPrice: updatedItem.sellingPrice ?? current.sellingPrice,
    });

    setItems((prev) => prev.map((item) => (item.id === id ? saved : item)));
    await logActivity("EDIT_ITEM", `Mengubah barang: ${saved.name}`);
  };

  const deleteItem = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) return;

    await appApi.items.remove(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    await logActivity("DELETE_ITEM", `Menghapus barang: ${current.name}`);
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

  const addAppUser = async (email: string, role: string) => {
    const created = await appApi.members.create(email, role);
    setAppUsers((prev) => [...prev, created]);
    await logActivity(
      "ADD_USER",
      created.status === "invited"
        ? `Mengundang user baru: ${created.email} (${created.role})`
        : `Menambahkan user baru: ${created.email} (${created.role})`
    );
  };

  const deleteAppUser = async (id: string) => {
    const current = appUsers.find((member) => member.id === id);
    if (!current) return;

    await appApi.members.remove(id);
    setAppUsers((prev) => prev.filter((member) => member.id !== id));
    await logActivity("DELETE_USER", `Mencabut akses user: ${current.email}`);
  };

  return (
    <AppContext.Provider
      value={{
        items,
        purchases,
        productions,
        sales,
        expenses,
        appUsers,
        activities,
        user,
        businessName,
        businessRole,
        needsAuth,
        isLoading,
        error,
        loginError,
        loginWithEmail,
        signUpWithEmail,
        logout,
        addItem,
        editItem,
        deleteItem,
        addPurchase,
        editPurchase,
        deletePurchase,
        addProduction,
        addSale,
        editSale,
        deleteSale,
        addExpense,
        editExpense,
        deleteExpense,
        refreshData,
        addAppUser,
        deleteAppUser,
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
