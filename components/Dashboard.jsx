"use client";

import { useMemo, useState } from "react";
import {
  Search,
  X,
  Package,
  Bell,
  Camera,
  QrCode,
} from "lucide-react";

export default function Dashboard({
  dbUser,
  products = [],
  batches = [],
  notifications = [],
  showToast,
  onOpenNotifications,
  onSelectProduct,
  onUnknownBarcode,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const getProductStock = (productId) => {
    return batches
      .filter((batch) => batch.productId === productId)
      .reduce(
        (total, batch) =>
          total + Number(batch.quantity || 0),
        0
      );
  };

  const filteredProducts = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const name = String(product.name || "")
        .toLocaleLowerCase("tr-TR");

      const qrNo = String(product.qrNo || "")
        .toLocaleLowerCase("tr-TR");

      const category = String(product.category || "")
        .toLocaleLowerCase("tr-TR");

      return (
        name.includes(query) ||
        qrNo.includes(query) ||
        category.includes(query)
      );
    });
  }, [products, searchQuery]);

  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce(
      (groups, product) => {
        const category = (
          product.category?.trim() || "DİĞER"
        ).toLocaleUpperCase("tr-TR");

        if (!groups[category]) {
          groups[category] = [];
        }

        groups[category].push(product);

        return groups;
      },
      {}
    );
  }, [filteredProducts]);

  const handleCode = (code) => {
    const cleanCode = String(code || "").trim();

    if (!cleanCode) {
      showToast?.(
        "Lütfen barkod veya QR kodu girin.",
        "error"
      );
      return;
    }

    const foundProduct = products.find(
      (product) =>
        String(product.qrNo || "").trim() === cleanCode
    );

    if (foundProduct) {
      setShowScanner(false);
      setManualCode("");
      onSelectProduct?.(foundProduct);
      return;
    }

    setShowScanner(false);
    setManualCode("");

    onUnknownBarcode?.(cleanCode);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <header className="p-6 bg-gray-900 border-b border-gray-800 rounded-b-3xl relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="min-w-0 pr-4">
            <h1 className="text-2xl font-bold text-white">
              Vertice Stok
            </h1>

            <p className="text-gray-500 text-sm mt-1 truncate">
              Merhaba, {dbUser?.name || "Kullanıcı"}
            </p>

            <span className="inline-block mt-2 px-2 py-1 bg-gray-800 rounded-md text-[10px] text-blue-400 uppercase font-bold">
              {dbUser?.role === "admin"
                ? "Yönetici"
                : "Personel"}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative shrink-0 p-3 bg-gray-800 rounded-full text-white active:scale-95 transition-transform"
          >
            <Bell size={24} />

            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-gray-900">
                {notifications.length > 99
                  ? "99+"
                  : notifications.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            size={22}
          />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Ürün adı, kategori veya QR ara..."
            className="w-full bg-gray-950 border border-gray-800 text-white pl-12 pr-12 py-4 rounded-2xl outline-none focus:border-blue-500 placeholder-gray-600"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-1">
              Toplam Ürün
            </p>

            <p className="text-2xl font-bold text-white">
              {products.length}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-1">
              Aktif Uyarı
            </p>

            <p
              className={`text-2xl font-bold ${
                notifications.length > 0
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {notifications.length}
            </p>
          </div>
        </div>

        {searchQuery && (
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-4">
            Arama Sonuçları ({filteredProducts.length})
          </p>
        )}

        {Object.keys(groupedProducts)
          .sort((a, b) =>
            a.localeCompare(b, "tr")
          )
          .map((category) => (
            <section
              key={category}
              className="mb-8"
            >
              <h2 className="text-blue-400 font-bold mb-3 px-1 text-sm tracking-widest uppercase flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                {category}
              </h2>

              <div className="space-y-3">
                {groupedProducts[category].map(
                  (product) => {
                    const totalStock =
                      getProductStock(product.id);

                    const minStock = Number(
                      product.minStock || 0
                    );

                    const isLowStock =
                      totalStock <= minStock;

                    return (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() =>
                          onSelectProduct?.(product)
                        }
                        className="w-full text-left bg-gray-900 p-4 rounded-2xl border border-gray-800 flex items-center justify-between active:scale-[0.98] transition-transform"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={`shrink-0 p-3 rounded-xl ${
                              isLowStock
                                ? "bg-red-500/20 text-red-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            <Package size={26} />
                          </div>

                          <div className="min-w-0">
                            <h3 className="text-white font-bold truncate">
                              {product.name}
                            </h3>

                            <div className="flex items-center gap-1 mt-1 text-gray-500">
                              <QrCode size={12} />

                              <span className="text-xs font-mono truncate">
                                {product.qrNo ||
                                  "Kod yok"}
                              </span>
                            </div>

                            {product.shelfLocation && (
                              <p className="text-[10px] text-gray-600 mt-1">
                                Raf:{" "}
                                {product.shelfLocation}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <p
                            className={`text-2xl font-bold ${
                              isLowStock
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {totalStock}
                          </p>

                          <p className="text-[10px] text-gray-600">
                            Adet
                          </p>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </section>
          ))}

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <Package
              size={56}
              className="text-gray-800 mb-4"
            />

            <p className="text-gray-400 font-bold">
              Ürün bulunamadı
            </p>

            <p className="text-gray-600 text-sm mt-2">
              Arama kelimesini değiştirin veya yeni
              bir ürün ekleyin.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowScanner(true)}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white p-5 rounded-full shadow-2xl active:scale-90 transition-transform"
      >
        <Camera size={32} />
      </button>

      {showScanner && (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end">
          <div className="w-full bg-gray-900 rounded-t-3xl border-t border-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Ürün Kodu
                </h2>

                <p className="text-gray-500 text-xs mt-1">
                  QR veya barkod numarasını girin.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowScanner(false);
                  setManualCode("");
                }}
                className="p-2 bg-gray-800 text-gray-400 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={manualCode}
              onChange={(event) =>
                setManualCode(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleCode(manualCode);
                }
              }}
              placeholder="Örn: 8691234567890"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white font-mono text-center text-lg outline-none focus:border-blue-500"
            />

            <button
              type="button"
              onClick={() =>
                handleCode(manualCode)
              }
              disabled={!manualCode.trim()}
              className="w-full mt-4 bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-4 rounded-xl"
            >
              Kodu Kontrol Et
            </button>

            <p className="text-center text-gray-600 text-xs mt-4">
              Kamera ile gerçek QR tarama özelliğini
              sonraki aşamada ekleyebiliriz.
            </p>
          </div>
        </div>
      )}
    </div>
  );
                            }
