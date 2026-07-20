"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Ban, Copy, Link2, QrCode, RefreshCw, ShieldCheck, Trash2, UserRound } from "lucide-react";

export default function CompanyAccessView({ company, user, onBack, showToast }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteQr, setInviteQr] = useState("");
  const [inviteRole, setInviteRole] = useState("PERSONNEL");
  const [joinCode, setJoinCode] = useState("");
  const role = company?.membership?.role;
  const isOwner = role === "OWNER";

  const request = useCallback(async (method = "GET", body) => {
    const token = await user.getIdToken();
    const response = await fetch(`/api/companies/${company.id}/access`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "İşlem tamamlanamadı.");
    return payload;
  }, [company.id, user]);

  const load = useCallback(async () => { try { setLoading(true); const payload = await request(); setMembers(payload.members || []); setInvites(payload.invites || []); } catch (error) { showToast(error.message, "error"); } finally { setLoading(false); } }, [request, showToast]);
  useEffect(() => { void load(); }, [load]);

  const createInvite = async () => { try { const payload = await request("POST", { action: "invite", role: inviteRole, maxUses: 1, expiresInDays: 7 }); setInviteUrl(payload.url); setInviteQr(await QRCode.toDataURL(payload.url, { width: 360, margin: 2, errorCorrectionLevel: "H" })); await load(); } catch (error) { showToast(error.message, "error"); } };
  const regenerate = async () => { try { const payload = await request("POST", { action: "regenerateJoinCode" }); setJoinCode(payload.joinCode); } catch (error) { showToast(error.message, "error"); } };
  const updateMember = async (uid, updates) => { try { await request("PATCH", { uid, ...updates }); await load(); } catch (error) { showToast(error.message, "error"); } };
  const removeMember = async (uid) => { if (!window.confirm("Personel işletmeden çıkarılsın mı?")) return; try { await request("DELETE", { uid }); await load(); } catch (error) { showToast(error.message, "error"); } };
  const revokeInvite = async (inviteId) => { try { await request("DELETE", { inviteId }); await load(); } catch (error) { showToast(error.message, "error"); } };
  const copy = async (value) => { await navigator.clipboard.writeText(value); showToast("Panoya kopyalandı.", "success"); };

  return <div className="flex h-full flex-col bg-gray-950 text-white"><header className="border-b border-gray-800 bg-gray-900 p-4"><div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800"><ArrowLeft size={20} /></button><div><h1 className="font-black">Personel ve davetler</h1><p className="text-xs text-gray-500">{company.name} · {role}</p></div></div></header><main className="flex-1 overflow-y-auto p-4 pb-10"><section className="rounded-2xl border border-gray-800 bg-gray-900 p-4"><h2 className="font-black">Personel daveti</h2><p className="mt-1 text-xs text-gray-500">Bağlantı 7 gün geçerli ve tek kullanımlıktır.</p>{isOwner && <label className="mt-4 block text-xs font-bold text-gray-500">Davet rolü<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950 px-3 py-3 text-white"><option value="PERSONNEL">Personel</option><option value="ADMIN">Yönetici</option></select></label>}<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={createInvite} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white"><Link2 size={17} />Davet oluştur</button>{isOwner && <button onClick={regenerate} className="flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-950 py-3 text-sm font-bold"><RefreshCw size={17} />Katılım kodu</button>}</div>{joinCode && <button onClick={() => copy(joinCode)} className="mt-3 w-full rounded-xl bg-blue-500/10 p-3 font-mono font-black text-blue-500">{joinCode} <Copy className="ml-2 inline" size={15} /></button>}{inviteUrl && <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950 p-4 text-center">{inviteQr && <img src={inviteQr} alt="Personel davet QR kodu" className="mx-auto h-52 w-52 rounded-xl bg-white p-2" />}<button onClick={() => copy(inviteUrl)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-800 py-3 text-sm font-bold"><QrCode size={17} />Davet bağlantısını kopyala</button></div>}</section><section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4"><div className="flex justify-between"><h2 className="font-black">Üyeler</h2><span className="text-xs text-gray-500">{members.length} kişi</span></div><div className="mt-3 divide-y divide-gray-800">{loading ? <p className="py-5 text-center text-sm text-gray-500">Yükleniyor...</p> : members.map((member) => <div key={member.uid} className="py-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-500"><UserRound size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{member.displayName || member.email || "Kullanıcı"}</p><p className="text-xs text-gray-500">{member.role} · {member.status}</p></div>{isOwner && member.role !== "OWNER" && <div className="flex gap-1"><button onClick={() => updateMember(member.uid, { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })} className="p-2 text-orange-500" aria-label="Durumu değiştir"><Ban size={17} /></button><button onClick={() => removeMember(member.uid)} className="p-2 text-red-500" aria-label="Üyeyi çıkar"><Trash2 size={17} /></button></div>}</div>{isOwner && member.role !== "OWNER" && <select value={member.role} onChange={(event) => updateMember(member.uid, { role: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs"><option value="PERSONNEL">Personel</option><option value="ADMIN">Yönetici</option></select>}</div>)}</div></section><section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-blue-500" /><h2 className="font-black">Aktif davetler</h2></div><div className="mt-3 space-y-2">{invites.filter((item) => item.status === "ACTIVE").map((invite) => <div key={invite.id} className="flex items-center justify-between rounded-xl bg-gray-950 p-3"><div><p className="text-sm font-bold">{invite.role}</p><p className="text-xs text-gray-500">{invite.usedCount}/{invite.maxUses} kullanım</p></div><button onClick={() => revokeInvite(invite.id)} className="p-2 text-red-500"><Trash2 size={17} /></button></div>)}</div></section></main></div>;
}
