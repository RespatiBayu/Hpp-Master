export type ItemType = "RAW" | "HALF_FINISHED" | "FINISHED";
export type BusinessRole = "super_admin" | "admin" | "staff";
export type AppMenuKey = "dashboard" | "inventory" | "purchases" | "productions" | "sales" | "expenses" | "calculator";
export type MemberStatus = "active" | "invited";
export type MenuVisibility = Record<AppMenuKey, boolean>;

export interface BusinessMenuPackage {
  id: string;
  name: string;
  description: string | null;
  menuVisibility: MenuVisibility;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  unit: string;
  minQty: number;
  sellingPrice?: number;
}

export interface Purchase {
  id: string;
  date: string;
  itemId: string;
  qty: number;
  totalCost: number;
}

export interface RawMaterialUsage {
  id: string;
  qty: number;
}

export interface Production {
  id: string;
  date: string;
  finishedItemId: string;
  finishedQty: number;
  rawMaterialsJSON: string; // JSON string of RawMaterialUsage[]
  overheadCost: number;
  totalHPP: number;
}

export interface Sale {
  id: string;
  date: string;
  itemId: string;
  qty: number;
  totalRevenue: number;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface AppUser {
  id: string;
  email: string;
  role: BusinessRole;
  createdAt: string;
  status?: MemberStatus;
  businessId?: string;
  businessName?: string;
}

export interface BusinessSummary {
  id: string;
  name: string;
}

export interface UserActivity {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  details: string;
}
