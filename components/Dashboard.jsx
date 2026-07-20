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

      <main className="flex-1 overflow-y-auto px-5 pb-32 pt-6">
        
        {/* Summary Cards */}
        <section className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-teal rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Stock</p>
            <p className="mt-1 text-2xl font-black">{totalStock}</p>
          </div>
          
          <div className="bg-gradient-blue rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Low Stock</p>
            <p className="mt-1 text-2xl font-black">{criticalProducts.length}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Out of Stock</p>
            <p className="mt-1 text-2xl font-black text-red-500">{outOfStockProducts.length}</p>
          </div>
        </section>

        {/* Quick Access */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Hızlı Erişim</h2>
          <div className="grid grid-cols-3 gap-3">
            <QuickAccessCard 
              icon={<Package size={24} className="text-teal-600 dark:text-teal-400" />} 
              label="Stok Yönetimi" 
              onClick={onOpenInventory} 
            />
            <QuickAccessCard 
              icon={<Camera size={24} className="text-blue-600 dark:text-blue-400" />} 
              label="Barkod & QR" 
              onClick={onOpenScanner} 
            />
            <QuickAccessCard 
              icon={<CalendarDays size={24} className="text-indigo-600 dark:text-indigo-400" />} 
              label="SKT Takibi" 
              onClick={onOpenSKTCalendar} 
            />
            <QuickAccessCard 
              icon={<Bell size={24} className="text-orange-500" />} 
              label="Bildirimler" 
              onClick={onOpenNotifications} 
              badge={notifications.length}
            />
            <QuickAccessCard 
              icon={<BarChart3 size={24} className="text-purple-500" />} 
              label="Raporlar" 
              onClick={onOpenReports} 
            />
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--foreground)]">Recent Activity</h2>
            <button onClick={onOpenHistory} className="text-sm font-semibold text-teal-600 dark:text-teal-400">View All</button>
          </div>
          
          <div className="space-y-3">
            {recentTransactions.length > 0 ? recentTransactions.map((tx) => (
              <ActivityItem key={tx.id} transaction={tx} />
            )) : (
              <p className="text-center py-6 text-sm text-slate-500">Henüz aktivite yok.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function QuickAccessCard({ icon, label, onClick, badge }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm transition-all text-center relative gap-3"
    >
      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
        {icon}
      </div>
      <span className="text-[11px] font-bold leading-tight">{label}</span>
      {badge > 0 && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md">
          {badge}
        </span>
      )}
    </button>
  );
}

function ActivityItem({ transaction }) {
  const incoming = isStockIn(transaction);
  return (
    <div className="flex items-center p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
      <div className={`p-3 rounded-xl mr-4 ${incoming ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
        {incoming ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-[var(--foreground)] truncate">{transaction.productName || "Stok İşlemi"}</h3>
        <p className="text-xs text-slate-500 truncate mt-0.5">{formatRelativeTime(transaction.date || transaction.createdAt)}</p>
      </div>
      <div className={`text-sm font-black ${incoming ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {incoming ? '+' : '-'}{transaction.quantity}
      </div>
    </div>
  );
}
