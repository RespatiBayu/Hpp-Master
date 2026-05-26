import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";

import { calculateItemStats } from "../lib/calculators";
import { getTodayDateValue } from "../lib/date";
import { useAppContext } from "../store/AppContext";

const formatCurrency = (value: number) => `Rp ${Math.round(value).toLocaleString()}`;

type CartItem = {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  sellingPrice: number;
  qty: number;
};

export default function PosView() {
  const { items, purchases, productions, sales, checkoutPosSale } = useAppContext();
  const stats = useMemo(() => calculateItemStats(items, purchases, productions, sales), [items, purchases, productions, sales]);

  const [date, setDate] = useState(getTodayDateValue);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashReceived, setCashReceived] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sellableItems = useMemo(
    () =>
      items
        .filter((item) => item.type === "FINISHED" && item.sellingPrice !== undefined)
        .map((item) => ({
          ...item,
          stockQty: stats[item.id]?.qty || 0,
        }))
        .sort((left, right) => {
          if ((left.stockQty > 0) !== (right.stockQty > 0)) {
            return left.stockQty > 0 ? -1 : 1;
          }

          return left.name.localeCompare(right.name);
        }),
    [items, stats]
  );

  const categories = useMemo(
    () =>
      [...new Set<string>(sellableItems.map((item) => item.category.trim()).filter(Boolean))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [sellableItems]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sellableItems.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery) || item.category.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory, sellableItems]);

  const totalQty = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const grandTotal = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.sellingPrice, 0), [cart]);
  const cashValue = Number(cashReceived || 0);
  const changeAmount = cashValue - grandTotal;
  const todaysSales = useMemo(() => sales.filter((sale) => sale.date === date), [date, sales]);
  const todaysRevenue = useMemo(() => todaysSales.reduce((sum, sale) => sum + sale.totalRevenue, 0), [todaysSales]);
  const lowStockCount = useMemo(() => sellableItems.filter((item) => item.stockQty > 0 && item.stockQty <= item.minQty).length, [sellableItems]);

  const addToCart = (itemId: string) => {
    const item = sellableItems.find((entry) => entry.id === itemId);
    if (!item) return;

    const existingQty = cart.find((entry) => entry.itemId === itemId)?.qty || 0;
    if (existingQty >= item.stockQty) {
      setFeedback({
        type: "error",
        text: `Stok ${item.name} tinggal ${item.stockQty} ${item.unit}. Qty di keranjang tidak bisa melebihi stok.`,
      });
      return;
    }

    setFeedback(null);
    setCart((current) => {
      const existing = current.find((entry) => entry.itemId === itemId);

      if (!existing) {
        return [
          ...current,
          {
            itemId: item.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            sellingPrice: item.sellingPrice || 0,
            qty: 1,
          },
        ];
      }

      return current.map((entry) => (entry.itemId === itemId ? { ...entry, qty: entry.qty + 1 } : entry));
    });
  };

  const updateCartQty = (itemId: string, nextQty: number) => {
    const item = sellableItems.find((entry) => entry.id === itemId);
    if (!item) return;

    if (nextQty <= 0) {
      setCart((current) => current.filter((entry) => entry.itemId !== itemId));
      return;
    }

    if (nextQty > item.stockQty) {
      setFeedback({
        type: "error",
        text: `Stok ${item.name} tidak cukup. Tersedia ${item.stockQty} ${item.unit}.`,
      });
      return;
    }

    setFeedback(null);
    setCart((current) => current.map((entry) => (entry.itemId === itemId ? { ...entry, qty: nextQty } : entry)));
  };

  const removeFromCart = (itemId: string) => {
    setCart((current) => current.filter((entry) => entry.itemId !== itemId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setFeedback({ type: "error", text: "Keranjang masih kosong." });
      return;
    }

    if (grandTotal <= 0) {
      setFeedback({ type: "error", text: "Total transaksi belum valid." });
      return;
    }

    if (cashValue < grandTotal) {
      setFeedback({ type: "error", text: "Uang bayar masih kurang dari total transaksi." });
      return;
    }

    setIsCheckingOut(true);
    setFeedback(null);

    try {
      const result = await checkoutPosSale({
        date,
        lines: cart.map((item) => ({
          itemId: item.itemId,
          qty: item.qty,
        })),
      });

      setCart([]);
      setCashReceived("");
      setFeedback({
        type: "success",
        text: `Checkout berhasil: ${result.summary.totalLines} produk, ${result.summary.totalQty} item, total ${formatCurrency(
          result.summary.totalRevenue
        )}.`,
      });
    } catch (error: any) {
      setFeedback({
        type: "error",
        text: error?.message || "Checkout PoS gagal diproses.",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-sm">
        <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)] lg:px-8">
          <div>
            <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 shadow-sm">
              PoS Kasir
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Layar cepat untuk penjualan harian kasir</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Pilih produk dari grid, tambah ke keranjang, cek total, masukkan uang bayar, lalu checkout. Semua transaksi tetap masuk ke data penjualan utama.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Package className="h-4 w-4 text-emerald-600" />
                Produk Siap Jual
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{sellableItems.length}</div>
              <div className="mt-1 text-sm text-slate-500">Barang jadi dengan harga jual aktif.</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Item Di Keranjang
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{totalQty}</div>
              <div className="mt-1 text-sm text-slate-500">Siap dihitung pada checkout ini.</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Receipt className="h-4 w-4 text-emerald-600" />
                Penjualan Tanggal Ini
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{formatCurrency(todaysRevenue)}</div>
              <div className="mt-1 text-sm text-slate-500">{todaysSales.length} baris transaksi pada {date}.</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <CircleAlert className="h-4 w-4 text-amber-500" />
                Stok Menipis
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{lowStockCount}</div>
              <div className="mt-1 text-sm text-slate-500">Produk mendekati batas minimum.</div>
            </div>
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            feedback.type === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-red-100 bg-red-50 text-red-800"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />}
          <div>{feedback.text}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)_220px]">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Tanggal Transaksi</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Cari Produk</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Ketik nama atau kategori produk"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Kategori</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredItems.map((item) => {
              const cartQty = cart.find((entry) => entry.itemId === item.id)?.qty || 0;
              const stockLeftAfterCart = item.stockQty - cartQty;
              const isOutOfStock = stockLeftAfterCart <= 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item.id)}
                  disabled={isOutOfStock}
                  className={`group rounded-3xl border p-5 text-left shadow-sm transition-all ${
                    isOutOfStock
                      ? "cursor-not-allowed border-slate-100 bg-slate-100/70 text-slate-400"
                      : "border-slate-100 bg-white hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${isOutOfStock ? "bg-slate-200 text-slate-500" : "bg-amber-50 text-amber-700"}`}>
                      {item.category}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stockLeftAfterCart <= item.minQty ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                      Stok {stockLeftAfterCart} {item.unit}
                    </span>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-lg font-bold text-slate-900">{item.name}</h2>
                    <div className="mt-2 text-sm text-slate-500">
                      Harga jual <span className="font-semibold text-slate-700">{formatCurrency(item.sellingPrice || 0)}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{cartQty > 0 ? `${cartQty} sudah di cart` : "Siap dijual"}</span>
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${isOutOfStock ? "bg-slate-200" : "bg-emerald-600 text-white group-hover:bg-emerald-500"}`}>
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              Produk tidak ditemukan untuk filter saat ini.
            </div>
          ) : null}
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Keranjang Kasir</h2>
                  <p className="mt-1 text-sm text-slate-500">Kelola item transaksi sebelum checkout.</p>
                </div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <ShoppingCart className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada produk di keranjang. Klik kartu produk di sebelah kiri untuk mulai transaksi.
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const stockQty = stats[item.itemId]?.qty || 0;
                    return (
                      <div key={item.itemId} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">{item.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.category} • Stok tersedia {stockQty} {item.unit}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.itemId)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Hapus dari keranjang"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-2xl bg-white p-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.itemId, item.qty - 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <div className="min-w-12 text-center text-sm font-bold text-slate-900">{item.qty}</div>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.itemId, item.qty + 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="text-right">
                            <div className="text-xs uppercase tracking-wide text-slate-400">{formatCurrency(item.sellingPrice)} per {item.unit}</div>
                            <div className="mt-1 font-bold text-slate-900">{formatCurrency(item.qty * item.sellingPrice)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Wallet className="h-4 w-4" />
                  Ringkasan Pembayaran
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Item</span>
                    <span className="font-semibold text-slate-900">{totalQty}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Belanja</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-emerald-600">Uang Bayar</span>
                  <input
                    type="number"
                    min="0"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="Masukkan nominal bayar"
                    className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>

                <div className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Kembalian</span>
                    <span className={`font-bold ${changeAmount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(Math.abs(changeAmount))}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {cashReceived === ""
                      ? "Masukkan uang bayar untuk menghitung kembalian."
                      : changeAmount >= 0
                        ? "Nilai di atas adalah kembalian ke pelanggan."
                        : "Nilai di atas menunjukkan kekurangan pembayaran."}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isCheckingOut || cart.length === 0}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCheckingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                  Checkout Transaksi
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
