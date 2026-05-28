import { planAssistantInput } from "./assistant.js";

const OPENROUTER_URL = "https://fal.run/openrouter/router/openai/v1/chat/completions";
const SUPPORTED_TARGETS = new Set(["purchases", "sales", "expenses"]);

const normalizeComparableText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.\s/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractJsonObject = (text) => {
  if (typeof text !== "string") return null;

  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");
  if (startIndex < 0 || endIndex <= startIndex) return null;

  return JSON.parse(text.slice(startIndex, endIndex + 1));
};

const buildMenuLabel = (targetMenu) => {
  if (targetMenu === "purchases") return "Pembelian";
  if (targetMenu === "sales") return "Penjualan";
  if (targetMenu === "expenses") return "Beban";
  return "Transaksi";
};

const buildSummary = (targetMenu, fields, catalog) => {
  if (targetMenu === "expenses") {
    return `Draft beban ${fields.description || "baru"} senilai Rp ${Number(fields.amount || 0).toLocaleString("id-ID")}`;
  }

  const item = catalog.items.find((entry) => entry.id === fields.itemId);
  const label = targetMenu === "sales" ? "penjualan" : "pembelian";
  const totalField = targetMenu === "sales" ? "totalRevenue" : "totalCost";
  return `Draft ${label} ${item?.name || "produk"} qty ${fields.qty || 0} total Rp ${Number(fields[totalField] || 0).toLocaleString("id-ID")}`;
};

const findItemMatch = (items, rawName, filter) => {
  const normalizedQuery = normalizeComparableText(rawName);
  if (!normalizedQuery) return null;

  const candidates = items
    .filter((item) => filter(item))
    .map((item) => ({
      item,
      normalizedName: normalizeComparableText(item.name),
    }))
    .filter(({ normalizedName }) => normalizedName && normalizedQuery.includes(normalizedName))
    .sort((left, right) => right.normalizedName.length - left.normalizedName.length);

  return candidates[0]?.item || null;
};

const normalizeVisionFields = (rawDraft, catalog) => {
  const targetMenu = SUPPORTED_TARGETS.has(rawDraft?.targetMenu) ? rawDraft.targetMenu : "expenses";
  const fields = rawDraft?.fields && typeof rawDraft.fields === "object" ? rawDraft.fields : {};

  if (targetMenu === "expenses") {
    return {
      targetMenu,
      formId: "expense_create",
      fields: {
        date: typeof fields.date === "string" ? fields.date : catalog.todayDate,
        description: typeof fields.description === "string" ? fields.description.trim() : "",
        amount: Number(fields.amount || 0),
      },
    };
  }

  const itemFilter = (item) =>
    targetMenu === "sales" ? item.type === "FINISHED" : item.type === "RAW" || item.type === "HALF_FINISHED";
  const requestedItemName = typeof fields.itemName === "string" ? fields.itemName : typeof fields.itemId === "string" ? fields.itemId : "";
  const itemMatch =
    catalog.items.find((item) => item.id === fields.itemId && itemFilter(item)) || findItemMatch(catalog.items, requestedItemName, itemFilter);

  return {
    targetMenu,
    formId: targetMenu === "sales" ? "sale_create" : "purchase_create",
    fields: {
      date: typeof fields.date === "string" ? fields.date : catalog.todayDate,
      itemId: itemMatch?.id,
      qty: Number(fields.qty || 0),
      ...(targetMenu === "sales"
        ? { totalRevenue: Number(fields.totalRevenue || fields.totalValue || 0) }
        : { totalCost: Number(fields.totalCost || fields.totalValue || 0) }),
    },
  };
};

