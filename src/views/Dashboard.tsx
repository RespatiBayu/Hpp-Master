import React, { useMemo } from "react";
import { useAppContext } from "../store/AppContext";
import { calculateItemStats } from "../lib/calculators";
import { AlertCircle, TrendingUp, DollarSign, Package } from "lucide-react";

export default function Dashboard() {
  const { items, purchases, productions, sales, expenses } = useAppContext();

  const stats = useMemo(() => calculateItemStats(items, purchases, productions, sales), [items, purchases, productions, sales]);

  const totalSales = sales.reduce((acc, sale) => acc + sale.totalRevenue, 0);
  
  // COGS logic: for goods sold, we find the avg cost of those goods
  const totalCOGS = useMemo(() => {
    return sales.reduce((acc, sale) => {
        const costPerUnit = stats[sale.itemId]?.avgCost || 0;
        return acc + (costPerUnit * sale.qty);
    }, 0);
  }, [sales, stats]);

  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  const grossProfit = totalSales - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  const lowStockItems = useMemo(() => {
    return items.filter(item => {
        const qty = stats[item.id]?.qty || 0;
        return qty <= item.minQty;
    });
  }, [items, stats]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Laba Rugi</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center text-slate-500 mb-1">
            <DollarSign className="w-5 h-5 mr-2 text-emerald-600" />
            <span className="text-sm font-medium">Total Penjualan</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">Rp {totalSales.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center text-slate-500 mb-1">
            <Package className="w-5 h-5 mr-2 text-red-500" />
            <span className="text-sm font-medium">Total HPP Terjual</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-red-600">Rp {totalCOGS.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center text-slate-500 mb-1">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
            <span className="text-sm font-medium">Laba Kotor</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">Rp {grossProfit.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center text-slate-500 mb-1">
            <DollarSign className="w-5 h-5 mr-2 text-emerald-600" />
            <span className="text-sm font-medium">Laba Bersih</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">Rp {netProfit.toLocaleString()}</div>
          <div className="text-[10px] uppercase font-bold text-slate-400 mt-2">Biaya Operasional: Rp {totalExpenses.toLocaleString()}</div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">Peringatan Stok</h2>
        
        {lowStockItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-500 shadow-sm">
                Semua stok aman.
            </div>
        ) : (
            <div className="overflow-x-auto rounded-2xl border border-red-100 bg-red-50 shadow-sm">
            <table className="min-w-[640px] text-left">
                <thead className="bg-red-100/50">
                <tr>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-red-800">Nama Barang</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-red-800">Tipe</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-red-800">Stok Saat Ini</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-red-800">Minimal Stok</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                {lowStockItems.map((item) => {
                  const qty = stats[item.id]?.qty || 0;
                  return (
                    <tr key={item.id}>
                    <td className="px-6 py-4 text-sm font-medium text-red-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-red-700">{item.type}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-700">{qty} {item.unit}</td>
                    <td className="px-6 py-4 text-sm text-red-700">{item.minQty} {item.unit}</td>
                    </tr>
                  )
                })}
                </tbody>
            </table>
            </div>
        )}
      </div>
    </div>
  );
}
