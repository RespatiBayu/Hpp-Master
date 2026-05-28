export type ItemType = "RAW" | "HALF_FINISHED" | "FINISHED";
export type BusinessRole = "super_admin" | "admin" | "staff";
export type AppMenuKey =
  | "dashboard"
  | "inventory"
  | "purchases"
  | "productions"
  | "sales"
  | "pos"
  | "expenses"
  | "calculator";
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
  category: string;
  type: ItemType;
  unit: string;
  minQty: number;
  sellingPrice?: number;
  hasPhoto?: boolean;
  photoUrl?: string;
  stockQty?: number;
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
  source?: "manual" | "pos";
  posOrderId?: string;
  unitPrice?: number;
}

export interface PosCheckoutLine {
  itemId: string;
  qty: number;
}

export type PosPaymentMethod = "cash" | "qris" | "bank_transfer" | "debit_credit";

export interface PosCheckoutSummary {
  totalLines: number;
  totalQty: number;
  totalRevenue: number;
}

export interface PosOrderLine {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  shareToken: string;
  date: string;
  status: string;
  paymentMethod: PosPaymentMethod;
  subtotal: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  cashierName: string | null;
  createdAt: string;
  receiptSettings: PosSettings;
  lines: PosOrderLine[];
}

export interface PosCheckoutResult {
  order?: PosOrder;
  sales: Sale[];
  summary: PosCheckoutSummary;
  invoiceUrl?: string;
}

export interface PosSettings {
  paperWidth: "58mm" | "80mm";
  headerText: string;
  footerText: string;
  showCashier: boolean;
  showPaymentMethod: boolean;
}

export interface PosBootstrapPayload {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    provider: string | null;
  };
  business: {
    id: string;
    name: string;
    role: BusinessRole;
  };
  items: Item[];
  categories: Category[];
  posSettings: PosSettings;
  todaysOrders: PosOrder[];
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiIntakePlan {
  source: "text" | "image";
  model: string;
  targetMenu: "purchases" | "sales" | "expenses";
  formId: "purchase_create" | "sale_create" | "expense_create";
  fields: Record<string, unknown>;
  missingFields: string[];
  summary: string;
  confidence: number;
  catalogFinishedItems?: Item[];
}

export interface TelegramLinkResult {
  linkCode: string;
  expiresAt: string;
  command: string;
  botConfigured: boolean;
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

export interface BulkUserUploadRow {
  rowNumber: number;
  email: string;
  role?: string;
  password?: string;
  businessId?: string;
  businessName?: string;
}

export interface BulkUserUploadError {
  rowNumber: number;
  email: string;
  role?: string;
  businessId?: string;
  businessName?: string;
  message: string;
}

export interface BulkUserUploadResult {
  total: number;
  createdCount: number;
  failedCount: number;
  created: AppUser[];
  errors: BulkUserUploadError[];
}

export interface BusinessSummary {
  id: string;
  name: string;
  allowAdminCreateStaff: boolean;
}

export interface UserActivity {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  details: string;
}
