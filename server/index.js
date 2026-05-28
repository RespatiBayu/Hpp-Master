import { existsSync } from "node:fs";
import path from "node:path";

import express from "express";

import { planAssistantInput } from "./assistant.js";
import { isSupportedTransactionTarget, planTransactionIntake } from "./ai-intake.js";
import { config } from "./config.js";
import { pool, query, runMigrations, withTransaction } from "./db.js";
import { businessMenuDefinitions, isBusinessMenuKey, mergeMenuVisibility, normalizeMenuVisibility } from "./menu-config.js";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./security.js";
import { asyncHandler, normalizeEmail, parseCookies, randomId, sendError, slugify, toNullableNumber } from "./utils.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "12mb" }));

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.nodeEnv === "production",
  path: "/",
};

const normalizeBusinessRole = (role) => {
  if (typeof role !== "string") return role;

  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "owner" || normalized === "superadmin") return "super_admin";

  return normalized;
};

const isManagedRole = (role) => ["super_admin", "admin", "staff"].includes(normalizeBusinessRole(role));

const canAssignRole = (actorRole, targetRole) => {
  const actor = normalizeBusinessRole(actorRole);
  const target = normalizeBusinessRole(targetRole);

  if (actor === "super_admin") return target === "admin";
  if (actor === "admin") return target === "staff";
  return false;
};

const canManageMemberRole = (actorRole, targetRole) => {
  const actor = normalizeBusinessRole(actorRole);
  const target = normalizeBusinessRole(targetRole);

  if (actor === "super_admin") return target === "admin";
  if (actor === "admin") return target === "staff";
  return false;
};

const mapUser = (row) => ({
  id: row.user_id,
  email: row.email,
  displayName: row.display_name || row.email,
  provider: null,
});

const mapItem = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category || "Umum",
  type: row.type,
  unit: row.unit,
  minQty: Number(row.min_qty),
  sellingPrice: row.selling_price === null ? undefined : Number(row.selling_price),
  hasPhoto: Boolean(row.has_photo),
  photoUrl: Boolean(row.has_photo) ? buildItemPhotoUrl(row.id, row.photo_updated_at) : undefined,
});

const mapPurchase = (row) => ({
  id: row.id,
  date: row.date,
  itemId: row.item_id,
  qty: Number(row.qty),
  totalCost: Number(row.total_cost),
});

const mapProduction = (row, materials) => ({
  id: row.id,
  date: row.date,
  finishedItemId: row.finished_item_id,
  finishedQty: Number(row.finished_qty),
  rawMaterialsJSON: JSON.stringify(
    materials
      .filter((material) => material.production_id === row.id)
      .map((material) => ({
        id: material.item_id,
        qty: Number(material.qty),
      }))
  ),
  overheadCost: Number(row.overhead_cost),
  totalHPP: Number(row.total_hpp),
});

const mapSale = (row) => ({
  id: row.id,
  date: row.date,
  itemId: row.item_id,
  qty: Number(row.qty),
  totalRevenue: Number(row.total_revenue),
  source: row.source || "manual",
  posOrderId: row.pos_order_id || undefined,
  unitPrice: row.unit_price === null || row.unit_price === undefined ? undefined : Number(row.unit_price),
});

const mapExpense = (row) => ({
  id: row.id,
  date: row.date,
  description: row.description,
  amount: Number(row.amount),
});

const mapMember = (row) => ({
  id: row.id,
  email: row.email,
  role: normalizeBusinessRole(row.role),
  createdAt: row.created_at,
  status: row.status,
  businessId: row.business_id || undefined,
  businessName: row.business_name || undefined,
});

const mapBusiness = (row) => ({
  id: row.id,
  name: row.name,
  allowAdminCreateStaff: Boolean(row.allow_admin_create_staff),
});

const mapActivity = (row) => ({
  id: row.id,
  timestamp: row.created_at,
  userEmail: row.user_email,
  action: row.action,
  details: row.details,
});

const mapMenuPackage = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  menuVisibility: normalizeMenuVisibility(row.menu_visibility_json || {}, false),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const DEFAULT_POS_SETTINGS = {
  paperWidth: "58mm",
  headerText: "",
  footerText: "",
  showCashier: true,
  showPaymentMethod: true,
};

const mapCategory = (row) => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPosSettings = (row) => ({
  paperWidth: row?.paper_width || DEFAULT_POS_SETTINGS.paperWidth,
  headerText: row?.header_text || "",
  footerText: row?.footer_text || "",
  showCashier: row?.show_cashier ?? DEFAULT_POS_SETTINGS.showCashier,
  showPaymentMethod: row?.show_payment_method ?? DEFAULT_POS_SETTINGS.showPaymentMethod,
});

const mapPosOrderLine = (row) => ({
  id: row.id,
  itemId: row.item_id,
  itemName: row.item_name_snapshot,
  category: row.item_category_snapshot,
  unit: row.unit_snapshot,
  qty: Number(row.qty),
  unitPrice: Number(row.unit_price),
  lineTotal: Number(row.line_total),
});

const mapPosOrder = (row, lines = []) => ({
  id: row.id,
  orderNumber: row.order_number,
  shareToken: row.share_token,
  date: row.order_date,
  status: row.status,
  paymentMethod: row.payment_method,
  subtotal: Number(row.subtotal),
  total: Number(row.total),
  paidAmount: Number(row.paid_amount),
  changeAmount: Number(row.change_amount),
  cashierName: row.cashier_name || null,
  createdAt: row.created_at,
  receiptSettings: row.receipt_settings_json || {},
  lines: lines.filter((line) => line.pos_order_id === row.id).map(mapPosOrderLine),
});

const buildItemPhotoUrl = (itemId, updatedAt) => {
  const version =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : typeof updatedAt === "string"
        ? Date.parse(updatedAt) || updatedAt
        : Date.now();
  return `/api/items/${itemId}/photo?v=${version}`;
};

const buildDisplayNameFromEmail = (email) => email.split("@")[0] || "User";
const normalizeItemCategory = (value) => (typeof value === "string" && value.trim() ? value.trim() : "Umum");
const normalizeItemCategoryKey = (value) => normalizeItemCategory(value).trim().toLowerCase();
const normalizePosPaymentMethod = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["cash", "qris", "bank_transfer", "debit_credit"].includes(normalized) ? normalized : "cash";
};
const toNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const upsertItemCategory = async (client, businessId, categoryName) => {
  const name = normalizeItemCategory(categoryName);
  await client.query(
    `
      insert into item_categories (id, business_id, name, normalized_name)
      values ($1, $2, $3, $4)
      on conflict (business_id, normalized_name)
      do update set name = excluded.name, updated_at = now()
    `,
    [randomId("cat_"), businessId, name, normalizeItemCategoryKey(name)]
  );
};

const loadBusinessCategories = async (clientOrPool, businessId) => {
  const result = await clientOrPool.query(
    `
      select id, name, created_at, updated_at
      from item_categories
      where business_id = $1
      order by name asc
    `,
    [businessId]
  );

  return result.rows.map(mapCategory);
};

const loadBusinessPosSettings = async (clientOrPool, businessId) => {
  const result = await clientOrPool.query(
    `
      select paper_width, header_text, footer_text, show_cashier, show_payment_method
      from business_pos_settings
      where business_id = $1
      limit 1
    `,
    [businessId]
  );

  return result.rowCount > 0 ? mapPosSettings(result.rows[0]) : DEFAULT_POS_SETTINGS;
};

const createPosOrderNumber = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `POS-${stamp}-${randomId("").slice(0, 4).toUpperCase()}`;
};

const createReceiptHtml = (order, businessName) => {
  const linesHtml = order.lines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.itemName)}</td>
          <td style="text-align:right;">${line.qty}</td>
          <td style="text-align:right;">Rp ${line.lineTotal.toLocaleString("id-ID")}</td>
        </tr>
      `
    )
    .join("");

  const paymentLabel = order.paymentMethod.replace(/_/g, " ").toUpperCase();
  const headerText = order.receiptSettings?.headerText ? `<p>${escapeHtml(order.receiptSettings.headerText)}</p>` : "";
  const footerText = order.receiptSettings?.footerText ? `<p>${escapeHtml(order.receiptSettings.footerText)}</p>` : "";

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${escapeHtml(order.orderNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
      .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 18px; padding: 24px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
      h1, h2, p { margin: 0; }
      .muted { color: #64748b; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
      .totals { margin-top: 20px; display: grid; gap: 8px; }
      .totals div { display: flex; justify-content: space-between; }
      .strong { font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="muted">${escapeHtml(businessName || "HPP Master")}</p>
      <h1 style="margin-top:8px;">${escapeHtml(order.orderNumber)}</h1>
      <p class="muted" style="margin-top:6px;">${escapeHtml(order.date)} • ${escapeHtml(paymentLabel)}</p>
      ${headerText}
      <table>
        <tbody>${linesHtml}</tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><span>Rp ${order.subtotal.toLocaleString("id-ID")}</span></div>
        <div><span>Total</span><span class="strong">Rp ${order.total.toLocaleString("id-ID")}</span></div>
        <div><span>Dibayar</span><span>Rp ${order.paidAmount.toLocaleString("id-ID")}</span></div>
        <div><span>Kembalian</span><span>Rp ${order.changeAmount.toLocaleString("id-ID")}</span></div>
      </div>
      ${footerText}
    </div>
  </body>
</html>`;
};

const assertBusinessCanHaveAdmin = async (client, businessId, excludeMemberId = null) => {
  const businessResult = await client.query("select id from businesses where id = $1 limit 1 for update", [businessId]);
  if (businessResult.rowCount === 0) {
    throw createHttpError(404, "Bisnis target tidak ditemukan.");
  }

  const params = excludeMemberId ? [businessId, excludeMemberId] : [businessId];
  const existingAdmin = await client.query(
    `
      select id
      from business_members
      where business_id = $1
        and role = 'admin'
        ${excludeMemberId ? "and id <> $2" : ""}
      limit 1
    `,
    params
  );

  if (existingAdmin.rowCount > 0) {
    throw createHttpError(409, "Bisnis ini sudah memiliki 1 admin.");
  }
};

