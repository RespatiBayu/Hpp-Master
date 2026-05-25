import React, { useEffect, useState } from "react";
import { BarChart2, Calculator, ChevronDown, Download, Info, Plus, Trash2, Utensils, Wand2 } from "lucide-react";

type FlexibleCostType = "%" | "Rp/Pcs" | "Rp/Bln";

interface HppItem {
  id: number;
  nama: string;
  hargaBeli: string;
  satuan: string;
  isiQty: string;
  pakai: string;
}

export default function BusinessCalculatorView() {
  const [errorMsg, setErrorMsg] = useState("");
  const [namaProduk, setNamaProduk] = useState("");
  const [hargaJual, setHargaJual] = useState("");
  const [hppItems, setHppItems] = useState<HppItem[]>([]);

  const [marketingValue, setMarketingValue] = useState("");
  const [marketingType, setMarketingType] = useState<FlexibleCostType>("%");
  const [gajiValue, setGajiValue] = useState("");
  const [gajiType, setGajiType] = useState<FlexibleCostType>("%");
  const [opsValue, setOpsValue] = useState("");
  const [opsType, setOpsType] = useState<FlexibleCostType>("%");

  const [targetOmset, setTargetOmset] = useState("");
  const [targetPenjualan, setTargetPenjualan] = useState("");
  const [showRincian, setShowRincian] = useState(true);

  const num = (value: string | number) => parseFloat(String(value).replace(",", ".")) || 0;

  const formatRp = (value: string | number) => new Intl.NumberFormat("id-ID").format(Math.round(num(value)));

  const formatRpInput = (value: string | number) => {
    const numericValue = num(value);
    if (!numericValue) return "";
    return formatRp(numericValue);
  };

  const handleCurrencyInput = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(value.replace(/[^0-9]/g, ""));
  };

  const handleFlexibleInput = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: FlexibleCostType,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (type === "%") {
      setter(event.target.value.replace(/[^0-9.]/g, ""));
      return;
    }

    handleCurrencyInput(event.target.value, setter);
  };

  const handleTypeChange = (
    nextType: FlexibleCostType,
    setType: React.Dispatch<React.SetStateAction<FlexibleCostType>>,
    setValue: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setType(nextType);
    setValue("");
  };

  const tambahHppItem = () => {
    setHppItems((current) => [
      ...current,
      { id: Date.now(), nama: "", hargaBeli: "", satuan: "Gram", isiQty: "1000", pakai: "100" },
    ]);
  };

  const updateHppItem = (id: number, field: keyof HppItem, value: string) => {
    const finalValue = field === "hargaBeli" ? value.replace(/[^0-9]/g, "") : value;
    setHppItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: finalValue } : item)));
  };

  const hapusHppItem = (id: number) => {
    setHppItems((current) => current.filter((item) => item.id !== id));
  };

  const hitungBiayaPerUnitHpp = (item: HppItem) => {
    const harga = num(item.hargaBeli);
    const isi = num(item.isiQty) || 1;
    const pakai = num(item.pakai);
    return (harga / isi) * pakai;
  };

  const handleOmsetChange = (value: string) => {
    const raw = value.replace(/[^0-9]/g, "");
    setTargetOmset(raw);
    const harga = num(hargaJual);
    if (harga > 0 && raw) {
      setTargetPenjualan(Math.round(Number(raw) / harga).toString());
    } else if (!raw) {
      setTargetPenjualan("");
    }
  };

  const handlePenjualanChange = (value: string) => {
    const raw = value.replace(/[^0-9]/g, "");
    setTargetPenjualan(raw);
    const harga = num(hargaJual);
    if (harga > 0 && raw) {
      setTargetOmset(Math.round(Number(raw) * harga).toString());
    } else if (!raw) {
      setTargetOmset("");
    }
  };

  useEffect(() => {
    const harga = num(hargaJual);
    if (harga > 0 && targetOmset) {
      setTargetPenjualan(Math.round(Number(targetOmset) / harga).toString());
    }
  }, [hargaJual, targetOmset]);

  const handleAutoFill = () => {
    if (!namaProduk) return;
    setErrorMsg("Fitur isi otomatis AI belum dikonfigurasi pada build HPP Master ini.");
  };

  const unitHarga = num(hargaJual);
  const totalOmset = num(targetOmset);
  const totalPenjualan = num(targetPenjualan);
  const unitHpp = hppItems.reduce((acc, item) => acc + hitungBiayaPerUnitHpp(item), 0);
  const totalHpp = totalPenjualan * unitHpp;

  const vMarketing = num(marketingValue);
  const vGaji = num(gajiValue);
  const vOps = num(opsValue);

  const totalMarketing = marketingType === "%" ? totalOmset * (vMarketing / 100) : marketingType === "Rp/Pcs" ? totalPenjualan * vMarketing : vMarketing;
  const totalGaji = gajiType === "%" ? totalOmset * (vGaji / 100) : gajiType === "Rp/Pcs" ? totalPenjualan * vGaji : vGaji;
  const totalOps = opsType === "%" ? totalOmset * (vOps / 100) : opsType === "Rp/Pcs" ? totalPenjualan * vOps : vOps;

  const unitMarketing = marketingType === "%" ? unitHarga * (vMarketing / 100) : marketingType === "Rp/Pcs" ? vMarketing : totalPenjualan > 0 ? vMarketing / totalPenjualan : 0;
  const unitGaji = gajiType === "%" ? unitHarga * (vGaji / 100) : gajiType === "Rp/Pcs" ? vGaji : totalPenjualan > 0 ? vGaji / totalPenjualan : 0;
  const unitOps = opsType === "%" ? unitHarga * (vOps / 100) : opsType === "Rp/Pcs" ? vOps : totalPenjualan > 0 ? vOps / totalPenjualan : 0;

  const unitBiayaLain = unitMarketing + unitGaji + unitOps;
  const unitUntungBersih = unitHarga - unitHpp - unitBiayaLain;
  const totalProfit = totalOmset - totalHpp - totalMarketing - totalGaji - totalOps;
  const marginTotal = totalOmset > 0 ? (totalProfit / totalOmset) * 100 : unitHarga > 0 ? (unitUntungBersih / unitHarga) * 100 : 0;

  const pctHpp = totalOmset > 0 ? (totalHpp / totalOmset) * 100 : unitHarga > 0 ? (unitHpp / unitHarga) * 100 : 0;
  const pctMarketing = totalOmset > 0 ? (totalMarketing / totalOmset) * 100 : unitHarga > 0 ? (unitMarketing / unitHarga) * 100 : 0;
  const pctGaji = totalOmset > 0 ? (totalGaji / totalOmset) * 100 : unitHarga > 0 ? (unitGaji / unitHarga) * 100 : 0;
  const pctOps = totalOmset > 0 ? (totalOps / totalOmset) * 100 : unitHarga > 0 ? (unitOps / unitHarga) * 100 : 0;
  const pctProfit = totalOmset > 0 ? marginTotal : unitHarga > 0 ? (unitUntungBersih / unitHarga) * 100 : 0;

  const isHppTinggi = pctHpp > 40;

  const handleExport = () => {
    let table = `<table border="1">`;
    table += `<tr><th colspan="10" style="background-color: #10b981; color: white;">RINGKASAN BISNIS F&B (DATA MENTAH)</th></tr>`;
    table += `<tr>
      <th>Nama Menu</th>
      <th>Harga Jual</th>
      <th>Target Penjualan (Porsi)</th>
      <th>Target Omset</th>
      <th>Total HPP</th>
      <th>Biaya Marketing</th>
      <th>Biaya Gaji</th>
      <th>Biaya Operasional Lain</th>
      <th>Net Profit</th>
      <th>Net Margin (%)</th>
    </tr>`;
    table += `<tr>
      <td>${namaProduk || "Belum diisi"}</td>
      <td>${unitHarga}</td>
      <td>${totalPenjualan}</td>
      <td>${totalOmset}</td>
      <td>${totalHpp}</td>
      <td>${totalMarketing}</td>
      <td>${totalGaji}</td>
      <td>${totalOps}</td>
      <td>${totalProfit}</td>
      <td>${marginTotal}</td>
    </tr>`;
    table += `<tr><td colspan="10"></td></tr>`;
    table += `<tr><th colspan="6" style="background-color: #10b981; color: white;">RINCIAN BAHAN BAKU (FOOD COST)</th></tr>`;
    table += `<tr>
      <th>Nama Bahan</th>
      <th>Harga Beli</th>
      <th>Satuan</th>
      <th>Isi (Qty)</th>
      <th>Pakai</th>
      <th>Biaya per Porsi</th>
    </tr>`;

    hppItems.forEach((item) => {
      table += `<tr>
        <td>${item.nama || "Tanpa Nama"}</td>
        <td>${num(item.hargaBeli)}</td>
        <td>${item.satuan || "-"}</td>
        <td>${num(item.isiQty)}</td>
        <td>${num(item.pakai)}</td>
        <td>${hitungBiayaPerUnitHpp(item)}</td>
      </tr>`;
    });

    table += `</table>`;

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>${table}</body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = namaProduk ? namaProduk.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "menu";

    link.setAttribute("href", url);
    link.setAttribute("download", `Raw_Data_FnB_${fileName}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const donutHasValue = pctHpp > 0 || pctMarketing > 0 || pctGaji > 0 || pctOps > 0 || pctProfit > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
            <Utensils className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kalkulator Profit F&amp;B</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Simulasikan food cost, biaya operasional, target penjualan, dan net profit per menu.
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <Download className="mr-2 h-4 w-4" />
          Export XLS
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-sm font-bold text-emerald-700">1</span>
              <h2 className="font-bold text-slate-900">Menu & Food Cost (HPP)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">Nama Menu / Produk</label>
                <input
                  type="text"
                  value={namaProduk}
                  onChange={(event) => setNamaProduk(event.target.value)}
                  placeholder="Nasi Goreng Spesial"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="pt-1">
                <button
                  onClick={handleAutoFill}
                  disabled={!namaProduk}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                    namaProduk ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  <Wand2 className="h-4 w-4" />
                  Isi Otomatis
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Isi otomatis AI belum aktif. Kalkulator manual tetap bisa dipakai penuh.
                </p>
                {errorMsg && <p className="mt-1.5 text-center text-[11px] font-medium text-red-500">{errorMsg}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Harga Jual per Porsi</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
                  <input
                    type="text"
                    value={hargaJual ? formatRpInput(hargaJual) : ""}
                    onChange={(event) => handleCurrencyInput(event.target.value, setHargaJual)}
                    placeholder="25.000"
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between rounded-t-xl border-b border-emerald-100 px-4 py-3">
                  <span className="text-xs font-bold text-slate-700">RINCIAN RESEP / MODAL (HPP)</span>
                  <button onClick={tambahHppItem} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700">
                    <Plus className="h-3.5 w-3.5" /> Tambah Bahan
                  </button>
                </div>

                <div className="max-h-[360px] space-y-3 overflow-y-auto bg-slate-50 p-3">
                  {hppItems.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <p className="text-xs italic">Belum ada data bahan baku. Tambah bahan untuk mulai menghitung HPP.</p>
                    </div>
                  ) : (
                    hppItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="mb-3 grid grid-cols-12 gap-2">
                          <div className="col-span-5">
                            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">Bahan</label>
                            <input
                              type="text"
                              value={item.nama}
                              onChange={(event) => updateHppItem(item.id, "nama", event.target.value)}
                              placeholder="Daging Sapi"
                              className="w-full border-b border-gray-200 pb-1 text-sm outline-none transition-colors focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-4">
                            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">Harga Beli</label>
                            <input
                              type="text"
                              value={item.hargaBeli ? formatRpInput(item.hargaBeli) : ""}
                              onChange={(event) => updateHppItem(item.id, "hargaBeli", event.target.value)}
                              placeholder="120.000"
                              className="w-full border-b border-gray-200 pb-1 text-sm outline-none transition-colors focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">Satuan</label>
                            <input
                              type="text"
                              value={item.satuan}
                              onChange={(event) => updateHppItem(item.id, "satuan", event.target.value)}
                              placeholder="Kg / Gram"
                              className="w-full border-b border-gray-200 pb-1 text-sm outline-none transition-colors focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-12 items-end gap-2">
                          <div className="col-span-3">
                            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">Isi (Qty)</label>
                            <input
                              type="number"
                              value={item.isiQty}
                              onChange={(event) => updateHppItem(item.id, "isiQty", event.target.value)}
                              className="w-full rounded border border-gray-200 bg-slate-50 p-1.5 text-center text-sm outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">Pakai</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.pakai}
                              onChange={(event) => updateHppItem(item.id, "pakai", event.target.value)}
                              className="w-full rounded border border-gray-200 bg-emerald-50 p-1.5 text-center text-sm outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-5 pb-1.5 text-right">
                            <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-slate-400">Biaya per Porsi</span>
                            <span className="text-sm font-bold text-slate-700">Rp {formatRp(hitungBiayaPerUnitHpp(item))}</span>
                          </div>
                          <div className="col-span-1 flex justify-end pb-1.5">
                            <button onClick={() => hapusHppItem(item.id)} className="text-gray-300 transition-colors hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between rounded-b-xl border-t border-emerald-100 bg-emerald-50/50 px-4 py-3">
                  <span className="text-xs font-bold text-slate-700">TOTAL HPP (FOOD COST)</span>
                  <span className="text-sm font-bold text-emerald-600">Rp {formatRp(unitHpp)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-sm font-bold text-emerald-700">2</span>
              <h2 className="font-bold text-slate-900">Biaya Operasional</h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  label: "Biaya Marketing (Ads, Promo, Diskon)",
                  type: marketingType,
                  value: marketingValue,
                  setType: setMarketingType,
                  setValue: setMarketingValue,
                },
                {
                  label: "Gaji & Upah Karyawan",
                  type: gajiType,
                  value: gajiValue,
                  setType: setGajiType,
                  setValue: setGajiValue,
                },
                {
                  label: "Operasional Lain (Sewa, Listrik, Air, dll)",
                  type: opsType,
                  value: opsValue,
                  setType: setOpsType,
                  setValue: setOpsValue,
                },
              ].map((field) => (
                <div key={field.label}>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">{field.label}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      {field.type !== "%" ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">Rp</span> : null}
                      <input
                        type="text"
                        value={field.type === "%" ? field.value : formatRpInput(field.value)}
                        onChange={(event) => handleFlexibleInput(event, field.type, field.setValue)}
                        placeholder="0"
                        className={`w-full rounded-lg border border-gray-200 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 ${
                          field.type !== "%" ? "pl-9 pr-3" : "px-3"
                        }`}
                      />
                      {field.type === "%" ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">%</span> : null}
                    </div>
                    <div className="relative w-32">
                      <select
                        value={field.type}
                        onChange={(event) => handleTypeChange(event.target.value as FlexibleCostType, field.setType, field.setValue)}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      >
                        <option value="%">% dari Omset</option>
                        <option value="Rp/Pcs">Rp / Porsi</option>
                        <option value="Rp/Bln">Rp / Bulan</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:col-span-7">
          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-sm font-bold text-emerald-700">3</span>
              <h2 className="font-bold text-slate-900">Target & Simulasi F&amp;B</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Target Omset Bulanan</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
                  <input
                    type="text"
                    value={targetOmset ? formatRpInput(targetOmset) : ""}
                    onChange={(event) => handleOmsetChange(event.target.value)}
                    placeholder="50.000.000"
                    className="w-full rounded-lg border border-gray-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Target Penjualan (Porsi/Bulan)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetPenjualan ? formatRpInput(targetPenjualan) : ""}
                    onChange={(event) => handlePenjualanChange(event.target.value)}
                    placeholder="2.000"
                    className="w-full rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 pr-16 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Porsi</span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl bg-[#0f3429] p-5 text-white shadow-sm">
              <BarChart2 className="absolute -bottom-4 -right-4 h-32 w-32 text-white/5" />
              <div className="relative z-10">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-wider text-emerald-300">
                  <Calculator className="h-3.5 w-3.5" /> NET PROFIT (BERSIH)
                </div>
                <h3 className="mb-1 text-3xl font-bold">Rp {formatRp(totalProfit)}</h3>
                <p className="text-sm text-emerald-100">Net Margin: {marginTotal.toFixed(1)}%</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <h4 className="mb-3 text-[10px] font-bold tracking-wider text-slate-400">UNIT ECONOMICS (PER PORSI)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Harga Jual</span>
                  <span className="font-semibold text-slate-800">Rp {formatRp(unitHarga)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>HPP (Food Cost)</span>
                  <span>-Rp {formatRp(unitHpp)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Biaya Operasional</span>
                  <span>-Rp {formatRp(unitBiayaLain)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-bold text-emerald-600">
                  <span>Untung per Porsi</span>
                  <span>Rp {formatRp(unitUntungBersih)}</span>
                </div>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-bold text-slate-900">Proporsi Keuangan Bisnis</h3>
            <div className="flex flex-col items-center gap-6 md:flex-row">
              <div className="flex items-center justify-center gap-6">
                <div className="relative h-32 w-32">
                  {donutHasValue ? (
                    <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90 rounded-full">
                      <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                      {pctHpp > 0 ? <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#ef4444" strokeWidth="6" strokeDasharray={`${pctHpp} ${100 - pctHpp}`} strokeDashoffset="100" /> : null}
                      {pctMarketing > 0 ? (
                        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="6" strokeDasharray={`${pctMarketing} ${100 - pctMarketing}`} strokeDashoffset={`${100 - pctHpp}`} />
                      ) : null}
                      {pctGaji > 0 ? (
                        <circle
                          cx="21"
                          cy="21"
                          r="15.915"
                          fill="transparent"
                          stroke="#f59e0b"
                          strokeWidth="6"
                          strokeDasharray={`${pctGaji} ${100 - pctGaji}`}
                          strokeDashoffset={`${100 - (pctHpp + pctMarketing)}`}
                        />
                      ) : null}
                      {pctOps > 0 ? (
                        <circle
                          cx="21"
                          cy="21"
                          r="15.915"
                          fill="transparent"
                          stroke="#8b5cf6"
                          strokeWidth="6"
                          strokeDasharray={`${pctOps} ${100 - pctOps}`}
                          strokeDashoffset={`${100 - (pctHpp + pctMarketing + pctGaji)}`}
                        />
                      ) : null}
                      {pctProfit > 0 ? (
                        <circle
                          cx="21"
                          cy="21"
                          r="15.915"
                          fill="transparent"
                          stroke="#10b981"
                          strokeWidth="6"
                          strokeDasharray={`${Math.max(0, pctProfit)} ${100 - Math.max(0, pctProfit)}`}
                          strokeDashoffset={`${100 - (pctHpp + pctMarketing + pctGaji + pctOps)}`}
                        />
                      ) : null}
                    </svg>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full border-2 border-dashed border-emerald-100 text-slate-400">
                      <BarChart2 className="mb-1 h-5 w-5 text-emerald-300" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 text-[10px]">
                  <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500"></span> Profit {pctProfit.toFixed(1)}%</div>
                  <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500"></span> HPP {pctHpp.toFixed(1)}%</div>
                  <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500"></span> Gaji {pctGaji.toFixed(1)}%</div>
                  <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-purple-500"></span> Ops {pctOps.toFixed(1)}%</div>
                  <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500"></span> Marketing {pctMarketing.toFixed(1)}%</div>
                </div>
              </div>

              <div className="w-full flex-1 rounded-xl border border-emerald-100 bg-[#f8fdfa] p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Info className="h-4 w-4 text-emerald-500" /> Insight Kuliner
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-50 pb-2">
                    <span className="text-slate-500">Food Cost (HPP)</span>
                    <span className={`font-bold ${isHppTinggi ? "text-red-500" : "text-emerald-600"}`}>{pctHpp.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      Status Food Cost:{" "}
                      <span className={`font-bold ${isHppTinggi ? "text-red-500" : "text-emerald-600"}`}>
                        {isHppTinggi ? "Terlalu Tinggi (> 40%)" : "Sehat"}
                      </span>
                    </span>
                    {isHppTinggi ? <p className="mt-1 text-[10px] leading-tight text-red-400">Turunkan porsi bahan atau naikkan harga jual untuk mencapai profit ideal.</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col items-center pt-2">
            <button onClick={() => setShowRincian((current) => !current)} className="mb-3 text-xs font-bold text-emerald-600 hover:underline">
              {showRincian ? "Sembunyikan Rincian Bulanan" : "Tampilkan Rincian Bulanan"}
            </button>

            {showRincian ? (
              <div className="w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="w-[40%] px-4 py-3 text-xs font-semibold">Komponen Biaya</th>
                      <th className="w-[20%] px-4 py-3 text-center text-xs font-semibold">%</th>
                      <th className="w-[40%] px-4 py-3 text-right text-xs font-semibold">Total (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-700">Omset Penjualan</td>
                      <td className="px-4 py-3 text-center text-slate-600">100%</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">Rp {formatRp(totalOmset)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 pl-6 text-red-500">- HPP (Bahan Baku)</td>
                      <td className="px-4 py-3 text-center text-red-500">{pctHpp.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-red-500">Rp {formatRp(totalHpp)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 pl-6 text-red-500">- Marketing & Promo</td>
                      <td className="px-4 py-3 text-center text-red-500">{pctMarketing.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-red-500">Rp {formatRp(totalMarketing)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 pl-6 text-red-500">- Gaji Karyawan</td>
                      <td className="px-4 py-3 text-center text-red-500">{pctGaji.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-red-500">Rp {formatRp(totalGaji)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 pl-6 text-red-500">- Operasional Lain</td>
                      <td className="px-4 py-3 text-center text-red-500">{pctOps.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-red-500">Rp {formatRp(totalOps)}</td>
                    </tr>
                    <tr className="bg-[#f0fdf4]">
                      <td className="px-4 py-3 font-bold text-emerald-700">NET PROFIT (BERSIH)</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">{marginTotal.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">Rp {formatRp(totalProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
