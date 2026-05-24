import React, { useState } from "react";
import { useAppContext } from "../store/AppContext";
import { Mail, Lock, LogIn } from "lucide-react";

export default function LoginView() {
  const { login, loginWithEmail, loginError } = useAppContext();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    await loginWithEmail(email, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="max-w-md w-full rounded-3xl bg-white p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center">
        
        {/* Logo/Icon Area */}
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-sm">
          <span className="text-3xl font-extrabold tracking-tight">H</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-center mb-2">HPP Master UMKM</h1>
        <p className="text-slate-500 text-sm text-center mb-8 px-4 leading-relaxed">
          Sistem pencatatan produksi dan HPP. Masuk untuk mulai mengelola bisnis Anda.
        </p>
        
        {loginError && (
          <div className="mb-6 w-full rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-100/50">
            <strong>Error:</strong> {loginError}
            {loginError.includes("pop-up") && (
               <p className="mt-2 text-[11px] opacity-80 leading-relaxed">Pastikan browser mengizinkan pop-up, atau coba buka aplikasi di tab baru.</p>
            )}
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="w-full space-y-4 mb-6">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Alamat Email"
                className="w-full bg-slate-50 border border-slate-100 focus:bg-white rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
            </div>
          </div>
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Sandi"
                className="w-full bg-slate-50 border border-slate-100 focus:bg-white rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            className="w-full flex items-center justify-center bg-slate-900 text-white rounded-xl py-3.5 px-4 text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm mt-2"
          >
            <LogIn className="w-4 h-4 mr-2" /> Masuk dengan Email
          </button>
        </form>

        <div className="w-full flex items-center justify-center gap-4 mb-6">
          <div className="h-px bg-slate-100 flex-1"></div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Atau</span>
          <div className="h-px bg-slate-100 flex-1"></div>
        </div>
        
        {/* Google Login Button */}
        <button 
          onClick={login} 
          className="w-full relative flex items-center justify-center bg-white border border-slate-200 text-slate-700 rounded-xl py-3.5 px-4 text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5 absolute left-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
          Lanjutkan dengan Google
        </button>

      </div>
    </div>
  );
}