const resolveManagedBusiness = async (client, actorRole, actorBusinessId, options = {}) => {
  const requestedBusinessId = typeof options.requestedBusinessId === "string" ? options.requestedBusinessId.trim() : "";
  const requestedBusinessName = typeof options.requestedBusinessName === "string" ? options.requestedBusinessName.trim() : "";
  const fallbackBusinessId = typeof options.fallbackBusinessId === "string" ? options.fallbackBusinessId.trim() : "";
  const createBusinessOnRequestedName = Boolean(options.createBusinessOnRequestedName);

  if (normalizeBusinessRole(actorRole) !== "super_admin") {
    if (!actorBusinessId) {
      throw createHttpError(400, "Bisnis target wajib dipilih.");
    }

    const businessResult = await client.query(
      "select id, name, allow_admin_create_staff from businesses where id = $1 limit 1",
      [actorBusinessId]
    );
    if (businessResult.rowCount === 0) {
      throw createHttpError(404, "Bisnis target tidak ditemukan.");
    }

    return businessResult.rows[0];
  }

  if (requestedBusinessId) {
    const businessResult = await client.query(
      "select id, name, allow_admin_create_staff from businesses where id = $1 limit 1",
      [requestedBusinessId]
    );
    if (businessResult.rowCount === 0) {
      throw createHttpError(404, "Bisnis target tidak ditemukan.");
    }

    return businessResult.rows[0];
  }

  if (requestedBusinessName) {
    if (createBusinessOnRequestedName) {
      const businessId = randomId("biz_");
      const slug = await generateUniqueBusinessSlug(client, requestedBusinessName);

      await client.query("insert into businesses (id, name, slug) values ($1, $2, $3)", [businessId, requestedBusinessName, slug]);

      return {
        id: businessId,
        name: requestedBusinessName,
        allow_admin_create_staff: true,
      };
    }

    const businessResult = await client.query(
      `
        select id, name, allow_admin_create_staff
        from businesses
        where lower(name) = lower($1)
        order by created_at asc
        limit 2
      `,
      [requestedBusinessName]
    );

    if (businessResult.rowCount === 0) {
      throw createHttpError(404, `Bisnis "${requestedBusinessName}" tidak ditemukan.`);
    }

    if (businessResult.rowCount > 1) {
      throw createHttpError(409, `Nama bisnis "${requestedBusinessName}" tidak unik. Pastikan nama bisnis unik sebelum bulk upload admin.`);
    }

    return businessResult.rows[0];
  }

  const targetBusinessId = fallbackBusinessId || actorBusinessId;
  if (!targetBusinessId) {
    throw createHttpError(400, "Bisnis target wajib dipilih.");
  }

  const businessResult = await client.query(
    "select id, name, allow_admin_create_staff from businesses where id = $1 limit 1",
    [targetBusinessId]
  );
  if (businessResult.rowCount === 0) {
    throw createHttpError(404, "Bisnis target tidak ditemukan.");
  }

  return businessResult.rows[0];
};

const createBusinessMemberRecord = async (client, payload) => {
  const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  const requestedBusinessName = typeof payload.requestedBusinessName === "string" ? payload.requestedBusinessName.trim() : "";
  const isCreatingBusiness = Boolean(payload.createBusinessOnRequestedName && requestedBusinessName);
  const requestedRole = normalizeBusinessRole(typeof payload.role === "string" ? payload.role : "");
  const role = requestedRole || (isCreatingBusiness ? "super_admin" : "staff");
  const password = typeof payload.password === "string" ? payload.password : "";
  const requirePassword = Boolean(payload.requirePassword);
  const targetBusiness = await resolveManagedBusiness(client, payload.actorRole, payload.actorBusinessId, {
    requestedBusinessId: payload.requestedBusinessId,
    requestedBusinessName,
    fallbackBusinessId: payload.fallbackBusinessId,
    createBusinessOnRequestedName: payload.createBusinessOnRequestedName,
  });

  if (!email) {
    throw createHttpError(400, "Email user wajib diisi.");
  }

  if (!isManagedRole(role)) {
    throw createHttpError(400, "Role user tidak valid.");
  }

  if (!canAssignRole(payload.actorRole, role)) {
    throw createHttpError(403, "Anda tidak memiliki izin untuk membuat role user tersebut.");
  }

  if (normalizeBusinessRole(payload.actorRole) === "admin" && !targetBusiness.allow_admin_create_staff) {
    throw createHttpError(403, "Super admin belum mengizinkan admin bisnis ini membuat user staff.");
  }

  if (password && password.length < 6) {
    throw createHttpError(400, "Kata sandi minimal 6 karakter.");
  }

  if (role === "admin") {
    await assertBusinessCanHaveAdmin(client, targetBusiness.id);
  }

  const duplicate = await client.query(
    `
      select bm.id
      from business_members bm
      left join users u on u.id = bm.user_id
      where bm.business_id = $1
        and (u.email = $2 or bm.invitation_email = $2)
      limit 1
    `,
    [targetBusiness.id, email]
  );

  if (duplicate.rowCount > 0) {
    throw createHttpError(409, "User dengan email ini sudah terdaftar di bisnis target.");
  }

  const existingUser = await client.query("select id from users where email = $1 limit 1", [email]);
  const memberId = randomId("mem_");

  if (requirePassword && existingUser.rowCount === 0 && !password) {
    throw createHttpError(400, "Password wajib diisi agar akun hasil bulk upload langsung aktif.");
  }

  if (existingUser.rowCount > 0) {
    const result = await client.query(
      `
        insert into business_members (id, business_id, user_id, role, status)
        values ($1, $2, $3, $4, 'active')
        returning
          id,
          $5::text as email,
          role,
          status,
          created_at,
          business_id,
          $6::text as business_name
      `,
      [memberId, targetBusiness.id, existingUser.rows[0].id, role, email, targetBusiness.name]
    );

    return mapMember(result.rows[0]);
  }

  if (password) {
    const userId = randomId("usr_");
    const passwordHash = await hashPassword(password);

    await client.query(
      `
        insert into users (id, email, password_hash, display_name)
        values ($1, $2, $3, $4)
      `,
      [userId, email, passwordHash, buildDisplayNameFromEmail(email)]
    );

    const result = await client.query(
      `
        insert into business_members (id, business_id, user_id, role, status)
        values ($1, $2, $3, $4, 'active')
        returning
          id,
          $5::text as email,
          role,
          status,
          created_at,
          business_id,
          $6::text as business_name
      `,
      [memberId, targetBusiness.id, userId, role, email, targetBusiness.name]
    );

    return mapMember(result.rows[0]);
  }

  const result = await client.query(
    `
      insert into business_members (id, business_id, invitation_email, role, status)
      values ($1, $2, $3, $4, 'invited')
      returning
        id,
        invitation_email as email,
        role,
        status,
        created_at,
        business_id,
        $5::text as business_name
    `,
    [memberId, targetBusiness.id, email, role, targetBusiness.name]
  );

  return mapMember(result.rows[0]);
};

const upsertBusinessMenuVisibility = async (client, businessId, menuVisibility) => {
  for (const menu of businessMenuDefinitions) {
    await client.query(
      `
        insert into business_menu_settings (id, business_id, menu_key, is_enabled)
        values ($1, $2, $3, $4)
        on conflict (business_id, menu_key)
        do update set is_enabled = excluded.is_enabled, updated_at = now()
      `,
      [randomId("bms_"), businessId, menu.id, Boolean(menuVisibility[menu.id])]
    );
  }
};

const loadBusinessMenuState = async (clientOrPool, businessId) => {
  const [menuSettingsResult, menuPackagesResult] = await Promise.all([
    clientOrPool.query("select menu_key, is_enabled from business_menu_settings where business_id = $1", [businessId]),
    clientOrPool.query(
      `
        select id, name, description, menu_visibility_json, is_active, created_at, updated_at
        from business_menu_packages
        where business_id = $1
        order by is_active desc, created_at asc
      `,
      [businessId]
    ),
  ]);

  return {
    menuVisibility: mergeMenuVisibility(menuSettingsResult.rows),
    menuPackages: menuPackagesResult.rows.map(mapMenuPackage),
  };
};

const loadPosOrders = async (clientOrPool, businessId, options = {}) => {
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 20;
  const dateFilter = typeof options.date === "string" && options.date ? options.date : null;
  const params = dateFilter ? [businessId, dateFilter, limit] : [businessId, limit];
  const dateClause = dateFilter ? "and po.order_date = $2" : "";
  const limitIndex = dateFilter ? 3 : 2;

  const ordersResult = await clientOrPool.query(
    `
      select
        po.*,
        coalesce(u.display_name, u.email, 'Kasir') as cashier_name
      from pos_orders po
      left join users u on u.id = po.cashier_user_id
      where po.business_id = $1
        ${dateClause}
      order by po.created_at desc
      limit $${limitIndex}
    `,
    params
  );

  if (ordersResult.rowCount === 0) return [];

  const orderIds = ordersResult.rows.map((row) => row.id);
  const linesResult = await clientOrPool.query(
    `
      select *
      from pos_order_lines
      where business_id = $1 and pos_order_id = any($2::text[])
      order by created_at asc
    `,
    [businessId, orderIds]
  );

  return ordersResult.rows.map((row) => mapPosOrder(row, linesResult.rows));
};

const loadPosOrderByShareToken = async (clientOrPool, shareToken) => {
  const orderResult = await clientOrPool.query(
    `
      select
        po.*,
        b.name as business_name,
        coalesce(u.display_name, u.email, 'Kasir') as cashier_name
      from pos_orders po
      join businesses b on b.id = po.business_id
      left join users u on u.id = po.cashier_user_id
      where po.share_token = $1
      limit 1
    `,
    [shareToken]
  );

  if (orderResult.rowCount === 0) return null;

  const linesResult = await clientOrPool.query(
    `
      select *
      from pos_order_lines
      where pos_order_id = $1
      order by created_at asc
    `,
    [orderResult.rows[0].id]
  );

  return {
    businessName: orderResult.rows[0].business_name,
    order: mapPosOrder(orderResult.rows[0], linesResult.rows),
  };
};

const loadFinishedGoodsCatalog = async (clientOrPool, businessId) => {
  const itemsResult = await clientOrPool.query(
    `
      select
        items.*,
        item_photos.item_id is not null as has_photo,
        item_photos.updated_at as photo_updated_at
      from items
      left join item_photos on item_photos.item_id = items.id
      where items.business_id = $1
        and items.type = 'FINISHED'
        and items.selling_price is not null
      order by items.name asc
    `,
    [businessId]
  );

  return itemsResult.rows.map(mapItem);
};

const logAiIntake = async (clientOrPool, payload) => {
  await clientOrPool.query(
    `
      insert into ai_intake_logs (id, business_id, user_id, telegram_chat_id, source, mode, model, status, prompt_excerpt, result_json, confidence)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
    `,
    [
      randomId("ail_"),
      payload.businessId,
      payload.userId || null,
      payload.telegramChatId || null,
      payload.source,
      payload.mode,
      payload.model || null,
      payload.status || "draft",
      payload.promptExcerpt || null,
      payload.resultJson ? JSON.stringify(payload.resultJson) : null,
      payload.confidence ?? null,
    ]
  );
};

const buildMenuLabel = (targetMenu) => {
  if (targetMenu === "purchases") return "Pembelian";
  if (targetMenu === "sales") return "Penjualan";
  if (targetMenu === "expenses") return "Beban";
  return "Transaksi";
};

const sendTelegramMessage = async (chatId, text) => {
  if (!config.telegramBotToken) return;

  await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => null);
};

const createPurchaseRecord = async (client, payload) => {
  const result = await client.query(
    `
      insert into purchases (id, business_id, date, item_id, qty, total_cost)
      values ($1, $2, $3, $4, $5, $6)
      returning *
    `,
    [randomId("pur_"), payload.businessId, payload.date, payload.itemId, Number(payload.qty), Number(payload.totalCost)]
  );

  return mapPurchase(result.rows[0]);
};

