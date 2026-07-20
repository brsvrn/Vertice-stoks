"use client";

import { Chrome, ShieldCheck } from "lucide-react";

export default function GoogleSignInView({ loading, onSignIn, error }) {
  return (
    <main className="min-h-[100dvh] bg-gray-950 text-white flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 text-center shadow-2xl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-600/15 text-blue-400 flex items-center justify-center"><ShieldCheck size={38} /></div>
        <h1 className="mt-6 text-2xl font-black">Güvenli giriş</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">Envantra’yı kullanmak için Google hesabınızla giriş yapın. Mevcut profiliniz ve verileriniz güvenle hesabınıza bağlanır.</p>
        {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <button type="button" onClick={onSignIn} disabled={loading} className="mt-6 w-full rounded-2xl bg-white py-4 font-bold text-gray-900 flex items-center justify-center gap-3 disabled:opacity-60">
          <Chrome size={21} />
          {loading ? "Google hesabı açılıyor..." : "Google ile devam et"}
        </button>
        <p className="mt-5 text-xs text-gray-600">Yetkiniz, girişten sonra hesabınızla ilişkilendirilir.</p>
      </section>
    </main>
  );
}
