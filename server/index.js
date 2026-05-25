import { existsSync } from "node:fs";
import path from "node:path";

import express from "express";

import { config } from "./config.js";
import { pool, query, runMigrations, withTransaction } from "./db.js";
import { businessMenuDefinitions, isBusinessMenuKey, mergeMenuVisibility, normalizeMenuVisibility } from "./menu-config.js";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./security.js";
import { asyncHandler, normalizeEmail, parseCookies, randomId, sendError, slugify, toNullableNumber } from "./utils.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.nodeEnv === "production",
  path: "/",
};

const normalizeBusinessRole = (role) => (role === "owner" ? "super_admin" : role);

const isManagedRole = (role) => ["admin", "staff"].includes(normalizeBusinessRole(role));

const canAssignRole = (actorRole, targetRole) => {
  const actor = normalizeBusinessRole(actorRole);
  const target = normalizeBusinessRole(targetRole);

  if (actor === "super_admin") return target === "admin" || target === "staff";
  if (actor === "admin") return target === "staff";
  return false;
};

const canManageMemberRole = (actorRole, targetRole) => {
  const actor = normalizeBusinessRole(actorRole);
  const target = normalizeBusinessRole(targetRole);

  if (actor === "super_admin") return target === "admin" || target === "staff";
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
  type: row.type,
  unit: row.unit,
  minQty: Number(row.min_qty),
  sellingPrice: row.selling_price === null ? undefined : Number(row.selling_price),
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

const buildDisplayNameFromEmail = (email) => email.split("@")[0] || "User";

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
        b.name as business_name
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

const loadBootstrap = async (businessId) => {
  const [
    itemsResult,
    purchasesResult,
    productionsResult,
    productionMaterialsResult,
    salesResult,
    expensesResult,
    membersResult,
    activitiesResult,
    menuState,
  ] =
    await Promise.all([
      query("select * from items where business_id = $1 order by created_at asc", [businessId]),
      query("select * from purchases where business_id = $1 order by date desc, created_at desc", [businessId]),
      query("select * from productions where business_id = $1 order by date desc, created_at desc", [businessId]),
      query("select * from production_materials where business_id = $1", [businessId]),
      query("select * from sales where business_id = $1 order by date desc, created_at desc", [businessId]),
      query("select * from expenses where business_id = $1 order by date desc, created_at desc", [businessId]),
      query(
        `
          select
            bm.id,
            coalesce(u.email, bm.invitation_email) as email,
            bm.role,
            bm.status,
            bm.created_at
          from business_members bm
          left join users u on u.id = bm.user_id
          where bm.business_id = $1
          order by
            case bm.role
              when 'super_admin' then 0
              when 'owner' then 0
              when 'admin' then 1
              else 2
            end,
            bm.created_at asc
        `,
        [businessId]
      ),
      query("select * from activity_logs where business_id = $1 order by created_at asc", [businessId]),
      loadBusinessMenuState(pool, businessId),
    ]);

  return {
    items: itemsResult.rows.map(mapItem),
    purchases: purchasesResult.rows.map(mapPurchase),
    productions: productionsResult.rows.map((row) => mapProduction(row, productionMaterialsResult.rows)),
    sales: salesResult.rows.map(mapSale),
    expenses: expensesResult.rows.map(mapExpense),
    appUsers: membersResult.rows.map(mapMember),
    activities: activitiesResult.rows.map(mapActivity),
    menuVisibility: menuState.menuVisibility,
    menuPackages: menuState.menuPackages,
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
      const businessResult = await client.query("select id, name from businesses where id = $1", [primaryBusinessId]);

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
      },
    });
  })
);

app.get(
  "/api/bootstrap",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = await loadBootstrap(req.auth.businessId);
    res.json({
      business: {
        id: req.auth.businessId,
        name: req.auth.businessName,
        role: req.auth.role,
      },
      user: req.auth.user,
      ...payload,
    });
  })
);