const createSaleRecord = async (client, payload) => {
  const qty = Number(payload.qty);
  const totalRevenue = Number(payload.totalRevenue);
  const result = await client.query(
    `
      insert into sales (id, business_id, date, item_id, qty, total_revenue, source, unit_price)
      values ($1, $2, $3, $4, $5, $6, 'manual', $7)
      returning *
    `,
    [randomId("sal_"), payload.businessId, payload.date, payload.itemId, qty, totalRevenue, qty > 0 ? totalRevenue / qty : 0]
  );

  return mapSale(result.rows[0]);
};

const createExpenseRecord = async (client, payload) => {
  const result = await client.query(
    `
      insert into expenses (id, business_id, date, description, amount)
      values ($1, $2, $3, $4, $5)
      returning *
    `,
    [randomId("exp_"), payload.businessId, payload.date, payload.description, Number(payload.amount)]
  );

  return mapExpense(result.rows[0]);
};

const collectDraftCommitMissingFields = (draft) => {
  const fields = draft?.fields && typeof draft.fields === "object" ? draft.fields : {};
  const missing = Array.isArray(draft?.missingFields) ? [...draft.missingFields] : [];

  if (draft?.targetMenu === "expenses") {
    if (!(typeof fields.description === "string" && fields.description.trim())) missing.push("description");
    if (!(Number(fields.amount) > 0)) missing.push("amount");
  } else if (draft?.targetMenu === "sales") {
    if (!(typeof fields.itemId === "string" && fields.itemId.trim())) missing.push("itemId");
    if (!(Number(fields.qty) > 0)) missing.push("qty");
    if (!(Number(fields.totalRevenue) > 0)) missing.push("totalRevenue");
  } else if (draft?.targetMenu === "purchases") {
    if (!(typeof fields.itemId === "string" && fields.itemId.trim())) missing.push("itemId");
    if (!(Number(fields.qty) > 0)) missing.push("qty");
    if (!(Number(fields.totalCost) > 0)) missing.push("totalCost");
  }

  return [...new Set(missing)];
};

const loadLatestTelegramDraft = async (clientOrPool, chatLinkId) => {
  const result = await clientOrPool.query(
    `
      select *
      from telegram_pending_drafts
      where chat_link_id = $1 and expires_at > now()
      order by created_at desc
      limit 1
    `,
    [chatLinkId]
  );

  return result.rows[0] || null;
};

const commitTelegramDraft = async (client, payload) => {
  const fields = payload.draft?.fields && typeof payload.draft.fields === "object" ? payload.draft.fields : {};
  const date = typeof fields.date === "string" && fields.date.trim() ? fields.date.trim() : new Date().toISOString().slice(0, 10);

  if (payload.draft?.targetMenu === "expenses") {
    if (!(typeof fields.description === "string" && fields.description.trim())) {
      throw createHttpError(400, "Draft beban belum punya deskripsi yang cukup jelas.");
    }
    if (!(Number(fields.amount) > 0)) {
      throw createHttpError(400, "Draft beban belum punya nominal yang valid.");
    }

    const record = await createExpenseRecord(client, {
      businessId: payload.businessId,
      date,
      description: fields.description.trim(),
      amount: Number(fields.amount),
    });

    return { targetMenu: "expenses", record };
  }

  if (!(typeof fields.itemId === "string" && fields.itemId.trim())) {
    throw createHttpError(400, `Draft ${buildMenuLabel(payload.draft?.targetMenu).toLowerCase()} belum punya item yang cocok.`);
  }

  if (!(Number(fields.qty) > 0)) {
    throw createHttpError(400, `Draft ${buildMenuLabel(payload.draft?.targetMenu).toLowerCase()} belum punya qty yang valid.`);
  }

  if (payload.draft?.targetMenu === "sales") {
    if (!(Number(fields.totalRevenue) > 0)) {
      throw createHttpError(400, "Draft penjualan belum punya total revenue yang valid.");
    }

    const record = await createSaleRecord(client, {
      businessId: payload.businessId,
      date,
      itemId: fields.itemId.trim(),
      qty: Number(fields.qty),
      totalRevenue: Number(fields.totalRevenue),
    });

    return { targetMenu: "sales", record };
  }

  if (!(Number(fields.totalCost) > 0)) {
    throw createHttpError(400, "Draft pembelian belum punya total cost yang valid.");
  }

  const record = await createPurchaseRecord(client, {
    businessId: payload.businessId,
    date,
    itemId: fields.itemId.trim(),
    qty: Number(fields.qty),
    totalCost: Number(fields.totalCost),
  });

  return { targetMenu: "purchases", record };
};

