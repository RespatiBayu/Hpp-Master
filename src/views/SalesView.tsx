import React, { useState } from "react";
import { useAppContext } from "../store/AppContext";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Sale } from "../lib/types";

export default function SalesView() {
  const { items, sales, addSale, editSale, deleteSale } = useAppContext();
  const finishedItems = items.filter(i => i.type === "FINISHED");

  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [totalRevenue, setTotalRevenue] = useState("");

  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<{id: string, name: string} | null>(null);

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setItemId(newId);
    const item = finishedItems.find(i => i.id === newId);
    if (item && item.sellingPrice && qty) {
      setTotalRevenue((Number(qty) * item.sellingPrice).toString());
    }
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQty = e.target.value;
    setQty(newQty);
    const item = finishedItems.find(i => i.id === itemId);
    if (item && item.sellingPrice && newQty) {
      setTotalRevenue((Number(newQty) * item.sellingPrice).toString());
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !qty || !totalRevenue) return;

    await addSale({
      date,
      itemId,
      qty: Number(qty),
      totalRevenue: Number(totalRevenue)
    });

    setIsAdding(false);
    setItemId(""); setQty(""); setTotalRevenue("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    await editSale(editingSale.id, {
      date: editingSale.date,
      itemId: editingSale.itemId,
      qty: Number(editingSale.qty),
      totalRevenue: Number(editingSale.totalRevenue)
    });
    setEditingSale(null);
  };

  const handleEditItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!editingSale) return;
    const newId = e.target.value;
    const item = finishedItems.find(i => i.id === newId);
    let newRevenue = editingSale.totalRevenue;
    if (item && item.sellingPrice) {
      newRevenue = Number(editingSale.qty) * item.sellingPrice;
    }
    setEditingSale({ ...editingSale, itemId: newId, totalRevenue: newRevenue });
  };

  const handleEditQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingSale) return;
    const newQty = Number(e.target.value);
    const item = finishedItems.find(i => i.id === editingSale.itemId);
    let newRevenue = editingSale.totalRevenue;
    if (item && item.sellingPrice) {
      newRevenue = newQty * item.sellingPrice;
    }
    setEditingSale({ ...editingSale, qty: newQty, totalRevenue: newRevenue });
  };

  const confirmDelete = async () => {
    if (saleToDelete) {
      await deleteSale(saleToDelete.id);
      setSaleToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Penjualan </h1>
        <button onClick={() => setIsAdding(!isAdding)} className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Catat Penjualan
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
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Barang Jadi (Produk)</label>
              <select required value={itemId} onChange={handleItemChange} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                <option value="">-- Pilih --</option>
                {finishedItems.map(i => <option key={i.id} value={i.id}>{i.name} {i.sellingPrice ? `(Rp ${i.sellingPrice.toLocaleString()})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Kuantitas Terjual</label>
              <input required type="number" min="0.01" step="any" value={qty} onChange={handleQtyChange} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Total Pendapatan (Rp)</label>
              <input required type="number" min="0" step="any" value={totalRevenue} onChange={e=>setTotalRevenue(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">Batal</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500">Simpan</button>
          </div>
        </form>
      )}

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-slate-900">Edit Penjualan</h3>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tanggal</label>
                  <input required type="date" value={editingSale.date} onChange={e=>setEditingSale({...editingSale, date: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Barang Jadi (Produk)</label>
                  <select required value={editingSale.itemId} onChange={handleEditItemChange} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                    <option value="">-- Pilih --</option>
                    {finishedItems.map(i => <option key={i.id} value={i.id}>{i.name} {i.sellingPrice ? `(Rp ${i.sellingPrice.toLocaleString()})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Kuantitas Terjual</label>
                  <input required type="number" min="0.01" step="any" value={editingSale.qty} onChange={handleEditQtyChange} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Total Pendapatan (Rp)</label>
                  <input required type="number" min="0" step="any" value={editingSale.totalRevenue} onChange={e=>setEditingSale({...editingSale, totalRevenue: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditingSale(null)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50">Batal</button>
                <button type="submit" className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Penjualan</h3>
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus data penjualan <strong>{saleToDelete.name}</strong>? Data ini akan hilang selamanya.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setSaleToDelete(null)}
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
            <h4 className="font-bold text-slate-900">Riwayat Penjualan</h4>
          </div>
        <table className="min-w-[720px] text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Barang Terjual</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Qty</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total Pendapatan</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {sales.map((s) => {
              const item = items.find(i => i.id === s.itemId);
              return (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900">{s.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{item?.name || "-"}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-500">{s.qty} {item?.unit}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-emerald-600">Rp {s.totalRevenue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button
                      onClick={() => setEditingSale(s)}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors mr-1"
                      title="Edit Penjualan"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSaleToDelete({id: s.id, name: item?.name || "Barang ini"})}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hapus Penjualan"
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
