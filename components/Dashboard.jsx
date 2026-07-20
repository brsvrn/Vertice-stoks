"use client";

import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Camera,
  Package,
  Search,
  CalendarDays,
  AlertTriangle,
  Scan,
  Plus,
  Printer,
  History
} from "lucide-react";

function asDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(value) {
  const date = asDate(value);
  if (!date) return "Tarih yok";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

function isStockIn(transaction) {
  return transaction.direction === "IN" || transaction.type === "STOCK_IN";
}

export default function Dashboard({
  dbUser,
  products = [],
  batches = [],
  notifications = [],
  transactions = [],
  inventoryCounts = [],
  onOpenProduct,
  onOpenScanner,
  onOpenAddScanner,
  onOpenInventory,
  onOpenHistory,
  onOpenReports,
  onOpenNotifications,
  onOpenProfile,
  onOpenPrintCenter,
  onOpenSKTCalendar,
}) {

  const stockByProduct = useMemo(() => batches.reduce((map, batch) => {
    const productId = batch.productId;
    if (!productId) return map;
    const amount = Number(batch.quantity || 0);
    const location = String(batch.location || "DEPO").toUpperCase();
    const current = map[productId] || { total: 0, depot: 0, bar: 0 };
    current.total += amount;
    current[location === "BAR" ? "bar" : "depot"] += amount;
    map[productId] = current;
    return map;
  }, {}), [batches]);

  const totalStock = useMemo(() => Object.values(stockByProduct).reduce((sum, item) => sum + item.total, 0), [stockByProduct]);
  
  const criticalProducts = useMemo(() => products.filter((product) => (
    Number(stockByProduct[product.id]?.total || 0) <= Number(product.minStock || 0)
  )), [products, stockByProduct]);
  
  const outOfStockProducts = useMemo(() => products.filter((product) => (
    Number(stockByProduct[product.id]?.total || 0) === 0
  )), [products, stockByProduct]);

  const recentTransactions = useMemo(() => [...transactions]
    .sort((a, b) => (asDate(b.date || b.createdAt)?.getTime() || 0) - (asDate(a.date || a.createdAt)?.getTime() || 0))
    .slice(0, 5), [transactions]);

  const { todayInbound, todayOutbound } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todays = transactions.filter(t => {
      const d = asDate(t.date || t.createdAt);
      return d && d >= todayStart;
    });
    return {
      todayInbound: todays.filter(isStockIn).length,
      todayOutbound: todays.filter(t => !isStockIn(t)).length
    };
  }, [transactions]);

  return (
    <div className="flex h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="relative z-10 bg-[var(--header-bg)] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-[var(--header-text)]">Envantra Dashboard</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Merhaba, {dbUser?.name?.split(" ")[0] || "Kullanıcı"}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onOpenScanner} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--header-text)] hover:bg-slate-200 transition-colors">
              <Search size={20} />
            </button>
            <button onClick={onOpenProfile} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--header-text)] hover:bg-slate-200 transition-colors">
              {(dbUser?.name || "K").trim().charAt(0).toLocaleUpperCase("tr-TR")}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 px-5 pt-4">
        {/* İş Durumu (Bugün - Güncel) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-white text-lg font-bold">İş Durumu</h2>
              <p className="text-slate-400 text-xs">Bugün · Güncel</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full text-xs font-bold">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              {todayInbound + todayOutbound} işlem
            </div>
          </div>
          
          <div className="mt-4 flex flex-col gap-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Bugünkü Hareket</span>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white">{todayInbound}</span>
              <span className="text-sm font-semibold text-emerald-500 mb-1">Giren</span>
              <span className="text-3xl font-black text-white ml-2">{todayOutbound}</span>
              <span className="text-sm font-semibold text-rose-500 mb-1">Çıkan</span>
            </div>
          </div>
          
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold mb-1">
                <AlertTriangle size={12} />
                KRİTİK STOK
              </div>
              <span className="text-white font-bold">{criticalProducts.length} ürün</span>
              <span className="text-slate-400 text-xs mt-0.5">{criticalProducts.length > 0 ? "Dikkat gerektiriyor" : "Her şey yolunda"}</span>
            </div>
            <div className="flex flex-col border-l border-slate-800 pl-4">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold mb-1">
                <ArrowDownRight size={12} />
                STOKSUZ
              </div>
              <span className="text-white font-bold">{outOfStockProducts.length} ürün</span>
              <span className="text-slate-400 text-xs mt-0.5">{outOfStockProducts.length > 0 ? "Tükendi" : "Tükenen yok"}</span>
            </div>
          </div>
        </section>

        {/* Hızlı İşlemler */}
        <section className="mt-6">
          <h2 className="text-sm font-bold text-white mb-3 ml-1">Hızlı İşlemler</h2>
          <div className="grid grid-cols-2 gap-3">
            <ActionCard 
              icon={<Scan size={20} className="text-emerald-400" />} 
              label="Hızlı Sayım" 
              onClick={onOpenScanner}
              tone="emerald"
            />
            <ActionCard 
              icon={<Plus size={20} className="text-blue-400" />} 
              label="Yeni Ürün" 
              onClick={onOpenAddScanner}
              tone="blue"
            />
            <ActionCard 
              icon={<Printer size={20} className="text-indigo-400" />} 
              label="Etiket Yazdır" 
              onClick={onOpenPrintCenter}
              tone="indigo"
            />
            <ActionCard 
              icon={<CalendarDays size={20} className="text-orange-400" />} 
              label="SKT Takibi" 
              onClick={onOpenSKTCalendar}
              tone="orange"
            />
          </div>
        </section>

        {/* Modüller */}
        <section className="mt-6">
          <h2 className="text-sm font-bold text-white mb-3 ml-1">Modüller</h2>
          <div className="grid grid-cols-2 gap-3">
            <ModuleCard 
              icon={<Package size={20} className="text-emerald-500" />} 
              label="Stoklar" 
              onClick={onOpenInventory}
            />
            <ModuleCard 
              icon={<BarChart3 size={20} className="text-slate-300" />} 
              label="Raporlar" 
              onClick={onOpenReports}
            />
            <ModuleCard 
              icon={<History size={20} className="text-slate-300" />} 
              label="İşlem Geçmişi" 
              onClick={onOpenHistory}
            />
            <ModuleCard 
              icon={<Bell size={20} className="text-slate-300" />} 
              label="Bildirimler" 
              onClick={onOpenNotifications}
              badge={notifications.length}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ActionCard({ icon, label, onClick, tone }) {
  const tones = {
    emerald: "bg-slate-900 border-slate-800",
    blue: "bg-slate-900 border-slate-800",
    indigo: "bg-slate-900 border-slate-800",
    orange: "bg-slate-900 border-slate-800",
  };
  
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-xl border ${tones[tone]} active:scale-95 transition-all text-left`}
    >
      <div className={`p-2 rounded-lg bg-slate-800/50`}>
        {icon}
      </div>
      <span className="text-sm font-semibold text-slate-200">{label}</span>
    </button>
  );
}

function ModuleCard({ icon, label, onClick, badge }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl active:scale-95 transition-all text-left relative"
    >
      <div className="p-2 rounded-lg bg-slate-800">
        {icon}
      </div>
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      {badge > 0 && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