const createPosOrder = async (client, payload) => {
  const { businessId, auth, date, lines, paymentMethod, paidAmount, changeAmount, posSettings } = payload;
  const uniqueItemIds = [...new Set(lines.map((line) => line.itemId))];
  const requestedQtyByItemId = {};

  for (const line of lines) {
    requestedQtyByItemId[line.itemId] = (requestedQtyByItemId[line.itemId] || 0) + Number(line.qty);
  }

  const itemResults = await client.query(
    `
      select
        items.id,
        items.name,
        items.category,
        items.type,
        items.unit,
        items.selling_price
      from items
      where items.business_id = $1 and items.id = any($2::text[])
    `,
    [businessId, uniqueItemIds]
  );

  const itemById = new Map(itemResults.rows.map((row) => [row.id, row]));
  if (itemById.size !== uniqueItemIds.length) {
    throw createHttpError(404, "Ada produk PoS yang tidak ditemukan.");
  }

  for (const line of lines) {
    const item = itemById.get(line.itemId);
    if (!item) {
      throw createHttpError(404, "Produk PoS tidak ditemukan.");
    }
    if (item.type !== "FINISHED") {
      throw createHttpError(400, `Produk ${item.name} belum termasuk barang jadi, jadi tidak bisa dijual lewat PoS.`);
    }
    if (item.selling_price === null) {
      throw createHttpError(400, `Produk ${item.name} belum memiliki harga jual.`);
    }
  }

  const stockByItemId = await loadAvailableStockByItemIds(client, businessId, uniqueItemIds);
  for (const itemId of uniqueItemIds) {
    const item = itemById.get(itemId);
    const requestedQty = requestedQtyByItemId[itemId] || 0;
    const availableQty = stockByItemId[itemId] || 0;
    if (requestedQty > availableQty) {
      throw createHttpError(
        400,
        `Stok ${item?.name || itemId} tidak cukup. Tersedia ${availableQty} ${item?.unit || ""}, diminta ${requestedQty} ${item?.unit || ""}.`
      );
    }
  }

  const orderId = randomId("pos_");
  const orderNumber = createPosOrderNumber();
  const shareToken = randomId("share_");
  let subtotal = 0;
  const createdSales = [];

  const orderResult = await client.query(
    `
      insert into pos_orders (
        id, business_id, cashier_member_id, cashier_user_id, order_number, share_token, order_date,
        status, payment_method, subtotal, total, paid_amount, change_amount, receipt_settings_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, 0, 0, $9, $10, $11::jsonb)
      returning *
    `,
    [
      orderId,
      businessId,
      auth.membershipId || null,
      auth.userId,
      orderNumber,
      shareToken,
      date,
      paymentMethod,
      paidAmount,
      changeAmount,
      JSON.stringify(posSettings),
    ]
  );

  for (const line of lines) {
    const item = itemById.get(line.itemId);
    const qty = Number(line.qty);
    const unitPrice = Number(item.selling_price);
    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;

    await client.query(
      `
        insert into pos_order_lines (
          id, business_id, pos_order_id, item_id, item_name_snapshot, item_category_snapshot, unit_snapshot, qty, unit_price, line_total
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [randomId("pol_"), businessId, orderId, item.id, item.name, item.category, item.unit, qty, unitPrice, lineTotal]
    );

    const salesResult = await client.query(
      `
        insert into sales (id, business_id, date, item_id, qty, total_revenue, source, pos_order_id, unit_price)
        values ($1, $2, $3, $4, $5, $6, 'pos', $7, $8)
        returning *
      `,
      [randomId("sal_"), businessId, date, item.id, qty, lineTotal, orderId, unitPrice]
    );

    createdSales.push(mapSale(salesResult.rows[0]));
  }

  const updatedOrderResult = await client.query(
    `
      update pos_orders
      set subtotal = $3, total = $3, updated_at = now()
      where id = $1 and business_id = $2
      returning *
    `,
    [orderId, businessId, subtotal]
  );

  const linesResult = await client.query(
    `
      select *
      from pos_order_lines
      where pos_order_id = $1
      order by created_at asc
    `,
    [orderId]
  );

  return {
    order: mapPosOrder(updatedOrderResult.rows[0], linesResult.rows),
    sales: createdSales,
    summary: {
      totalLines: lines.length,
      totalQty: lines.reduce((sum, line) => sum + Number(line.qty), 0),
      totalRevenue: subtotal,
    },
  };
};

const loadAvailableStockByItemIds = async (client, businessId, itemIds) => {
  if (itemIds.length === 0) return {};

  const [purchasesResult, productionsResult, salesResult] = await Promise.all([
    client.query(
      `
        select item_id, coalesce(sum(qty), 0) as qty
        from purchases
        where business_id = $1 and item_id = any($2::text[])
        group by item_id
      `,
      [businessId, itemIds]
    ),
    client.query(
      `
        select finished_item_id as item_id, coalesce(sum(finished_qty), 0) as qty
        from productions
        where business_id = $1 and finished_item_id = any($2::text[])
        group by finished_item_id
      `,
      [businessId, itemIds]
    ),
    client.query(
      `
        select item_id, coalesce(sum(qty), 0) as qty
        from sales
        where business_id = $1 and item_id = any($2::text[])
        group by item_id
      `,
      [businessId, itemIds]
    ),
  ]);

  const stockByItemId = Object.fromEntries(itemIds.map((itemId) => [itemId, 0]));

  for (const row of purchasesResult.rows) {
    stockByItemId[row.item_id] = (stockByItemId[row.item_id] || 0) + Number(row.qty);
  }

  for (const row of productionsResult.rows) {
    stockByItemId[row.item_id] = (stockByItemId[row.item_id] || 0) + Number(row.qty);
  }

  for (const row of salesResult.rows) {
    stockByItemId[row.item_id] = (stockByItemId[row.item_id] || 0) - Number(row.qty);
  }

  return stockByItemId;
};

const createSessionRecord = async (client, userId) => {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);

  await client.query(
    `
      insert into sessions (id, user_id, token_hash, expires_at)
      values ($1, $2, $3, $4)
    `,
    [randomId("ses_"), userId, tokenHash, expiresAt.toISOString()]
  );

  return { token, expiresAt };
};

const setSessionCookie = (res, token, expiresAt) => {
  res.cookie(config.sessionCookieName, token, {
    ...sessionCookieOptions,
    expires: expiresAt,
  });
};

const clearSessionCookie = (res) => {
  res.clearCookie(config.sessionCookieName, sessionCookieOptions);
};

const generateUniqueBusinessSlug = async (client, businessName) => {
  const baseSlug = slugify(businessName);
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await client.query("select 1 from businesses where slug = $1 limit 1", [slug]);
    if (existing.rowCount === 0) return slug;
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

const getPrimaryMembership = async (clientOrPool, userId) => {
  const { rows } = await clientOrPool.query(
    `
      select
        bm.id as membership_id,
        bm.business_id,
        bm.role,
        b.name as business_name,
        b.allow_admin_create_staff
      from business_members bm
      join businesses b on b.id = bm.business_id
      where bm.user_id = $1 and bm.status = 'active'
      order by
        case bm.role
          when 'super_admin' then 0
          when 'owner' then 0
          when 'admin' then 1
          else 2
        end,
        bm.created_at asc
      limit 1
    `,
    [userId]
  );

  if (rows.length === 0) return null;

  return {
    ...rows[0],
    role: normalizeBusinessRole(rows[0].role),
  };
};

const loadVisibleMembers = async (businessId, role) => {
  if (normalizeBusinessRole(role) === "super_admin") {
    return query(
      `
        select
          bm.id,
          coalesce(u.email, bm.invitation_email) as email,
          bm.role,
          bm.status,
          bm.created_at,
          bm.business_id,
          b.name as business_name
        from business_members bm
        join businesses b on b.id = bm.business_id
        left join users u on u.id = bm.user_id
        where bm.role = 'admin'
        order by
          case
            when bm.business_id = $1 then 0
            else 1
          end,
          b.name asc,
          bm.created_at asc
      `,
      [businessId]
    );
  }

  if (normalizeBusinessRole(role) === "admin") {
    return query(
      `
        select
          bm.id,
          coalesce(u.email, bm.invitation_email) as email,
          bm.role,
          bm.status,
          bm.created_at,
          bm.business_id,
          b.name as business_name
        from business_members bm
        join businesses b on b.id = bm.business_id
        left join users u on u.id = bm.user_id
        where bm.business_id = $1
          and bm.role = 'staff'
        order by bm.created_at asc
      `,
      [businessId]
    );
  }

  return { rows: [] };
};

const loadVisibleBusinesses = async (businessId, role) => {
  if (normalizeBusinessRole(role) === "super_admin") {
    return query(
      `
        select id, name, allow_admin_create_staff
        from businesses
        order by
          case
            when id = $1 then 0
            else 1
          end,
          name asc
      `,
      [businessId]
    );
  }

  return query("select id, name, allow_admin_create_staff from businesses where id = $1 limit 1", [businessId]);
};

const loadBootstrap = async (businessId, role) => {
  const [
    businessesResult,
    categories,
    itemsResult,
    purchasesResult,
    productionsResult,
    productionMaterialsResult,
    salesResult,
    expensesResult,
    membersResult,
    activitiesResult,
    menuState,
    posSettings,
  ] =
    await Promise.all([
      loadVisibleBusinesses(businessId, role),
      loadBusinessCategories(pool, businessId),
      query(
        `
          select
            items.*,
            item_photos.item_id is not null as has_photo,
            item_photos.updated_at as photo_updated_at
          from items
          left join item_photos on item_photos.item_id = items.id
          where items.business_id = $1
          order by items.created_at asc
        `,
        [businessId]
      ),
      query("select * from purchases where business_id = $1 order by date desc, created_at desc", [businessId]),
      query("select * from productions where business_id = $1 order by date desc, created_at desc", [businessId]),
      query("select * from production_materials where business_id = $1", [businessId]),
      query("select * from sales where business_id = $1 order by date desc, created_at desc", [businessId]),
      query("select * from expenses where business_id = $1 order by date desc, created_at desc", [businessId]),
      loadVisibleMembers(businessId, role),
      query("select * from activity_logs where business_id = $1 order by created_at asc", [businessId]),
      loadBusinessMenuState(pool, businessId),
      loadBusinessPosSettings(pool, businessId),
    ]);

  return {
    businesses: businessesResult.rows.map(mapBusiness),
    categories,
    items: itemsResult.rows.map(mapItem),
    purchases: purchasesResult.rows.map(mapPurchase),
    productions: productionsResult.rows.map((row) => mapProduction(row, productionMaterialsResult.rows)),
    sales: salesResult.rows.map(mapSale),
    expenses: expensesResult.rows.map(mapExpense),
    appUsers: membersResult.rows.map(mapMember),
    activities: activitiesResult.rows.map(mapActivity),
    menuVisibility: menuState.menuVisibility,
    menuPackages: menuState.menuPackages,
    posSettings,
  };
};

app.use(
  asyncHandler(async (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies[config.sessionCookieName];

    if (!sessionToken) {
      req.auth = null;
      next();
      return;
    }

    const sessionHash = hashSessionToken(sessionToken);
    const sessionResult = await query(
      `
        select
          s.id as session_id,
          s.user_id,
          u.email,
          u.display_name
        from sessions s
        join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()
        limit 1
      `,
      [sessionHash]
    );

    if (sessionResult.rowCount === 0) {
      clearSessionCookie(res);
      req.auth = null;
      next();
      return;
    }

    const sessionRow = sessionResult.rows[0];
    const membership = await getPrimaryMembership(pool, sessionRow.user_id);

    req.auth = {
      sessionId: sessionRow.session_id,
      userId: sessionRow.user_id,
      email: sessionRow.email,
      displayName: sessionRow.display_name || sessionRow.email,
      membershipId: membership?.membership_id || null,
      businessId: membership?.business_id || null,
      businessName: membership?.business_name || null,
      role: membership?.role || null,
      allowAdminCreateStaff: Boolean(membership?.allow_admin_create_staff),
      user: mapUser(sessionRow),
    };

    next();
  })
);

const requireAuth = (req, res, next) => {
  if (!req.auth?.userId || !req.auth.businessId || !req.auth.role) {
    sendError(res, 401, "Sesi login tidak ditemukan atau bisnis belum aktif.");
    return;
  }

  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth?.role) {
    sendError(res, 401, "Sesi login tidak ditemukan.");
    return;
  }

  if (!roles.includes(req.auth.role)) {
    sendError(res, 403, "Anda tidak memiliki izin untuk aksi ini.");
    return;
  }

  next();
};

const requirePosAccess = asyncHandler(async (req, res, next) => {
  if (!req.auth?.businessId || !req.auth?.role) {
    sendError(res, 401, "Sesi login tidak ditemukan.");
    return;
  }

  if (req.auth.role === "super_admin" || req.auth.role === "admin") {
    next();
    return;
  }

  const menuState = await loadBusinessMenuState(pool, req.auth.businessId);
  if (!menuState.menuVisibility.pos) {
    sendError(res, 403, "Akses PoS sedang dinonaktifkan untuk bisnis ini.");
    return;
  }

  next();
});

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    await query("select 1");
    res.json({ ok: true });
  })
);

app.post(
  "/api/auth/signup",
  asyncHandler(async (req, res) => {
    const email = typeof req.body.email === "string" ? normalizeEmail(req.body.email) : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const businessName = typeof req.body.businessName === "string" ? req.body.businessName.trim() : "";
    const displayName =
      typeof req.body.displayName === "string" && req.body.displayName.trim()
        ? req.body.displayName.trim()
        : email.split("@")[0] || "User";

    if (!email) {
      sendError(res, 400, "Email wajib diisi.");
      return;
    }

    if (password.length < 6) {
      sendError(res, 400, "Kata sandi minimal 6 karakter.");
      return;
    }

    const result = await withTransaction(async (client) => {
      const existingUser = await client.query("select 1 from users where email = $1 limit 1", [email]);
      if (existingUser.rowCount > 0) {
        const error = new Error("Email sudah terdaftar.");
        error.status = 409;
        throw error;
      }

      const invitedMemberships = await client.query(
        `
          select id, business_id, role
          from business_members
          where invitation_email = $1 and status = 'invited'
          order by created_at asc
        `,
        [email]
      );

      if (invitedMemberships.rowCount === 0 && !businessName) {
        const error = new Error("Nama bisnis wajib diisi jika Anda belum diundang ke bisnis yang sudah ada.");
        error.status = 400;
        throw error;
      }

      const userId = randomId("usr_");
      const passwordHash = await hashPassword(password);
      await client.query(
        `
          insert into users (id, email, password_hash, display_name)
          values ($1, $2, $3, $4)
        `,
        [userId, email, passwordHash, displayName]
      );

      let primaryBusinessId;
      let primaryRole;

      if (invitedMemberships.rowCount > 0) {
        await client.query(
          `
            update business_members
            set user_id = $1, invitation_email = null, status = 'active'
            where invitation_email = $2 and status = 'invited'
          `,
          [userId, email]
        );

        const membership = await getPrimaryMembership(client, userId);
        primaryBusinessId = membership.business_id;
        primaryRole = membership.role;
      } else {
        const businessId = randomId("biz_");
        const membershipId = randomId("mem_");
        const slug = await generateUniqueBusinessSlug(client, businessName);

        await client.query(
          `
            insert into businesses (id, name, slug)
            values ($1, $2, $3)
          `,
          [businessId, businessName, slug]
        );

        await client.query(
          `
            insert into business_members (id, business_id, user_id, role, status)
            values ($1, $2, $3, 'super_admin', 'active')
          `,
          [membershipId, businessId, userId]
        );

        primaryBusinessId = businessId;
        primaryRole = "super_admin";
      }

      const session = await createSessionRecord(client, userId);
      const businessResult = await client.query("select id, name, allow_admin_create_staff from businesses where id = $1", [primaryBusinessId]);

      return {
        user: {
          id: userId,
          email,
          displayName,
          provider: null,
        },
        business: {
          id: primaryBusinessId,
          name: businessResult.rows[0].name,
          role: primaryRole,
          allowAdminCreateStaff: Boolean(businessResult.rows[0].allow_admin_create_staff),
        },
        session,
      };
    });

    setSessionCookie(res, result.session.token, result.session.expiresAt);
    res.status(201).json({
      user: result.user,
      business: result.business,
    });
  })
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const email = typeof req.body.email === "string" ? normalizeEmail(req.body.email) : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password) {
      sendError(res, 400, "Email dan kata sandi wajib diisi.");
      return;
    }

    const userResult = await query(
      `
        select id as user_id, email, password_hash, display_name
        from users
        where email = $1
        limit 1
      `,
      [email]
    );

    if (userResult.rowCount === 0) {
      sendError(res, 401, "Email atau kata sandi salah.");
      return;
    }

    const userRow = userResult.rows[0];
    const isValidPassword = await verifyPassword(password, userRow.password_hash);
    if (!isValidPassword) {
      sendError(res, 401, "Email atau kata sandi salah.");
      return;
    }

    const membership = await getPrimaryMembership(pool, userRow.user_id);
    if (!membership) {
      sendError(res, 403, "Akun ini belum memiliki akses ke bisnis mana pun.");
      return;
    }

    const session = await withTransaction(async (client) => createSessionRecord(client, userRow.user_id));
    setSessionCookie(res, session.token, session.expiresAt);

    res.json({
      user: {
        id: userRow.user_id,
        email: userRow.email,
        displayName: userRow.display_name || userRow.email,
        provider: null,
      },
      business: {
        id: membership.business_id,
        name: membership.business_name,
        role: membership.role,
        allowAdminCreateStaff: Boolean(membership.allow_admin_create_staff),
      },
    });
  })
);

app.post(
  "/api/auth/logout",
  asyncHandler(async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies[config.sessionCookieName];

    if (sessionToken) {
      await query("delete from sessions where token_hash = $1", [hashSessionToken(sessionToken)]);
    }

    clearSessionCookie(res);
    res.json({ ok: true });
  })
);

app.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    if (!req.auth?.userId || !req.auth.businessId || !req.auth.role) {
      sendError(res, 401, "Belum login.");
      return;
    }

    res.json({
      user: req.auth.user,
      business: {
        id: req.auth.businessId,
        name: req.auth.businessName,
        role: req.auth.role,
        allowAdminCreateStaff: Boolean(req.auth.allowAdminCreateStaff),
      },
    });
  })
);

app.get(
  "/api/bootstrap",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = await loadBootstrap(req.auth.businessId, req.auth.role);
    res.json({
      business: {
        id: req.auth.businessId,
        name: req.auth.businessName,
        role: req.auth.role,
        allowAdminCreateStaff: Boolean(req.auth.allowAdminCreateStaff),
      },
      user: req.auth.user,
      ...payload,
    });
  })
);

app.get(
  "/api/categories",
  requireAuth,
  asyncHandler(async (req, res) => {
    const categories = await loadBusinessCategories(pool, req.auth.businessId);
    res.json(categories);
  })
);

app.post(
  "/api/categories",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const name = normalizeItemCategory(req.body.name);
    if (!name) {
      sendError(res, 400, "Nama kategori wajib diisi.");
      return;
    }

    const result = await withTransaction(async (client) => {
      await upsertItemCategory(client, req.auth.businessId, name);
      return client.query(
        `
          select id, name, created_at, updated_at
          from item_categories
          where business_id = $1 and normalized_name = $2
          limit 1
        `,
        [req.auth.businessId, normalizeItemCategoryKey(name)]
      );
    });

    res.status(201).json(mapCategory(result.rows[0]));
  })
);

app.put(
  "/api/categories/:id",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const nextName = normalizeItemCategory(req.body.name);
    if (!nextName) {
      sendError(res, 400, "Nama kategori wajib diisi.");
      return;
    }

    const updated = await withTransaction(async (client) => {
      const categoryResult = await client.query(
        `
          select id, name
          from item_categories
          where id = $1 and business_id = $2
          limit 1
        `,
        [req.params.id, req.auth.businessId]
      );

      if (categoryResult.rowCount === 0) {
        throw createHttpError(404, "Kategori tidak ditemukan.");
      }

      const previousName = categoryResult.rows[0].name;
      await client.query(
        `
          update item_categories
          set name = $3, normalized_name = $4, updated_at = now()
          where id = $1 and business_id = $2
        `,
        [req.params.id, req.auth.businessId, nextName, normalizeItemCategoryKey(nextName)]
      );
      await client.query(
        `
          update items
          set category = $3, updated_at = now()
          where business_id = $1 and category = $2
        `,
        [req.auth.businessId, previousName, nextName]
      );

      return client.query(
        `
          select id, name, created_at, updated_at
          from item_categories
          where id = $1 and business_id = $2
          limit 1
        `,
        [req.params.id, req.auth.businessId]
      );
    });

    res.json(mapCategory(updated.rows[0]));
  })
);

app.delete(
  "/api/categories/:id",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const categoryResult = await query(
      `
        select id, name
        from item_categories
        where id = $1 and business_id = $2
        limit 1
      `,
      [req.params.id, req.auth.businessId]
    );

    if (categoryResult.rowCount === 0) {
      sendError(res, 404, "Kategori tidak ditemukan.");
      return;
    }

    const usageResult = await query(
      `
        select 1
        from items
        where business_id = $1 and category = $2
        limit 1
      `,
      [req.auth.businessId, categoryResult.rows[0].name]
    );

    if (usageResult.rowCount > 0) {
      sendError(res, 409, "Kategori masih dipakai oleh barang, jadi belum bisa dihapus.");
      return;
    }

    await query("delete from item_categories where id = $1 and business_id = $2", [req.params.id, req.auth.businessId]);
    res.json({ ok: true });
  })
);

app.post(
  "/api/items",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = randomId("itm_");
    const sellingPrice = toNullableNumber(req.body.sellingPrice);
    const category = normalizeItemCategory(req.body.category);
    const result = await withTransaction(async (client) => {
      await upsertItemCategory(client, req.auth.businessId, category);
      return client.query(
        `
          insert into items (id, business_id, name, category, type, unit, min_qty, selling_price)
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          returning *
        `,
        [id, req.auth.businessId, req.body.name, category, req.body.type, req.body.unit, Number(req.body.minQty), sellingPrice]
      );
    });

    res.status(201).json(mapItem(result.rows[0]));
  })
);

app.put(
  "/api/items/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sellingPrice = toNullableNumber(req.body.sellingPrice);
    const category = normalizeItemCategory(req.body.category);
    const result = await withTransaction(async (client) => {
      await upsertItemCategory(client, req.auth.businessId, category);
      return client.query(
        `
          update items
          set
            name = $3,
            category = $4,
            type = $5,
            unit = $6,
            min_qty = $7,
            selling_price = $8,
            updated_at = now()
          where id = $1 and business_id = $2
          returning *
        `,
        [req.params.id, req.auth.businessId, req.body.name, category, req.body.type, req.body.unit, Number(req.body.minQty), sellingPrice]
      );
    });

    if (result.rowCount === 0) {
      sendError(res, 404, "Barang tidak ditemukan.");
      return;
    }

    res.json(mapItem(result.rows[0]));
  })
);

app.get(
  "/api/items/:id/photo",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        select mime_type, data
        from item_photos
        where item_id = $1 and business_id = $2
        limit 1
      `,
      [req.params.id, req.auth.businessId]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Foto produk tidak ditemukan.");
      return;
    }

    res.setHeader("Content-Type", result.rows[0].mime_type);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(result.rows[0].data);
  })
);

