import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Item, Purchase, Production, Sale, Expense, AppUser, UserActivity } from "../lib/types";
import { initAuth, getAccessToken, googleSignIn, logout as logoutAuth, emailPasswordSignIn, emailPasswordSignUp } from "../lib/auth";
import { User } from "firebase/auth";
import {
  findOrCreateDatabase,
  getSheetData,
  appendRow,
  updateRow,
  clearRow,
} from "../lib/sheets";

interface AppState {
  items: Item[];
  purchases: Purchase[];
  productions: Production[];
  sales: Sale[];
  expenses: Expense[];
  appUsers: AppUser[];
  activities: UserActivity[];
  user: User | null;
  needsAuth: boolean;
  isLoading: boolean;
  spreadsheetId: string | null;
  setCustomSpreadsheetId: (id: string | null) => void;
  error: string | null;
  loginError: string | null;
  login: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  addItem: (item: Omit<Item, "id">) => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, "id">) => Promise<void>;
  editPurchase: (id: string, updatedPurchase: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  editItem: (id: string, updatedItem: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addProduction: (prod: Omit<Production, "id">) => Promise<void>;
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

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);

  useEffect(() => {
    const unsubscribe = initAuth(
      async (loggedInUser, token) => {
        setUser(loggedInUser);
        setNeedsAuth(false);
        await initializeData(token, loggedInUser);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const initializeData = async (token: string, currentUser: User | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const storedCustomId = currentUser?.email ? localStorage.getItem(`HPP_CUSTOM_SPREADSHEET_${currentUser.email}`) : null;
      const spId = await findOrCreateDatabase(token, storedCustomId);
      setSpreadsheetId(spId);
      await loadAllData(spId, token, currentUser);
    } catch (err: any) {
      console.error(err);
      if (err.message === "UNAUTHORIZED_USER") {
        setLoginError("Akses ditolak: Email Anda belum didaftarkan oleh Admin.");
        await logoutAuth();
        setUser(null);
        setNeedsAuth(true);
        setSpreadsheetId(null);
      } else {
        setError("Gagal memuat database " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async (spId: string, token: string, currentUser: User | null) => {
    const [itemsRaw, purchasesRaw, productionsRaw, salesRaw, expensesRaw, usersRaw, activityRaw] = await Promise.all([
      getSheetData(spId, "Items", token),
      getSheetData(spId, "Purchases", token),
      getSheetData(spId, "Productions", token),
      getSheetData(spId, "Sales", token),
      getSheetData(spId, "Expenses", token),
      getSheetData(spId, "Users", token),
      getSheetData(spId, "Activity", token),
    ]);

    setItems(itemsRaw.slice(1).filter((row: any) => row && row[0]).map((row: any) => ({
      id: row[0], name: row[1], type: row[2], unit: row[3], minQty: Number(row[4]), sellingPrice: row[5] ? Number(row[5]) : undefined
    })));

    setPurchases(purchasesRaw.slice(1).filter((row: any) => row && row[0]).map((row: any) => ({
      id: row[0], date: row[1], itemId: row[2], qty: Number(row[3]), totalCost: Number(row[4])
    })));

    setProductions(productionsRaw.slice(1).filter((row: any) => row && row[0]).map((row: any) => ({
      id: row[0], date: row[1], finishedItemId: row[2], finishedQty: Number(row[3]), rawMaterialsJSON: row[4], overheadCost: Number(row[5]), totalHPP: Number(row[6])
    })));

    setSales(salesRaw.slice(1).filter((row: any) => row && row[0]).map((row: any) => ({
      id: row[0], date: row[1], itemId: row[2], qty: Number(row[3]), totalRevenue: Number(row[4])
    })));

    setExpenses(expensesRaw.slice(1).filter((row: any) => row && row[0]).map((row: any) => ({
      id: row[0], date: row[1], description: row[2], amount: Number(row[3])
    })));

    const users = usersRaw.slice(1).filter((row: any) => row && row[0]).map((row: any) => ({
      id: row[0], email: row[1], role: row[2], createdAt: row[3]
    }));

    if (currentUser) {
      const userEmail = currentUser.email || "";
      const isSuperAdmin = userEmail === "bayu.respatih@gmail.com";
      const isRegistered = users.some(u => u.email === userEmail);
      if (!isSuperAdmin && !isRegistered && userEmail !== "") {
        throw new Error("UNAUTHORIZED_USER");
      }
    }

    setAppUsers(users);

    setActivities(activityRaw.slice(1).filter((row: any) => row && row[0]).map((row: any) => ({
      id: row[0], timestamp: row[1], userEmail: row[2], action: row[3], details: row[4]
    })));
  };

  const refreshData = async () => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      setIsLoading(true);
      await loadAllData(spreadsheetId, token, user);
      setIsLoading(false);
    }
  };

  const [loginError, setLoginError] = useState<string | null>(null);

  const setCustomSpreadsheetId = (id: string | null) => {
    if (user?.email) {
      if (id) {
        localStorage.setItem(`HPP_CUSTOM_SPREADSHEET_${user.email}`, id);
      } else {
        localStorage.removeItem(`HPP_CUSTOM_SPREADSHEET_${user.email}`);
      }
      setSpreadsheetId(null);
      getAccessToken().then(token => {
        if (token) {
           initializeData(token, user);
        }
      })
    }
  };

  const login = async () => {
    try {
      setLoginError(null);
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        await initializeData(res.accessToken, res.user);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code === "auth/popup-closed-by-user" || err.message === "Login dibatalkan oleh pengguna.") {
         setLoginError("Login dibatalkan oleh Anda.");
      } else {
         setLoginError("Koneksi ditolak oleh Firebase. Pastikan email uji Anda sudah disetujui di Google Cloud Console sebagai 'Test User', atau periksa konfigurasi. Detail: " + err.message);
      }
    }
  };

  const loginWithEmail = async (e: string, p: string) => {
    try {
      setLoginError(null);
      const res = await emailPasswordSignIn(e, p);
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        await initializeData(res.accessToken, res.user);
      }
    } catch (err: any) {
      console.error("Email Login failed:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setLoginError("Email atau kata sandi salah, atau belum terdaftar.");
      } else {
        setLoginError(err.message || "Gagal masuk. Pastikan Firebase Authentication (Email/Password) telah diaktifkan.");
      }
    }
  }

  const signUpWithEmail = async (e: string, p: string) => {
    try {
      setLoginError(null);
      const res = await emailPasswordSignUp(e, p);
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        await initializeData(res.accessToken, res.user);
      }
    } catch (err: any) {
      console.error("Email Signup failed:", err);
      if (err.code === "auth/email-already-in-use") {
        setLoginError("Email sudah terdaftar. Silakan log in.");
      } else if (err.code === "auth/weak-password") {
        setLoginError("Kata sandi terlalu lemah (minimal 6 karakter).");
      } else {
        setLoginError(err.message || "Gagal mendaftar. Pastikan Firebase Authentication (Email/Password) aktif di konsol.");
      }
    }
  };

  const logout = async () => {
    await logoutAuth();
    setUser(null);
    setNeedsAuth(true);
    setSpreadsheetId(null);
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addItem = async (item: Omit<Item, "id">) => {
    const id = generateId();
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const row = [id, item.name, item.type, item.unit, item.minQty.toString(), item.sellingPrice ? item.sellingPrice.toString() : ""];
      await appendRow(spreadsheetId, "Items", row, token);
      setItems((prev) => [...prev, { ...item, id }]);
      await logActivity("ADD_ITEM", `Menambahkan barang: ${item.name}`);
    }
  };

  const editItem = async (id: string, updatedItem: Partial<Item>) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const itemIndex = items.findIndex(i => i.id === id);
      if (itemIndex === -1) return;
      
      const item = items[itemIndex];
      const newItem = { ...item, ...updatedItem };
      
      const rowIndex = itemIndex + 2; // +1 for 0-index, +1 for header line
      const row = [newItem.id, newItem.name, newItem.type, newItem.unit, newItem.minQty.toString(), newItem.sellingPrice ? newItem.sellingPrice.toString() : ""];
      
      await updateRow(spreadsheetId, `Items!A${rowIndex}:F${rowIndex}`, row, token);
      
      setItems(prev => {
        const newItems = [...prev];
        newItems[itemIndex] = newItem;
        return newItems;
      });
      await logActivity("EDIT_ITEM", `Mengubah barang: ${newItem.name}`);
    }
  };

  const deleteItem = async (id: string) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const itemIndex = items.findIndex(i => i.id === id);
      if (itemIndex === -1) return;
      const itemName = items[itemIndex].name;
      
      const rowIndex = itemIndex + 2; // +1 for 0-index, +1 for header line
      await clearRow(spreadsheetId, `Items!A${rowIndex}:Z${rowIndex}`, token);
      
      setItems(prev => prev.filter(i => i.id !== id));
      await logActivity("DELETE_ITEM", `Menghapus barang: ${itemName}`);
    }
  };

  const addPurchase = async (purchase: Omit<Purchase, "id">) => {
    const id = generateId();
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const row = [id, purchase.date, purchase.itemId, purchase.qty.toString(), purchase.totalCost.toString()];
      await appendRow(spreadsheetId, "Purchases", row, token);
      setPurchases((prev) => [...prev, { ...purchase, id }]);
      
      const item = items.find(i => i.id === purchase.itemId);
      await logActivity("ADD_PURCHASE", `Pembelian ${item?.name || purchase.itemId} x${purchase.qty}`);
    }
  };

  const editPurchase = async (id: string, updatedPurchase: Partial<Purchase>) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const pIndex = purchases.findIndex(p => p.id === id);
      if (pIndex === -1) return;
      
      const p = purchases[pIndex];
      const newP = { ...p, ...updatedPurchase };
      
      const rowIndex = pIndex + 2;
      const row = [newP.id, newP.date, newP.itemId, newP.qty.toString(), newP.totalCost.toString()];
      
      await updateRow(spreadsheetId, `Purchases!A${rowIndex}:E${rowIndex}`, row, token);
      
      setPurchases(prev => {
        const arr = [...prev];
        arr[pIndex] = newP;
        return arr;
      });
      await logActivity("EDIT_PURCHASE", `Mengubah pembelian ID: ${newP.id}`);
    }
  };

  const deletePurchase = async (id: string) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const pIndex = purchases.findIndex(p => p.id === id);
      if (pIndex === -1) return;
      
      const rowIndex = pIndex + 2;
      await clearRow(spreadsheetId, `Purchases!A${rowIndex}:Z${rowIndex}`, token);
      
      setPurchases(prev => prev.filter(p => p.id !== id));
      await logActivity("DELETE_PURCHASE", `Menghapus pembelian ID: ${id}`);
    }
  };

  const addProduction = async (prod: Omit<Production, "id">) => {
    const id = generateId();
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const row = [id, prod.date, prod.finishedItemId, prod.finishedQty.toString(), prod.rawMaterialsJSON, prod.overheadCost.toString(), prod.totalHPP.toString()];
      await appendRow(spreadsheetId, "Productions", row, token);
      setProductions((prev) => [...prev, { ...prod, id }]);
      
      const item = items.find(i => i.id === prod.finishedItemId);
      await logActivity("ADD_PRODUCTION", `Produksi ${item?.name || prod.finishedItemId} x${prod.finishedQty}`);
    }
  };

  const addSale = async (sale: Omit<Sale, "id">) => {
    const id = generateId();
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const row = [id, sale.date, sale.itemId, sale.qty.toString(), sale.totalRevenue.toString()];
      await appendRow(spreadsheetId, "Sales", row, token);
      setSales((prev) => [...prev, { ...sale, id }]);
      
      const item = items.find(i => i.id === sale.itemId);
      await logActivity("ADD_SALE", `Penjualan ${item?.name || sale.itemId} x${sale.qty}`);
    }
  };

  const editSale = async (id: string, updatedSale: Partial<Sale>) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const sIndex = sales.findIndex(s => s.id === id);
      if (sIndex === -1) return;
      
      const s = sales[sIndex];
      const newS = { ...s, ...updatedSale };
      
      const rowIndex = sIndex + 2;
      const row = [newS.id, newS.date, newS.itemId, newS.qty.toString(), newS.totalRevenue.toString()];
      
      await updateRow(spreadsheetId, `Sales!A${rowIndex}:E${rowIndex}`, row, token);
      
      setSales(prev => {
        const arr = [...prev];
        arr[sIndex] = newS;
        return arr;
      });
      await logActivity("EDIT_SALE", `Mengubah penjualan ID: ${newS.id}`);
    }
  };

  const deleteSale = async (id: string) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const sIndex = sales.findIndex(s => s.id === id);
      if (sIndex === -1) return;
      
      const rowIndex = sIndex + 2;
      await clearRow(spreadsheetId, `Sales!A${rowIndex}:Z${rowIndex}`, token);
      
      setSales(prev => prev.filter(s => s.id !== id));
      await logActivity("DELETE_SALE", `Menghapus penjualan ID: ${id}`);
    }
  };

  const addExpense = async (expense: Omit<Expense, "id">) => {
    const id = generateId();
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const row = [id, expense.date, expense.description, expense.amount.toString()];
      await appendRow(spreadsheetId, "Expenses", row, token);
      setExpenses((prev) => [...prev, { ...expense, id }]);
      await logActivity("ADD_EXPENSE", `Mencatat Beban: ${expense.description}`);
    }
  };

  const editExpense = async (id: string, updatedExpense: Partial<Expense>) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const eIndex = expenses.findIndex(e => e.id === id);
      if (eIndex === -1) return;
      
      const exp = expenses[eIndex];
      const newExp = { ...exp, ...updatedExpense };
      
      const rowIndex = eIndex + 2;
      const row = [newExp.id, newExp.date, newExp.description, newExp.amount.toString()];
      
      await updateRow(spreadsheetId, `Expenses!A${rowIndex}:D${rowIndex}`, row, token);
      
      setExpenses(prev => {
        const arr = [...prev];
        arr[eIndex] = newExp;
        return arr;
      });
      await logActivity("EDIT_EXPENSE", `Mengubah beban: ${newExp.description}`);
    }
  };

  const deleteExpense = async (id: string) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const eIndex = expenses.findIndex(e => e.id === id);
      if (eIndex === -1) return;
      
      const rowIndex = eIndex + 2;
      await clearRow(spreadsheetId, `Expenses!A${rowIndex}:Z${rowIndex}`, token);
      
      setExpenses(prev => prev.filter(e => e.id !== id));
      await logActivity("DELETE_EXPENSE", `Menghapus beban ID: ${id}`);
    }
  };

  const addAppUser = async (email: string, role: string) => {
    const id = generateId();
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const row = [id, email, role, new Date().toISOString()];
      await appendRow(spreadsheetId, "Users", row, token);
      setAppUsers((prev) => [...prev, { id, email, role, createdAt: new Date().toISOString() }]);
      await logActivity("ADD_USER", `Menambahkan user baru: ${email} (${role})`);
    }
  };

  const deleteAppUser = async (id: string) => {
    const token = await getAccessToken();
    if (token && spreadsheetId) {
      const userIndex = appUsers.findIndex(u => u.id === id);
      if (userIndex === -1) return;
      
      const u = appUsers[userIndex];
      const rowIndex = userIndex + 2; 
      await clearRow(spreadsheetId, `Users!A${rowIndex}:Z${rowIndex}`, token);
      
      setAppUsers(prev => prev.filter(user => user.id !== id));
      await logActivity("DELETE_USER", `Menghapus user: ${u.email}`);
    }
  };

  const logActivity = async (action: string, details: string) => {
    const id = generateId();
    const token = await getAccessToken();
    if (token && spreadsheetId && user) {
      const email = user.email || "Unknown";
      const timestamp = new Date().toISOString();
      const row = [id, timestamp, email, action, details];
      await appendRow(spreadsheetId, "Activity", row, token);
      setActivities((prev) => [...prev, { id, timestamp, userEmail: email, action, details }]);
    }
  };

  return (
    <AppContext.Provider
      value={{
        items, purchases, productions, sales, expenses, appUsers, activities,
        user, needsAuth, isLoading, spreadsheetId, setCustomSpreadsheetId, error, loginError,
        login, loginWithEmail, signUpWithEmail, logout, refreshData,
        addItem, editItem, deleteItem, addPurchase, addProduction, addSale, addExpense,
        addAppUser, deleteAppUser, logActivity
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
