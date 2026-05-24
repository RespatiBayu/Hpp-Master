import fs from "node:fs/promises";
import path from "node:path";

import pg from "pg";

import { config } from "./config.js";

const { Pool } = pg;

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL belum diisi. Backend Postgres tidak bisa dijalankan.");
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const query = (text, params = []) => pool.query(text, params);

export const withTransaction = async (handler) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await handler(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const runMigrations = async () => {
  const sqlPath = path.resolve(process.cwd(), "server/migrations/001_init.sql");
  const sql = await fs.readFile(sqlPath, "utf8");
  await pool.query(sql);
};
