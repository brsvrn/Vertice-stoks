"use client";

import { useState } from "react";
import { Chrome, Mail, ShieldCheck } from "lucide-react";
import BrandLogo from "./BrandLogo";

export default function GoogleSignInView({ loading, onSignIn, onEmailAuth, onPasswordReset, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createAccount, setCreateAccount] = useState(false);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gray-950 p-5 text-white">
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-[0_18px_50px_rgba(11,28,48,.12)]">
        <BrandLogo className="justify-center" />
        <div className="mt-7 text-center">
          <ShieldCheck className="mx-auto text-blue-500" size={31} />
          <h1 className="mt-3 text-2xl font-black">Güvenli giriş</h1>
          <p className="mt-2 text-sm text-gray-500">Firmanızın izole stok alanına erişin.</p>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
        <form onSubmit={(event) => { event.preventDefault(); onEmailAuth({ email: email.trim(), password, createAccount }); }} className="mt-6 space-y-3">
          <label className="block text-xs font-bold text-gray-500">E-posta
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3.5 text-white outline-none" />
          </label>
          <label className="block text-xs font-bold text-gray-500">Şifre
            <input type="password" required minLength={6} autoComplete={createAccount ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3.5 text-white outline-none" />
          </label>
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-bold text-white disabled:opacity-60">
            <Mail size={19} />{loading ? "İşleniyor..." : createAccount ? "Hesap oluştur" : "E-posta ile giriş"}
          </button>
        </form>
        <div className="mt-3 flex items-center justify-between text-xs">
          <button type="button" onClick={() => setCreateAccount((value) => !value)} className="font-bold text-blue-500">{createAccount ? "Hesabım var" : "Yeni hesap oluştur"}</button>
          <button type="button" onClick={() => onPasswordReset(email.trim())} className="text-gray-500">Şifremi unuttum</button>
        </div>
        <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-gray-800" /><span className="text-xs text-gray-500">veya</span><span className="h-px flex-1 bg-gray-800" /></div>
        <button type="button" onClick={onSignIn} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-800 bg-white py-4 font-bold text-gray-900 disabled:opacity-60">
          <Chrome size={20} className="text-blue-500" />Google ile devam et
        </button>
      </section>
    </main>
  );
}