app.post(
  "/api/items",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = randomId("itm_");
    const sellingPrice = toNullableNumber(req.body.sellingPrice);
    const result = await query(
      `
        insert into items (id, business_id, name, type, unit, min_qty, selling_price)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
      [id, req.auth.businessId, req.body.name, req.body.type, req.body.unit, Number(req.body.minQty), sellingPrice]
    );

    res.status(201).json(mapItem(result.rows[0]));
  })
);

app.put(
  "/api/items/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sellingPrice = toNullableNumber(req.body.sellingPrice);
    const result = await query(
      `
        update items
        set
          name = $3,
          type = $4,
          unit = $5,
          min_qty = $6,
          selling_price = $7,
          updated_at = now()
        where id = $1 and business_id = $2
        returning *
      `,
      [req.params.id, req.auth.businessId, req.body.name, req.body.type, req.body.unit, Number(req.body.minQty), sellingPrice]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Barang tidak ditemukan.");
      return;
    }

    res.json(mapItem(result.rows[0]));
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
        insert into sales (id, business_id, date, item_id, qty, total_revenue)
        values ($1, $2, $3, $4, $5, $6)
        returning *
      `,
      [randomId("sal_"), req.auth.businessId, req.body.date, req.body.itemId, Number(req.body.qty), Number(req.body.totalRevenue)]
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
        set date = $3, item_id = $4, qty = $5, total_revenue = $6, updated_at = now()
        where id = $1 and business_id = $2
        returning *
      `,
      [req.params.id, req.auth.businessId, req.body.date, req.body.itemId, Number(req.body.qty), Number(req.body.totalRevenue)]
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
    const email = typeof req.body.email === "string" ? normalizeEmail(req.body.email) : "";
    const role = normalizeBusinessRole(typeof req.body.role === "string" ? req.body.role : "staff");
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!email) {
      sendError(res, 400, "Email user wajib diisi.");
      return;
    }

    if (!isManagedRole(role)) {
      sendError(res, 400, "Role user tidak valid.");
      return;
    }

    if (!canAssignRole(req.auth.role, role)) {
      sendError(res, 403, "Anda tidak memiliki izin untuk membuat role user tersebut.");
      return;
    }

    if (password && password.length < 6) {
      sendError(res, 400, "Kata sandi minimal 6 karakter.");
      return;
    }

    const created = await withTransaction(async (client) => {
      const duplicate = await client.query(
        `
          select bm.id
          from business_members bm
          left join users u on u.id = bm.user_id
          where bm.business_id = $1
            and (u.email = $2 or bm.invitation_email = $2)
          limit 1
        `,
        [req.auth.businessId, email]
      );

      if (duplicate.rowCount > 0) {
        const error = new Error("User dengan email ini sudah terdaftar di bisnis Anda.");
        error.status = 409;
        throw error;
      }

      const existingUser = await client.query("select id, email from users where email = $1 limit 1", [email]);
      const memberId = randomId("mem_");

      if (existingUser.rowCount > 0) {
        const result = await client.query(
          `
            insert into business_members (id, business_id, user_id, role, status)
            values ($1, $2, $3, $4, 'active')
            returning id, $5::text as email, role, status, created_at
          `,
          [memberId, req.auth.businessId, existingUser.rows[0].id, role, email]
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
            returning id, $5::text as email, role, status, created_at
          `,
          [memberId, req.auth.businessId, userId, role, email]
        );

        return mapMember(result.rows[0]);
      }

      const result = await client.query(
        `
          insert into business_members (id, business_id, invitation_email, role, status)
          values ($1, $2, $3, $4, 'invited')
          returning id, invitation_email as email, role, status, created_at
        `,
        [memberId, req.auth.businessId, email, role]
      );

      return mapMember(result.rows[0]);
    });

    res.status(201).json(created);
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
      const memberResult = await client.query(
        `
          select id, role, status, user_id, invitation_email
          from business_members
          where id = $1 and business_id = $2
          limit 1
        `,
        [req.params.id, req.auth.businessId]
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

      if (!canManageMemberRole(req.auth.role, member.role)) {
        const error = new Error("Anda tidak memiliki izin untuk mengubah user ini.");
        error.status = 403;
        throw error;
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
            created_at
        `,
        [req.params.id, req.auth.businessId, role, userId, invitationEmail, status]
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
    const memberResult = await query(
      `
        select id, role, user_id
        from business_members
        where id = $1 and business_id = $2
        limit 1
      `,
      [req.params.id, req.auth.businessId]
    );

    if (memberResult.rowCount === 0) {
      sendError(res, 404, "User bisnis tidak ditemukan.");
      return;
    }

    const member = memberResult.rows[0];

    if (!canManageMemberRole(req.auth.role, member.role)) {
      sendError(res, 403, "Anda tidak memiliki izin untuk menghapus user ini.");
      return;
    }

    if (member.user_id && member.user_id === req.auth.userId) {
      sendError(res, 400, "Akun yang sedang Anda pakai tidak bisa dihapus dari panel ini.");
      return;
    }

    await query("delete from business_members where id = $1 and business_id = $2", [req.params.id, req.auth.businessId]);
    res.json({ ok: true });
  })
);

app.post(
  "/api/business/menu-packages",
  requireAuth,
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : null;
    const menuVisibility = normalizeMenuVisibility(req.body.menuVisibility || {}, false);

    if (!name) {
      sendError(res, 400, "Nama paket menu wajib diisi.");
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
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : null;
    const menuVisibility = normalizeMenuVisibility(req.body.menuVisibility || {}, false);

    if (!name) {
      sendError(res, 400, "Nama paket menu wajib diisi.");
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
        const error = new Error("Paket menu tidak ditemukan.");
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
  requireRole("super_admin"),
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
        const error = new Error("Paket menu tidak ditemukan.");
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
  requireRole("super_admin"),
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
        const error = new Error("Paket menu tidak ditemukan.");
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
  requireRole("super_admin"),
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
