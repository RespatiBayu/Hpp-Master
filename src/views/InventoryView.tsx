import React, { useMemo, useState } from "react";
import { Edit2, Plus, Search, Tags, Trash2 } from "lucide-react";

import { calculateItemStats } from "../lib/calculators";
import { getItemTypeLabel } from "../lib/items";
import { type Item, type ItemType } from "../lib/types";
import { useAppContext } from "../store/AppContext";

const formatCurrency = (value: number) => `Rp ${Math.round(value).toLocaleString()}`;

export default function InventoryView() {
  const { items, purchases, productions, sales, addItem, editItem, deleteItem } = useAppContext();
  const stats = useMemo(() => calculateItemStats(items, purchases, productions, sales), [items, purchases, productions, sales]);

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Umum");
  const [type, setType] = useState<ItemType>("RAW");
  const [unit, setUnit] = useState("pcs");
  const [minQty, setMinQty] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const categories = useMemo(
    () => [...new Set<string>(items.map((item) => item.category.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        getItemTypeLabel(item.type).toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [items, searchQuery, selectedCategory]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !unit || !minQty) return;

    await addItem({
      name: name.trim(),
      category: category.trim() || "Umum",
      type,
      unit,
      minQty: Number(minQty),
      sellingPrice: type === "FINISHED" && sellingPrice !== "" ? Number(sellingPrice) : undefined,
    });

    setIsAdding(false);
    setName("");
    setCategory("Umum");
    setType("RAW");
    setUnit("pcs");
    setMinQty("");
    setSellingPrice("");
  };

  const handleDeleteClick = (id: string, itemName: string) => {
    setItemToDelete({ id, name: itemName });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    await deleteItem(itemToDelete.id);
    setItemToDelete(null);
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingItem) return;

    await editItem(editingItem.id, {
      name: editingItem.name.trim(),
      category: editingItem.category.trim() || "Umum",
      type: editingItem.type,
      unit: editingItem.unit,
      minQty: Number(editingItem.minQty),
      sellingPrice: editingItem.type === "FINISHED" ? editingItem.sellingPrice : undefined,
    });

    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventori</h1>
          <p className="mt-1 text-sm text-slate-500">Kategori barang sekarang tersimpan langsung di master item dan bisa dipakai PoS untuk filter kasir.</p>
        </div>
        <button
          onClick={() => setIsAdding((current) => !current)}
          className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" /> Tambah Barang
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Cari Barang</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Nama barang, kategori, atau tipe"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Filter Kategori</span>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 text-emerald-600 shadow-sm">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Kategori Aktif</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{categories.length}</div>
              <p className="mt-1 text-sm text-slate-600">
                {selectedCategory === "all" ? "Semua kategori sedang ditampilkan." : `Sedang memfilter kategori ${selectedCategory}.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isAdding ? (
        <form onSubmit={handleAdd} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Tambah Barang Baru</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Nama</label>
              <input
                required
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Kategori Barang</label>
              <input
                required
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Contoh: Minuman"
                className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Tipe</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as ItemType)}
                className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="RAW">Bahan Baku</option>
                <option value="HALF_FINISHED">Barang Setengah Jadi</option>
                <option value="FINISHED">Barang Jadi</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Unit (Satuan)</label>
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
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
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Minimal Qty (Alert)</label>
              <input
                required
                type="number"
                min="0"
                value={minQty}
                onChange={(event) => setMinQty(event.target.value)}
                className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            {type === "FINISHED" ? (
              <div className="sm:col-span-2 xl:col-span-5">
                <label className="mb-1 block text-[10px] font-bold uppercase text-emerald-600">Harga Jual (Barang Jadi)</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(event.target.value)}
                  className="w-full rounded-xl bg-emerald-50/70 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500">
              Simpan
            </button>
          </div>
        </form>
      ) : null}

      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900">Edit Barang</h3>
            </div>

            <form onSubmit={handleEditSubmit} className="max-h-[70vh] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Nama</label>
                  <input
                    required
                    type="text"
                    value={editingItem.name}
                    onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
                    className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Kategori Barang</label>
                  <input
                    required
                    type="text"
                    value={editingItem.category}
                    onChange={(event) => setEditingItem({ ...editingItem, category: event.target.value })}
                    className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Tipe</label>
                  <select
                    value={editingItem.type}
                    onChange={(event) => setEditingItem({ ...editingItem, type: event.target.value as ItemType })}
                    className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="RAW">Bahan Baku</option>
                    <option value="HALF_FINISHED">Barang Setengah Jadi</option>
                    <option value="FINISHED">Barang Jadi</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Unit (Satuan)</label>
                  <select
                    value={editingItem.unit}
                    onChange={(event) => setEditingItem({ ...editingItem, unit: event.target.value })}
                    className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
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
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Minimal Qty (Alert)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={editingItem.minQty}
                    onChange={(event) => setEditingItem({ ...editingItem, minQty: Number(event.target.value) })}
                    className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                {editingItem.type === "FINISHED" ? (
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-blue-600">Harga Jual</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={editingItem.sellingPrice ?? ""}
                      onChange={(event) =>
                        setEditingItem({
                          ...editingItem,
                          sellingPrice: event.target.value === "" ? undefined : Number(event.target.value),
                        })
                      }
                      className="w-full rounded-xl bg-blue-50/60 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditingItem(null)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50">
                  Batal
                </button>
                <button type="submit" className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-50 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-bold text-slate-900">Daftar Barang</h4>
            <p className="mt-1 text-sm text-slate-500">
              Menampilkan {filteredItems.length} dari {items.length} barang.
            </p>
          </div>
        </div>

        <table className="min-w-[980px] text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori Barang</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipe</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Nama Barang</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Stok (Unit)</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Cost / HPP</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Valuasi</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Harga Jual</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {filteredItems.map((item) => {
              const itemStat = stats[item.id] || { qty: 0, avgCost: 0, value: 0 };

              return (
                <tr key={item.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{getItemTypeLabel(item.type)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {item.name}
                    {itemStat.qty <= item.minQty ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Stok Tipis</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900">
                    {itemStat.qty.toLocaleString()} {item.unit}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900">{formatCurrency(itemStat.avgCost)}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(itemStat.value)}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-emerald-600">
                    {item.type === "FINISHED" && item.sellingPrice !== undefined ? formatCurrency(item.sellingPrice) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="mr-1 inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title="Edit Barang"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item.id, item.name)}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Hapus Barang"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {itemToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Hapus Barang</h3>
            <p className="mb-6 text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus <strong>{itemToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setItemToDelete(null)}
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
      ) : null}
    </div>
  );
}
