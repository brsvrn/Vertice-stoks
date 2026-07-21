"use client";

import { User, Printer, FileText, History, CalendarDays, Package, ChevronRight, Settings } from "lucide-react";

export default function MoreMenuView({
  dbUser,
  onOpenProfile,
  onOpenPrintCenter,
  onOpenReports,
  onOpenHistory,
  onOpenSKTCalendar,
  onOpenInventory,
}) {
  const roleName =
    dbUser?.tenantRole === "OWNER"
      ? "İşletme Sahibi"
      : dbUser?.tenantRole === "ADMIN"
      ? "Yönetici"
      : "Personel";

  return (
    <div className="flex flex-col h-full bg-[#0a0f1c] text-white">
      <header className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">Ayarlar</h1>
        <p className="text-sm text-slate-400 mt-1">Hesap, modüller ve uygulama tercihleri</p>
      </header>

      <main className="flex-1 px-5 pb-24 overflow-y-auto">
        
        {/* HESAP GRUBU */}
        <div className="mb-6 mt-4">
          <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-2 pl-2">HESAP</h2>
          <div className="bg-[#121827] rounded-2xl overflow-hidden flex flex-col">
            <MenuRow 
              icon={<User size={18} />} 
              iconBg="bg-blue-500/10" 
              iconColor="text-blue-500" 
              title="Hesabım" 
              subtitle={dbUser?.name || "Kullanıcı bilgileri"}
              onClick={onOpenProfile} 
              isLast={true}
            />
          </div>
        </div>

        {/* MODÜLLER GRUBU */}
        <div className="mb-6">
          <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-2 pl-2">MODÜLLER</h2>
          <div className="bg-[#121827] rounded-2xl overflow-hidden flex flex-col">
            <MenuRow 
              icon={<Package size={18} />} 
              iconBg="bg-emerald-500/10" 
              iconColor="text-emerald-500" 
              title="Toplu Sayım İşlemleri" 
              subtitle="Stok sayımı ve mutabakat"
              onClick={onOpenInventory} 
            />
            <MenuRow 
              icon={<CalendarDays size={18} />} 
              iconBg="bg-orange-500/10" 
              iconColor="text-orange-500" 
              title="SKT Takvimi" 
              subtitle="Son kullanma tarihi takibi"
              onClick={onOpenSKTCalendar} 
            />
            <MenuRow 
              icon={<Printer size={18} />} 
              iconBg="bg-indigo-500/10" 
              iconColor="text-indigo-500" 
              title="Etiket Merkezi" 
              subtitle="Barkod ve QR etiket yazdırma"
              onClick={onOpenPrintCenter} 
              isLast={true}
            />
          </div>
        </div>

        {/* RAPORLAR & VERİLER GRUBU */}
        <div className="mb-6">
          <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-2 pl-2">RAPORLAR & VERİLER</h2>
          <div className="bg-[#121827] rounded-2xl overflow-hidden flex flex-col">
            <MenuRow 
              icon={<FileText size={18} />} 
              iconBg="bg-purple-500/10" 
              iconColor="text-purple-500" 
              title="Raporlar" 
              subtitle="Finans, stok ve analiz"
              onClick={onOpenReports} 
            />
            <MenuRow 
              icon={<History size={18} />} 
              iconBg="bg-teal-500/10" 
              iconColor="text-teal-500" 
              title="Sayım Geçmişi" 
              subtitle="Eski sayım ve işlem kayıtları"
              onClick={onOpenHistory} 
              isLast={true}
            />
          </div>
        </div>

      </main>
    </div>
  );
}

function MenuRow({ icon, iconBg, iconColor, title, subtitle, onClick, isLast }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center p-4 active:bg-slate-800/50 transition-colors text-left ${!isLast ? 'border-b border-slate-800/60' : ''}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-3 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <ChevronRight size={18} className="text-slate-500 shrink-0 ml-2" />
    </button>
  );
}
