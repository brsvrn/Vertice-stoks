"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Search, Package, Plus } from "lucide-react";

export default function ProductsListView({
  products = [],
  batches = [],
  onBack,
  onOpenProduct,
  onAddProduct,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const stockByProduct = useMemo(() => {
    return batches.reduce((acc, batch) => {
      if (!batch.productId) return acc;
      acc[batch.productId] = (acc[batch.productId] || 0) + Number(batch.quantity || 0);
      return acc;
    }, {});
  }, [batches]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!query) return products.sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr-TR"));
    
    return products.filter((p) => {
      const name = String(p.name || "").toLocaleLowerCase("tr-TR");
      const code = String(p.qrNo || p.barcode || p.barcodeNo || "").toLocaleLowerCase("tr-TR");
      return name.includes(query) || code.includes(query);
    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr-TR"));
  }, [products, searchQuery]);

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f1c] text-white">
      <header className="px-5 pt-12 pb-4 bg-[#0f1523] border-b border-slate-800 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <button onClick={onBack} className="p-2 -ml-2 bg-slate-800 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Ürünler</h1>
          <button onClick={onAddProduct} className="p-2 -mr-2 bg-blue-600 rounded-full text-white">
            <Plus size={20} />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ürün adı veya barkod ara..." 
            className="w-full bg-[#1a2235] border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-3">
          {filteredProducts.map(product => {
            const stock = stockByProduct[product.id] || 0;
            return (
              <button 
                key={product.id}
                onClick={() => onOpenProduct(product)}
                className="w-full bg-[#121827] border border-slate-800 rounded-xl p-4 flex justify-between items-center text-left active:bg-slate-800 transition-colors"
              >
                <div className="flex-1 pr-4">
                  <h3 className="font-bold text-slate-200 truncate">{product.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{product.qrNo || product.barcode}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-black ${stock <= (product.minStock || 0) ? 'text-red-400' : 'text-emerald-400'}`}>
                    {stock}
                  </p>
                  <p className="text-[10px] text-slate-500">Stok</p>
                </div>
              </button>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-slate-700 mb-4" />
              <p className="text-slate-400">Ürün bulunamadı.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
