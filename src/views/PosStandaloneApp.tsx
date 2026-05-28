import React, { useEffect, useMemo, useState } from "react";
import { Bluetooth, CheckCircle2, Loader2, Minus, Package, Plus, Printer, Search, Share2, ShoppingCart, Wallet } from "lucide-react";

import { appApi } from "../lib/api";
import { getTodayDateValue } from "../lib/date";
import { formatCurrency, formatQty } from "../lib/format";
import type { Item, PosBootstrapPayload, PosCheckoutResult, PosPaymentMethod } from "../lib/types";

type CartItem = {
  itemId: string;
  qty: number;
};

const PAYMENT_OPTIONS: Array<{ value: PosPaymentMethod; label: string; note: string }> = [
  { value: "cash", label: "Tunai", note: "Hitung kembalian otomatis." },
  { value: "qris", label: "QRIS", note: "Bayar pas tanpa kembalian." },
  { value: "bank_transfer", label: "Transfer", note: "Cocok untuk pesan antar atau pre-order." },
  { value: "debit_credit", label: "Kartu", note: "Debit atau kartu kredit." },
];

const getStoredPrinterLabel = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("hpp-pos-printer-label") || "";
};

type BluetoothDeviceLike = {
  name?: string | null;
};

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice?: (options: { acceptAllDevices: boolean; optionalServices?: string[] }) => Promise<BluetoothDeviceLike>;
  };
};