app.post(
  "/api/items/:id/photo",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const dataUrl = typeof req.body.dataUrl === "string" ? req.body.dataUrl : "";
    const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!matches) {
      sendError(res, 400, "Format foto produk tidak valid.");
      return;
    }

    const mimeType = matches[1];
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      sendError(res, 400, "Format foto yang didukung hanya JPEG, PNG, atau WebP.");
      return;
    }

    const data = Buffer.from(matches[2], "base64");
    if (data.byteLength > 3 * 1024 * 1024) {
      sendError(res, 400, "Ukuran foto maksimal 3 MB setelah dikompres.");
      return;
    }

    const itemResult = await query(
      `
        select id
        from items
        where id = $1 and business_id = $2
        limit 1
      `,
      [req.params.id, req.auth.businessId]
    );

    if (itemResult.rowCount === 0) {
      sendError(res, 404, "Barang tidak ditemukan.");
      return;
    }

    await query(
      `
        insert into item_photos (item_id, business_id, mime_type, data, size_bytes)
        values ($1, $2, $3, $4, $5)
        on conflict (item_id)
        do update set mime_type = excluded.mime_type, data = excluded.data, size_bytes = excluded.size_bytes, updated_at = now()
      `,
      [req.params.id, req.auth.businessId, mimeType, data, data.byteLength]
    );

    res.status(201).json({
      ok: true,
      photoUrl: buildItemPhotoUrl(req.params.id, Date.now()),
      hasPhoto: true,
    });
  })
);

app.delete(
  "/api/items/:id/photo",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    await query("delete from item_photos where item_id = $1 and business_id = $2", [req.params.id, req.auth.businessId]);
    res.json({ ok: true });
  })
);

app.delete(
  "/api/items/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query("delete from items where id = $1 and business_id = $2 returning id", [req.params.id, req.auth.businessId]);

    if (result.rowCount === 0) {
      sendError(res, 404, "Barang tidak ditemukan.");
      return;
    }

    res.json({ ok: true });
  })
);

app.post(
  "/api/purchases",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        insert into purchases (id, business_id, date, item_id, qty, total_cost)
        values ($1, $2, $3, $4, $5, $6)
        returning *
      `,
      [randomId("pur_"), req.auth.businessId, req.body.date, req.body.itemId, Number(req.body.qty), Number(req.body.totalCost)]
    );

    res.status(201).json(mapPurchase(result.rows[0]));
  })
);

app.put(
  "/api/purchases/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        update purchases
        set date = $3, item_id = $4, qty = $5, total_cost = $6, updated_at = now()
        where id = $1 and business_id = $2
        returning *
      `,
      [req.params.id, req.auth.businessId, req.body.date, req.body.itemId, Number(req.body.qty), Number(req.body.totalCost)]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Pembelian tidak ditemukan.");
      return;
    }

    res.json(mapPurchase(result.rows[0]));
  })
);

app.delete(
  "/api/purchases/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query("delete from purchases where id = $1 and business_id = $2 returning id", [req.params.id, req.auth.businessId]);

    if (result.rowCount === 0) {
      sendError(res, 404, "Pembelian tidak ditemukan.");
      return;
    }

    res.json({ ok: true });
  })
);

app.post(
  "/api/productions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rawMaterials = JSON.parse(req.body.rawMaterialsJSON || "[]");
    if (!Array.isArray(rawMaterials)) {
      sendError(res, 400, "Format bahan baku produksi tidak valid.");
      return;
    }

    const created = await withTransaction(async (client) => {
      const productionId = randomId("prd_");
      const productionResult = await client.query(
        `
          insert into productions (id, business_id, date, finished_item_id, finished_qty, overhead_cost, total_hpp)
          values ($1, $2, $3, $4, $5, $6, $7)
          returning *
        `,
        [
          productionId,
          req.auth.businessId,
          req.body.date,
          req.body.finishedItemId,
          Number(req.body.finishedQty),
          Number(req.body.overheadCost),
          Number(req.body.totalHPP),
        ]
      );

      for (const material of rawMaterials) {
        await client.query(
          `
            insert into production_materials (id, business_id, production_id, item_id, qty)
            values ($1, $2, $3, $4, $5)
          `,
          [randomId("pm_"), req.auth.businessId, productionId, material.id, Number(material.qty)]
        );
      }

      return mapProduction(productionResult.rows[0], rawMaterials.map((material) => ({
        production_id: productionId,
        item_id: material.id,
        qty: material.qty,
      })));
    });

    res.status(201).json(created);
  })
);

