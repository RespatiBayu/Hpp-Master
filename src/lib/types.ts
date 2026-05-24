export type ItemType = "RAW" | "HALF_FINISHED" | "FINISHED";

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
  role: string;
  createdAt: string;
  status?: "active" | "invited";
}

export interface UserActivity {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  details: string;
}
