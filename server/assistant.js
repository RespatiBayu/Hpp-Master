const SUPPORTED_TARGET_MENUS = new Set(["inventory", "purchases", "productions", "sales", "expenses", "admin"]);
const ITEM_TYPES = new Set(["RAW", "HALF_FINISHED", "FINISHED"]);
const FORM_BY_MENU = {
  inventory: "inventory_item_create",
  purchases: "purchase_create",
  productions: "production_create",
  sales: "sale_create",
  expenses: "expense_create",
  admin: "member_create",
};

const JSON_RESPONSE_SHAPE = {
  assistantMessage: "string",
  action: '"prefill_form" | "needs_clarification" | "chat"',
  targetMenu: "inventory | purchases | productions | sales | expenses | admin",
  formId: "string",
  fields: "object",
  missingFields: ["string"],
  suggestions: ["string"],
  confidence: "0-1",
};

const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

const toTrimmedString = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const toFiniteNumber = (value, { min = null } = {}) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (min !== null && parsed < min) return null;
  return parsed;
};

const clampConfidence = (value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.max(0, Math.min(1, parsed));
};

const normalizeStringList = (value, limit = 3) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
};

const firstSupportedMenu = (context) => {
  const visibleMenus = Array.isArray(context?.visibleMenus) ? context.visibleMenus : [];
  const supportedVisible = visibleMenus
    .map((menu) => (menu && typeof menu.id === "string" ? menu.id : ""))
    .filter((menuId) => SUPPORTED_TARGET_MENUS.has(menuId));

  if (supportedVisible.length > 0) {
    return supportedVisible[0];
  }

  if (typeof context?.targetMenu === "string" && SUPPORTED_TARGET_MENUS.has(context.targetMenu)) {
    return context.targetMenu;
  }

  if (typeof context?.currentMenu === "string" && SUPPORTED_TARGET_MENUS.has(context.currentMenu)) {
    return context.currentMenu;
  }

  return "inventory";
};

const normalizeTargetMenu = (targetMenu, context) => {
  if (typeof targetMenu === "string" && SUPPORTED_TARGET_MENUS.has(targetMenu)) {
    const visibleMenus = Array.isArray(context?.visibleMenus) ? context.visibleMenus : [];
    const visibleIds = new Set(
      visibleMenus.map((menu) => (menu && typeof menu.id === "string" ? menu.id : "")).filter(Boolean)
    );

    if (visibleIds.size === 0 || visibleIds.has(targetMenu)) {
      return targetMenu;
    }
  }

  return firstSupportedMenu(context);
};

const normalizeFormId = (formId, targetMenu) => {
  const expectedFormId = FORM_BY_MENU[targetMenu] || FORM_BY_MENU.inventory;
  if (typeof formId === "string" && formId.trim() === expectedFormId) {
    return expectedFormId;
  }

  return expectedFormId;
};

const extractJsonObject = (text) => {
  if (typeof text !== "string") return null;

  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");

  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  const candidate = text.slice(startIndex, endIndex + 1);
  return JSON.parse(candidate);
};

const getCatalog = (context) => ({
  items: Array.isArray(context?.catalog?.items) ? context.catalog.items : [],
  businesses: Array.isArray(context?.catalog?.businesses) ? context.catalog.businesses : [],
});