app.post(
  "/api/sales",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        insert into sales (id, business_id, date, item_id, qty, total_revenue, source, unit_price)
        values ($1, $2, $3, $4, $5, $6, 'manual', $7)
        returning *
      `,
      [
        randomId("sal_"),
        req.auth.businessId,
        req.body.date,
        req.body.itemId,
        Number(req.body.qty),
        Number(req.body.totalRevenue),
        Number(req.body.qty) > 0 ? Number(req.body.totalRevenue) / Number(req.body.qty) : 0,
      ]
    );

    res.status(201).json(mapSale(result.rows[0]));
  })
);

app.put(
  "/api/sales/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        update sales
        set date = $3, item_id = $4, qty = $5, total_revenue = $6, unit_price = $7, updated_at = now()
        where id = $1 and business_id = $2
        returning *
      `,
      [
        req.params.id,
        req.auth.businessId,
        req.body.date,
        req.body.itemId,
        Number(req.body.qty),
        Number(req.body.totalRevenue),
        Number(req.body.qty) > 0 ? Number(req.body.totalRevenue) / Number(req.body.qty) : 0,
      ]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Penjualan tidak ditemukan.");
      return;
    }

    res.json(mapSale(result.rows[0]));
  })
);

app.delete(
  "/api/sales/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query("delete from sales where id = $1 and business_id = $2 returning id", [req.params.id, req.auth.businessId]);

    if (result.rowCount === 0) {
      sendError(res, 404, "Penjualan tidak ditemukan.");
      return;
    }

    res.json({ ok: true });
  })
);

app.get(
  "/api/pos/bootstrap",
  requireAuth,
  requirePosAccess,
  asyncHandler(async (req, res) => {
    const [items, categories, posSettings, todaysOrders] = await Promise.all([
      loadFinishedGoodsCatalog(pool, req.auth.businessId),
      loadBusinessCategories(pool, req.auth.businessId),
      loadBusinessPosSettings(pool, req.auth.businessId),
      loadPosOrders(pool, req.auth.businessId, { date: new Date().toISOString().slice(0, 10), limit: 20 }),
    ]);
    const stockByItemId = await loadAvailableStockByItemIds(
      pool,
      req.auth.businessId,
      items.map((item) => item.id)
    );

    res.json({
      business: {
        id: req.auth.businessId,
        name: req.auth.businessName,
        role: req.auth.role,
      },
      user: req.auth.user,
      items: items.map((item) => ({
        ...item,
        stockQty: stockByItemId[item.id] || 0,
      })),
      categories,
      posSettings,
      todaysOrders,
    });
  })
);

app.get(
  "/api/pos/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const posSettings = await loadBusinessPosSettings(pool, req.auth.businessId);
    res.json(posSettings);
  })
);

app.put(
  "/api/pos/settings",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const paperWidth = req.body.paperWidth === "80mm" ? "80mm" : "58mm";
    const headerText = typeof req.body.headerText === "string" ? req.body.headerText.trim() : "";
    const footerText = typeof req.body.footerText === "string" ? req.body.footerText.trim() : "";
    const showCashier = req.body.showCashier !== false;
    const showPaymentMethod = req.body.showPaymentMethod !== false;

    await query(
      `
        insert into business_pos_settings (
          id, business_id, paper_width, header_text, footer_text, show_cashier, show_payment_method
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (business_id)
        do update set
          paper_width = excluded.paper_width,
          header_text = excluded.header_text,
          footer_text = excluded.footer_text,
          show_cashier = excluded.show_cashier,
          show_payment_method = excluded.show_payment_method,
          updated_at = now()
      `,
      [randomId("bps_"), req.auth.businessId, paperWidth, headerText, footerText, showCashier, showPaymentMethod]
    );

    const posSettings = await loadBusinessPosSettings(pool, req.auth.businessId);
    res.json(posSettings);
  })
);

app.post(
  "/api/pos/checkout",
  requireAuth,
  requirePosAccess,
  asyncHandler(async (req, res) => {
    const date = typeof req.body.date === "string" ? req.body.date : "";
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

    if (!date) {
      sendError(res, 400, "Tanggal transaksi wajib diisi.");
      return;
    }

    if (lines.length === 0) {
      sendError(res, 400, "Keranjang PoS masih kosong.");
      return;
    }

    const uniqueItemIds = [...new Set(lines.map((line) => (typeof line.itemId === "string" ? line.itemId : "")).filter(Boolean))];
    const requestedQtyByItemId = {};

    for (const line of lines) {
      const qty = Number(line.qty);
      const itemId = typeof line.itemId === "string" ? line.itemId : "";

      if (!itemId || !Number.isFinite(qty) || qty <= 0) {
        sendError(res, 400, "Format item PoS tidak valid.");
        return;
      }

      requestedQtyByItemId[itemId] = (requestedQtyByItemId[itemId] || 0) + qty;
    }

    const posSettings = await loadBusinessPosSettings(pool, req.auth.businessId);
    const priceSnapshot = await query(
      `
        select id, selling_price
        from items
        where business_id = $1 and id = any($2::text[])
      `,
      [req.auth.businessId, uniqueItemIds]
    );
    const priceById = new Map(priceSnapshot.rows.map((row) => [row.id, Number(row.selling_price || 0)]));
    const estimatedTotal = lines.reduce(
      (sum, line) => sum + Number(line.qty || 0) * (priceById.get(typeof line.itemId === "string" ? line.itemId : "") || 0),
      0
    );
    const paidAmount = toNonNegativeNumber(req.body.cashReceived, estimatedTotal);
    const payload = await withTransaction((client) =>
      createPosOrder(client, {
        businessId: req.auth.businessId,
        auth: req.auth,
        date,
        lines: lines.map((line) => ({ itemId: line.itemId, qty: Number(line.qty) })),
        paymentMethod: "cash",
        paidAmount,
        changeAmount: Math.max(0, paidAmount - estimatedTotal),
        posSettings,
      })
    );

    res.status(201).json(payload);
  })
);

app.post(
  "/api/pos/orders",
  requireAuth,
  requirePosAccess,
  asyncHandler(async (req, res) => {
    const date = typeof req.body.date === "string" ? req.body.date : "";
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    const paymentMethod = normalizePosPaymentMethod(req.body.paymentMethod);

    if (!date) {
      sendError(res, 400, "Tanggal transaksi wajib diisi.");
      return;
    }

    if (lines.length === 0) {
      sendError(res, 400, "Keranjang PoS masih kosong.");
      return;
    }

    const normalizedLines = lines.map((line) => ({
      itemId: typeof line.itemId === "string" ? line.itemId : "",
      qty: Number(line.qty),
    }));

    if (normalizedLines.some((line) => !line.itemId || !Number.isFinite(line.qty) || line.qty <= 0)) {
      sendError(res, 400, "Format item PoS tidak valid.");
      return;
    }

    const posSettings = await loadBusinessPosSettings(pool, req.auth.businessId);
    const requestedIds = normalizedLines.map((line) => line.itemId);
    const priceSnapshot = await query(
      `
        select id, selling_price
        from items
        where business_id = $1 and id = any($2::text[])
      `,
      [req.auth.businessId, requestedIds]
    );
    const priceById = new Map(priceSnapshot.rows.map((row) => [row.id, Number(row.selling_price || 0)]));
    const estimatedTotal = normalizedLines.reduce((sum, line) => sum + line.qty * (priceById.get(line.itemId) || 0), 0);
    const paidAmount =
      paymentMethod === "cash" ? toNonNegativeNumber(req.body.paidAmount, estimatedTotal) : estimatedTotal;
    const changeAmount = paymentMethod === "cash" ? Math.max(0, paidAmount - estimatedTotal) : 0;

    if (paymentMethod === "cash" && paidAmount < estimatedTotal) {
      sendError(res, 400, "Uang bayar masih kurang dari total transaksi.");
      return;
    }

    const payload = await withTransaction((client) =>
      createPosOrder(client, {
        businessId: req.auth.businessId,
        auth: req.auth,
        date,
        lines: normalizedLines,
        paymentMethod,
        paidAmount,
        changeAmount,
        posSettings,
      })
    );

    res.status(201).json({
      ...payload,
      invoiceUrl: `${config.appUrl}/public/invoices/${payload.order.shareToken}`,
    });
  })
);

app.get(
  "/api/pos/orders/today",
  requireAuth,
  requirePosAccess,
  asyncHandler(async (req, res) => {
    const today = typeof req.query.date === "string" && req.query.date ? req.query.date : new Date().toISOString().slice(0, 10);
    const orders = await loadPosOrders(pool, req.auth.businessId, { date: today, limit: 30 });
    res.json(orders);
  })
);

app.get(
  "/public/invoices/:token",
  asyncHandler(async (req, res) => {
    const payload = await loadPosOrderByShareToken(pool, req.params.token);
    if (!payload) {
      sendError(res, 404, "Invoice tidak ditemukan.");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(createReceiptHtml(payload.order, payload.businessName));
  })
);

app.post(
  "/api/assistant/intake-plan",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userMessage = typeof req.body.userMessage === "string" ? req.body.userMessage.trim() : "";
    const imageDataUrl = typeof req.body.imageDataUrl === "string" ? req.body.imageDataUrl : "";
    const catalogItems = await loadFinishedGoodsCatalog(pool, req.auth.businessId);
    const allCatalogItemsResult = await query(
      `
        select
          items.*,
          false as has_photo,
          null::timestamptz as photo_updated_at
        from items
        where items.business_id = $1
        order by items.name asc
      `,
      [req.auth.businessId]
    );

    if (!userMessage && !imageDataUrl) {
      sendError(res, 400, "Teks atau foto struk wajib diisi.");
      return;
    }

    const plan = await planTransactionIntake({
      apiKey: config.falKey,
      textModel: config.aiTextModel,
      visionModel: config.aiVisionModel,
      fallbackModel: config.aiFallbackModel,
      todayDate: new Date().toISOString().slice(0, 10),
      businessRole: req.auth.role,
      userMessage,
      imageDataUrl,
      catalog: {
        items: allCatalogItemsResult.rows.map(mapItem).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          type: item.type,
          unit: item.unit,
          sellingPrice: item.sellingPrice,
        })),
      },
    });

    if (!isSupportedTransactionTarget(plan.targetMenu)) {
      sendError(res, 400, "AI hanya mendukung draft pembelian, penjualan, atau beban pada fase ini.");
      return;
    }

    await logAiIntake(pool, {
      businessId: req.auth.businessId,
      userId: req.auth.userId,
      source: imageDataUrl ? "app_receipt" : "app_text",
      mode: imageDataUrl ? "image" : "text",
      model: plan.model,
      status: "draft",
      promptExcerpt: userMessage || "[image receipt]",
      resultJson: plan,
      confidence: plan.confidence,
    });

    res.json({
      ...plan,
      catalogFinishedItems: catalogItems,
    });
  })
);

