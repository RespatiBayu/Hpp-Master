import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { coerceAssistantDate, coerceAssistantNumber, coerceAssistantText, subscribeAssistantPrefill } from "../lib/assistant";
import { calculateItemStats } from "../lib/calculators";
import { getTodayDateValue } from "../lib/date";
import { RawMaterialUsage } from "../lib/types";
import { useAppContext } from "../store/AppContext";

export default function ProductionsView() {
  const { items, purchases, productions, sales, addProduction } = useAppContext();
  const rawItems = items.filter(i => i.type === "RAW" || i.type === "HALF_FINISHED");
  const finishedItems = items.filter(i => i.type === "FINISHED" || i.type === "HALF_FINISHED");
  
  const stats = calculateItemStats(items, purchases, productions, sales);

  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(getTodayDateValue);
  const [finishedItemId, setFinishedItemId] = useState("");
  const [finishedQty, setFinishedQty] = useState("");
  const [overheadCost, setOverheadCost] = useState("");
  
  const [rawUsage, setRawUsage] = useState<RawMaterialUsage[]>([]);

  const addRawUsageLine = () => {
    if (rawItems.length > 0) {
      setRawUsage([...rawUsage, { id: rawItems[0].id, qty: 1 }]);
    }
  };

  const updateRawUsage = (index: number, field: keyof RawMaterialUsage, value: any) => {
    const updated = [...rawUsage];
    updated[index] = { ...updated[index], [field]: value };
    setRawUsage(updated);
  };

  const removeRawUsage = (index: number) => {
    setRawUsage(rawUsage.filter((_, i) => i !== index));
  };

  const calculateCurrentHPP = () => {
    let totalRawCost = 0;
    rawUsage.forEach(r => {
      const avgCost = stats[r.id]?.avgCost || 0;
      totalRawCost += (avgCost * r.qty);
    });
    return totalRawCost + Number(overheadCost || 0);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finishedItemId || !finishedQty) return;
    
    const totalHPP = calculateCurrentHPP();
    
    await addProduction({
      date,
      finishedItemId,
      finishedQty: Number(finishedQty),
      rawMaterialsJSON: JSON.stringify(rawUsage),
      overheadCost: Number(overheadCost),
      totalHPP
    });

    setIsAdding(false);
    setFinishedItemId(""); setFinishedQty(""); setOverheadCost(""); setRawUsage([]);
  };

  useEffect(() => {
    return subscribeAssistantPrefill((payload) => {
      if (payload.targetMenu !== "productions" || payload.formId !== "production_create") return;

      const requestedFinishedItemId = coerceAssistantText(payload.fields.finishedItemId);
      const nextFinishedItemId = finishedItems.some((item) => item.id === requestedFinishedItemId) ? requestedFinishedItemId : "";
      const nextDate = coerceAssistantDate(payload.fields.date, getTodayDateValue());
      const nextFinishedQty = coerceAssistantNumber(payload.fields.finishedQty);
      const nextOverheadCost = coerceAssistantNumber(payload.fields.overheadCost);
      const nextRawMaterials = Array.isArray(payload.fields.rawMaterials)
        ? payload.fields.rawMaterials
            .map((entry) => {
              const id = coerceAssistantText(entry && typeof entry === "object" ? (entry as { id?: unknown }).id : "");
              const qty = coerceAssistantNumber(entry && typeof entry === "object" ? (entry as { qty?: unknown }).qty : null);
              if (!id || qty === null || !rawItems.some((item) => item.id === id)) return null;
              return { id, qty };
            })
            .filter((entry): entry is RawMaterialUsage => Boolean(entry))
        : [];
      const appliedFields: string[] = [];

      if (nextDate) appliedFields.push("date");
      if (nextFinishedItemId) appliedFields.push("finishedItemId");
      if (nextFinishedQty !== null) appliedFields.push("finishedQty");
      if (nextOverheadCost !== null) appliedFields.push("overheadCost");
      if (nextRawMaterials.length > 0) appliedFields.push("rawMaterials");

      setIsAdding(true);
      setDate(nextDate);
      setFinishedItemId(nextFinishedItemId);
      setFinishedQty(nextFinishedQty !== null ? String(nextFinishedQty) : "");
      setOverheadCost(nextOverheadCost !== null ? String(nextOverheadCost) : "");
      setRawUsage(nextRawMaterials);

      payload.respond({
        appliedFields,
        missingFields: [],
        note:
          appliedFields.length > 0
            ? "Form produksi sudah dibuka dan draft bahan/qty yang jelas sudah diisi."
            : "Form produksi sudah dibuka, tetapi produk hasil atau bahan bakunya belum cukup jelas.",
      });
    });
  }, [finishedItems, rawItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Produksi & HPP</h1>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" /> Catat Produksi
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Produksi Barang Jadi</h2>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tanggal</label>
              <input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Barang Jadi yang Dihasilkan</label>
              <select required value={finishedItemId} onChange={e=>setFinishedItemId(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                <option value="">-- Pilih Barang --</option>
                {finishedItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Kuantitas Dihasilkan</label>
              <input required type="number" min="0.01" step="any" value={finishedQty} onChange={e=>setFinishedQty(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Biaya Pabrikasi (Overhead)</label>
              <input required type="number" min="0" value={overheadCost} onChange={e=>setOverheadCost(e.target.value)} placeholder="0" className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="block text-xs font-bold text-slate-500 uppercase">Penggunaan Bahan Baku</h3>
                <button type="button" onClick={addRawUsageLine} className="text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
                    + Tambah Bahan Baku
                </button>
            </div>
            
            {rawUsage.map((usage, idx) => (
                <div key={idx} className="mb-3 flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex-1">
                        <select required value={usage.id} onChange={e=>updateRawUsage(idx, 'id', e.target.value)} className="block w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                            {rawItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                    </div>
                    <div className="sm:w-32">
                        <input required type="number" min="0.01" step="any" value={usage.qty} onChange={e=>updateRawUsage(idx, 'qty', Number(e.target.value))} placeholder="Qty" className="block w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                    <div className="truncate text-sm font-medium text-slate-500 sm:w-32">
                        Rp {Math.round((stats[usage.id]?.avgCost || 0) * usage.qty).toLocaleString()}
                    </div>
                    <button type="button" onClick={() => removeRawUsage(idx)} className="self-end p-2 text-slate-400 transition-colors hover:text-red-500 sm:self-auto"><X className="w-5 h-5"/></button>
                </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-6 text-lg sm:flex-row sm:items-center sm:justify-between">
            <span className="font-bold text-slate-600">Total HPP Produksi (Estimasi)</span>
            <span className="font-bold text-emerald-600 text-2xl">Rp {Math.round(calculateCurrentHPP()).toLocaleString()}</span>
          </div>
          {finishedQty && Number(finishedQty) > 0 && (
             <div className="text-right text-sm font-medium text-slate-500 mt-2">
                 HPP per unit: Rp {Math.round(calculateCurrentHPP() / Number(finishedQty)).toLocaleString()}
             </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">Batal</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500">Simpan Produksi</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col">
          <div className="flex flex-col gap-2 border-b border-slate-50 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="font-bold text-slate-900">Log Produksi Terakhir</h4>
          </div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Barang Jadi</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Qty</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Biaya Pabrikasi</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total HPP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {productions.map((p) => {
                const item = items.find(i => i.id === p.finishedItemId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900">{p.date}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{item?.name || "-"}</td>
                    <td className="px-6 py-4 text-sm text-right text-slate-500">{p.finishedQty} {item?.unit}</td>
                    <td className="px-6 py-4 text-sm text-right text-slate-500">Rp {p.overheadCost.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-slate-900">Rp {p.totalHPP.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
