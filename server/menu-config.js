export const businessMenuDefinitions = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Ringkasan performa usaha dan indikator utama.",
  },
  {
    id: "inventory",
    label: "Inventori",
    description: "Data barang, stok, dan harga jual per item.",
  },
  {
    id: "purchases",
    label: "Pembelian Bahan",
    description: "Pencatatan pembelian bahan baku masuk.",
  },
  {
    id: "productions",
    label: "Produksi (HPP)",
    description: "Perhitungan produksi dan HPP barang jadi.",
  },
  {
    id: "sales",
    label: "Penjualan",
    description: "Pencatatan transaksi penjualan produk.",
  },
  {
    id: "expenses",
    label: "Beban Operasional",
    description: "Pengeluaran usaha di luar bahan baku.",
  },
  {
    id: "calculator",
    label: "Kalkulator F&B",
    description: "Simulasi food cost, biaya operasional, dan profit menu.",
  },
];

const businessMenuKeySet = new Set(businessMenuDefinitions.map((menu) => menu.id));

export const isBusinessMenuKey = (value) => typeof value === "string" && businessMenuKeySet.has(value);

export const createDefaultMenuVisibility = () =>
  Object.fromEntries(businessMenuDefinitions.map((menu) => [menu.id, true]));

export const createDisabledMenuVisibility = () =>
  Object.fromEntries(businessMenuDefinitions.map((menu) => [menu.id, false]));

export const normalizeMenuVisibility = (value = {}, defaultValue = false) => {
  const visibility = {};

  for (const menu of businessMenuDefinitions) {
    visibility[menu.id] = typeof value?.[menu.id] === "boolean" ? Boolean(value[menu.id]) : defaultValue;
  }

  return visibility;
};

export const mergeMenuVisibility = (rows = []) => {
  const visibility = createDefaultMenuVisibility();

  for (const row of rows) {
    if (isBusinessMenuKey(row.menu_key)) {
      visibility[row.menu_key] = Boolean(row.is_enabled);
    }
  }

  return visibility;
};
