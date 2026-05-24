import React, { useState } from "react";
import { Lock, LogIn, Mail, Store } from "lucide-react";

import { useAppContext } from "../store/AppContext";

export default function LoginView() {
  const { loginWithEmail, signUpWithEmail, loginError } = useAppContext();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;

    if (mode === "login") {
      await loginWithEmail(email, password);
      return;
    }

    await signUpWithEmail(email, password, businessName || undefined);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <span className="text-3xl font-extrabold tracking-tight">H</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">HPP Master UMKM</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            {mode === "login"
              ? "Masuk ke bisnis Anda dengan email dan kata sandi."
              : "Daftarkan bisnis baru, atau pakai email yang sudah diundang admin."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Daftar
          </button>
        </div>

        {loginError && (
          <div className="mb-6 rounded-xl border border-red-100/50 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error:</strong> {loginError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Alamat Email"
              className="w-full rounded-xl border border-slate-100 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Kata Sandi"
              className="w-full rounded-xl border border-slate-100 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {mode === "signup" && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Store className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Nama Bisnis (kosongkan jika Anda sudah diundang)"
                className="w-full rounded-xl border border-slate-100 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          )}

          {mode === "signup" && (
            <p className="text-xs leading-relaxed text-slate-500">
              Jika email Anda sudah ditambahkan oleh owner/admin, akun akan otomatis masuk ke bisnis tersebut. Jika belum, nama bisnis akan dipakai untuk membuat tenant baru.
            </p>
          )}

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {mode === "login" ? "Masuk dengan Email" : "Buat Akun Bisnis"}
          </button>
        </form>
      </div>
    </div>
  );
}
