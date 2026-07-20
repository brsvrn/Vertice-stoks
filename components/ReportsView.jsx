"use client";

import { useMemo } from "react";
import { ArrowLeft, BarChart3, Download, Package, TriangleAlert } from "lucide-react";

export default function ReportsView({ products = [], batches = [], transactions = [], inventoryCounts = [], onBack }) {
  const summary = useMemo(() => {
    const stocks = batches.reduce((total, batch) => total + Number(batch.quantity || 0), 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = transactions.filter((item) => new Date(item.date || item.createdAt || 0) >= thirtyDaysAgo);
    const stockIn = recent.filter((item) => item.direction === "IN" || item.type === "STOCK_IN").reduce((total, item) => total + Number(item.quantity || 0), 0);
    const stockOut = recent.filter((item) => item.direction === "OUT" || item.type === "STOCK_OUT").reduce((total, item) => total + Number(item.quantity || 0), 0);
    const stockMap = batches.reduce((map, batch) => ({ ...map, [batch.productId]: Number(map[batch.productId] || 0) + Number(batch.quantity || 0) }), {});
    const critical = products.filter((product) => Number(stockMap[product.id] || 0) <= Number(product.minStock || 0));
    const pendingCounts = inventoryCounts.filter((item) => item.applied === false && Number(item.differenceProducts || 0) > 0 && item.status !== "REJECTED");
    const topProducts = Object.entries(recent.reduce((map, item) => ({ ...map, [item.productId]: Number(map[item.productId] || 0) + Number(item.quantity || 0) }), {}))
      .map(([productId, quantity]) => ({ product: products.find((item) => item.id === productId), quantity }))
      .filter((item) => item.product)
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 5);
    return { stocks, stockIn, stockOut, critical, pendingCounts, topProducts };
  }, [batches, inventoryCounts, products, transactions]);

  const maximumProductMovement = Math.max(...summary.topProducts.map((item) => item.quantity), 1);
  const exportReport = () => {
    const lines = [
      ["Stockera Raporu", new Date().toLocaleString("tr-TR")],
      ["Toplam stok", summary.stocks],
      ["Son 30 gün stok girişi", summary.stockIn],
      ["Son 30 gün stok çıkışı", summary.stockOut],
      ["Kritik stoklu ürün", summary.critical.length],
      [],
      ["Ürün", "Son 30 gün hareket"],
      ...summary.topProducts.map((item) => [item.product.name, item.quantity]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `vertice-rapor-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 p-5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center"><ArrowLeft size={22} /></button>
          <div className="flex-1"><h1 className="text-xl font-black">Raporlar</h1><p className="text-xs text-gray-500 mt-1">Son 30 günün operasyon özeti</p></div>
          <button type="button" onClick={exportReport} className="w-11 h-11 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center" aria-label="Raporu CSV indir"><Download size={20} /></button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-10 space-y-5">
        <section className="grid grid-cols-3 gap-2">
          <Metric label="Toplam Stok" value={summary.stocks} tone="blue" />
          <Metric label="30 Gün Giriş" value={summary.stockIn} tone="green" />
          <Metric label="30 Gün Çıkış" value={summary.stockOut} tone="red" />
        </section>
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center gap-2"><BarChart3 size={18} className="text-violet-400" /><h2 className="font-black">En Çok Hareket Gören Ürünler</h2></div>
          <div className="mt-5 space-y-4">
            {summary.topProducts.length > 0 ? summary.topProducts.map((item) => <div key={item.product.id}>
              <div className="flex justify-between gap-3 text-sm"><span className="font-bold truncate">{item.product.name}</span><span className="text-violet-400 font-black">{item.quantity}</span></div>
              <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(item.quantity / maximumProductMovement) * 100}%` }} /></div>
            </div>) : <p className="text-sm text-gray-500">Bu dönem için stok hareketi bulunmuyor.</p>}
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4"><div className="flex gap-2 text-red-400"><TriangleAlert size={18} /><h2 className="font-black">Kritik Stok</h2></div><p className="mt-3 text-3xl font-black">{summary.critical.length}</p><p className="mt-1 text-xs text-gray-400">Ürün minimum stok seviyesinde veya altında.</p></div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4"><div className="flex gap-2 text-orange-400"><Package size={18} /><h2 className="font-black">Bekleyen Sayım</h2></div><p className="mt-3 text-3xl font-black">{summary.pendingCounts.length}</p><p className="mt-1 text-xs text-gray-400">Yönetici onayı bekleyen sayım kaydı.</p></div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const tones = { blue: "text-blue-400", green: "text-emerald-400", red: "text-red-400" };
  return <div className="rounded-2xl border border-gray-800 bg-gray-900 p-3"><p className="text-[9px] uppercase font-bold text-gray-500">{label}</p><p className={`mt-2 text-xl font-black ${tones[tone]}`}>{value}</p></div>;
}
