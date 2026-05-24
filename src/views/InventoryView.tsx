import React, { useState, useMemo } from "react";
import { useAppContext } from "../store/AppContext";
import { calculateItemStats } from "../lib/calculators";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Item, ItemType } from "../lib/types";

export default function InventoryView() {
  const { items, purchases, productions, sales, addItem, editItem, deleteItem } = useAppContext();
  const stats = useMemo(() => calculateItemStats(items, purchases, productions, sales), [items, purchases, productions, sales]);

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ItemType>("RAW");
  const [unit, setUnit] = useState("pcs");
  const [minQty, setMinQty] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !unit || !minQty) return;
    
    await addItem({ 
      name, 
      type, 
      unit, 
      minQty: Number(minQty),
      sellingPrice: type === "FINISHED" && sellingPrice ? Number(sellingPrice) : undefined
    });
    setIsAdding(false);
    setName(""); setUnit("pcs"); setMinQty(""); setSellingPrice("");
  };

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await editItem(editingItem.id, {
      name: editingItem.name,
      type: editingItem.type,
      unit: editingItem.unit,
      minQty: Number(editingItem.minQty),
      sellingPrice: editingItem.type === "FINISHED" && editingItem.sellingPrice ? Number(editingItem.sellingPrice) : undefined
    });
    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventori</h1>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" /> Tambah Barang
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 text-slate-900">Tambah Barang Baru</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Nama</label>
              <input required type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tipe</label>
              <select value={type} onChange={e=>setType(e.target.value as ItemType)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                <option value="RAW">Bahan Baku</option>
                <option value="HALF_FINISHED">Barang Setengah Jadi</option>
                <option value="FINISHED">Barang Jadi</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Unit (Satuan)</label>
              <select value={unit} onChange={e=>setUnit(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="gr">gr</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="porsi">porsi</option>
                <option value="bungkus">bungkus</option>
                <option value="box">box</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Minimal Qty (Alert)</label>
              <input required type="number" min="0" value={minQty} onChange={e=>setMinQty(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            {type === "FINISHED" && (
              <div>
                <label className="text-[10px] uppercase text-emerald-600 font-bold mb-1 block">Harga Jual (Status: Barang Jadi)</label>
                <input required type="number" min="0" value={sellingPrice} onChange={e=>setSellingPrice(e.target.value)} className="w-full bg-emerald-50/50 border-none rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Batal</button>
            <button type="submit" className="bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-500 rounded-lg transition-colors">Simpan</button>
          </div>
        </form>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-slate-900">Edit Barang</h3>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Nama</label>
                  <input required type="text" value={editingItem.name} onChange={e=>setEditingItem({...editingItem, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tipe</label>
                  <select value={editingItem.type} onChange={e=>setEditingItem({...editingItem, type: e.target.value as ItemType})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="RAW">Bahan Baku</option>
                    <option value="HALF_FINISHED">Barang Setengah Jadi</option>
                    <option value="FINISHED">Barang Jadi</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Unit (Satuan)</label>
                  <select value={editingItem.unit} onChange={e=>setEditingItem({...editingItem, unit: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="gr">gr</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="porsi">porsi</option>
                    <option value="bungkus">bungkus</option>
                    <option value="box">box</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Minimal Qty (Alert)</label>
                  <input required type="number" min="0" value={editingItem.minQty} onChange={e=>setEditingItem({...editingItem, minQty: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                {editingItem.type === "FINISHED" && (
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase text-blue-600 font-bold mb-1 block">Harga Jual</label>
                    <input required type="number" min="0" value={editingItem.sellingPrice || ""} onChange={e=>setEditingItem({...editingItem, sellingPrice: Number(e.target.value)})} className="w-full bg-blue-50/50 border-none rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                )}
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setEditingItem(null)} className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
                <button type="submit" className="bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 rounded-xl transition-colors shadow-sm">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
          <h4 className="font-bold text-slate-900">Daftar Barang</h4>
        </div>
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Nama Barang</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Stok (Unit)</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Cost / HPP</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Valuasi</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Harga Jual</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {items.map((item) => {
              const s = stats[item.id] || { qty: 0, avgCost: 0, value: 0 };
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {item.type === "RAW" ? "Bahan Baku" : item.type === "HALF_FINISHED" ? "Setengah Jadi" : "Barang Jadi"}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {item.name}
                    {s.qty <= item.minQty && <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Stok Tipis</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-slate-900">{s.qty.toLocaleString()} {item.unit}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-900">Rp {Math.round(s.avgCost).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">Rp {Math.round(s.value).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-emerald-600 font-medium">
                    {item.type === "FINISHED" ? (item.sellingPrice ? `Rp ${item.sellingPrice.toLocaleString()}` : "-") : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors mr-1"
                      title="Edit Barang"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item.id, item.name)}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hapus Barang"
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

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Barang</h3>
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus <strong>{itemToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