const normalizeFields = (formId, rawFields, context) => {
  const fields = rawFields && typeof rawFields === "object" ? rawFields : {};
  const catalog = getCatalog(context);
  const itemsById = new Map(
    catalog.items
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item])
  );
  const businessesById = new Map(
    catalog.businesses
      .filter((business) => business && typeof business.id === "string")
      .map((business) => [business.id, business])
  );

  if (formId === "inventory_item_create") {
    const nextFields = {};
    const name = toTrimmedString(fields.name);
    const category = toTrimmedString(fields.category);
    const type = toTrimmedString(fields.type);
    const unit = toTrimmedString(fields.unit);
    const minQty = toFiniteNumber(fields.minQty, { min: 0 });
    const sellingPrice = toFiniteNumber(fields.sellingPrice, { min: 0 });

    if (name) nextFields.name = name;
    if (category) nextFields.category = category;
    if (type && ITEM_TYPES.has(type)) nextFields.type = type;
    if (unit) nextFields.unit = unit;
    if (minQty !== null) nextFields.minQty = minQty;
    if (sellingPrice !== null) nextFields.sellingPrice = sellingPrice;

    return nextFields;
  }

  if (formId === "purchase_create") {
    const nextFields = {};
    const date = toTrimmedString(fields.date);
    const itemId = toTrimmedString(fields.itemId);
    const qty = toFiniteNumber(fields.qty, { min: 0.01 });
    const totalCost = toFiniteNumber(fields.totalCost, { min: 0 });

    if (date && isIsoDate(date)) nextFields.date = date;
    if (itemId && itemsById.has(itemId)) {
      const item = itemsById.get(itemId);
      if (item.type === "RAW" || item.type === "HALF_FINISHED") {
        nextFields.itemId = itemId;
      }
    }
    if (qty !== null) nextFields.qty = qty;
    if (totalCost !== null) nextFields.totalCost = totalCost;

    return nextFields;
  }

  if (formId === "production_create") {
    const nextFields = {};
    const date = toTrimmedString(fields.date);
    const finishedItemId = toTrimmedString(fields.finishedItemId);
    const finishedQty = toFiniteNumber(fields.finishedQty, { min: 0.01 });
    const overheadCost = toFiniteNumber(fields.overheadCost, { min: 0 });
    const rawMaterials = Array.isArray(fields.rawMaterials) ? fields.rawMaterials : [];

    if (date && isIsoDate(date)) nextFields.date = date;
    if (finishedItemId && itemsById.has(finishedItemId)) {
      const item = itemsById.get(finishedItemId);
      if (item.type === "FINISHED" || item.type === "HALF_FINISHED") {
        nextFields.finishedItemId = finishedItemId;
      }
    }
    if (finishedQty !== null) nextFields.finishedQty = finishedQty;
    if (overheadCost !== null) nextFields.overheadCost = overheadCost;

    const normalizedRawMaterials = rawMaterials
      .map((entry) => {
        const id = toTrimmedString(entry?.id);
        const qty = toFiniteNumber(entry?.qty, { min: 0.01 });
        if (!id || qty === null || !itemsById.has(id)) return null;

        const item = itemsById.get(id);
        if (item.type !== "RAW" && item.type !== "HALF_FINISHED") return null;

        return { id, qty };
      })
      .filter(Boolean);

    if (normalizedRawMaterials.length > 0) {
      nextFields.rawMaterials = normalizedRawMaterials;
    }

    return nextFields;
  }

  if (formId === "sale_create") {
    const nextFields = {};
    const date = toTrimmedString(fields.date);
    const itemId = toTrimmedString(fields.itemId);
    const qty = toFiniteNumber(fields.qty, { min: 0.01 });
    const totalRevenue = toFiniteNumber(fields.totalRevenue, { min: 0 });

    if (date && isIsoDate(date)) nextFields.date = date;
    if (itemId && itemsById.has(itemId) && itemsById.get(itemId).type === "FINISHED") {
      nextFields.itemId = itemId;
    }
    if (qty !== null) nextFields.qty = qty;
    if (totalRevenue !== null) nextFields.totalRevenue = totalRevenue;

    return nextFields;
  }

  if (formId === "expense_create") {
    const nextFields = {};
    const date = toTrimmedString(fields.date);
    const description = toTrimmedString(fields.description);
    const amount = toFiniteNumber(fields.amount, { min: 0 });

    if (date && isIsoDate(date)) nextFields.date = date;
    if (description) nextFields.description = description;
    if (amount !== null) nextFields.amount = amount;

    return nextFields;
  }

  if (formId === "member_create") {
    const nextFields = {};
    const email = toTrimmedString(fields.email);
    const password = toTrimmedString(fields.password);
    const businessId = toTrimmedString(fields.businessId);
    const businessName = toTrimmedString(fields.businessName);
    const createBusinessOnRequestedName = Boolean(fields.createBusinessOnRequestedName);

    if (email && email.includes("@")) nextFields.email = email.toLowerCase();
    if (password) nextFields.password = password;
    if (businessId && businessesById.has(businessId)) nextFields.businessId = businessId;
    if (businessName) nextFields.businessName = businessName;
    if (createBusinessOnRequestedName) nextFields.createBusinessOnRequestedName = true;

    return nextFields;
  }

  return {};
};

const buildFallbackPlan = (context, userMessage) => {
  const targetMenu = normalizeTargetMenu(context?.targetMenu || context?.currentMenu, context);
  const formId = FORM_BY_MENU[targetMenu] || FORM_BY_MENU.inventory;

  return {
    assistantMessage:
      "Saya sudah menangkap menu tujuan, tapi koneksi AI sedang bermasalah. Coba tulis instruksi lebih spesifik agar saya bisa bantu isi form lebih akurat.",
    action: "needs_clarification",
    targetMenu,
    formId,
    fields: {},
    missingFields: [],
    suggestions: [
      `Contoh ${targetMenu}: ${userMessage || "isi form dengan format lebih rinci"}`,
      "Tulis nama item, jumlah, nominal, dan tanggal bila ada.",
    ],
    confidence: 0.15,
  };
};