const buildVisionPrompt = (catalog) => `
Anda adalah extractor transaksi bisnis UMKM dari foto struk atau foto nota.

Balas HANYA dengan JSON valid, tanpa markdown.

Skema wajib:
{
  "targetMenu": "purchases | sales | expenses",
  "fields": {
    "date": "YYYY-MM-DD",
    "itemName": "string optional untuk pembelian/penjualan",
    "qty": "number optional",
    "totalCost": "number optional",
    "totalRevenue": "number optional",
    "description": "string optional untuk beban",
    "amount": "number optional"
  },
  "summary": "string",
  "confidence": "0-1"
}

Aturan:
1. Jawaban harus berbahasa Indonesia.
2. Pilih purchases bila nota terlihat seperti pembelian bahan/barang masuk.
3. Pilih sales bila terlihat seperti struk penjualan ke pelanggan.
4. Pilih expenses bila terlihat seperti biaya operasional.
5. Gunakan tanggal hari ini (${catalog.todayDate}) bila tanggal tidak terbaca.
6. Untuk purchases/sales, boleh isi itemName dengan item paling dominan jika hanya satu produk yang jelas.
7. Jangan mengarang itemId. Hanya boleh gunakan itemName teks.
8. confidence harus konservatif bila struk blur atau item tidak jelas.

Katalog item yang mungkin relevan:
${catalog.items.map((item) => `- ${item.name} [${item.type}]`).join("\n")}
`;

const requestVisionDraft = async ({ apiKey, model, fallbackModel, imageDataUrl, catalog }) => {
  if (!apiKey) {
    throw new Error("FAL_KEY belum diisi, jadi AI foto struk belum aktif.");
  }

  const tryModel = async (targetModel) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: targetModel,
          temperature: 0.1,
          messages: [
            { role: "system", content: buildVisionPrompt(catalog) },
            {
              role: "user",
              content: [
                { type: "text", text: "Baca foto ini dan ubah menjadi draft transaksi yang paling mungkin." },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(
          payload?.error?.message || payload?.message || `Permintaan vision gagal dengan status ${response.status}.`
        );
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
      const draft = extractJsonObject(text);
      if (!draft) {
        throw new Error("Respons model vision tidak berisi JSON yang valid.");
      }

      return {
        draft,
        model: targetModel,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await tryModel(model);
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === model) {
      throw primaryError;
    }
    return tryModel(fallbackModel);
  }
};

const buildIntakeContext = ({ todayDate, businessRole, catalog }) => ({
  currentMenu: "inventory",
  targetMenu: null,
  todayDate,
  businessRole,
  visibleMenus: [
    { id: "purchases", label: "Pembelian" },
    { id: "sales", label: "Penjualan" },
    { id: "expenses", label: "Beban" },
  ],
  catalog: {
    items: catalog.items,
    businesses: [],
  },
});

export const planTransactionIntake = async ({
  apiKey,
  textModel,
  visionModel,
  fallbackModel,
  todayDate,
  businessRole,
  userMessage,
  imageDataUrl,
  catalog,
}) => {
  const cleanCatalog = {
    todayDate,
    items: Array.isArray(catalog?.items) ? catalog.items : [],
  };

  if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:image/")) {
    const visionResult = await requestVisionDraft({
      apiKey,
      model: visionModel,
      fallbackModel,
      imageDataUrl,
      catalog: cleanCatalog,
    });
    const normalized = normalizeVisionFields(visionResult.draft, cleanCatalog);
    const confidence = Math.max(0, Math.min(1, Number(visionResult.draft?.confidence || 0.35)));

    return {
      source: "image",
      model: visionResult.model,
      targetMenu: normalized.targetMenu,
      formId: normalized.formId,
      fields: normalized.fields,
      missingFields: Object.entries(normalized.fields)
        .filter(([, value]) => value === undefined || value === "" || value === 0)
        .map(([key]) => key),
      summary: visionResult.draft?.summary || buildSummary(normalized.targetMenu, normalized.fields, cleanCatalog),
      confidence,
    };
  }

  const plan = await planAssistantInput({
    apiKey,
    userMessage: userMessage || "",
    context: buildIntakeContext({
      todayDate,
      businessRole,
      catalog: cleanCatalog,
    }),
    model: textModel,
  });

  return {
    source: "text",
    model: textModel,
    targetMenu: plan.targetMenu,
    formId: plan.formId,
    fields: plan.fields,
    missingFields: plan.missingFields,
    summary: plan.assistantMessage || buildSummary(plan.targetMenu, plan.fields, cleanCatalog),
    confidence: plan.confidence,
  };
};

export const isSupportedTransactionTarget = (targetMenu) => SUPPORTED_TARGETS.has(targetMenu);
