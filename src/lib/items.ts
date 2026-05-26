import type { ItemType } from "./types";

export const itemTypeLabels: Record<ItemType, string> = {
  RAW: "Bahan Baku",
  HALF_FINISHED: "Barang Setengah Jadi",
  FINISHED: "Barang Jadi",
};

export const getItemTypeLabel = (type: ItemType) => itemTypeLabels[type] || type;
