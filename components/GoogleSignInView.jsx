"use client";

import { Boxes, Chrome, ShieldCheck } from "lucide-react";

export default function GoogleSignInView({ loading, onSignIn, error }) {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-gray-950 text-white flex items-center justify-center p-5">
      <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 sm:p-8 shadow-[0_18px_50px_rgba(11,28,48,.12)]">
        <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-blue-500/10 px-4 py-3 text-blue-500">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Boxes size={22} /></span>
          <span className="text-left leading-tight"><strong className="block text-base tracking-tight">ENVANTRA</strong><small className="block mt-0.5 text-[10px] font-bold tracking-[.16em]">AKILLI STOK YÖNETİMİ</small></span>
        </div>

        <div className="mt-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500"><ShieldCheck size={28} /></span>
          <h1 className="mt-4 text-2xl font-black tracking-tight">Güvenli giriş</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">Envantra’ya Google hesabınızla giriş yapın. Profiliniz ve stok verileriniz güvenle hesabınıza bağlanır.</p>
        </div>

        {error && <p role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

        <button type="button" onClick={onSignIn} disabled={loading} className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-800 bg-white py-4 font-bold text-gray-900 shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
          <Chrome size={21} className="text-blue-500" />
          {loading ? "Google hesabı açılıyor..." : "Google ile devam et"}
        </button>

        <p className="mt-5 text-center text-xs leading-5 text-gray-500">Giriş yaptıktan sonra hesabınıza tanımlı yönetici veya personel yetkileri uygulanır.</p>
      </section>
    </main>
  );
}
