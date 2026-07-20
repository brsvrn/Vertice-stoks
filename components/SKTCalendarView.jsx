"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, Calendar as CalendarIcon, AlertCircle } from "lucide-react";

export default function SKTCalendarView({ products, batches, onBack }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Bütün SKT'li partileri bul ve ürünlerle eşleştir
  const batchesWithSKT = useMemo(() => {
    const validBatches = batches.filter((b) => b.expiryDate);
    const result = [];

    for (const batch of validBatches) {
      const product = products.find((p) => p.id === batch.productId);
      if (product) {
        const dateObj = new Date(batch.expiryDate);
        if (!isNaN(dateObj.getTime())) {
          result.push({
            ...batch,
            productName: product.name,
            productSku: product.sku,
            dateObj,
            month: dateObj.getMonth(),
            year: dateObj.getFullYear(),
          });
        }
      }
    }
    // Tarihe göre sırala
    return result.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [products, batches]);

  // Seçili ay/yıl için partileri filtrele
  const currentMonthBatches = useMemo(() => {
    return batchesWithSKT.filter(
      (b) => b.month === selectedMonth && b.year === selectedYear
    );
  }, [batchesWithSKT, selectedMonth, selectedYear]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between sticky top-0 z-10 pt-10">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 active:scale-95 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CalendarIcon size={20} className="text-blue-400" />
          SKT Takvimi
        </h1>
        <div className="w-10 h-10" />
      </header>

      <div className="p-4 flex items-center justify-between bg-gray-900/50">
        <button onClick={handlePrevMonth} className="px-3 py-1 bg-gray-800 rounded-lg text-sm font-bold">Önceki</button>
        <div className="text-lg font-black text-blue-400">
          {monthNames[selectedMonth]} {selectedYear}
        </div>
        <button onClick={handleNextMonth} className="px-3 py-1 bg-gray-800 rounded-lg text-sm font-bold">Sonraki</button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {currentMonthBatches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
            <p>Bu ay için süresi dolacak ürün bulunmuyor.</p>
          </div>
        ) : (
          currentMonthBatches.map((batch) => {
            const today = new Date();
            const daysLeft = Math.ceil((batch.dateObj.getTime() - today.getTime()) / (1000 * 3600 * 24));
            
            let statusColor = "text-green-400";
            let bgStatusColor = "bg-green-500/10 border-green-500/30";
            if (daysLeft < 0) {
              statusColor = "text-red-500";
              bgStatusColor = "bg-red-500/10 border-red-500/30";
            } else if (daysLeft <= 30) {
              statusColor = "text-orange-400";
              bgStatusColor = "bg-orange-500/10 border-orange-500/30";
            }

            return (
              <div key={batch.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-white">{batch.productName}</h3>
                  <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold whitespace-nowrap ${bgStatusColor} ${statusColor}`}>
                    {daysLeft < 0 ? "Süresi Doldu" : `${daysLeft} Gün Kaldı`}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mb-3">
                  Lokasyon: {batch.location || "DEPO"} · Parti: {batch.batchNo}
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800">
                  <div className="text-sm">
                    <span className="text-gray-500">Miktar: </span>
                    <span className="font-bold text-white">{batch.quantity}</span>
                  </div>
                  <div className="text-sm font-mono flex items-center gap-1.5 text-blue-400">
                    <AlertCircle size={14} />
                    SKT: {batch.dateObj.toLocaleDateString("tr-TR")}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
