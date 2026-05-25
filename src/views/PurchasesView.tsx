import React, { useState } from "react";
import { useAppContext } from "../store/AppContext";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Purchase } from "../lib/types";

export default function PurchasesView() {
  const { items, purchases, addPurchase, editPurchase, deletePurchase } = useAppContext();
  const rawItems = items.filter(i => i.type === "RAW" || i.type === "HALF_FINISHED");

  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [totalCost, setTotalCost] = useState("");

  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<{id: string, name: string} | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !qty || !totalCost) return;
    
    await addPurchase({
      date,
      itemId,
      qty: Number(qty),
      totalCost: Number(totalCost)
    });

    setIsAdding(false);
    setItemId(""); setQty(""); setTotalCost("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    await editPurchase(editingPurchase.id, {
      date: editingPurchase.date,
      itemId: editingPurchase.itemId,
      qty: Number(editingPurchase.qty),
      totalCost: Number(editingPurchase.totalCost)
    });
    setEditingPurchase(null);
  };

  const confirmDelete = async () => {
    if (purchaseToDelete) {
      await deletePurchase(purchaseToDelete.id);
      setPurchaseToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pembelian Bahan Baku</h1>
        <button onClick={() => setIsAdding(!isAdding)} className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Catat Pembelian
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tanggal</label>
              <input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Bahan Baku</label>
              <select required value={itemId} onChange={e=>setItemId(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                <option value="">-- Pilih --</option>
                {rawItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Kuantitas</label>
              <input required type="number" min="0.01" step="any" value={qty} onChange={e=>setQty(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Total Harga (Rp)</label>
              <input required type="number" min="0" step="any" value={totalCost} onChange={e=>setTotalCost(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">Batal</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500">Simpan</button>
          </div>
        </form>
      )}

      {/* Edit Purchase Modal */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-slate-900">Edit Pembelian</h3>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tanggal</label>
                  <input required type="date" value={editingPurchase.date} onChange={e=>setEditingPurchase({...editingPurchase, date: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Bahan Baku</label>
                  <select required value={editingPurchase.itemId} onChange={e=>setEditingPurchase({...editingPurchase, itemId: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                    <option value="">-- Pilih --</option>
                    {rawItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Kuantitas</label>
                  <input required type="number" min="0.01" step="any" value={editingPurchase.qty} onChange={e=>setEditingPurchase({...editingPurchase, qty: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Total Harga (Rp)</label>
                  <input required type="number" min="0" step="any" value={editingPurchase.totalCost} onChange={e=>setEditingPurchase({...editingPurchase, totalCost: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditingPurchase(null)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50">Batal</button>
                <button type="submit" className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {purchaseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Pembelian</h3>
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus data pembelian <strong>{purchaseToDelete.name}</strong>? Data ini akan hilang selamanya.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setPurchaseToDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col">
          <div className="flex flex-col gap-2 border-b border-slate-50 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="font-bold text-slate-900">Riwayat Pembelian</h4>
          </div>
        <table className="min-w-[720px] text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Bahan Baku</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Qty</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total Harga</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {purchases.map((p) => {
              const item = items.find(i => i.id === p.itemId);
              return (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900">{p.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{item?.name || "-"}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-500">{p.qty} {item?.unit}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">Rp {p.totalCost.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button
                      onClick={() => setEditingPurchase(p)}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors mr-1"
                      title="Edit Pembelian"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPurchaseToDelete({id: p.id, name: item?.name || "Barang ini"})}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hapus Pembelian"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
