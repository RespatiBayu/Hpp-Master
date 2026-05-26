import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Bot, CheckCircle2, Loader2, MessageSquare, Send, Sparkles, Wand2, X } from "lucide-react";

import {
  assistantMenuOptions,
  isAssistantSupportedMenu,
  requestAssistantPrefill,
  type AssistantMenuTarget,
  type AssistantPlan,
  type AssistantSupportedMenu,
} from "../lib/assistant";
import { appApi } from "../lib/api";
import { getTodayDateValue } from "../lib/date";
import { useAppContext } from "../store/AppContext";

interface FloatingAssistantProps {
  activeMenu: AssistantMenuTarget;
  activeMenuLabel: string;
  visibleMenus: Array<{ id: AssistantMenuTarget; label: string }>;
  onNavigate: (menu: AssistantSupportedMenu) => void;
}

interface AssistantMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  tone?: "neutral" | "success" | "warning";
  suggestions?: string[];
  missingFields?: string[];
}

const QUICK_PROMPTS: Record<AssistantSupportedMenu, string[]> = {
  inventory: [
    "Tambah bahan baku gula kategori Bahan, satuan kg, stok minimum 5",
    "Buat produk jadi Kopi Susu, kategori Minuman, satuan botol, stok minimum 10, harga jual 18000",
  ],
  purchases: [
    "Catat pembelian 10 kg gula total Rp180000 hari ini",
    "Beli 5 liter susu full cream total 95000 tanggal 2026-05-26",
  ],
  productions: [
    "Catat produksi 40 botol kopi susu, overhead 50000, pakai 2 kg gula dan 5 liter susu",
    "Produksi 12 box brownies hari ini dengan overhead 35000",
  ],
  sales: [
    "Catat penjualan 12 botol kopi susu total Rp216000 hari ini",
    "Jual 8 box brownies tanggal 2026-05-26 total 280000",
  ],
  expenses: [
    "Catat beban listrik Rp350000 hari ini",
    "Tambah beban gaji barista Rp2500000 tanggal 2026-05-25",
  ],
  admin: [
    "Buat admin baru untuk bisnis Alpha Kitchen dengan email admin@alpha.com dan password Alpha123",
    "Tambah staff baru email kasir@kedaimaju.com dengan password Kasir123",
  ],
};

const toneStyles: Record<NonNullable<AssistantMessage["tone"]>, string> = {
  neutral: "border-slate-200 bg-white text-slate-700",
  success: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
  warning: "border-amber-100 bg-amber-50/80 text-amber-700",
};

const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