export default function PosStandaloneApp() {
  const [bootstrap, setBootstrap] = useState<PosBootstrapPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"catalog" | "payment" | "success">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<PosCheckoutResult | null>(null);
  const [printerLabel, setPrinterLabel] = useState(getStoredPrinterLabel);
  const [printerMessage, setPrinterMessage] = useState("");

  const loadBootstrap = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await appApi.pos.bootstrap();
      setBootstrap(payload);
    } catch (nextError: any) {
      setError(nextError.message || "PoS gagal dimuat.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  const items: Item[] = bootstrap?.items || [];
  const categories = useMemo(
    () =>
      [...new Set<string>(items.map((item) => item.category).filter((category): category is string => Boolean(category)))]
        .sort((left, right) => left.localeCompare(right)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => selectedCategory === "all" || item.category === selectedCategory)
      .filter((item) => !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery) || item.category.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftStock = left.stockQty || 0;
        const rightStock = right.stockQty || 0;
        if ((leftStock > 0) !== (rightStock > 0)) {
          return leftStock > 0 ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
  }, [items, searchQuery, selectedCategory]);

  const cartItems = useMemo(
    () =>
      cart
        .map((entry) => {
          const item = items.find((candidate) => candidate.id === entry.itemId);
          return item ? { item, qty: entry.qty } : null;
        })
        .filter((entry): entry is { item: Item; qty: number } => Boolean(entry)),
    [cart, items]
  );

  const totalQty = useMemo(() => cartItems.reduce((sum, entry) => sum + entry.qty, 0), [cartItems]);
  const grandTotal = useMemo(() => cartItems.reduce((sum, entry) => sum + entry.qty * Number(entry.item.sellingPrice || 0), 0), [cartItems]);
  const paidNumber = Number(paidAmount || 0);
  const changeAmount = paymentMethod === "cash" ? Math.max(0, paidNumber - grandTotal) : 0;

  const updateCart = (itemId: string, delta: number) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;

    setCart((current) => {
      const existing = current.find((entry) => entry.itemId === itemId);
      const nextQty = (existing?.qty || 0) + delta;

      if (nextQty <= 0) {
        return current.filter((entry) => entry.itemId !== itemId);
      }

      if ((item.stockQty || 0) < nextQty) {
        return current;
      }

      if (!existing) {
        return [...current, { itemId, qty: nextQty }];
      }

      return current.map((entry) => (entry.itemId === itemId ? { ...entry, qty: nextQty } : entry));
    });
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (paymentMethod === "cash" && paidNumber < grandTotal) return;

    setIsSubmitting(true);
    try {
      const result = await appApi.pos.createOrder({
        date: getTodayDateValue(),
        paymentMethod,
        paidAmount: paymentMethod === "cash" ? paidNumber : undefined,
        lines: cart.map((entry) => ({ itemId: entry.itemId, qty: entry.qty })),
      });

      setCheckoutResult(result);
      setCart([]);
      setPaidAmount("");
      setStep("success");
      await loadBootstrap();
    } catch (nextError: any) {
      setError(nextError.message || "Checkout PoS gagal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectPrinter = async () => {
    const bluetooth = (navigator as NavigatorWithBluetooth).bluetooth;

    if (!bluetooth?.requestDevice) {
      setPrinterMessage("Browser ini belum mendukung Web Bluetooth. Gunakan preview/cetak browser sebagai fallback.");
      return;
    }

    try {
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [] });
      const label = device.name || "Printer Bluetooth";
      setPrinterLabel(label);
      window.localStorage.setItem("hpp-pos-printer-label", label);
      setPrinterMessage(`Terhubung ke ${label}. Jika printer tidak menerima job langsung, gunakan preview invoice sebagai fallback.`);
    } catch (nextError: any) {
      setPrinterMessage(nextError.message || "Koneksi printer dibatalkan.");
    }
  };

  const handleShareWhatsApp = async () => {
    if (!checkoutResult?.invoiceUrl) return;

    const text = `Invoice ${checkoutResult.order?.orderNumber || ""}\n${checkoutResult.invoiceUrl}`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => null);
      return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!bootstrap || error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">{error || "Data PoS belum tersedia."}</p>
          <button onClick={() => void loadBootstrap()} className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900">
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#d9f99d,transparent_22%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-lime-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-lime-700">
                PoS Terpisah
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight">{bootstrap.business.name}</h1>
              <p className="mt-1 text-sm text-slate-500">Kasir fokus ke barang jadi, kategori cepat, pembayaran, struk, dan share invoice.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Produk Siap Jual</div>
                <div className="mt-2 text-2xl font-bold">{items.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Item Di Keranjang</div>
                <div className="mt-2 text-2xl font-bold">{totalQty}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Printer</div>
                <div className="mt-2 text-sm font-bold">{printerLabel || "Belum tersambung"}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep("catalog")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${step === "catalog" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              1. Pilih Produk
            </button>
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => setStep("payment")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${step === "payment" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              2. Pembayaran
            </button>
            <button
              type="button"
              disabled={!checkoutResult}
              onClick={() => setStep("success")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${step === "success" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              3. Struk
            </button>
          </div>

          {step === "catalog" ? (
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
              <section>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Cari nama produk atau kategori"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/20"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className={`rounded-full px-3 py-2 text-sm font-semibold ${selectedCategory === "all" ? "bg-lime-500 text-white" : "bg-white text-slate-600"}`}
                    >
                      Semua
                    </button>
                    {categories.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => setSelectedCategory(entry)}
                        className={`rounded-full px-3 py-2 text-sm font-semibold ${selectedCategory === entry ? "bg-lime-500 text-white" : "bg-white text-slate-600"}`}
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredItems.map((item) => {
                    const stockQty = item.stockQty || 0;
                    const cartQty = cart.find((entry) => entry.itemId === item.id)?.qty || 0;
                    const soldOut = stockQty <= 0;

                    return (
                      <article key={item.id} className={`overflow-hidden rounded-[28px] border ${soldOut ? "border-slate-200 bg-slate-50" : "border-white bg-white"} p-4 shadow-sm`}>
                        {item.photoUrl ? (
                          <img src={item.photoUrl} alt={item.name} className="h-40 w-full rounded-2xl object-cover" />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <Package className="h-8 w-8" />
                          </div>
                        )}
                        <div className="mt-4">
                          <div className="inline-flex rounded-full bg-lime-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-700">{item.category}</div>
                          <h3 className="mt-3 text-lg font-bold">{item.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">Stok {formatQty(stockQty)} {item.unit}</p>
                          <div className="mt-3 text-xl font-black text-slate-900">{formatCurrency(item.sellingPrice || 0)}</div>
                          <div className="mt-4 flex items-center justify-between gap-2">
                            <div className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1">
                              <button type="button" onClick={() => updateCart(item.id, -1)} className="rounded-full p-1 text-slate-600 hover:bg-white">
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="min-w-10 text-center text-sm font-bold">{cartQty}</span>
                              <button
                                type="button"
                                disabled={soldOut}
                                onClick={() => updateCart(item.id, 1)}
                                className="rounded-full p-1 text-slate-600 hover:bg-white disabled:opacity-40"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={soldOut}
                              onClick={() => updateCart(item.id, 1)}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {soldOut ? "Habis" : "Tambah"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                  <ShoppingCart className="h-4 w-4 text-lime-600" />
                  Keranjang Aktif
                </div>
                <div className="mt-5 space-y-3">
                  {cartItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada produk yang dipilih.
                    </div>
                  ) : (
                    cartItems.map(({ item, qty }) => (
                      <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold">{item.name}</div>
                            <div className="text-sm text-slate-500">{qty} x {formatCurrency(item.sellingPrice || 0)}</div>
                          </div>
                          <div className="text-sm font-bold">{formatCurrency((item.sellingPrice || 0) * qty)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 rounded-2xl bg-slate-900 p-5 text-white">
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">Total Belanja</div>
                  <div className="mt-2 text-3xl font-black">{formatCurrency(grandTotal)}</div>
                  <button
                    type="button"
                    disabled={cartItems.length === 0}
                    onClick={() => setStep("payment")}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                  >
                    Lanjut ke Pembayaran
                  </button>
                </div>
              </aside>
            </div>
          ) : null}

          {step === "payment" ? (
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_400px]">
              <section className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Metode Pembayaran</div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PAYMENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPaymentMethod(option.value)}
                      className={`rounded-2xl border p-4 text-left ${paymentMethod === option.value ? "border-lime-400 bg-white" : "border-slate-200 bg-white/80"}`}
                    >
                      <div className="font-bold">{option.label}</div>
                      <div className="mt-1 text-sm text-slate-500">{option.note}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Printer className="h-4 w-4 text-emerald-600" />
                    Layout Struk Aktif
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {bootstrap.posSettings.paperWidth} • Header: {bootstrap.posSettings.headerText || "kosong"} • Footer: {bootstrap.posSettings.footerText || "kosong"}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Printer Bluetooth</div>
                      <div className="mt-1 text-sm text-slate-500">{printerLabel || "Belum ada perangkat tersimpan"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleConnectPrinter()}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      <Bluetooth className="h-4 w-4" />
                      Connect Device
                    </button>
                  </div>
                  {printerMessage ? <p className="mt-3 text-sm text-slate-500">{printerMessage}</p> : null}
                </div>
              </section>

              <aside className="rounded-[28px] border border-slate-100 bg-slate-900 p-5 text-white shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-300">
                  <Wallet className="h-4 w-4 text-lime-400" />
                  Ringkasan Checkout
                </div>
                <div className="mt-5 space-y-3">
                  {cartItems.map(({ item, qty }) => (
                    <div key={item.id} className="rounded-2xl bg-white/10 p-4">
                      <div className="font-bold">{item.name}</div>
                      <div className="mt-1 text-sm text-slate-300">{qty} x {formatCurrency(item.sellingPrice || 0)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Total</span><span className="font-bold">{formatCurrency(grandTotal)}</span></div>
                  {paymentMethod === "cash" ? (
                    <>
                      <label className="mt-4 block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-300">Uang Dibayar</span>
                        <input
                          type="number"
                          min="0"
                          value={paidAmount}
                          onChange={(event) => setPaidAmount(event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30"
                          placeholder="Masukkan nominal tunai"
                        />
                      </label>
                      <div className="flex justify-between"><span>Kembalian</span><span className="font-bold">{formatCurrency(changeAmount)}</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between"><span>Metode</span><span className="font-bold">{PAYMENT_OPTIONS.find((entry) => entry.value === paymentMethod)?.label}</span></div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setStep("catalog")} className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20">
                    Kembali
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || cartItems.length === 0 || (paymentMethod === "cash" && paidNumber < grandTotal)}
                    onClick={() => void handleCheckout()}
                    className="flex-1 rounded-xl bg-lime-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                  >
                    {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Selesaikan"}
                  </button>
                </div>
              </aside>
            </div>
          ) : null}

          {step === "success" && checkoutResult?.order ? (
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <section className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Checkout Berhasil
                </div>
                <h2 className="mt-4 text-3xl font-black">{checkoutResult.order.orderNumber}</h2>
                <p className="mt-2 text-sm text-slate-600">Invoice publik siap dibuka, dibagikan ke WhatsApp, atau dipakai sebagai fallback print browser.</p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => window.open(checkoutResult.invoiceUrl, "_blank", "noopener,noreferrer")}
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Preview Struk
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareWhatsApp()}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    <Share2 className="h-4 w-4" />
                    Kirim ke WA
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("catalog")}
                    className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Transaksi Baru
                  </button>
                </div>
              </section>

              <aside className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Ringkasan Struk</div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-bold">{bootstrap.business.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{checkoutResult.order.paymentMethod.replace(/_/g, " ").toUpperCase()}</div>
                  <div className="mt-4 space-y-3">
                    {checkoutResult.order.lines.map((line) => (
                      <div key={line.id} className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{line.itemName}</div>
                          <div className="text-sm text-slate-500">{formatQty(line.qty)} x {formatCurrency(line.unitPrice)}</div>
                        </div>
                        <div className="text-sm font-bold text-slate-900">{formatCurrency(line.lineTotal)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-slate-200 pt-4 text-sm">
                    <div className="flex justify-between"><span>Total</span><span className="font-bold">{formatCurrency(checkoutResult.order.total)}</span></div>
                    <div className="mt-2 flex justify-between"><span>Dibayar</span><span>{formatCurrency(checkoutResult.order.paidAmount)}</span></div>
                    <div className="mt-2 flex justify-between"><span>Kembalian</span><span>{formatCurrency(checkoutResult.order.changeAmount)}</span></div>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
