import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export const hashSessionToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const createSessionToken = () => crypto.randomBytes(32).toString("base64url");

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
};

export const verifyPassword = async (password, storedHash) => {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;

  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  const actualBuffer = Buffer.from(derivedKey).toString("hex");

  return crypto.timingSafeEqual(Buffer.from(actualBuffer, "utf8"), Buffer.from(expectedHash, "utf8"));
};