export default function FloatingAssistant({ activeMenu, activeMenuLabel, visibleMenus, onNavigate }: FloatingAssistantProps) {
  const { items, businesses, businessRole } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [targetMenu, setTargetMenu] = useState<AssistantSupportedMenu>("inventory");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "Saya bisa bantu buka form dan isi data awal. Pilih menu tujuan lalu jelaskan data yang ingin Anda input.",
      suggestions: QUICK_PROMPTS.inventory,
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const supportedVisibleMenus = useMemo(() => {
    const mappedMenus = visibleMenus
      .filter((menu) => isAssistantSupportedMenu(menu.id))
      .map((menu) => ({ id: menu.id, label: menu.label }));

    if (mappedMenus.length > 0) {
      return mappedMenus;
    }

    return assistantMenuOptions;
  }, [visibleMenus]);

  useEffect(() => {
    const currentSupported = isAssistantSupportedMenu(activeMenu) ? activeMenu : null;
    const nextTarget = currentSupported && supportedVisibleMenus.some((menu) => menu.id === currentSupported)
      ? currentSupported
      : supportedVisibleMenus[0]?.id || "inventory";

    setTargetMenu((current) => (supportedVisibleMenus.some((menu) => menu.id === current) ? current : nextTarget));
  }, [activeMenu, supportedVisibleMenus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isOpen]);

  const menuLabelById = useMemo(
    () => Object.fromEntries(supportedVisibleMenus.map((menu) => [menu.id, menu.label])),
    [supportedVisibleMenus]
  );

  const quickPrompts = QUICK_PROMPTS[targetMenu] || [];

  const appendMessages = (...entries: AssistantMessage[]) => {
    setMessages((current) => [...current, ...entries]);
  };

  const buildAssistantMessage = (plan: AssistantPlan, applyNote?: string): AssistantMessage => {
    const hasMissingFields = plan.missingFields.length > 0;

    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      tone: applyNote ? "success" : hasMissingFields ? "warning" : "neutral",
      text: applyNote ? `${plan.assistantMessage}\n\n${applyNote}` : plan.assistantMessage,
      suggestions: plan.suggestions.length > 0 ? plan.suggestions : quickPrompts,
      missingFields: plan.missingFields,
    };
  };

  const handleSend = async () => {
    const userMessage = draft.trim();
    if (!userMessage || isSending) return;

    setDraft("");
    setIsSending(true);

    appendMessages({
      id: `user-${Date.now()}`,
      role: "user",
      text: userMessage,
    });

    try {
      const plan = await appApi.assistant.planInput(userMessage, {
        currentMenu: activeMenu,
        targetMenu,
        todayDate: getTodayDateValue(),
        businessRole,
        visibleMenus: supportedVisibleMenus,
        catalog: {
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            type: item.type,
            unit: item.unit,
            sellingPrice: item.sellingPrice,
          })),
          businesses: businesses.map((business) => ({
            id: business.id,
            name: business.name,
          })),
        },
      });

      let applyNote = "";
      const hasStructuredFields = Object.keys(plan.fields || {}).length > 0;

      if ((plan.action === "prefill_form" || hasStructuredFields) && plan.formId) {
        onNavigate(plan.targetMenu);
        await wait(220);

        const applyResult = await requestAssistantPrefill({
          targetMenu: plan.targetMenu,
          formId: plan.formId,
          fields: plan.fields || {},
        });

        const appliedCount = applyResult.appliedFields.length;
        const missingCount = plan.missingFields.length + applyResult.missingFields.length;
        const pageLabel = menuLabelById[plan.targetMenu] || plan.targetMenu;

        applyNote =
          applyResult.note ||
          (appliedCount > 0
            ? `Form ${pageLabel} sudah dibuka dan ${appliedCount} field terisi otomatis.`
            : `Form ${pageLabel} sudah dibuka, tetapi data yang pasti masih minim.`);

        if (missingCount > 0 && !applyNote.includes("masih")) {
          applyNote = `${applyNote} Masih ada ${missingCount} field yang perlu Anda cek atau lengkapi.`;
        }
      }

      appendMessages(buildAssistantMessage(plan, applyNote));
    } catch (error: any) {
      appendMessages({
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        tone: "warning",
        text: error.message || "Assistant gagal memproses instruksi. Coba lagi dengan kalimat yang lebih rinci.",
        suggestions: quickPrompts,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {isOpen ? (
        <div className="pointer-events-auto w-[min(28rem,calc(100vw-1rem))] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_48%),linear-gradient(135deg,#f8fafc,#ffffff)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Asisten Input
                </div>
                <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-900">Buka form dan isi draft data lebih cepat</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Halaman aktif: <span className="font-semibold text-slate-700">{activeMenuLabel}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                aria-label="Tutup assistant"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Menu tujuan</label>
              <div className="grid grid-cols-2 gap-2">
                {supportedVisibleMenus.map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => setTargetMenu(menu.id)}
                    className={`rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                      targetMenu === menu.id
                        ? "border-emerald-200 bg-white text-emerald-700 shadow-sm"
                        : "border-transparent bg-white/70 text-slate-500 hover:border-slate-200 hover:text-slate-800"
                    }`}
                  >
                    {menu.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[20rem] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl border px-4 py-3 ${
                    message.role === "user"
                      ? "ml-8 border-slate-900 bg-slate-900 text-white"
                      : toneStyles[message.tone || "neutral"]
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
                        message.role === "user"
                          ? "bg-white/10 text-white"
                          : message.tone === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : message.tone === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {message.role === "user" ? (
                        <MessageSquare className="h-4 w-4" />
                      ) : message.tone === "success" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : message.tone === "warning" ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line text-sm leading-relaxed">{message.text}</p>
                      {message.missingFields && message.missingFields.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.missingFields.map((field) => (
                            <span
                              key={field}
                              className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700"
                            >
                              butuh {field}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {isSending ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    Assistant sedang menyiapkan form dan draft input...
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <Wand2 className="h-3.5 w-3.5" />
                Contoh cepat
              </div>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setDraft(prompt)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                rows={4}
                placeholder={`Contoh: ${quickPrompts[0] || "Tulis instruksi input data di sini"}`}
                className="w-full resize-none border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs leading-relaxed text-slate-400">
                  Assistant akan membuka halaman tujuan lalu mengisi form awal. Data tetap perlu Anda cek sebelum disimpan.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isSending || !draft.trim()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Jalankan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? "Tutup asisten input" : "Buka asisten input"}
        aria-expanded={isOpen}
        className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-slate-900 px-4 py-3 text-left text-white shadow-[0_20px_50px_-18px_rgba(15,23,42,0.55)] transition-transform hover:-translate-y-0.5"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-cyan-500 text-white shadow-inner">
          <Bot className="h-5 w-5" />
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Asisten AI</span>
          <span className="mt-0.5 block text-sm font-semibold">Bantu isi form</span>
        </span>
        <ArrowRight className={`hidden h-4 w-4 text-white/70 transition-transform sm:block ${isOpen ? "rotate-90" : ""}`} />
      </button>
    </div>
  );
}
