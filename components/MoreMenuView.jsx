"use client";

import { User, Printer, FileText, History, CalendarDays, Package } from "lucide-react";

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
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="px-6 pt-12 pb-6 bg-gray-900 border-b border-gray-800">
        <h1 className="text-3xl font-black text-white">Daha Fazla</h1>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-24">
        {/* Kullanıcı Özeti */}
        <div 
          onClick={onOpenProfile}
          className="flex items-center gap-4 bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-6 cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center text-blue-400 text-xl font-black">
            {dbUser?.name?.charAt(0)?.toLocaleUpperCase("tr-TR") || "K"}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{dbUser?.name || "Kullanıcı"}</h2>
            <p className="text-sm text-gray-400">{roleName}</p>
          </div>
          <User className="text-gray-500" size={20} />
        </div>

        {/* Menü Öğeleri */}
        <div className="space-y-3">
          <MenuButton icon={<Package size={20} />} label="Stok Yönetimi" onClick={onOpenInventory} />
          <MenuButton icon={<CalendarDays size={20} />} label="SKT Takvimi" onClick={onOpenSKTCalendar} />
          <MenuButton icon={<Printer size={20} />} label="Etiket Yazdırma Merkezi" onClick={onOpenPrintCenter} />
          <MenuButton icon={<FileText size={20} />} label="Raporlar" onClick={onOpenReports} />
          <MenuButton icon={<History size={20} />} label="Sayım Geçmişi" onClick={onOpenHistory} />
        </div>
      </main>
    </div>
  );
}

function MenuButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-gray-900 border border-gray-800 p-4 rounded-xl text-left active:scale-95 transition-transform"
    >
      <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-blue-400">
        {icon}
      </div>
      <span className="flex-1 font-semibold text-gray-200">{label}</span>
    </button>
  );
}
