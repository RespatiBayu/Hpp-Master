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
const MENU_LABELS = {
  inventory: "Inventori",
  purchases: "Pembelian",
  productions: "Produksi",
  sales: "Penjualan",
  expenses: "Beban",
  admin: "Admin",
};
const MENU_REQUIRED_FIELDS = {
  inventory: ["name", "type", "unit", "minQty"],
  purchases: ["itemId", "qty", "totalCost"],
  productions: ["finishedItemId", "finishedQty"],
  sales: ["itemId", "qty", "totalRevenue"],
  expenses: ["description", "amount"],
  admin: ["email"],
};
const MENU_QUICK_EXAMPLES = {
  inventory: [
    "Tambah bahan baku gula kategori Bahan, satuan kg, stok minimum 5",
    "Buat produk jadi Kopi Susu, kategori Minuman, satuan botol, stok minimum 10, harga jual 18000",
  ],
  purchases: [
    "Catat pembelian 10 kg gula total Rp180000 hari ini",
    "Beli 5 liter susu total 95000 tanggal 2026-05-27",
  ],
  productions: [
    "Catat produksi 40 botol kopi susu, overhead 50000, pakai 2 kg gula dan 5 liter susu",
    "Produksi 12 box brownies hari ini dengan overhead 35000",
  ],
  sales: [
    "Catat penjualan 12 botol kopi susu total Rp216000 hari ini",
    "Jual 8 box brownies tanggal 2026-05-27 total 280000",
  ],
  expenses: ["Catat beban listrik Rp350000 hari ini", "Tambah beban gaji barista Rp2500000 tanggal 2026-05-27"],
  admin: [
    "Buat admin baru untuk bisnis Alpha Kitchen dengan email admin@alpha.com dan password Alpha123",
    "Tambah staff baru email kasir@kedaimaju.com dengan password Kasir123",
  ],
};
const MENU_KEYWORDS = {
  inventory: ["inventori", "barang", "item", "stok minimum", "kategori", "harga jual"],
  purchases: ["pembelian", "beli", "bahan baku", "supplier", "total harga"],
  productions: ["produksi", "hpp", "overhead", "hasilkan", "bahan baku"],
  sales: ["penjualan", "jual", "terjual", "pendapatan", "omzet"],
  expenses: ["beban", "biaya", "listrik", "gaji", "sewa", "operasional"],
  admin: ["admin", "staff", "user", "akun", "email", "password"],
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

const normalizeComparableText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.\s/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseFlexibleNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value || "").replace(/[^\d.,-]/g, "").trim();
  if (!raw) return null;

  let normalized = raw;
  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");

  if (hasDot && hasComma) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = normalized.split(",");
    normalized = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join("");
  } else if (hasDot) {
    const parts = normalized.split(".");
    normalized = parts.length === 2 && parts[1].length <= 2 ? normalized : parts.join("");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractNumberByPatterns = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = parseFlexibleNumber(match?.[1]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const getVisibleSupportedMenus = (context) => {
  const visibleMenus = Array.isArray(context?.visibleMenus) ? context.visibleMenus : [];
  const supportedVisibleMenus = visibleMenus
    .map((menu) => (menu && typeof menu.id === "string" ? menu.id : ""))
    .filter((menuId) => SUPPORTED_TARGET_MENUS.has(menuId));

  return supportedVisibleMenus.length > 0 ? supportedVisibleMenus : Array.from(SUPPORTED_TARGET_MENUS);
};

const inferTargetMenuFromMessage = (userMessage, context) => {
  const normalizedMessage = normalizeComparableText(userMessage);
  const candidateMenus = getVisibleSupportedMenus(context);
  const scoredMenus = candidateMenus
    .map((menuId) => {
      const score = (MENU_KEYWORDS[menuId] || []).reduce((total, keyword) => {
        return normalizedMessage.includes(normalizeComparableText(keyword)) ? total + 1 : total;
      }, 0);

      return { menuId, score };
    })
    .sort((left, right) => right.score - left.score);

  if (scoredMenus[0]?.score >= 2) {
    return scoredMenus[0].menuId;
  }

  return normalizeTargetMenu(context?.targetMenu || context?.currentMenu, context);
};

const findCatalogMatchByMention = (userMessage, entries, filter = () => true) => {
  const normalizedMessage = normalizeComparableText(userMessage);
  const candidates = entries
    .filter((entry) => entry && typeof entry.id === "string" && typeof entry.name === "string" && filter(entry))
    .map((entry) => ({
      entry,
      normalizedName: normalizeComparableText(entry.name),
    }))
    .filter(({ normalizedName }) => normalizedName && normalizedMessage.includes(normalizedName))
    .sort((left, right) => right.normalizedName.length - left.normalizedName.length);

  return candidates[0]?.entry || null;
};

const extractDateValue = (userMessage, todayDate) => {
  const normalizedMessage = normalizeComparableText(userMessage);
  if (normalizedMessage.includes("hari ini")) {
    return todayDate;
  }

  const isoMatch = userMessage.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const localMatch = userMessage.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (localMatch) {
    const day = localMatch[1].padStart(2, "0");
    const month = localMatch[2].padStart(2, "0");
    const year = localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3];
    return `${year}-${month}-${day}`;
  }

  return todayDate;
};

const extractInventoryName = (userMessage) => {
  const match = userMessage.match(
    /(?:buat|buatkan|tambah|tambahkan)\s+(?:produk jadi|barang jadi|barang setengah jadi|setengah jadi|bahan baku|barang|item)?\s*([^,\n]+?)(?=\s+(?:kategori|satuan|unit|stok|min(?:imal)?|harga)|$|,)/i
  );
  return toTrimmedString(match?.[1] || "");
};

const extractInventoryFields = (userMessage, todayDate) => {
  const normalizedMessage = normalizeComparableText(userMessage);
  const inferredType = normalizedMessage.includes("bahan baku")
    ? "RAW"
    : normalizedMessage.includes("setengah jadi")
      ? "HALF_FINISHED"
      : normalizedMessage.includes("produk jadi") || normalizedMessage.includes("barang jadi")
        ? "FINISHED"
        : null;

  const categoryMatch = userMessage.match(/kategori\s+([^,\n]+?)(?=\s+(?:satuan|unit|stok|min(?:imal)?|harga)|$|,)/i);
  const unitMatch = userMessage.match(/(?:satuan|unit)\s+([a-zA-Z]+)/i);

  return {
    date: todayDate,
    name: extractInventoryName(userMessage) || undefined,
    category: toTrimmedString(categoryMatch?.[1] || "") || "Umum",
    type: inferredType || "RAW",
    unit: toTrimmedString(unitMatch?.[1] || "") || "pcs",
    minQty:
      extractNumberByPatterns(userMessage, [
        /stok\s*minimum\s*([\d.,]+)/i,
        /minimal\s*(?:stok|qty)?\s*([\d.,]+)/i,
        /min(?:imal)?\s*qty\s*([\d.,]+)/i,
      ]) ?? undefined,
    sellingPrice:
      extractNumberByPatterns(userMessage, [
        /harga\s*jual\s*(?:rp)?\s*([\d.,]+)/i,
        /jual\s*(?:rp)?\s*([\d.,]+)/i,
      ]) ?? undefined,
  };
};

const extractTransactionFields = (userMessage, context, menuId) => {
  const items = getCatalog(context).items;
  const itemMatch = findCatalogMatchByMention(
    userMessage,
    items,
    (item) =>
      menuId === "sales"
        ? item.type === "FINISHED"
        : menuId === "purchases"
          ? item.type === "RAW" || item.type === "HALF_FINISHED"
          : true
  );

  const qtyPatterns =
    menuId === "sales"
      ? [/terjual\s*([\d.,]+)/i, /jual\s*([\d.,]+)/i, /qty\s*([\d.,]+)/i, /kuantitas\s*([\d.,]+)/i]
      : [/beli\s*([\d.,]+)/i, /pembelian\s*([\d.,]+)/i, /qty\s*([\d.,]+)/i, /kuantitas\s*([\d.,]+)/i];
  const totalPatterns =
    menuId === "sales"
      ? [/total\s*(?:pendapatan|penjualan|omzet)?\s*(?:rp)?\s*([\d.,]+)/i, /rp\s*([\d.,]+)/i]
      : [/total\s*(?:harga|biaya|pembelian)?\s*(?:rp)?\s*([\d.,]+)/i, /rp\s*([\d.,]+)/i];
  const contextualQty = itemMatch
    ? extractNumberByPatterns(userMessage, [
        new RegExp(`([\\d.,]+)\\s*(?:[a-zA-Z]+)?\\s*${escapeRegExp(itemMatch.name)}`, "i"),
        new RegExp(`${escapeRegExp(itemMatch.name)}\\s*x\\s*([\\d.,]+)`, "i"),
      ])
    : null;

  return {
    date: extractDateValue(userMessage, context.todayDate),
    itemId: itemMatch?.id,
    qty: contextualQty ?? extractNumberByPatterns(userMessage, qtyPatterns) ?? undefined,
    totalValue: extractNumberByPatterns(userMessage, totalPatterns) ?? undefined,
  };
};

const extractProductionFields = (userMessage, context) => {
  const catalog = getCatalog(context);
  const finishedItems = catalog.items.filter((item) => item.type === "FINISHED" || item.type === "HALF_FINISHED");
  const rawItems = catalog.items.filter((item) => item.type === "RAW" || item.type === "HALF_FINISHED");
  const finishedItemMatch = findCatalogMatchByMention(userMessage, finishedItems);

  const rawMaterials = rawItems
    .map((item) => {
      const normalizedItemName = normalizeComparableText(item.name);
      if (!normalizedItemName || !normalizeComparableText(userMessage).includes(normalizedItemName)) {
        return null;
      }

      const itemPattern = escapeRegExp(item.name);
      const qty = extractNumberByPatterns(userMessage, [
        new RegExp(`pakai\\s*([\\d.,]+)\\s*(?:[a-zA-Z]+)?\\s*${itemPattern}`, "i"),
        new RegExp(`([\\d.,]+)\\s*(?:[a-zA-Z]+)?\\s*${itemPattern}`, "i"),
        new RegExp(`${itemPattern}\\s*(?:sebanyak|qty)?\\s*([\\d.,]+)`, "i"),
      ]);

      if (qty === null) return null;
      return { id: item.id, qty };
    })
    .filter(Boolean);

  return {
    date: extractDateValue(userMessage, context.todayDate),
    finishedItemId: finishedItemMatch?.id,
    finishedQty:
      extractNumberByPatterns(userMessage, [/produksi\s*([\d.,]+)/i, /hasilkan\s*([\d.,]+)/i, /qty\s*([\d.,]+)/i]) ?? undefined,
    overheadCost: extractNumberByPatterns(userMessage, [/overhead\s*(?:rp)?\s*([\d.,]+)/i, /biaya\s*pabrikasi\s*(?:rp)?\s*([\d.,]+)/i]) ?? 0,
    rawMaterials,
  };
};

const extractExpenseFields = (userMessage, context) => {
  const descriptionMatch = userMessage.match(
    /(?:catat|tambah|tambahkan)?\s*(?:beban|biaya)\s+(.+?)(?=\s+(?:rp|sebesar|senilai|tanggal|hari ini|\d)|$|,)/i
  );

  return {
    date: extractDateValue(userMessage, context.todayDate),
    description: toTrimmedString(descriptionMatch?.[1] || "") || undefined,
    amount: extractNumberByPatterns(userMessage, [/(?:rp|sebesar|senilai)\s*([\d.,]+)/i, /beban\s+.+?\s+([\d.,]+)\b/i]) ?? undefined,
  };
};

const extractAdminFields = (userMessage, context) => {
  const catalog = getCatalog(context);
  const emailMatch = userMessage.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const passwordMatch = userMessage.match(/(?:password|kata\s*sandi)(?:nya)?\s*[:=]?\s*([^\s,]+)/i);
  const businessMatch = findCatalogMatchByMention(userMessage, catalog.businesses);
  const namedBusinessMatch = userMessage.match(/bisnis\s+(.+?)(?=\s+(?:dengan|email|password|kata\s*sandi)|$|,)/i);
  const requestedBusinessName = toTrimmedString(namedBusinessMatch?.[1] || "");

  return {
    email: toTrimmedString(emailMatch?.[0] || "") || undefined,
    password: toTrimmedString(passwordMatch?.[1] || "") || undefined,
    businessId: businessMatch?.id,
    businessName: !businessMatch && requestedBusinessName ? requestedBusinessName : undefined,
    createBusinessOnRequestedName: !businessMatch && Boolean(requestedBusinessName),
  };
};

const removeUndefinedEntries = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));

