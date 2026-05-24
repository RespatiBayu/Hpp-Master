import path from "node:path";

import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.PORT, 4000),
  appUrl: process.env.APP_URL || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL || "",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "hpp_session",
  sessionTtlDays: toNumber(process.env.SESSION_TTL_DAYS, 14),
  autoMigrate: process.env.AUTO_MIGRATE !== "false",
  nodeEnv: process.env.NODE_ENV || "development",
};
