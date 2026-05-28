import React, { useEffect, useMemo, useState } from "react";
import { Edit2, ImagePlus, Plus, Search, Tags, Trash2 } from "lucide-react";

import { coerceAssistantNumber, coerceAssistantText, subscribeAssistantPrefill } from "../lib/assistant";
import { calculateItemStats } from "../lib/calculators";
import { formatCurrency, formatQty } from "../lib/format";
import { resizeImageToDataUrl } from "../lib/images";
import { getItemTypeLabel } from "../lib/items";
import { type Category, type Item, type ItemType } from "../lib/types";
import { useAppContext } from "../store/AppContext";

export default function InventoryView() {
  const {
    items,
    categories: categoryRecords,
    purchases,
    productions,
    sales,
    addItem,
    editItem,
    uploadItemPhoto,
    deleteItemPhoto,
    deleteItem,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useAppContext();
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
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState("");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingPhotoDataUrl, setEditingPhotoDataUrl] = useState("");
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const categories = useMemo(
    () => categoryRecords.map((entry) => entry.name),
    [categoryRecords]
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

    const created = await addItem({
      name: name.trim(),
      category: category.trim() || "Umum",
      type,
      unit,
      minQty: Number(minQty),
      sellingPrice: type === "FINISHED" && sellingPrice !== "" ? Number(sellingPrice) : undefined,
    });

    if (newPhotoDataUrl) {
      await uploadItemPhoto(created.id, newPhotoDataUrl);
    }

    setIsAdding(false);
    setName("");
    setCategory("Umum");
    setType("RAW");
    setUnit("pcs");
    setMinQty("");
    setSellingPrice("");
    setNewPhotoDataUrl("");
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

    if (editingPhotoDataUrl) {
      await uploadItemPhoto(editingItem.id, editingPhotoDataUrl);
    }

    setEditingItem(null);
    setEditingPhotoDataUrl("");
  };

  const handlePhotoInput = async (file: File | undefined, mode: "new" | "edit") => {
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const optimized = await resizeImageToDataUrl(file);
      if (mode === "new") {
        setNewPhotoDataUrl(optimized);
      } else {
        setEditingPhotoDataUrl(optimized);
      }
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleCategorySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCategoryError(null);

    try {
      if (editingCategory) {
        const updated = await updateCategory(editingCategory.id, categoryDraft);
        if (category === editingCategory.name) setCategory(updated.name);
        if (selectedCategory === editingCategory.name) setSelectedCategory(updated.name);
        if (editingItem?.category === editingCategory.name) {
          setEditingItem({ ...editingItem, category: updated.name });
        }
      } else {
        const created = await createCategory(categoryDraft);
        setCategory(created.name);
      }

      setCategoryDraft("");
      setEditingCategory(null);
    } catch (error: any) {
      setCategoryError(error.message || "Kategori gagal disimpan.");
    }
  };

  useEffect(() => {
    return subscribeAssistantPrefill((payload) => {
      if (payload.targetMenu !== "inventory" || payload.formId !== "inventory_item_create") return;

      const nextName = coerceAssistantText(payload.fields.name);
      const nextCategory = coerceAssistantText(payload.fields.category, "Umum");
      const requestedType = coerceAssistantText(payload.fields.type, "RAW");
      const nextType: ItemType =
        requestedType === "HALF_FINISHED" || requestedType === "FINISHED" || requestedType === "RAW" ? requestedType : "RAW";
      const nextUnit = coerceAssistantText(payload.fields.unit, "pcs");
      const nextMinQty = coerceAssistantNumber(payload.fields.minQty);
      const nextSellingPrice = coerceAssistantNumber(payload.fields.sellingPrice);
      const appliedFields: string[] = [];

      if (nextName.trim()) appliedFields.push("name");
      if (nextCategory.trim()) appliedFields.push("category");
      if (nextUnit.trim()) appliedFields.push("unit");
      if (nextMinQty !== null) appliedFields.push("minQty");
      if (requestedType) appliedFields.push("type");
      if (nextType === "FINISHED" && nextSellingPrice !== null) appliedFields.push("sellingPrice");

      setIsAdding(true);
      setName(nextName);
      setCategory(nextCategory);
      setType(nextType);
      setUnit(nextUnit);
      setMinQty(nextMinQty !== null ? String(nextMinQty) : "");
      setSellingPrice(nextType === "FINISHED" && nextSellingPrice !== null ? String(nextSellingPrice) : "");

      payload.respond({
        appliedFields,
        missingFields: [],
        note:
          appliedFields.length > 0
            ? "Form barang baru sudah dibuka dan draft field yang jelas sudah diisi."
            : "Form barang baru sudah dibuka, tetapi detail input masih terlalu umum.",
      });
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventori</h1>
          <p className="mt-1 text-sm text-slate-500">Kategori sekarang memakai master dropdown yang sama untuk backoffice dan PoS, lengkap dengan foto produk.</p>
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
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Kategori Aktif</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{categories.length}</div>
              <p className="mt-1 text-sm text-slate-600">
                {selectedCategory === "all" ? "Semua kategori sedang ditampilkan." : `Sedang memfilter kategori ${selectedCategory}.`}
              </p>

              <form onSubmit={handleCategorySubmit} className="mt-4 space-y-3">
                <input
                  type="text"
                  value={categoryDraft}
                  onChange={(event) => setCategoryDraft(event.target.value)}
                  placeholder={editingCategory ? `Ubah ${editingCategory.name}` : "Tambah kategori baru"}
                  className="w-full rounded-xl border border-emerald-200 bg-white/90 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                {categoryError ? <p className="text-xs font-medium text-red-600">{categoryError}</p> : null}
                <div className="flex gap-2">
                  <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                    {editingCategory ? "Simpan Kategori" : "Tambah Kategori"}
                  </button>
                  {editingCategory ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryDraft("");
                        setCategoryError(null);
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white/80"
                    >
                      Batal
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                {categoryRecords.map((entry) => (
                  <span key={entry.id} className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                    {entry.name}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(entry);
                        setCategoryDraft(entry.name);
                        setCategoryError(null);
                      }}
                      className="text-slate-400 hover:text-emerald-600"
                      aria-label={`Ubah kategori ${entry.name}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryToDelete(entry)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Hapus kategori ${entry.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
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
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {categories.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setCategoryDraft("");
                  setEditingCategory(null);
                  setCategoryError(null);
                }}
                className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-500"
              >
                + Tambah kategori baru di panel kanan
              </button>
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
            <div className="sm:col-span-2 xl:col-span-5">
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Foto Produk</label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40">
                <ImagePlus className="h-5 w-5 text-emerald-600" />
                <span>{isProcessingPhoto ? "Memproses foto..." : newPhotoDataUrl ? "Foto siap diunggah setelah barang disimpan" : "Pilih foto dari galeri atau kamera"}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => void handlePhotoInput(event.target.files?.[0], "new")}
                />
              </label>
              {newPhotoDataUrl ? <img src={newPhotoDataUrl} alt="Preview produk baru" className="mt-3 h-32 rounded-2xl object-cover shadow-sm" /> : null}
            </div>
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
                  <select
                    value={editingItem.category}
                    onChange={(event) => setEditingItem({ ...editingItem, category: event.target.value })}
                    className="w-full rounded-xl bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {categories.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
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
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Foto Produk</label>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    {editingPhotoDataUrl || editingItem.photoUrl ? (
                      <img
                        src={editingPhotoDataUrl || editingItem.photoUrl}
                        alt={`Foto ${editingItem.name}`}
                        className="h-36 rounded-2xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-400">
                        Belum ada foto produk
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100">
                        <ImagePlus className="h-4 w-4 text-emerald-600" />
                        {isProcessingPhoto ? "Memproses..." : "Ganti Foto"}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(event) => void handlePhotoInput(event.target.files?.[0], "edit")}
                        />
                      </label>
                      {editingItem.hasPhoto || editingPhotoDataUrl ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (editingPhotoDataUrl) {
                              setEditingPhotoDataUrl("");
                              return;
                            }
                            await deleteItemPhoto(editingItem.id);
                            setEditingItem({ ...editingItem, hasPhoto: false, photoUrl: undefined });
                          }}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Hapus Foto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
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
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Foto</th>
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
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name} className="h-14 w-14 rounded-2xl object-cover shadow-sm" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-400">
                        No Photo
                      </div>
                    )}
                  </td>
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
                    {formatQty(itemStat.qty)} {item.unit}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900">{formatCurrency(itemStat.avgCost)}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(itemStat.value)}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-emerald-600">
                    {item.type === "FINISHED" && item.sellingPrice !== undefined ? formatCurrency(item.sellingPrice) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setEditingPhotoDataUrl("");
                      }}
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

      {categoryToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Hapus Kategori</h3>
            <p className="mb-6 text-sm text-slate-600">
              Kategori <strong>{categoryToDelete.name}</strong> hanya bisa dihapus jika belum dipakai oleh barang mana pun.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteCategory(categoryToDelete.id);
                    if (category === categoryToDelete.name) setCategory("Umum");
                    if (selectedCategory === categoryToDelete.name) setSelectedCategory("all");
                    setCategoryToDelete(null);
                  } catch (error: any) {
                    setCategoryError(error.message || "Kategori gagal dihapus.");
                    setCategoryToDelete(null);
                  }
                }}
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
