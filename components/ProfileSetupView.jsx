"use client";

import { useState } from "react";
import { Package, UserRound } from "lucide-react";

export default function ProfileSetupView({ onSetup, showToast, initialName = "" }) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const cleanName = name.trim();
    if (!cleanName) { showToast("Lütfen adınızı girin.", "error"); return; }
    try { setLoading(true); await onSetup(cleanName, "staff", ""); }
    catch (error) { console.error("Profile setup failed:", error); showToast("Profil oluşturulamadı.", "error"); }
    finally { setLoading(false); }
  };

  return <main className="min-h-[100dvh] bg-gray-950 p-6 text-white flex items-center justify-center"><div className="w-full max-w-md"><div className="text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg"><Package size={38} /></span><h1 className="mt-6 text-3xl font-black">Envantra</h1><p className="mt-2 text-sm text-gray-500">Firma üyeliklerinde görünecek profil adınızı belirleyin.</p></div><section className="mt-8 rounded-3xl border border-gray-800 bg-gray-900 p-6"><label className="text-sm font-bold text-gray-400">Adınız soyadınız<div className="relative mt-2"><UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} /><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} autoComplete="name" placeholder="Adınızı ve soyadınızı girin" className="w-full rounded-xl border border-gray-800 bg-gray-950 py-4 pl-12 pr-4 text-white outline-none" /></div></label><button type="button" onClick={submit} disabled={loading || !name.trim()} className="mt-6 w-full rounded-xl bg-blue-600 py-4 font-bold text-white disabled:opacity-60">{loading ? "Kaydediliyor..." : "Devam et"}</button></section></div></main>;
}