app.post(
  "/api/integrations/telegram/link",
  requireAuth,
  asyncHandler(async (req, res) => {
    const linkCode = randomId("tg_").slice(0, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `
        insert into telegram_chat_links (id, business_id, user_id, member_id, link_code, expires_at)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [randomId("tgl_"), req.auth.businessId, req.auth.userId, req.auth.membershipId || null, linkCode, expiresAt.toISOString()]
    );

    res.status(201).json({
      linkCode,
      expiresAt: expiresAt.toISOString(),
      command: `/link ${linkCode}`,
      botConfigured: Boolean(config.telegramBotToken),
    });
  })
);

app.post(
  "/api/integrations/telegram/webhook",
  asyncHandler(async (req, res) => {
    if (config.telegramWebhookSecret) {
      const headerSecret = req.headers["x-telegram-bot-api-secret-token"];
      if (headerSecret !== config.telegramWebhookSecret) {
        sendError(res, 401, "Secret Telegram tidak valid.");
        return;
      }
    }

    const message = req.body?.message;
    if (!message?.chat?.id) {
      res.json({ ok: true });
      return;
    }

    const chatId = String(message.chat.id);
    const text = typeof message.text === "string" ? message.text.trim() : "";

    if (text.startsWith("/link ")) {
      const linkCode = text.replace("/link", "").trim();
      const linkResult = await query(
        `
          update telegram_chat_links
          set chat_id = $2, chat_username = $3, link_status = 'linked', linked_at = now(), updated_at = now()
          where link_code = $1 and expires_at > now() and link_status = 'pending'
          returning business_id
        `,
        [linkCode, chatId, message.from?.username || null]
      );

      const replyText =
        linkResult.rowCount > 0
          ? "Telegram berhasil terhubung. Sekarang Anda bisa kirim teks atau foto struk untuk dibuatkan draft transaksi."
          : "Kode link tidak valid atau sudah kedaluwarsa.";
      await sendTelegramMessage(chatId, replyText);

      res.json({ ok: true });
      return;
    }

    const linkResult = await query(
      `
        select *
        from telegram_chat_links
        where chat_id = $1 and link_status = 'linked'
        limit 1
      `,
      [chatId]
    );

    if (linkResult.rowCount === 0) {
      res.json({ ok: true });
      return;
    }

    const link = linkResult.rows[0];
    if (text === "/confirm") {
      const pendingDraftRow = await loadLatestTelegramDraft(pool, link.id);
      if (!pendingDraftRow) {
        await sendTelegramMessage(chatId, "Belum ada draft aktif yang bisa disimpan. Kirim teks atau foto struk dulu.");
        res.json({ ok: true });
        return;
      }

      try {
        const committed = await withTransaction(async (client) => {
          const result = await commitTelegramDraft(client, {
            businessId: link.business_id,
            draft: pendingDraftRow.draft_json,
          });

          await client.query("delete from telegram_pending_drafts where chat_link_id = $1", [link.id]);
          return result;
        });

        await sendTelegramMessage(
          chatId,
          `${buildMenuLabel(committed.targetMenu)} berhasil disimpan.\nReferensi: ${committed.record.id}\nAnda bisa kirim transaksi berikutnya kapan saja.`
        );
      } catch (error) {
        await sendTelegramMessage(chatId, error?.message || "Draft belum bisa disimpan. Coba kirim ulang detail yang lebih lengkap.");
      }

      res.json({ ok: true });
      return;
    }

    if (text === "/batal" || text === "/cancel") {
      await query("delete from telegram_pending_drafts where chat_link_id = $1", [link.id]);
      await sendTelegramMessage(chatId, "Draft transaksi dibatalkan.");
      res.json({ ok: true });
      return;
    }

    const photoEntries = Array.isArray(message.photo) ? message.photo : [];
    if (!text && photoEntries.length === 0) {
      res.json({ ok: true });
      return;
    }

    let imageDataUrl = "";

    if (photoEntries.length > 0 && config.telegramBotToken) {
      const fileId = photoEntries[photoEntries.length - 1].file_id;
      const fileMetaResponse = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getFile?file_id=${fileId}`).then((value) =>
        value.json()
      );
      const filePath = fileMetaResponse?.result?.file_path;
      if (filePath) {
        const fileResponse = await fetch(`https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`);
        const arrayBuffer = await fileResponse.arrayBuffer();
        imageDataUrl = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
      }
    }

    const allCatalogItemsResult = await query(
      `
        select
          items.*,
          false as has_photo,
          null::timestamptz as photo_updated_at
        from items
        where items.business_id = $1
        order by items.name asc
      `,
      [link.business_id]
    );

    const draft = await planTransactionIntake({
      apiKey: config.falKey,
      textModel: config.aiTextModel,
      visionModel: config.aiVisionModel,
      fallbackModel: config.aiFallbackModel,
      todayDate: new Date().toISOString().slice(0, 10),
      businessRole: "staff",
      userMessage: text,
      imageDataUrl,
      catalog: {
        items: allCatalogItemsResult.rows.map(mapItem).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          type: item.type,
          unit: item.unit,
          sellingPrice: item.sellingPrice,
        })),
      },
    });

    await logAiIntake(pool, {
      businessId: link.business_id,
      userId: link.user_id,
      telegramChatId: chatId,
      source: imageDataUrl ? "telegram_receipt" : "telegram_text",
      mode: imageDataUrl ? "image" : "text",
      model: draft.model,
      status: "draft",
      promptExcerpt: text || "[telegram image]",
      resultJson: draft,
      confidence: draft.confidence,
    });

    const missingCommitFields = collectDraftCommitMissingFields(draft);
    const totalLabel =
      draft.targetMenu === "sales"
        ? `Rp ${Number(draft.fields.totalRevenue || 0).toLocaleString("id-ID")}`
        : draft.targetMenu === "purchases"
          ? `Rp ${Number(draft.fields.totalCost || 0).toLocaleString("id-ID")}`
          : `Rp ${Number(draft.fields.amount || 0).toLocaleString("id-ID")}`;

    if (missingCommitFields.length > 0) {
      await sendTelegramMessage(
        chatId,
        `Draft ${buildMenuLabel(draft.targetMenu)} belum siap disimpan.\n${draft.summary}\nField yang masih perlu dilengkapi: ${missingCommitFields.join(", ")}.\nKirim ulang detail yang lebih jelas atau gunakan dashboard untuk pengecekan manual.`
      );
      res.json({ ok: true });
      return;
    }

    await query("delete from telegram_pending_drafts where chat_link_id = $1", [link.id]);

    await query(
      `
        insert into telegram_pending_drafts (id, business_id, chat_link_id, target_menu, draft_json, expires_at)
        values ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [randomId("tgd_"), link.business_id, link.id, draft.targetMenu, JSON.stringify(draft), new Date(Date.now() + 15 * 60 * 1000).toISOString()]
    );

    await sendTelegramMessage(
      chatId,
      `Draft ${buildMenuLabel(draft.targetMenu)} siap.\n${draft.summary}\nNominal: ${totalLabel}\nBalas /confirm untuk simpan atau /batal untuk membatalkan draft ini.`
    );

    res.json({ ok: true });
  })
);

app.post(
  "/api/expenses",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        insert into expenses (id, business_id, date, description, amount)
        values ($1, $2, $3, $4, $5)
        returning *
      `,
      [randomId("exp_"), req.auth.businessId, req.body.date, req.body.description, Number(req.body.amount)]
    );

    res.status(201).json(mapExpense(result.rows[0]));
  })
);

