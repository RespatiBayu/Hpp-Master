import type { AppUser, Expense, Item, Production, Purchase, Sale, UserActivity } from "./types";

export interface ApiAuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  provider: string | null;
}

export interface BusinessContext {
  id: string;
  name: string;
  role: "owner" | "admin" | "staff";
}

export interface BootstrapPayload {
  user: ApiAuthUser;
  business: BusinessContext;
  items: Item[];
  purchases: Purchase[];
  productions: Production[];
  sales: Sale[];
  expenses: Expense[];
  appUsers: AppUser[];
  activities: UserActivity[];
}

const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" && payload.message) ||
      response.statusText ||
      "Permintaan ke server gagal.";
    throw new Error(message);
  }

  return payload as T;
};

export const authApi = {
  me: () => apiFetch<{ user: ApiAuthUser; business: BusinessContext }>("/api/auth/me"),
  login: (email: string, password: string) =>
    apiFetch<{ user: ApiAuthUser; business: BusinessContext }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signup: (email: string, password: string, businessName?: string) =>
    apiFetch<{ user: ApiAuthUser; business: BusinessContext }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, businessName }),
    }),
  logout: () =>
    apiFetch<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
    }),
};

export const appApi = {
  bootstrap: () => apiFetch<BootstrapPayload>("/api/bootstrap"),
  items: {
    create: (item: Omit<Item, "id">) =>
      apiFetch<Item>("/api/items", {
        method: "POST",
        body: JSON.stringify(item),
      }),
    update: (id: string, item: Partial<Item> & Pick<Item, "name" | "type" | "unit" | "minQty">) =>
      apiFetch<Item>(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify(item),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/items/${id}`, {
        method: "DELETE",
      }),
  },
  purchases: {
    create: (purchase: Omit<Purchase, "id">) =>
      apiFetch<Purchase>("/api/purchases", {
        method: "POST",
        body: JSON.stringify(purchase),
      }),
    update: (id: string, purchase: Partial<Purchase> & Pick<Purchase, "date" | "itemId" | "qty" | "totalCost">) =>
      apiFetch<Purchase>(`/api/purchases/${id}`, {
        method: "PUT",
        body: JSON.stringify(purchase),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/purchases/${id}`, {
        method: "DELETE",
      }),
  },
  productions: {
    create: (production: Omit<Production, "id">) =>
      apiFetch<Production>("/api/productions", {
        method: "POST",
        body: JSON.stringify(production),
      }),
  },
  sales: {
    create: (sale: Omit<Sale, "id">) =>
      apiFetch<Sale>("/api/sales", {
        method: "POST",
        body: JSON.stringify(sale),
      }),
    update: (id: string, sale: Partial<Sale> & Pick<Sale, "date" | "itemId" | "qty" | "totalRevenue">) =>
      apiFetch<Sale>(`/api/sales/${id}`, {
        method: "PUT",
        body: JSON.stringify(sale),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/sales/${id}`, {
        method: "DELETE",
      }),
  },
  expenses: {
    create: (expense: Omit<Expense, "id">) =>
      apiFetch<Expense>("/api/expenses", {
        method: "POST",
        body: JSON.stringify(expense),
      }),
    update: (id: string, expense: Partial<Expense> & Pick<Expense, "date" | "description" | "amount">) =>
      apiFetch<Expense>(`/api/expenses/${id}`, {
        method: "PUT",
        body: JSON.stringify(expense),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/expenses/${id}`, {
        method: "DELETE",
      }),
  },
  members: {
    create: (email: string, role: string) =>
      apiFetch<AppUser>("/api/members", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/members/${id}`, {
        method: "DELETE",
      }),
  },
  activity: {
    create: (action: string, details: string) =>
      apiFetch<UserActivity>("/api/activity", {
        method: "POST",
        body: JSON.stringify({ action, details }),
      }),
  },
};
