"use client";

import { useMemo, useState } from "react";
import {
  Search,
  X,
  Package,
  Bell,
  Camera,
} from "lucide-react";

export default function Dashboard({
  dbUser,
  products,
  batches,
  notifications,
  onOpenNotifications,
  onSelectProduct,
  showToast,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const productName = String(
        product.name || ""
      ).toLocaleLowerCase("tr-TR");

      const qrNo = String(
        product.qrNo || ""
      ).toLocaleLowerCase("tr-TR");

      return (
        productName.includes(query) ||
        qrNo.includes(query)
      );
    });
  }, [products, searchQuery]);

  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce(
      (groups, product) => {
        const category = (
          product.category?.trim() ||
          "DİĞER"
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

  const getProductStock = (productId) => {
    return batches
      .filter(
        (batch) =>
          batch.productId === productId
      )
      .reduce(
        (total, batch) =>
          total +
          Number(batch.quantity || 0),
        0
      );
  };

  const handleCameraClick = () => {
    showToast(
      "QR tarayıcı modülünü bir sonraki adımda bağlayacağız.",
      "warning"
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">

      {/* Header */}

      <header className="p-5 bg-gray-900 rounded-b-3xl border-b border-gray-800 shadow-lg relative z-10">

        <div className="flex justify-between items-center mb-5">

          <div>
            <h1 className="text-2xl font-black text-white">
              Vertice Stok
            </h1>

            <div className="flex items-center gap-2 mt-1">

              <p className="text-gray-500 text-sm">
                Merhaba,{" "}
                <span className="text-gray-300 font-medium">
                  {dbUser?.name}
                </span>
              </p>

              <span className="px-2 py-0.5 bg-gray-800 rounded-md text-[9px] text-blue-400 uppercase font-bold tracking-wider">
                {dbUser?.role === "admin"
                  ? "Yönetici"
                  : "Personel"}
              </span>

            </div>
          </div>

          <button
            type="button"
            onClick={
              onOpenNotifications
            }
            className="relative p-3 bg-gray-800 rounded-full text-white active:scale-95 transition-transform"
          >

            <Bell size={23} />

            {notifications.length >
              0 && (
              <span className="absolute top-1 right-1 min-w-5 h-5 px-1 bg-red-500 rounded-full border-2 border-gray-800 text-[9px] font-bold flex items-center justify-center">
                {notifications.length >
                99
                  ? "99+"
                  : notifications.length}
              </span>
            )}

          </button>

        </div>

        {/* Search */}

        <div className="relative">

          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600"
            size={22}
          />

          <input
            type="search"
            placeholder="Ürün adı veya QR kodu ara..."
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
            className="w-full bg-gray-950 text-white pl-12 pr-12 py-4 rounded-2xl border border-gray-800 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-700"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() =>
                setSearchQuery("")
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
            >
              <X size={20} />
            </button>
          )}

        </div>

      </header>

      {/* Product List */}

      <section className="flex-1 overflow-y-auto p-4 pb-36">

        {searchQuery && (
          <div className="mb-4 px-1">

            <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
              {filteredProducts.length} ürün bulundu
            </p>

          </div>
        )}

        {Object.keys(
          groupedProducts
        )
          .sort((a, b) =>
            a.localeCompare(
              b,
              "tr"
            )
          )
          .map((category) => (

            <div
              key={category}
              className="mb-7"
            >

              {/* Category */}

              <div className="flex items-center gap-2 mb-3 px-1">

                <div className="w-2 h-2 bg-blue-500 rounded-full" />

                <h2 className="text-blue-400 text-xs font-black uppercase tracking-[0.15em]">
                  {category}
                </h2>

                <span className="text-[10px] text-gray-700 ml-auto">
                  {
                    groupedProducts[
                      category
                    ].length
                  }{" "}
                  ürün
                </span>

              </div>

              {/* Products */}

              <div className="space-y-3">

                {groupedProducts[
                  category
                ].map(
                  (product) => {
                    const totalStock =
                      getProductStock(
                        product.id
                      );

                    const minimumStock =
                      Number(
                        product.minStock ||
                          0
                      );

                    const isLowStock =
                      totalStock <=
                      minimumStock;

                    return (
                      <button
                        type="button"
                        key={
                          product.id
                        }
                        onClick={() =>
                          onSelectProduct(
                            product
                          )
                        }
                        className="w-full bg-gray-900 p-4 rounded-2xl border border-gray-800 flex items-center justify-between text-left active:scale-[0.98] transition-transform"
                      >

                        <div className="flex items-center gap-4 min-w-0">

                          <div
                            className={`shrink-0 p-3 rounded-xl ${
                              isLowStock
                                ? "bg-red-500/10 text-red-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            <Package
                              size={
                                26
                              }
                            />
                          </div>

                          <div className="min-w-0">

                            <h3 className="text-white font-bold text-base truncate">
                              {
                                product.name
                              }
                            </h3>

                            <div className="flex items-center gap-2 mt-1">

                              <p className="text-gray-600 text-xs font-mono truncate">
                                {product.qrNo ||
                                  "QR yok"}
                              </p>

                              {product.shelfLocation && (
                                <span className="text-[9px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full shrink-0">
                                  Raf{" "}
                                  {
                                    product.shelfLocation
                                  }
                                </span>
                              )}

                            </div>

                          </div>

                        </div>

                        <div className="text-right shrink-0 ml-3">

                          <p
                            className={`text-2xl font-black ${
                              isLowStock
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {
                              totalStock
                            }
                          </p>

                          <p className="text-[9px] text-gray-600 uppercase tracking-wider">
                            Adet
                          </p>

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </div>

          ))}

        {/* Empty State */}

        {filteredProducts.length ===
          0 && (
          <div className="flex flex-col items-center justify-center text-center py-20">

            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-5">

              <Package
                size={38}
                className="text-gray-700"
              />

            </div>

            <h3 className="text-white font-bold mb-2">
              Ürün bulunamadı
            </h3>

            <p className="text-gray-600 text-sm max-w-[250px]">
              Arama kriterlerinize uygun bir ürün bulunamadı.
            </p>

          </div>
        )}

      </section>

      {/* QR Scanner Button */}

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">

        <button
          type="button"
          onClick={
            handleCameraClick
          }
          className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-[0_0_30px_rgba(37,99,235,0.45)] flex items-center justify-center active:scale-90 transition-transform border-4 border-gray-950"
          aria-label="QR kod tara"
        >
          <Camera size={30} />
        </button>

      </div>

    </div>
  );
                        }
