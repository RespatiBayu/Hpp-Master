import { Item, Purchase, Production, Sale, RawMaterialUsage } from "./types";

export const calculateItemStats = (
  items: Item[],
  purchases: Purchase[],
  productions: Production[],
  sales: Sale[]
) => {
  const stats: Record<string, { qty: number; avgCost: number; value: number }> = {};

  // Initialize
  items.forEach(item => {
    stats[item.id] = { qty: 0, avgCost: 0, value: 0 };
  });

  // 1. Process Purchases (Adds Raw Material Qty & calculates cost)
  const rawCostTotal: Record<string, number> = {};
  const rawQtyTotal: Record<string, number> = {};

  purchases.forEach(p => {
    rawQtyTotal[p.itemId] = (rawQtyTotal[p.itemId] || 0) + p.qty;
    rawCostTotal[p.itemId] = (rawCostTotal[p.itemId] || 0) + p.totalCost;
    if (stats[p.itemId]) stats[p.itemId].qty += p.qty;
  });

  // Calculate Raw Material Avg Cost
  Object.keys(rawQtyTotal).forEach(itemId => {
    if (stats[itemId]) {
      stats[itemId].avgCost = rawQtyTotal[itemId] > 0 ? (rawCostTotal[itemId] / rawQtyTotal[itemId]) : 0;
    }
  });

  // 2. Process Productions
  const finCostTotal: Record<string, number> = {};
  const finQtyTotal: Record<string, number> = {};

  productions.forEach(prod => {
    // Deduct raw materials used
    if (prod.rawMaterialsJSON) {
      try {
        const usage: RawMaterialUsage[] = JSON.parse(prod.rawMaterialsJSON);
        usage.forEach(u => {
          if (stats[u.id]) stats[u.id].qty -= u.qty;
        });
      } catch (e) {
        console.error("Failed to parse raw materials usage", e);
      }
    }

    // Add finished goods
    if (stats[prod.finishedItemId]) {
      stats[prod.finishedItemId].qty += prod.finishedQty;
    }

    finQtyTotal[prod.finishedItemId] = (finQtyTotal[prod.finishedItemId] || 0) + prod.finishedQty;
    finCostTotal[prod.finishedItemId] = (finCostTotal[prod.finishedItemId] || 0) + prod.totalHPP;
  });

  // Calculate Finished Goods Avg Cost
  Object.keys(finQtyTotal).forEach(itemId => {
    if (stats[itemId]) {
      stats[itemId].avgCost = finQtyTotal[itemId] > 0 ? (finCostTotal[itemId] / finQtyTotal[itemId]) : 0;
    }
  });

  // 3. Process Sales (Deduct finished goods)
  sales.forEach(sale => {
    if (stats[sale.itemId]) {
      stats[sale.itemId].qty -= sale.qty;
    }
  });

  // 4. Calculate total valuation
  Object.keys(stats).forEach(itemId => {
    stats[itemId].value = stats[itemId].qty * stats[itemId].avgCost;
  });

  return stats;
};

// P&L Calculation
export const calculateProfitLoss = (
    sales: Sale[],
    productions: Production[],
    expenses: Expense // ah wait, I need to pass in all params, let me just calculate when needed
) => {
    // We will do this in the Dashboard view directly using simple reduce.
};