const buildSystemPrompt = () => `
Anda adalah asisten input data untuk aplikasi HPP Master. Tugas Anda adalah mengubah instruksi user menjadi rencana pengisian form yang terstruktur.

Balas HANYA dengan JSON valid. Jangan gunakan markdown. Jangan menambahkan teks sebelum atau sesudah JSON.

Skema JSON wajib:
${JSON.stringify(JSON_RESPONSE_SHAPE, null, 2)}

Aturan:
1. Semua jawaban harus berbahasa Indonesia.
2. action hanya boleh "prefill_form", "needs_clarification", atau "chat".
3. targetMenu hanya boleh salah satu dari: inventory, purchases, productions, sales, expenses, admin.
4. formId harus sesuai menu:
   - inventory -> inventory_item_create
   - purchases -> purchase_create
   - productions -> production_create
   - sales -> sale_create
   - expenses -> expense_create
   - admin -> member_create
5. Jangan pernah mengarang itemId atau businessId. Gunakan hanya ID yang tersedia di catalog.
6. Jika user menyebut nama item atau bisnis, pilih ID yang paling cocok HANYA jika jelas. Jika ragu, jangan isi ID tersebut dan masukkan field itu ke missingFields.
7. Jika user tidak menyebut tanggal, gunakan todayDate.
8. Untuk menu productions, fields.rawMaterials harus berupa array objek { "id": "item_id", "qty": number }.
9. Untuk menu inventory, type hanya boleh RAW, HALF_FINISHED, atau FINISHED.
10. Untuk menu sales, itemId harus produk FINISHED.
11. Untuk menu purchases, itemId harus RAW atau HALF_FINISHED.
12. Untuk menu admin, cukup bantu tambah user baru dengan fields email, password, businessId, businessName, createBusinessOnRequestedName bila relevan.
13. assistantMessage harus singkat, jelas, dan menyatakan apa yang akan diisi atau apa yang masih kurang.
14. suggestions berisi 1 sampai 3 saran tindak lanjut yang singkat.
15. confidence bernilai 0 sampai 1.

Jika informasi belum cukup, tetap isi fields yang bisa dipastikan dan pakai action "needs_clarification".
`;

const buildUserPayload = (userMessage, context) => ({
  userMessage,
  context: {
    currentMenu: context.currentMenu,
    targetMenu: context.targetMenu,
    todayDate: context.todayDate,
    businessRole: context.businessRole,
    visibleMenus: Array.isArray(context.visibleMenus) ? context.visibleMenus : [],
    catalog: {
      items: Array.isArray(context?.catalog?.items) ? context.catalog.items : [],
      businesses: Array.isArray(context?.catalog?.businesses) ? context.catalog.businesses : [],
    },
  },
});

const normalizePlan = (rawPlan, context) => {
  const targetMenu = normalizeTargetMenu(rawPlan?.targetMenu, context);
  const formId = normalizeFormId(rawPlan?.formId, targetMenu);
  const action = ["prefill_form", "needs_clarification", "chat"].includes(rawPlan?.action)
    ? rawPlan.action
    : "chat";
  const fields = normalizeFields(formId, rawPlan?.fields, context);
  const suggestions = normalizeStringList(rawPlan?.suggestions, 3);
  const missingFields = normalizeStringList(rawPlan?.missingFields, 6);
  const assistantMessage = toTrimmedString(rawPlan?.assistantMessage) || "Saya siap membantu mengisi form yang Anda pilih.";

  return {
    assistantMessage,
    action,
    targetMenu,
    formId,
    fields,
    missingFields,
    suggestions,
    confidence: clampConfidence(rawPlan?.confidence),
  };
};

export const planAssistantInput = async ({ apiKey, userMessage, context }) => {
  if (!apiKey) {
    return buildFallbackPlan(context, userMessage);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://fal.run/openrouter/router/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.2,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: JSON.stringify(buildUserPayload(userMessage, context), null, 2) },
        ],
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        `Permintaan ke fal.ai gagal dengan status ${response.status}.`;
      throw new Error(message);
    }

    const content = payload?.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((entry) => (entry?.type === "text" ? entry.text : ""))
              .filter(Boolean)
              .join("\n")
          : "";

    const rawPlan = extractJsonObject(text);
    if (!rawPlan) {
      throw new Error("Respons fal.ai tidak mengandung JSON yang bisa dipakai.");
    }

    return normalizePlan(rawPlan, context);
  } catch (error) {
    console.error("Assistant AI planning failed:", error);
    return buildFallbackPlan(context, userMessage);
  } finally {
    clearTimeout(timeout);
  }
};