const buildLocalPlan = (context, userMessage, options = {}) => {
  const targetMenu = inferTargetMenuFromMessage(userMessage, context);
  const formId = FORM_BY_MENU[targetMenu] || FORM_BY_MENU.inventory;

  let fields = {};
  if (targetMenu === "inventory") {
    fields = removeUndefinedEntries(extractInventoryFields(userMessage, context.todayDate));
  } else if (targetMenu === "purchases") {
    const transactionFields = extractTransactionFields(userMessage, context, "purchases");
    fields = removeUndefinedEntries({
      date: transactionFields.date,
      itemId: transactionFields.itemId,
      qty: transactionFields.qty,
      totalCost: transactionFields.totalValue,
    });
  } else if (targetMenu === "productions") {
    fields = removeUndefinedEntries(extractProductionFields(userMessage, context));
    if (Array.isArray(fields.rawMaterials) && fields.rawMaterials.length === 0) {
      delete fields.rawMaterials;
    }
  } else if (targetMenu === "sales") {
    const transactionFields = extractTransactionFields(userMessage, context, "sales");
    fields = removeUndefinedEntries({
      date: transactionFields.date,
      itemId: transactionFields.itemId,
      qty: transactionFields.qty,
      totalRevenue: transactionFields.totalValue,
    });
  } else if (targetMenu === "expenses") {
    fields = removeUndefinedEntries(extractExpenseFields(userMessage, context));
  } else if (targetMenu === "admin") {
    fields = removeUndefinedEntries(extractAdminFields(userMessage, context));
  }

  const requiredFields = MENU_REQUIRED_FIELDS[targetMenu] || [];
  const missingFields = requiredFields.filter((field) => !Object.prototype.hasOwnProperty.call(fields, field));
  const hasAnyFields = Object.keys(fields).length > 0;
  const suggestions = MENU_QUICK_EXAMPLES[targetMenu] || MENU_QUICK_EXAMPLES.inventory;
  const intro = options.providerUnavailable
    ? "Saya bantu isi draft dengan mode lokal dulu."
    : "Saya sudah siapkan draft input.";

  return {
    assistantMessage: hasAnyFields
      ? `${intro} Form ${MENU_LABELS[targetMenu]} siap diisi${missingFields.length > 0 ? `, tapi saya masih butuh ${missingFields.join(", ")}.` : "."}`
      : `${intro} Saya belum bisa menangkap detail penting untuk form ${MENU_LABELS[targetMenu]}.`,
    action: hasAnyFields && missingFields.length === 0 ? "prefill_form" : "needs_clarification",
    targetMenu,
    formId,
    fields,
    missingFields,
    suggestions: suggestions.slice(0, 2),
    confidence: hasAnyFields ? (missingFields.length === 0 ? 0.74 : 0.48) : 0.18,
  };
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
  return buildLocalPlan(context, userMessage, { providerUnavailable: true });
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

export const planAssistantInput = async ({ apiKey, userMessage, context, model = "google/gemini-2.5-flash" }) => {
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
        model,
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
      const error = new Error(message);
      error.statusCode = response.status;
      throw error;
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
    const statusSuffix = typeof error?.statusCode === "number" ? ` status ${error.statusCode}` : "";
    const message = error?.message ? ` ${error.message}` : "";
    console.warn(`[assistant] fal.ai planning unavailable.${statusSuffix}${message}`);
    return buildFallbackPlan(context, userMessage);
  } finally {
    clearTimeout(timeout);
  }
};
