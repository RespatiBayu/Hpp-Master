import type { BulkUserUploadRow } from "./types";

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

const normalizeRoleInput = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (!normalized) return "";
  if (normalized === "owner" || normalized === "superadmin" || normalized === "super_admin") return "super_admin";
  if (normalized === "admin") return "admin";
  if (normalized === "staff" || normalized === "karyawan") return "staff";

  return value.trim();
};

const countDelimiterOccurrences = (line: string, delimiter: string) => {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
};

const detectDelimiter = (text: string) => {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return ",";

  const candidates = [",", ";", "\t"];
  let selected = ",";
  let maxCount = -1;

  for (const candidate of candidates) {
    const count = countDelimiterOccurrences(firstLine, candidate);
    if (count > maxCount) {
      selected = candidate;
      maxCount = count;
    }
  }

  return selected;
};

const parseDelimitedText = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "\"") {
      if (inQuotes && text[index + 1] === "\"") {
        currentValue += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!inQuotes && char === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    if (!inQuotes && char === "\r") {
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
};

const resolveHeaderIndex = (headers: string[], aliases: string[]) => {
  for (const alias of aliases) {
    const match = headers.indexOf(alias);
    if (match >= 0) return match;
  }

  return -1;
};

export const parseBulkUserUploadFile = (text: string): BulkUserUploadRow[] => {
  const sanitizedText = text.replace(/^\uFEFF/, "").trim();
  if (!sanitizedText) {
    throw new Error("File upload kosong.");
  }

  const delimiter = detectDelimiter(sanitizedText);
  const rows = parseDelimitedText(sanitizedText, delimiter);

  if (rows.length < 2) {
    throw new Error("File upload harus berisi header dan minimal 1 baris data.");
  }

  const headers = rows[0].map(normalizeHeader);
  const emailIndex = resolveHeaderIndex(headers, ["email", "e_mail", "mail"]);
  const roleIndex = resolveHeaderIndex(headers, ["role", "peran"]);
  const passwordIndex = resolveHeaderIndex(headers, ["password", "kata_sandi", "kata_sandi_baru"]);
  const businessIdIndex = resolveHeaderIndex(headers, ["business_id", "bisnis_id"]);
  const businessNameIndex = resolveHeaderIndex(headers, ["business_name", "business", "bisnis", "nama_bisnis"]);

  if (emailIndex < 0) {
    throw new Error("Header wajib memuat kolom `email`.");
  }

  return rows.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    email: (row[emailIndex] || "").trim(),
    role: roleIndex >= 0 ? normalizeRoleInput(row[roleIndex] || "") : "",
    password: passwordIndex >= 0 ? (row[passwordIndex] || "").trim() : "",
    businessId: businessIdIndex >= 0 ? (row[businessIdIndex] || "").trim() : "",
    businessName: businessNameIndex >= 0 ? (row[businessNameIndex] || "").trim() : "",
  }));
};
