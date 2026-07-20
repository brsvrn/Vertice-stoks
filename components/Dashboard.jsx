"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  History,
  Home,
  Package,
  Plus,
  Search,
  User,
  Warehouse,
  Wine,
  X,
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
}) {
  const [searchQuery, setSearchQuery] = useState("");

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
  const depotStock = useMemo(() => Object.values(stockByProduct).reduce((sum, item) => sum + item.depot, 0), [stockByProduct]);
  const barStock = useMemo(() => Object.values(stockByProduct).reduce((sum, item) => sum + item.bar, 0), [stockByProduct]);

  const criticalProducts = useMemo(() => products.filter((product) => (
    Number(stockByProduct[product.id]?.total || 0) <= Number(product.minStock || 0)
  )), [products, stockByProduct]);

  const last24HourMovements = useMemo(() => {
    const boundary = Date.now() - (24 * 60 * 60 * 1000);
    return transactions.filter((transaction) => asDate(transaction.date || transaction.createdAt)?.getTime() >= boundary);
  }, [transactions]);

  const recentTransactions = useMemo(() => [...transactions]
    .sort((a, b) => (asDate(b.date || b.createdAt)?.getTime() || 0) - (asDate(a.date || a.createdAt)?.getTime() || 0))
    .slice(0, 4), [transactions]);

  const movementTrend = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return { date, value: 0, label: new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(date).slice(0, 3) };
    });
    transactions.forEach((transaction) => {
      const date = asDate(transaction.date || transaction.createdAt);
      if (!date) return;
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      const item = days.find((entry) => entry.date.getTime() === day.getTime());
      if (item) item.value += Math.abs(Number(transaction.quantity || 0));
    });
    return days;
  }, [transactions]);

  const attentionItems = useMemo(() => {
    const lowStock = criticalProducts.slice(0, 2).map((product) => ({
      id: `low-${product.id}`,
      tone: "red",
      title: product.name,
      description: `Kritik stok: ${Number(stockByProduct[product.id]?.total || 0)} adet`,
    }));
    const nextWeek = Date.now() + (7 * 24 * 60 * 60 * 1000);
    const expiry = batches.filter((batch) => {
      const date = asDate(batch.expiryDate);
      return date && date.getTime() >= Date.now() && date.getTime() <= nextWeek && Number(batch.quantity || 0) > 0;
    }).slice(0, 2).map((batch) => ({
      id: `expiry-${batch.id}`,
      tone: "amber",
      title: products.find((product) => product.id === batch.productId)?.name || "Ürün",
      description: `SKT: ${new Intl.DateTimeFormat("tr-TR").format(asDate(batch.expiryDate))}`,
    }));
    const counts = inventoryCounts.filter((item) => item.applied === false && Number(item.differenceProducts || 0) > 0 && item.status !== "REJECTED")
      .slice(0, 1).map((item) => ({ id: `count-${item.id}`, tone: "blue", title: "Sayım onayı bekliyor", description: `${item.differenceProducts} üründe stok farkı var` }));
    return [...lowStock, ...expiry, ...counts].slice(0, 4);
  }, [batches, criticalProducts, inventoryCounts, products, stockByProduct]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!query) return products;
    return products.filter((product) => [product.name, product.qrNo, product.category, product.shelfLocation]
      .some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(query)));
  }, [products, searchQuery]);

  const trendMaximum = Math.max(...movementTrend.map((item) => item.value), 1);
  const depotPercent = totalStock ? Math.round((depotStock / totalStock) * 100) : 0;
  const barPercent = totalStock ? Math.round((barStock / totalStock) * 100) : 0;
  const locationCount = new Set(batches.map((batch) => String(batch.location || "DEPO").toUpperCase())).size;

  return (
    <div className="envantra-dashboard flex h-full flex-col bg-gray-950 text-gray-100">
      <header className="envantra-dashboard__header relative z-10 border-b border-gray-800 bg-gray-900">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Boxes size={21} /></span>
              <div className="min-w-0"><h1 className="truncate text-base font-black tracking-tight text-white">ENVANTRA</h1><p className="mt-0.5 text-[10px] font-bold tracking-[.12em] text-gray-500">AKILLI STOK YÖNETİMİ</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onOpenNotifications} className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800 text-white" aria-label="Bildirimleri aç"><Bell size={20} />{notifications.length > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-gray-900 bg-red-500 px-1 text-[9px] font-black text-white">{notifications.length > 99 ? "99+" : notifications.length}</span>}</button>
              <button type="button" onClick={onOpenProfile} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white" aria-label="Profili aç">{(dbUser?.name || "K").trim().charAt(0).toLocaleUpperCase("tr-TR")}</button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-40 pt-5 sm:px-6">
        <section>
          <h2 className="text-xl font-black tracking-tight text-white">Hoş geldin, {dbUser?.name?.split(" ")[0] || "ekip"}</h2>
          <p className="mt-1 text-sm text-gray-500">Stok operasyonunuzdaki güncel durum burada.</p>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricCard icon={<Package size={20} />} label="Toplam ürün" value={products.length} detail={`${totalStock.toLocaleString("tr-TR")} adet stok`} tone="blue" />
          <MetricCard icon={<AlertTriangle size={20} />} label="Düşük stok uyarısı" value={criticalProducts.length} detail="İlgi bekleyen ürün" tone="red" />
          <MetricCard icon={<History size={20} />} label="Hareket (24 saat)" value={last24HourMovements.length} detail="Son 24 saatteki kayıt" tone="teal" />
        </section>

        <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="font-black text-white">Hızlı işlemler</h2><p className="mt-1 text-xs text-gray-500">Sık kullanılan stok operasyonları</p></div><Camera size={19} className="text-blue-500" /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickAction label="Ürün tara" icon={<Camera size={18} />} onClick={onOpenScanner} primary />
            {dbUser?.role === "admin" && <QuickAction label="Ürün ekle" icon={<Plus size={18} />} onClick={onOpenAddScanner} />}
            {dbUser?.role === "admin" && <QuickAction label="Sayım başlat" icon={<ClipboardCheck size={18} />} onClick={onOpenInventory} />}
            <QuickAction label="Hareketler" icon={<History size={18} />} onClick={onOpenHistory} />
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="font-black text-white">Stok hareket trendi</h2><p className="mt-1 text-xs text-gray-500">Son 7 gün</p></div><button type="button" onClick={onOpenReports} className="flex items-center gap-1 text-xs font-bold text-blue-500">Raporlar <ChevronRight size={15} /></button></div>
          <div className="mt-5 flex h-36 items-end justify-between gap-2">
            {movementTrend.map((item) => <div key={item.date.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-28 w-full items-end rounded-t-lg bg-gray-800 px-1"><div className="w-full rounded-t-md bg-blue-600" style={{ height: `${Math.max(8, Math.round((item.value / trendMaximum) * 100))}%` }} title={`${item.value} adet hareket`} /></div><span className="text-[10px] font-medium text-gray-500">{item.label}</span></div>)}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="font-black text-white">Son aktiviteler</h2><p className="mt-1 text-xs text-gray-500">Kaydedilen son stok hareketleri</p></div><button type="button" onClick={onOpenHistory} className="text-xs font-bold text-blue-500">Tümünü gör</button></div>
          <div className="mt-4 divide-y divide-gray-800">
            {recentTransactions.length ? recentTransactions.map((transaction) => <ActivityRow key={transaction.id} transaction={transaction} />) : <p className="py-5 text-center text-sm text-gray-500">Henüz kaydedilmiş stok hareketi yok.</p>}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center gap-2"><Warehouse size={19} className="text-blue-500" /><div><h2 className="font-black text-white">Depo durumu</h2><p className="mt-1 text-xs text-gray-500">Mevcut stok dağılımı · {locationCount} lokasyon</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><LocationCard icon={<Warehouse size={18} />} label="Depo" amount={depotStock} percent={depotPercent} /><LocationCard icon={<Wine size={18} />} label="Bar" amount={barStock} percent={barPercent} /></div>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between"><div><h2 className="font-black text-white">Dikkat gerektirenler</h2><p className="mt-1 text-xs text-gray-500">Kritik stok, SKT ve sayım kontrolleri</p></div><span className="text-xs font-bold text-gray-500">{attentionItems.length} kayıt</span></div>
          <div className="mt-3 space-y-2">{attentionItems.length ? attentionItems.map((item) => <AttentionCard key={item.id} item={item} />) : <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-500">Şu anda takip gerektiren bir stok, SKT veya sayım kaydı yok.</div>}</div>
        </section>

        <section className="mt-6">
          <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={19} /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Ürün, barkod, kategori veya raf ara" className="w-full rounded-2xl border border-gray-800 bg-gray-900 py-3.5 pl-11 pr-10 text-sm outline-none" />{searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500" aria-label="Aramayı temizle"><X size={17} /></button>}</div>
          <div className="mt-4 flex items-center justify-between"><h2 className="font-black text-white">Ürünler</h2><span className="text-xs font-bold text-gray-500">{filteredProducts.length} kayıt</span></div>
          <div className="mt-3 space-y-2">{filteredProducts.slice(0, searchQuery ? 50 : 6).map((product) => <ProductRow key={product.id} product={product} stock={stockByProduct[product.id]} onOpen={() => onOpenProduct?.(product)} />)}{filteredProducts.length === 0 && <p className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-center text-sm text-gray-500">Aramanıza uygun ürün bulunamadı.</p>}</div>
        </section>
      </main>

      <div className="absolute bottom-[76px] left-1/2 z-20 -translate-x-1/2"><button type="button" onClick={onOpenScanner} className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-gray-950 bg-blue-600 text-white shadow-[0_10px_26px_rgba(0,82,204,.35)] active:scale-90" aria-label="QR veya barkod tara"><Camera size={27} /></button></div>
      <nav className="absolute bottom-0 left-0 right-0 z-10 border-t border-gray-800 bg-gray-900/95 px-2 py-2.5 backdrop-blur-xl"><div className="flex items-center justify-around"><NavButton icon={<Home size={20} />} label="Ana sayfa" active />{dbUser?.role === "admin" && <NavButton icon={<Plus size={20} />} label="Ekle" onClick={onOpenAddScanner} />}{dbUser?.role === "admin" && <NavButton icon={<ClipboardCheck size={20} />} label="Sayım" onClick={onOpenInventory} />}<NavButton icon={<History size={20} />} label="Geçmiş" onClick={onOpenHistory} /><NavButton icon={<CheckCircle2 size={20} />} label="Etiket" onClick={onOpenPrintCenter} /><NavButton icon={<User size={20} />} label="Profil" onClick={onOpenProfile} /></div></nav>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, tone }) {
  const tones = { blue: "bg-blue-500/10 text-blue-500", red: "bg-red-500/10 text-red-500", teal: "bg-violet-500/10 text-violet-500" };
  return <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.12em] text-gray-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{Number(value).toLocaleString("tr-TR")}</p><p className="mt-1 text-xs text-gray-500">{detail}</p></div>;
}

function QuickAction({ icon, label, onClick, primary = false }) {
  return <button type="button" onClick={onClick} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 text-xs font-bold active:scale-[.98] ${primary ? "border-blue-500 bg-blue-600 text-white" : "border-gray-800 bg-gray-950 text-gray-300 hover:bg-gray-800"}`}>{icon}<span>{label}</span></button>;
}

function ActivityRow({ transaction }) {
  const incoming = isStockIn(transaction);
  const transfer = transaction.type === "TRANSFER";
  return <div className="flex items-center gap-3 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${transfer ? "bg-blue-500/10 text-blue-500" : incoming ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{incoming ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{transaction.productName || "Stok işlemi"}</p><p className="mt-0.5 text-xs text-gray-500">{transaction.locationInfo || transaction.location || "Depo"} · {formatRelativeTime(transaction.date || transaction.createdAt)}</p></div><span className={`text-sm font-black ${incoming ? "text-emerald-500" : "text-red-500"}`}>{incoming ? "+" : "-"}{Number(transaction.quantity || 0)}</span></div>;
}

function LocationCard({ icon, label, amount, percent }) {
  return <div className="rounded-xl bg-gray-950 p-3"><div className="flex items-center justify-between text-blue-500">{icon}<span className="text-xs font-black">%{percent}</span></div><p className="mt-3 text-sm font-bold text-white">{label}</p><p className="mt-1 text-lg font-black text-white">{amount.toLocaleString("tr-TR")} <span className="text-xs font-medium text-gray-500">adet</span></p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div></div>;
}

function AttentionCard({ item }) {
  const tone = item.tone === "red" ? "border-red-500/25 bg-red-500/10" : item.tone === "amber" ? "border-orange-500/25 bg-orange-500/10" : "border-blue-500/20 bg-blue-500/10";
  return <div className={`flex items-center gap-3 rounded-xl border p-3 ${tone}`}><AlertTriangle size={17} className={item.tone === "red" ? "text-red-500" : "text-blue-500"} /><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{item.title}</p><p className="mt-0.5 truncate text-xs text-gray-500">{item.description}</p></div></div>;
}

function ProductRow({ product, stock, onOpen }) {
  const amount = Number(stock?.total || 0);
  const critical = amount <= Number(product.minStock || 0);
  return <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-3 text-left shadow-sm active:scale-[.99]"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${critical ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}`}><Package size={21} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{product.name}</span><span className="mt-1 block truncate text-[11px] text-gray-500">{product.qrNo || "Barkod tanımlanmadı"}{product.shelfLocation ? ` · Raf ${product.shelfLocation}` : ""}</span></span><span className="text-right"><span className={`block text-lg font-black ${critical ? "text-red-500" : "text-emerald-500"}`}>{amount}</span><span className="text-[10px] font-bold uppercase text-gray-500">adet</span></span></button>;
}

function NavButton({ icon, label, active = false, onClick }) {
  return <button type="button" onClick={onClick} className={`flex min-w-11 flex-col items-center gap-1 rounded-lg px-1 py-1 ${active ? "text-blue-500" : "text-gray-500"}`}>{icon}<span className="text-[9px] font-bold">{label}</span></button>;
}
