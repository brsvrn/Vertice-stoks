"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  History,
  Home,
  Package,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";

export default function Dashboard({
  dbUser,
  products = [],
  batches = [],
  notifications = [],
  onOpenProduct,
  onOpenScanner,
  onOpenAddScanner,
  onOpenInventory,
  onOpenHistory,
  onOpenNotifications,
  onOpenProfile,
  onOpenPrintCenter,
}) 
{
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("tr-TR");

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const name = String(product.name || "").toLocaleLowerCase("tr-TR");
      const qrNo = String(product.qrNo || "").toLocaleLowerCase("tr-TR");
      const category = String(product.category || "").toLocaleLowerCase("tr-TR");
      const shelfLocation = String(product.shelfLocation || "").toLocaleLowerCase("tr-TR");

      return (
        name.includes(query) ||
        qrNo.includes(query) ||
        category.includes(query) ||
        shelfLocation.includes(query)
      );
    });
  }, [products, searchQuery]);

  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce((groups, product) => {
      const category = (
        product.category?.trim() || "DİĞER"
      ).toLocaleUpperCase("tr-TR");

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(product);

      return groups;
    }, {});
  }, [filteredProducts]);

  const getProductStock = (productId) => {
    return batches
      .filter((batch) => batch.productId === productId)
      .reduce((total, batch) => total + Number(batch.quantity || 0), 0);
  };

  const totalStock = useMemo(() => {
    return batches.reduce(
      (total, batch) => total + Number(batch.quantity || 0),
      0
    );
  }, [batches]);

  const criticalProductCount = useMemo(() => {
    return products.filter((product) => {
      const stock = getProductStock(product.id);
      return stock <= Number(product.minStock || 0);
    }).length;
  }, [products, batches]);

  const sortedCategories = Object.keys(groupedProducts).sort((a, b) =>
    a.localeCompare(b, "tr")
  );

  return (
    <div className="soft-dashboard flex flex-col h-full bg-gray-950 text-gray-100">
      {/* HEADER */}
      <header className="soft-dashboard__header bg-gray-900 border-b border-gray-800 rounded-b-3xl shadow-xl relative z-10">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="min-w-0">
              <h1 className="text-sm font-black text-white tracking-tight">
                Vertice Stok
              </h1>

              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-400 text-sm truncate">
                  Merhaba, {dbUser?.name || "Kullanıcı"}
                </p>

                <span className="shrink-0 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  {dbUser?.role === "admin" ? "Yönetici" : "Personel"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative shrink-0 w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <Bell size={23} />

              {notifications.length > 0 && (
                <>
                  <span className="absolute top-1 right-1 min-w-5 h-5 px-1 bg-red-500 border-2 border-gray-900 rounded-full text-[9px] font-black flex items-center justify-center text-white">
                    {notifications.length > 99 ? "99+" : notifications.length}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* ÖZET KARTLARI */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="soft-dashboard__primary-stat col-span-2 rounded-2xl p-4">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                Ürün
              </p>

              <p className="text-3xl font-black text-white mt-1">
                {products.length}
              </p>
            </div>

            <div className="soft-dashboard__critical-stat bg-gray-950 border border-gray-800 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                Toplam Stok
              </p>

              <p className="text-xl font-black text-green-400 mt-1">
                {totalStock}
              </p>
            </div>

            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                Kritik
              </p>

              <p
                className={`text-xl font-black mt-1 ${
                  criticalProductCount > 0
                    ? "text-red-400"
                    : "text-gray-400"
                }`}
              >
                {criticalProductCount}
              </p>
            </div>
          </div>

          {/* ARAMA */}
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              size={21}
            />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ürün, QR, kategori veya raf ara..."
              className="w-full bg-gray-950 border border-gray-800 focus:border-blue-500 text-white pl-12 pr-12 py-4 rounded-2xl outline-none transition-colors placeholder:text-gray-600"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={19} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ÜRÜN LİSTESİ */}
      <main className="flex-1 overflow-y-auto p-4 pb-40">
        {searchQuery && (
          <div className="flex justify-between items-center mb-5 px-1">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
              Arama Sonuçları
            </p>

            <span className="text-xs text-blue-400 font-bold">
              {filteredProducts.length} ürün
            </span>
          </div>
        )}

        {sortedCategories.map((category) => (
          <section key={category} className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />

              <h2 className="text-blue-400 font-black text-xs uppercase tracking-[0.15em]">
                {category}
              </h2>

              <span className="ml-auto text-[10px] text-gray-600 font-bold">
                {groupedProducts[category].length}
              </span>
            </div>

            <div className="space-y-3">
              {groupedProducts[category].map((product) => {
                const stock = getProductStock(product.id);
                const minStock = Number(product.minStock || 0);
                const isCritical = stock <= minStock;

                const depoStock = batches
                  .filter(
                    (batch) =>
                      batch.productId === product.id &&
                      (batch.location || "DEPO") === "DEPO"
                  )
                  .reduce(
                    (total, batch) =>
                      total + Number(batch.quantity || 0),
                    0
                  );

                const barStock = batches
                  .filter(
                    (batch) =>
                      batch.productId === product.id &&
                      batch.location === "BAR"
                  )
                  .reduce(
                    (total, batch) =>
                      total + Number(batch.quantity || 0),
                    0
                  );

                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => onOpenProduct?.(product)}
                    className="w-full text-left bg-gray-900 hover:bg-gray-800/80 border border-gray-800 rounded-2xl p-4 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${
                          isCritical
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        <Package size={25} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-white font-bold text-base truncate">
                              {product.name}
                            </h3>

                            <p className="text-gray-600 text-[11px] font-mono mt-1 truncate">
                              {product.qrNo || "QR kodu yok"}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p
                              className={`text-2xl font-black ${
                                isCritical
                                  ? "text-red-400"
                                  : "text-green-400"
                              }`}
                            >
                              {stock}
                            </p>

                            <p className="text-[9px] text-gray-600 uppercase font-bold">
                              Adet
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="text-[10px] bg-gray-950 border border-gray-800 text-gray-400 px-2 py-1 rounded-md">
                            Depo: {depoStock}
                          </span>

                          <span className="text-[10px] bg-gray-950 border border-gray-800 text-gray-400 px-2 py-1 rounded-md">
                            Bar: {barStock}
                          </span>

                          {product.shelfLocation && (
                            <span className="text-[10px] bg-gray-950 border border-gray-800 text-gray-400 px-2 py-1 rounded-md">
                              Raf: {product.shelfLocation}
                            </span>
                          )}

                          {isCritical && (
                            <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 font-bold px-2 py-1 rounded-md">
                              Kritik Stok
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center mb-5">
              <Package size={38} className="text-gray-700" />
            </div>

            <h3 className="text-white font-bold text-lg">
              {searchQuery ? "Ürün bulunamadı" : "Henüz ürün yok"}
            </h3>

            <p className="text-gray-500 text-sm mt-2 max-w-[250px]">
              {searchQuery
                ? "Arama kriterlerinize uygun kayıtlı bir ürün bulunamadı."
                : dbUser?.role === "admin"
                ? "İlk ürününüzü eklemek için aşağıdaki Ekle butonunu kullanabilirsiniz."
                : "Henüz sisteme kayıtlı bir ürün bulunmuyor."}
            </p>
          </div>
        )}
      </main>

      {/* QR TARAMA BUTONU */}
      <div className="absolute bottom-[82px] left-1/2 -translate-x-1/2 z-20">
        <button
          type="button"
          onClick={onOpenScanner}
          className="w-16 h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-[0_0_30px_rgba(37,99,235,0.45)] flex items-center justify-center active:scale-90 transition-all border-4 border-gray-950"
          aria-label="QR veya barkod tara"
        >
          <Camera size={29} />
        </button>
      </div>

      {/* ALT MENÜ */}
      <nav className="absolute bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 px-3 py-3 z-10">
        <div className="flex items-center justify-between">
          <NavButton
            icon={<Home size={21} />}
            label="Ana Sayfa"
            active
          />

          {dbUser?.role === "admin" && (
            <NavButton
              icon={<Plus size={21} />}
              label="Ekle"
              onClick={onOpenAddScanner}
            />
          )}

          {dbUser?.role === "admin" && (
            <NavButton
              icon={<ClipboardCheck size={21} />}
              label="Sayım"
              onClick={onOpenInventory}
            />
          )}

          <NavButton
            icon={<History size={21} />}
            label="Geçmiş"
            onClick={onOpenHistory}
          />
          <NavButton
  icon={<CheckCircle2 size={21} />}
  label="Etiket"
  onClick={onOpenPrintCenter}
/>

          <NavButton
            icon={<User size={21} />}
            label="Profil"
            onClick={onOpenProfile}
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[52px] flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
        active ? "text-blue-500" : "text-gray-500 hover:text-gray-300"
      }`}
    >
      {icon}

      <span className="text-[9px] font-bold">
        {label}
      </span>
    </button>
  );
            }
