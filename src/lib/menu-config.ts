import type { AppMenuKey, MenuVisibility } from "./types";

export interface BusinessMenuDefinition {
  id: AppMenuKey;
  label: string;
  description: string;
}

export const businessMenuDefinitions: BusinessMenuDefinition[] = [
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

export const createDefaultMenuVisibility = (): MenuVisibility =>
  businessMenuDefinitions.reduce(
    (visibility, menu) => ({
      ...visibility,
      [menu.id]: true,
    }),
    {} as MenuVisibility
  );

export const createDisabledMenuVisibility = (): MenuVisibility =>
  businessMenuDefinitions.reduce(
    (visibility, menu) => ({
      ...visibility,
      [menu.id]: false,
    }),
    {} as MenuVisibility
  );

export const normalizeMenuVisibility = (value?: Partial<Record<AppMenuKey, boolean>> | null, defaultValue = false): MenuVisibility =>
  businessMenuDefinitions.reduce(
    (visibility, menu) => ({
      ...visibility,
      [menu.id]: typeof value?.[menu.id] === "boolean" ? Boolean(value[menu.id]) : defaultValue,
    }),
    {} as MenuVisibility
  );

export const getBusinessMenuLabel = (menuKey: AppMenuKey) =>
  businessMenuDefinitions.find((menu) => menu.id === menuKey)?.label || menuKey;
