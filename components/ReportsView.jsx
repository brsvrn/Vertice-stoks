"use client";

import { useMemo } from "react";
import { ArrowLeft, BarChart3, Box, Download, Lightbulb, Package, ScanLine, TriangleAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function asDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function ReportsView({ products = [], batches = [], transactions = [], inventoryCounts = [], onBack }) {
  const summary = useMemo(() => {
    const since = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recent = transactions.filter((item) => asDate(item.date || item.createdAt)?.getTime() >= since);
    const stockByProduct = batches.reduce((map, batch) => {
      map[batch.productId] = Number(map[batch.productId] || 0) + Number(batch.quantity || 0);
      return map;
    }, {});
    const stocks = Object.values(stockByProduct).reduce((total, value) => total + value, 0);
    const inbound = recent.filter((item) => item.direction === "IN" || item.type === "STOCK_IN").reduce((total, item) => total + Number(item.quantity || 0), 0);
    const outbound = recent.filter((item) => item.direction === "OUT" || item.type === "STOCK_OUT").reduce((total, item) => total + Number(item.quantity || 0), 0);
    const critical = products.filter((product) => Number(stockByProduct[product.id] || 0) <= Number(product.minStock || 0));
    const pendingCounts = inventoryCounts.filter((item) => item.applied === false && Number(item.differenceProducts || 0) > 0 && item.status !== "REJECTED");
    const categoryStocks = products.reduce((map, product) => {
      const category = product.category?.trim() || "Diğer";
      map[category] = Number(map[category] || 0) + Number(stockByProduct[product.id] || 0);
      return map;
    }, {});
    const categoryDistribution = Object.entries(categoryStocks).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topProducts = Object.entries(recent.reduce((map, item) => {
      map[item.productId] = Number(map[item.productId] || 0) + Math.abs(Number(item.quantity || 0));
      return map;
    }, {})).map(([productId, quantity]) => ({ product: products.find((item) => item.id === productId), quantity })).filter((item) => item.product).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return { date, inbound: 0, outbound: 0, label: new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(date).slice(0, 3) };
    });
    recent.forEach((item) => {
      const date = asDate(item.date || item.createdAt);
      if (!date) return;
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      const target = days.find((entry) => entry.date.getTime() === day.getTime());
      if (!target) return;
      if (item.direction === "IN" || item.type === "STOCK_IN") target.inbound += Number(item.quantity || 0);
      else target.outbound += Math.abs(Number(item.quantity || 0));
    });
    const upcomingExpiry = batches.filter((batch) => {
      const date = asDate(batch.expiryDate);
      return date && date.getTime() >= Date.now() && date.getTime() <= Date.now() + (7 * 24 * 60 * 60 * 1000) && Number(batch.quantity || 0) > 0;
    });
    return { stocks, inbound, outbound, critical, pendingCounts, categoryDistribution, topProducts, days, upcomingExpiry, recentCount: recent.length };
  }, [batches, inventoryCounts, products, transactions]);

  const exportReport = async () => {
    try {
      const lines = [["Envantra Raporu", new Date().toLocaleString("tr-TR")], ["Toplam stok", summary.stocks], ["Son 30 gün stok girişi", summary.inbound], ["Son 30 gün stok çıkışı", summary.outbound], ["Kritik stoklu ürün", summary.critical.length], [], ["Ürün", "Son 30 gün hareket"], ...summary.topProducts.map((item) => [item.product.name, item.quantity])];
      const csv = `\uFEFF${lines.map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n")}`;

      const fileName = `envantra-rapor-${new Date().toISOString().slice(0, 10)}.csv`;
      
      const result = await Filesystem.writeFile({
        path: fileName,
        data: csv,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      await Share.share({
        title: 'Envantra Raporu',
        text: 'Envantra stok raporu ektedir.',
        url: result.uri,
        dialogTitle: 'Raporu Kaydet veya Paylaş',
      });
    } catch (error) {
      console.error("Export failed:", error);
      if (typeof window !== "undefined" && window.Capacitor?.isNative) {
        alert("Dışa aktarım başarısız: " + error.message);
      } else {
        const lines = [["Envantra Raporu", new Date().toLocaleString("tr-TR")], ["Toplam stok", summary.stocks], ["Son 30 gün stok girişi", summary.inbound], ["Son 30 gün stok çıkışı", summary.outbound], ["Kritik stoklu ürün", summary.critical.length], [], ["Ürün", "Son 30 gün hareket"], ...summary.topProducts.map((item) => [item.product.name, item.quantity])];
        const csv = `\uFEFF${lines.map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n")}`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        link.download = `envantra-rapor-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    }
  };

  const chartMaximum = Math.max(...summary.days.flatMap((item) => [item.inbound, item.outbound]), 1);
  const categoryTotal = Math.max(summary.categoryDistribution.reduce((total, [, value]) => total + value, 0), 1);
  const movementMaximum = Math.max(...summary.topProducts.map((item) => item.quantity), 1);

  return <div className="flex h-full flex-col bg-gray-950 text-gray-100">
    <header className="border-b border-gray-800 bg-gray-900 p-4"><div className="flex items-center gap-3"><button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800 text-white" aria-label="Geri dön"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><h1 className="text-lg font-black text-white">Raporlar ve analiz</h1><p className="mt-0.5 text-xs text-gray-500">Stok yönetimi için güncel içgörüler</p></div><button type="button" onClick={exportReport} className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white" aria-label="Raporu dışa aktar"><Download size={17} />Dışa aktar</button></div></header>
    <main className="flex-1 overflow-y-auto p-4 pb-10 sm:p-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ReportMetric icon={<Package size={19} />} label="Toplam stok" value={summary.stocks} tone="blue" /><ReportMetric icon={<TrendingUp size={19} />} label="Giriş (30 gün)" value={summary.inbound} tone="teal" /><ReportMetric icon={<TrendingDown size={19} />} label="Çıkış (30 gün)" value={summary.outbound} tone="red" /><ReportMetric icon={<ScanLine size={19} />} label="Hareket kaydı" value={summary.recentCount} tone="blue" /></section>
      <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm"><div className="flex items-center gap-2"><BarChart3 size={19} className="text-blue-500" /><div><h2 className="font-black text-white">Stok hareketleri</h2><p className="mt-0.5 text-xs text-gray-500">Son 7 gün · giriş ve çıkış karşılaştırması</p></div></div><div className="mt-5 flex h-44 items-end justify-between gap-2">{summary.days.map((day) => <div key={day.date.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-32 w-full items-end justify-center gap-1 rounded-t-lg bg-gray-800 px-1"><span className="w-1/2 rounded-t bg-blue-600" style={{ height: `${Math.max(4, Math.round((day.inbound / chartMaximum) * 100))}%` }} title={`Giriş: ${day.inbound}`} /><span className="w-1/2 rounded-t bg-cyan-500" style={{ height: `${Math.max(4, Math.round((day.outbound / chartMaximum) * 100))}%` }} title={`Çıkış: ${day.outbound}`} /></div><span className="text-[10px] font-medium text-gray-500">{day.label}</span></div>)}</div><div className="mt-3 flex justify-center gap-4 text-[11px] text-gray-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-600" />Giriş</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-cyan-500" />Çıkış</span></div></section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm"><h2 className="font-black text-white">Kategori dağılımı</h2><p className="mt-1 text-xs text-gray-500">Stokların kategori bazlı görünümü</p><div className="mt-5 space-y-4">{summary.categoryDistribution.length ? summary.categoryDistribution.map(([category, stock], index) => <div key={category}><div className="flex justify-between gap-3 text-sm"><span className="truncate font-bold text-white">{category}</span><span className="font-black text-blue-500">%{Math.round((stock / categoryTotal) * 100)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800"><div className={index === 0 ? "h-full rounded-full bg-blue-600" : index === 1 ? "h-full rounded-full bg-cyan-500" : "h-full rounded-full bg-emerald-500"} style={{ width: `${(stock / categoryTotal) * 100}%` }} /></div></div>) : <p className="py-6 text-center text-sm text-gray-500">Kategori verisi oluştuğunda burada görünecek.</p>}</div></div><div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm"><div className="flex items-center gap-2"><Lightbulb size={19} className="text-blue-500" /><div><h2 className="font-black text-white">Akıllı öneriler</h2><p className="mt-0.5 text-xs text-gray-500">Mevcut stok verilerinizden üretilir</p></div></div><div className="mt-4 space-y-3"><Insight tone="red" title="Kritik stok kontrolü" text={summary.critical.length ? `${summary.critical.length} ürün minimum stok seviyesinde veya altında.` : "Kritik stok seviyesinde ürün bulunmuyor."} /><Insight tone="teal" title="SKT kontrolü" text={summary.upcomingExpiry.length ? `${summary.upcomingExpiry.length} parti 7 gün içinde SKT'ye yaklaşıyor.` : "Önümüzdeki 7 gün için SKT uyarısı bulunmuyor."} /><Insight tone="blue" title="Sayım kontrolü" text={summary.pendingCounts.length ? `${summary.pendingCounts.length} sayım kaydı yönetici onayı bekliyor.` : "Onay bekleyen sayım kaydı bulunmuyor."} /></div></div></section>
      <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm"><div className="flex items-center gap-2"><Box size={19} className="text-blue-500" /><div><h2 className="font-black text-white">En çok hareket gören ürünler</h2><p className="mt-0.5 text-xs text-gray-500">Son 30 gündeki toplam hareket adedi</p></div></div><div className="mt-5 space-y-4">{summary.topProducts.length ? summary.topProducts.map((item) => <div key={item.product.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-bold text-white">{item.product.name}</span><span className="font-black text-blue-500">{item.quantity}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(item.quantity / movementMaximum) * 100}%` }} /></div></div>) : <p className="py-6 text-center text-sm text-gray-500">Bu dönem için stok hareketi bulunmuyor.</p>}</div></section>
    </main>
  </div>;
}

function ReportMetric({ icon, label, value, tone }) {
  const tones = { blue: "bg-blue-500/10 text-blue-500", teal: "bg-violet-500/10 text-violet-500", red: "bg-red-500/10 text-red-500" };
  return <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.12em] text-gray-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{Number(value).toLocaleString("tr-TR")}</p></div>;
}

function Insight({ tone, title, text }) {
  const tones = { red: "border-red-500/20 bg-red-500/10 text-red-500", teal: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500", blue: "border-blue-500/20 bg-blue-500/10 text-blue-500" };
  return <div className={`rounded-xl border p-3 ${tones[tone]}`}><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-gray-500">{text}</p></div>;
}
