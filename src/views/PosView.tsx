import React, { useMemo } from "react";
import { ExternalLink, MonitorSmartphone, Receipt, ShoppingCart } from "lucide-react";

import { formatCurrency } from "../lib/format";
import { useAppContext } from "../store/AppContext";

export default function PosView() {
  const { items, sales } = useAppContext();

  const finishedProducts = useMemo(
    () => items.filter((item) => item.type === "FINISHED" && item.sellingPrice !== undefined).length,
    [items]
  );
  const posSales = useMemo(() => sales.filter((sale) => sale.source === "pos"), [sales]);
  const posRevenue = useMemo(() => posSales.reduce((sum, sale) => sum + sale.totalRevenue, 0), [posSales]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 shadow-sm">
        <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)] lg:px-8">
          <div>
            <div className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 shadow-sm">
              PoS Terpisah
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">PoS sekarang berjalan di aplikasi kasir terpisah</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Dashboard ini tetap menjadi backoffice. Operasional kasir, kategori tab, pembayaran, struk, Bluetooth printer, dan share invoice sekarang dibuka dari halaman
              PoS terpisah di <code className="rounded bg-white px-2 py-1 text-slate-900">/pos</code>.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/pos"
                className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
              >
                Buka Aplikasi PoS
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Produk Siap PoS
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{finishedProducts}</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Receipt className="h-4 w-4 text-emerald-600" />
                Transaksi PoS
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{posSales.length}</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <MonitorSmartphone className="h-4 w-4 text-emerald-600" />
                Omzet PoS
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{formatCurrency(posRevenue)}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
