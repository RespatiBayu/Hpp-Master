export const SHEET_NAMES = {
  ITEMS: "Items",
  PURCHASES: "Purchases",
  PRODUCTIONS: "Productions",
  SALES: "Sales",
  EXPENSES: "Expenses",
  USERS: "Users",
  ACTIVITY: "Activity",
};

const LOCAL_STORAGE_KEY_PREFIX = "HPP_DATA_";

export const getHeadersForSheet = (sheetName: string) => {
  switch (sheetName) {
    case SHEET_NAMES.ITEMS:
      return ["ID", "Name", "Type", "Unit", "MinQty", "SellingPrice"];
    case SHEET_NAMES.PURCHASES:
      return ["ID", "Date", "ItemID", "Qty", "TotalCost"];
    case SHEET_NAMES.PRODUCTIONS:
      return ["ID", "Date", "FinishedItemID", "FinishedQty", "RawMaterialsJSON", "OverheadCost", "TotalHPP"];
    case SHEET_NAMES.SALES:
      return ["ID", "Date", "ItemID", "Qty", "TotalRevenue"];
    case SHEET_NAMES.EXPENSES:
      return ["ID", "Date", "Description", "Amount"];
    case SHEET_NAMES.USERS:
       return ["ID", "Email", "Role", "CreatedAt"];
    case SHEET_NAMES.ACTIVITY:
       return ["ID", "Timestamp", "UserEmail", "Action", "Details"];
    default:
      return [];
  }
};

export const findOrCreateDatabase = async (accessToken: string, customId?: string | null): Promise<string> => {
  if (accessToken === "LOCAL_STORAGE_TOKEN") {
    // Initialize headers in local storage if not present
    Object.values(SHEET_NAMES).forEach(sheetName => {
      const existing = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + sheetName);
      if (!existing) {
        localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + sheetName, JSON.stringify([getHeadersForSheet(sheetName)]));
      }
    });
    return "LOCAL_STORAGE_DB";
  }

  if (customId) {
     return customId;
  }

  const fileName = "HPP_Data_UMKM";
  
  // 1. Search for existing file
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const searchData = await searchRes.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id; // Return existing spreadsheet ID
  }

  // 2. Create new spreadsheet if not found
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: fileName,
      },
      sheets: Object.values(SHEET_NAMES).map((title) => ({
        properties: { title },
      })),
    }),
  });
  
  const createData = await createRes.json();
  const spreadsheetId = createData.spreadsheetId;

  // 3. Initialize Headers for all sheets
  const requests = Object.values(SHEET_NAMES).map((sheetName) => ({
    appendCells: {
      sheetId: createData.sheets.find((s: any) => s.properties.title === sheetName)?.properties.sheetId,
      rows: [
        {
          values: getHeadersForSheet(sheetName).map((header) => ({
            userEnteredValue: { stringValue: header },
            userEnteredFormat: { textFormat: { bold: true } },
          })),
        },
      ],
      fields: "*",
    },
  }));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  return spreadsheetId;
};

export const getSheetData = async (spreadsheetId: string, sheetName: string, accessToken: string) => {
  if (accessToken === "LOCAL_STORAGE_TOKEN") {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + sheetName);
    return data ? JSON.parse(data) : [getHeadersForSheet(sheetName)];
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}?valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.values || [];
};

export const appendRow = async (spreadsheetId: string, sheetName: string, values: any[], accessToken: string) => {
  if (accessToken === "LOCAL_STORAGE_TOKEN") {
    const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + sheetName) || "[]");
    data.push(values);
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + sheetName, JSON.stringify(data));
    return { updates: { updatedRows: 1 } };
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [values],
      }),
    }
  );
  return res.json();
};

export const updateRow = async (spreadsheetId: string, range: string, values: any[], accessToken: string) => {
  if (accessToken === "LOCAL_STORAGE_TOKEN") {
    // range looks like "Items!A3:Z3" or similar
    const [sheetName, cellRange] = range.split("!");
    const rowIndex = parseInt(cellRange.substring(1)) - 1; // e.g. A3 -> row 2 (0-indexed)
    
    const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + sheetName) || "[]");
    // Ensure array is large enough
    while (data.length <= rowIndex) data.push([]);
    
    // Naively replace exactly that row (with values[0] since values is passed as `row` without outer array in updateRow)
    // Wait, updateRow receives `values` as a single flat array.
    data[rowIndex] = values;
    
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + sheetName, JSON.stringify(data));
    return { updatedRows: 1 };
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [values],
      }),
    }
  );
  return res.json();
};

export const clearRow = async (spreadsheetId: string, range: string, accessToken: string) => {
  if (accessToken === "LOCAL_STORAGE_TOKEN") {
    const [sheetName, cellRange] = range.split("!");
    const rowIndex = parseInt(cellRange.substring(1)) - 1;
    
    const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + sheetName) || "[]");
    if (rowIndex < data.length) {
      data[rowIndex] = []; // clear the row
      localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + sheetName, JSON.stringify(data));
    }
    return { clearedRange: range };
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  return res.json();
};

