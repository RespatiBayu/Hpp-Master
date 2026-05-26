import type { AppMenuKey, BusinessRole, Item } from "./types";

export type AssistantMenuTarget = AppMenuKey | "admin";
export type AssistantSupportedMenu = "inventory" | "purchases" | "productions" | "sales" | "expenses" | "admin";
export type AssistantAction = "prefill_form" | "needs_clarification" | "chat";
export type AssistantFormId =
  | "inventory_item_create"
  | "purchase_create"
  | "production_create"
  | "sale_create"
  | "expense_create"
  | "member_create";

export interface AssistantMenuOption {
  id: AssistantSupportedMenu;
  label: string;
}

export interface AssistantCatalogItem {
  id: string;
  name: string;
  category: string;
  type: Item["type"];
  unit: string;
  sellingPrice?: number;
}

export interface AssistantBusinessOption {
  id: string;
  name: string;
}

export interface AssistantRequestContext {
  currentMenu: AssistantMenuTarget;
  targetMenu: AssistantSupportedMenu | null;
  todayDate: string;
  businessRole: BusinessRole | null;
  visibleMenus: AssistantMenuOption[];
  catalog: {
    items: AssistantCatalogItem[];
    businesses: AssistantBusinessOption[];
  };
}

export interface AssistantPlan {
  assistantMessage: string;
  action: AssistantAction;
  targetMenu: AssistantSupportedMenu;
  formId: AssistantFormId;
  fields: Record<string, unknown>;
  missingFields: string[];
  suggestions: string[];
  confidence: number;
}

export interface AssistantApplyResult {
  appliedFields: string[];
  missingFields: string[];
  note?: string;
}

interface AssistantPrefillRequest {
  targetMenu: AssistantSupportedMenu;
  formId: AssistantFormId;
  fields: Record<string, unknown>;
  respond: (result: AssistantApplyResult) => void;
}

const ASSISTANT_PREFILL_EVENT = "hpp:assistant-prefill";

export const assistantMenuOptions: AssistantMenuOption[] = [
  { id: "inventory", label: "Inventori" },
  { id: "purchases", label: "Pembelian" },
  { id: "productions", label: "Produksi" },
  { id: "sales", label: "Penjualan" },
  { id: "expenses", label: "Beban" },
  { id: "admin", label: "Admin" },
];

export const assistantInputMenus = new Set<AssistantSupportedMenu>(assistantMenuOptions.map((menu) => menu.id));

export const isAssistantSupportedMenu = (value: string): value is AssistantSupportedMenu => assistantInputMenus.has(value as AssistantSupportedMenu);

export const coerceAssistantText = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
};

export const coerceAssistantNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const coerceAssistantDate = (value: unknown, fallback: string) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  return fallback;
};

export const requestAssistantPrefill = (payload: {
  targetMenu: AssistantSupportedMenu;
  formId: AssistantFormId;
  fields: Record<string, unknown>;
}): Promise<AssistantApplyResult> => {
  if (typeof window === "undefined") {
    return Promise.resolve({
      appliedFields: [],
      missingFields: Object.keys(payload.fields),
      note: "Bridge assistant tidak tersedia di server-side render.",
    });
  }

  return new Promise<AssistantApplyResult>((resolve) => {
    let settled = false;

    const finish = (result: AssistantApplyResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        appliedFields: [],
        missingFields: Object.keys(payload.fields),
        note: "Form tujuan belum siap dibuka. Coba kirim instruksi sekali lagi.",
      });
    }, 1500);

    window.dispatchEvent(
      new CustomEvent<AssistantPrefillRequest>(ASSISTANT_PREFILL_EVENT, {
        detail: {
          ...payload,
          respond: finish,
        },
      })
    );
  });
};

export const subscribeAssistantPrefill = (handler: (payload: AssistantPrefillRequest) => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    handler((event as CustomEvent<AssistantPrefillRequest>).detail);
  };

  window.addEventListener(ASSISTANT_PREFILL_EVENT, listener as EventListener);
  return () => {
    window.removeEventListener(ASSISTANT_PREFILL_EVENT, listener as EventListener);
  };
};
