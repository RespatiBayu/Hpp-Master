import crypto from "node:crypto";

export const randomId = (prefix = "") => `${prefix}${crypto.randomBytes(12).toString("hex")}`;

export const normalizeEmail = (email) => email.trim().toLowerCase();

export const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bisnis";

export const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});

export const asyncHandler =
  (handler) =>
  async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };

export const sendError = (res, status, message) => res.status(status).json({ message });

export const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