app.put(
  "/api/expenses/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        update expenses
        set date = $3, description = $4, amount = $5, updated_at = now()
        where id = $1 and business_id = $2
        returning *
      `,
      [req.params.id, req.auth.businessId, req.body.date, req.body.description, Number(req.body.amount)]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Beban tidak ditemukan.");
      return;
    }

    res.json(mapExpense(result.rows[0]));
  })
);

app.delete(
  "/api/expenses/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query("delete from expenses where id = $1 and business_id = $2 returning id", [req.params.id, req.auth.businessId]);

    if (result.rowCount === 0) {
      sendError(res, 404, "Beban tidak ditemukan.");
      return;
    }

    res.json({ ok: true });
  })
);

app.post(
  "/api/members",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const createBusinessOnRequestedName = Boolean(req.body.createBusinessOnRequestedName);
    const requestedBusinessName = typeof req.body.businessName === "string" ? req.body.businessName.trim() : "";

    if (createBusinessOnRequestedName && !requestedBusinessName) {
      sendError(res, 400, "Nama bisnis baru wajib diisi.");
      return;
    }

    const created = await withTransaction(async (client) =>
      createBusinessMemberRecord(client, {
        actorRole: req.auth.role,
        actorBusinessId: req.auth.businessId,
        email: req.body.email,
        role: req.body.role,
        password: req.body.password,
        requestedBusinessId: createBusinessOnRequestedName ? undefined : req.body.businessId,
        requestedBusinessName,
        fallbackBusinessId: req.auth.businessId,
        createBusinessOnRequestedName,
      })
    );

    res.status(201).json(created);
  })
);

app.post(
  "/api/members/bulk",
  requireAuth,
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const defaultBusinessId = typeof req.body.defaultBusinessId === "string" ? req.body.defaultBusinessId.trim() : "";

    if (rows.length === 0) {
      sendError(res, 400, "File upload tidak berisi data user.");
      return;
    }

    if (rows.length > 250) {
      sendError(res, 400, "Bulk upload maksimal 250 user per proses.");
      return;
    }

    const created = [];
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = Number.isFinite(Number(row.rowNumber)) ? Number(row.rowNumber) : index + 2;

      try {
        const requestedRole = typeof row.role === "string" ? normalizeBusinessRole(row.role) : "";

        if (requestedRole && requestedRole !== "admin") {
          throw createHttpError(400, "Bulk upload admin hanya menerima role admin.");
        }

        const member = await withTransaction(async (client) =>
          createBusinessMemberRecord(client, {
            actorRole: req.auth.role,
            actorBusinessId: req.auth.businessId,
            email: row.email,
            role: "admin",
            password: row.password,
            requestedBusinessName: row.businessName,
            fallbackBusinessId: defaultBusinessId || req.auth.businessId,
            requirePassword: true,
          })
        );

        created.push(member);
      } catch (error) {
        errors.push({
          rowNumber,
          email: typeof row.email === "string" ? normalizeEmail(row.email) : "",
          role: "admin",
          businessName: typeof row.businessName === "string" && row.businessName.trim() ? row.businessName.trim() : undefined,
          message: error?.message || "Gagal memproses user.",
        });
      }
    }

    res.status(errors.length > 0 ? 200 : 201).json({
      total: rows.length,
      createdCount: created.length,
      failedCount: errors.length,
      created,
      errors,
    });
  })
);

app.put(
  "/api/members/:id",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const role = normalizeBusinessRole(typeof req.body.role === "string" ? req.body.role : "staff");
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!isManagedRole(role)) {
      sendError(res, 400, "Role user tidak valid.");
      return;
    }

    if (!canAssignRole(req.auth.role, role)) {
      sendError(res, 403, "Anda tidak memiliki izin untuk mengubah role user menjadi role tersebut.");
      return;
    }

    if (password && password.length < 6) {
      sendError(res, 400, "Kata sandi minimal 6 karakter.");
      return;
    }

    const updated = await withTransaction(async (client) => {
      const memberScopeParams = req.auth.role === "super_admin" ? [req.params.id] : [req.params.id, req.auth.businessId];
      const memberResult = await client.query(
        `
          select id, role, status, user_id, invitation_email, business_id
          from business_members
          where id = $1
            ${req.auth.role === "super_admin" ? "" : "and business_id = $2"}
          limit 1
        `,
        memberScopeParams
      );

      if (memberResult.rowCount === 0) {
        const error = new Error("User bisnis tidak ditemukan.");
        error.status = 404;
        throw error;
      }

      const member = {
        ...memberResult.rows[0],
        role: normalizeBusinessRole(memberResult.rows[0].role),
      };
      const targetBusinessId = member.business_id;

      if (!canManageMemberRole(req.auth.role, member.role)) {
        const error = new Error("Anda tidak memiliki izin untuk mengubah user ini.");
        error.status = 403;
        throw error;
      }

      if (role === "admin") {
        await assertBusinessCanHaveAdmin(client, targetBusinessId, req.params.id);
      }

      let userId = member.user_id;
      let invitationEmail = member.invitation_email;
      let status = member.status;

      if (password) {
        const passwordHash = await hashPassword(password);

        if (member.status === "invited") {
          const invitedEmail = normalizeEmail(member.invitation_email || "");
          if (!invitedEmail) {
            const error = new Error("Undangan user tidak memiliki email yang valid.");
            error.status = 400;
            throw error;
          }

          const existingUser = await client.query("select id from users where email = $1 limit 1", [invitedEmail]);

          if (existingUser.rowCount > 0) {
            userId = existingUser.rows[0].id;
            await client.query(
              `
                update users
                set password_hash = $2, updated_at = now()
                where id = $1
              `,
              [userId, passwordHash]
            );
          } else {
            userId = randomId("usr_");
            await client.query(
              `
                insert into users (id, email, password_hash, display_name)
                values ($1, $2, $3, $4)
              `,
              [userId, invitedEmail, passwordHash, buildDisplayNameFromEmail(invitedEmail)]
            );
          }

          invitationEmail = null;
          status = "active";
        } else if (member.user_id) {
          await client.query(
            `
              update users
              set password_hash = $2, updated_at = now()
              where id = $1
            `,
            [member.user_id, passwordHash]
          );
        }
      }

      const result = await client.query(
        `
          update business_members
          set role = $3, user_id = $4, invitation_email = $5, status = $6
          where id = $1 and business_id = $2
          returning
            id,
            coalesce((select email from users where id = business_members.user_id), business_members.invitation_email) as email,
            role,
            status,
            created_at,
            business_id,
            (select name from businesses where id = business_members.business_id) as business_name
        `,
        [req.params.id, targetBusinessId, role, userId, invitationEmail, status]
      );

      return mapMember(result.rows[0]);
    });

    res.json(updated);
  })
);

app.delete(
  "/api/members/:id",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const memberScopeParams = req.auth.role === "super_admin" ? [req.params.id] : [req.params.id, req.auth.businessId];
    const memberResult = await query(
      `
        select id, role, user_id, business_id
        from business_members
        where id = $1
          ${req.auth.role === "super_admin" ? "" : "and business_id = $2"}
        limit 1
      `,
      memberScopeParams
    );

    if (memberResult.rowCount === 0) {
      sendError(res, 404, "User bisnis tidak ditemukan.");
      return;
    }

    const member = memberResult.rows[0];
    const targetBusinessId = member.business_id;

    if (!canManageMemberRole(req.auth.role, member.role)) {
      sendError(res, 403, "Anda tidak memiliki izin untuk menghapus user ini.");
      return;
    }

    if (member.user_id && member.user_id === req.auth.userId) {
      sendError(res, 400, "Akun yang sedang Anda pakai tidak bisa dihapus dari panel ini.");
      return;
    }

    await query("delete from business_members where id = $1 and business_id = $2", [req.params.id, targetBusinessId]);
    res.json({ ok: true });
  })
);

app.put(
  "/api/businesses/:id/staff-creation-access",
  requireAuth,
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    if (typeof req.body.allowAdminCreateStaff !== "boolean") {
      sendError(res, 400, "Nilai izin pembuatan staff tidak valid.");
      return;
    }

    const result = await query(
      `
        update businesses
        set allow_admin_create_staff = $2
        where id = $1
        returning id, name, allow_admin_create_staff
      `,
      [req.params.id, req.body.allowAdminCreateStaff]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Bisnis tidak ditemukan.");
      return;
    }

    res.json(mapBusiness(result.rows[0]));
  })
);

app.post(
  "/api/business/menu-packages",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : null;
    const menuVisibility = normalizeMenuVisibility(req.body.menuVisibility || {}, false);

    if (!name) {
      sendError(res, 400, "Nama user role wajib diisi.");
      return;
    }

    const response = await withTransaction(async (client) => {
      await client.query(
        `
          insert into business_menu_packages (id, business_id, name, description, menu_visibility_json)
          values ($1, $2, $3, $4, $5::jsonb)
        `,
        [randomId("bmp_"), req.auth.businessId, name, description, JSON.stringify(menuVisibility)]
      );

      return loadBusinessMenuState(client, req.auth.businessId);
    });

    res.status(201).json(response);
  })
);

app.put(
  "/api/business/menu-packages/:id",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : null;
    const menuVisibility = normalizeMenuVisibility(req.body.menuVisibility || {}, false);

    if (!name) {
      sendError(res, 400, "Nama user role wajib diisi.");
      return;
    }

    const response = await withTransaction(async (client) => {
      const packageResult = await client.query(
        `
          select id, is_active
          from business_menu_packages
          where id = $1 and business_id = $2
          limit 1
        `,
        [req.params.id, req.auth.businessId]
      );

      if (packageResult.rowCount === 0) {
        const error = new Error("User role tidak ditemukan.");
        error.status = 404;
        throw error;
      }

      await client.query(
        `
          update business_menu_packages
          set name = $3, description = $4, menu_visibility_json = $5::jsonb, updated_at = now()
          where id = $1 and business_id = $2
        `,
        [req.params.id, req.auth.businessId, name, description, JSON.stringify(menuVisibility)]
      );

      if (packageResult.rows[0].is_active) {
        await upsertBusinessMenuVisibility(client, req.auth.businessId, menuVisibility);
      }

      return loadBusinessMenuState(client, req.auth.businessId);
    });

    res.json(response);
  })
);

app.delete(
  "/api/business/menu-packages/:id",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const response = await withTransaction(async (client) => {
      const packageResult = await client.query(
        `
          select id
          from business_menu_packages
          where id = $1 and business_id = $2
          limit 1
        `,
        [req.params.id, req.auth.businessId]
      );

      if (packageResult.rowCount === 0) {
        const error = new Error("User role tidak ditemukan.");
        error.status = 404;
        throw error;
      }

      await client.query("delete from business_menu_packages where id = $1 and business_id = $2", [req.params.id, req.auth.businessId]);
      return loadBusinessMenuState(client, req.auth.businessId);
    });

    res.json(response);
  })
);

app.post(
  "/api/business/menu-packages/:id/apply",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const response = await withTransaction(async (client) => {
      const packageResult = await client.query(
        `
          select id, menu_visibility_json
          from business_menu_packages
          where id = $1 and business_id = $2
          limit 1
        `,
        [req.params.id, req.auth.businessId]
      );

      if (packageResult.rowCount === 0) {
        const error = new Error("User role tidak ditemukan.");
        error.status = 404;
        throw error;
      }

      const packageVisibility = normalizeMenuVisibility(packageResult.rows[0].menu_visibility_json || {}, false);

      await client.query("update business_menu_packages set is_active = false where business_id = $1", [req.auth.businessId]);
      await client.query(
        `
          update business_menu_packages
          set is_active = true, updated_at = now()
          where id = $1 and business_id = $2
        `,
        [req.params.id, req.auth.businessId]
      );

      await upsertBusinessMenuVisibility(client, req.auth.businessId, packageVisibility);
      return loadBusinessMenuState(client, req.auth.businessId);
    });

    res.json(response);
  })
);

app.put(
  "/api/business/menu-visibility/:menuKey",
  requireAuth,
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const menuKey = req.params.menuKey;
    const isEnabled = req.body.isEnabled;

    if (!isBusinessMenuKey(menuKey)) {
      sendError(res, 400, "Menu bisnis tidak valid.");
      return;
    }

    if (typeof isEnabled !== "boolean") {
      sendError(res, 400, "Status menu harus berupa boolean.");
      return;
    }

    await query(
      `
        insert into business_menu_settings (id, business_id, menu_key, is_enabled)
        values ($1, $2, $3, $4)
        on conflict (business_id, menu_key)
        do update set is_enabled = excluded.is_enabled, updated_at = now()
      `,
      [randomId("bms_"), req.auth.businessId, menuKey, isEnabled]
    );

    await query("update business_menu_packages set is_active = false where business_id = $1", [req.auth.businessId]);
    const menuState = await loadBusinessMenuState(pool, req.auth.businessId);

    res.json({
      menuVisibility: menuState.menuVisibility,
      menuPackages: menuState.menuPackages,
    });
  })
);

app.post(
  "/api/assistant/input-plan",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userMessage = typeof req.body.userMessage === "string" ? req.body.userMessage.trim() : "";
    const context = req.body.context && typeof req.body.context === "object" ? req.body.context : {};

    if (!userMessage) {
      sendError(res, 400, "Instruksi assistant wajib diisi.");
      return;
    }

    const plan = await planAssistantInput({
      apiKey: config.falKey,
      model: config.aiTextModel,
      userMessage,
      context: {
        ...context,
        businessRole: req.auth.role,
      },
    });

    res.json(plan);
  })
);

app.post(
  "/api/activity",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        insert into activity_logs (id, business_id, user_id, user_email, action, details)
        values ($1, $2, $3, $4, $5, $6)
        returning *
      `,
      [randomId("act_"), req.auth.businessId, req.auth.userId, req.auth.email, req.body.action, req.body.details]
    );

    res.status(201).json(mapActivity(result.rows[0]));
  })
);

const distPath = path.resolve(process.cwd(), "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  const posDistPath = path.join(distPath, "pos", "index.html");
  if (existsSync(posDistPath)) {
    app.get(/^\/pos(?:\/.*)?$/, (_req, res) => {
      res.sendFile(posDistPath);
    });
  }
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error.status) {
    sendError(res, error.status, error.message);
    return;
  }

  if (error.code === "23503") {
    sendError(res, 409, "Data ini masih dipakai oleh transaksi lain, jadi belum bisa dihapus.");
    return;
  }

  if (error.code === "23505") {
    sendError(res, 409, "Data dengan nilai unik yang sama sudah ada.");
    return;
  }

  sendError(res, 500, "Terjadi kesalahan internal pada server.");
});

if (config.autoMigrate) {
  await runMigrations();
}

app.listen(config.port, () => {
  console.log(`HPP Master backend listening on http://0.0.0.0:${config.port}`);
});
