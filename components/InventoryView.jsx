"use client";

import { useMemo, useState } from "react";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Minus,
  Package,
  Plus,
  Search,
  Warehouse,
  Wine,
  X,
} from "lucide-react";

import {
  addDoc,
} from "firebase/firestore";

import {
  getPublicCollection,
} from "./StockApp";

import QRScannerModal from "./QRScannerModal";

export default function InventoryView({
  products = [],
  batches = [],
  dbUser,
  onBack,
  showToast,
}) {
  const [location, setLocation] =
    useState("DEPO");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [counts, setCounts] =
    useState({});

  const [isSaving, setIsSaving] =
    useState(false);

  /*
   * SAYIM BARKOD TARAYICI
   */
  const [
    isInventoryScannerOpen,
    setIsInventoryScannerOpen,
  ] = useState(false);

  /*
   * LOKASYONA GÖRE
   * ÜRÜNÜN SİSTEM STOĞU
   */
  const getSystemStock = (
    productId
  ) => {
    return batches
      .filter(
        (batch) =>
          batch.productId ===
            productId &&
          (batch.location ||
            "DEPO") ===
            location
      )
      .reduce(
        (total, batch) =>
          total +
          Number(
            batch.quantity || 0
          ),
        0
      );
  };

  /*
   * ARAMA
   */
  const filteredProducts =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      if (!query) {
        return products;
      }

      return products.filter(
        (product) => {
          const name =
            String(
              product.name || ""
            ).toLocaleLowerCase(
              "tr-TR"
            );

          const qrNo =
            String(
              product.qrNo ||
                product.barcode ||
                product.barcodeNo ||
                ""
            ).toLocaleLowerCase(
              "tr-TR"
            );

          const category =
            String(
              product.category ||
                ""
            ).toLocaleLowerCase(
              "tr-TR"
            );

          return (
            name.includes(query) ||
            qrNo.includes(query) ||
            category.includes(query)
          );
        }
      );
    }, [
      products,
      searchQuery,
    ]);

  /*
   * SAYILAN ADEDİ GÜNCELLE
   */
  const updateCount = (
    productId,
    value
  ) => {
    const cleanValue =
      Math.max(
        0,
        Number(value) || 0
      );

    setCounts(
      (previous) => ({
        ...previous,

        [productId]:
          cleanValue,
      })
    );
  };

  /*
   * +1
   */
  const increaseCount = (
    productId
  ) => {
    setCounts(
      (previous) => ({
        ...previous,

        [productId]:
          Number(
            previous[
              productId
            ] || 0
          ) + 1,
      })
    );
  };

  /*
   * -1
   */
  const decreaseCount = (
    productId
  ) => {
    setCounts(
      (previous) => ({
        ...previous,

        [productId]:
          Math.max(
            0,
            Number(
              previous[
                productId
              ] || 0
            ) - 1
          ),
      })
    );
  };

  /*
   * SAYIM SIRASINDA
   * BARKOD OKUTULDU
   */
  const handleInventoryScan = (
    decodedText
  ) => {
    const cleanCode =
      String(
        decodedText || ""
      ).trim();

    /*
     * Tarayıcıyı kapat.
     */
    setIsInventoryScannerOpen(
      false
    );

    if (!cleanCode) {
      showToast?.(
        "Geçerli bir barkod okunamadı.",
        "error"
      );

      return;
    }

    /*
     * Barkoda ait ürünü bul.
     */
    const foundProduct =
      products.find(
        (product) => {
          const productCode =
            String(
              product.qrNo ||
                product.barcode ||
                product.barcodeNo ||
                ""
            ).trim();

          return (
            productCode ===
            cleanCode
          );
        }
      );

    /*
     * Ürün kayıtlı değil.
     */
    if (!foundProduct) {
      showToast?.(
        `Bu barkod sistemde kayıtlı değil: ${cleanCode}`,
        "error"
      );

      return;
    }

    /*
     * Sayılan adedi +1 artır.
     */
    setCounts(
      (previous) => ({
        ...previous,

        [foundProduct.id]:
          Number(
            previous[
              foundProduct.id
            ] || 0
          ) + 1,
      })
    );

    /*
     * Arama alanına ürünü getir.
     *
     * Böylece okutulan ürün
     * ekranda hemen görünür.
     */
    setSearchQuery(
      foundProduct.name || ""
    );

    showToast?.(
      `${foundProduct.name} sayıldı: +1`,
      "success"
    );
  };

  /*
   * SAYILAN ÜRÜN SAYISI
   */
  const countedProducts =
    useMemo(() => {
      return Object.keys(
        counts
      ).filter(
        (productId) =>
          counts[
            productId
          ] !== undefined
      ).length;
    }, [counts]);

  /*
   * FARK OLAN ÜRÜNLER
   */
  const differenceCount =
    useMemo(() => {
      return products.filter(
        (product) => {
          if (
            counts[
              product.id
            ] === undefined
          ) {
            return false;
          }

          const systemStock =
            getSystemStock(
              product.id
            );

          const countedStock =
            Number(
              counts[
                product.id
              ]
            );

          return (
            countedStock !==
            systemStock
          );
        }
      ).length;
    }, [
      products,
      batches,
      counts,
      location,
    ]);

  /*
   * SAYIMI TAMAMLA
   */
  const handleCompleteInventory =
    async () => {
      if (
        countedProducts === 0
      ) {
        showToast?.(
          "En az bir ürün saymalısınız.",
          "error"
        );

        return;
      }

      try {
        setIsSaving(true);

        /*
         * SAYIM KALEMLERİ
         */
        const items =
          products
            .filter(
              (product) =>
                counts[
                  product.id
                ] !== undefined
            )
            .map(
              (product) => {
                const systemStock =
                  getSystemStock(
                    product.id
                  );

                const countedStock =
                  Number(
                    counts[
                      product.id
                    ] || 0
                  );

                return {
                  productId:
                    product.id,

                  productName:
                    product.name ||
                    "",

                  qrNo:
                    product.qrNo ||
                    product.barcode ||
                    product.barcodeNo ||
                    "",

                  systemStock,

                  countedStock,

                  difference:
                    countedStock -
                    systemStock,
                };
              }
            );

        /*
         * FIRESTORE'A
         * SAYIM RAPORU KAYDET
         */
        await addDoc(
          getPublicCollection(
            "inventoryCounts"
          ),
          {
            location,

            status:
              "COMPLETED",

            countedByUid:
              dbUser?.uid ||
              "",

            countedByName:
              dbUser?.name ||
              "Bilinmeyen Kullanıcı",

            countedByRole:
              dbUser?.role ||
              "staff",

            totalProducts:
              items.length,

            differenceProducts:
              items.filter(
                (item) =>
                  item.difference !==
                  0
              ).length,

            items,

            createdAt:
              new Date()
                .toISOString(),

            completedAt:
              new Date()
                .toISOString(),
          }
        );

        showToast?.(
          "Stok sayımı başarıyla kaydedildi.",
          "success"
        );

        setCounts({});

        setSearchQuery("");

        setTimeout(() => {
          onBack?.();
        }, 800);
      } catch (error) {
        console.error(
          "Sayım kaydetme hatası:",
          error
        );

        showToast?.(
          "Sayım kaydedilemedi.",
          "error"
        );
      } finally {
        setIsSaving(false);
      }
    };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">

      {/* SAYIM QR / BARKOD TARAYICI */}

      {isInventoryScannerOpen && (
        <QRScannerModal
          title="Sayım İçin Barkod Tara"
          onClose={() =>
            setIsInventoryScannerOpen(
              false
            )
          }
          onScan={
            handleInventoryScan
          }
        />
      )}

      {/* HEADER */}

      <header className="bg-gray-900 border-b border-gray-800">

        <div className="p-5">

          <div className="flex items-center gap-4">

            <button
              type="button"
              onClick={onBack}
              className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <ArrowLeft
                size={22}
              />
            </button>

            <div>

              <h1 className="text-xl font-black text-white">
                Stok Sayımı
              </h1>

              <p className="text-gray-500 text-xs mt-1">
                Fiziksel stok ile sistem stoğunu karşılaştır
              </p>

            </div>

          </div>

          {/* LOKASYON */}

          <div className="grid grid-cols-2 gap-3 mt-5">

            <button
              type="button"
              onClick={() =>
                setLocation(
                  "DEPO"
                )
              }
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-all ${
                location ===
                "DEPO"
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-950 border-gray-800 text-gray-500"
              }`}
            >
              <Warehouse
                size={18}
              />

              Depo
            </button>

            <button
              type="button"
              onClick={() =>
                setLocation(
                  "BAR"
                )
              }
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-all ${
                location ===
                "BAR"
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-950 border-gray-800 text-gray-500"
              }`}
            >
              <Wine
                size={18}
              />

              Bar
            </button>

          </div>

          {/* BARKOD TARA */}

          <button
            type="button"
            onClick={() =>
              setIsInventoryScannerOpen(
                true
              )
            }
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <Camera
              size={22}
            />

            QR / Barkod Tara
          </button>

          {/* ÖZET */}

          <div className="grid grid-cols-2 gap-3 mt-4">

            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">

              <p className="text-[9px] text-gray-500 uppercase font-bold">
                Sayılan Ürün
              </p>

              <p className="text-xl font-black text-white mt-1">
                {
                  countedProducts
                }
              </p>

            </div>

            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">

              <p className="text-[9px] text-gray-500 uppercase font-bold">
                Fark Bulunan
              </p>

              <p
                className={`text-xl font-black mt-1 ${
                  differenceCount >
                  0
                    ? "text-red-400"
                    : "text-green-400"
                }`}
              >
                {
                  differenceCount
                }
              </p>

            </div>

          </div>

          {/* ARAMA */}

          <div className="relative mt-4">

            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600"
            />

            <input
              type="text"
              value={
                searchQuery
              }
              onChange={(
                event
              ) =>
                setSearchQuery(
                  event.target
                    .value
                )
              }
              placeholder="Ürün veya barkod ara..."
              className="w-full bg-gray-950 border border-gray-800 focus:border-blue-500 text-white pl-11 pr-11 py-3.5 rounded-xl outline-none"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() =>
                  setSearchQuery(
                    ""
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600"
              >
                <X
                  size={18}
                />
              </button>
            )}

          </div>

        </div>

      </header>

      {/* ÜRÜNLER */}

      <main className="flex-1 overflow-y-auto p-4 pb-32">

        <div className="space-y-3">

          {filteredProducts.map(
            (product) => {
              const systemStock =
                getSystemStock(
                  product.id
                );

              const hasCount =
                counts[
                  product.id
                ] !== undefined;

              const countedStock =
                hasCount
                  ? Number(
                      counts[
                        product.id
                      ]
                    )
                  : 0;

              const difference =
                hasCount
                  ? countedStock -
                    systemStock
                  : 0;

              return (
                <div
                  key={
                    product.id
                  }
                  className={`bg-gray-900 border rounded-2xl p-4 ${
                    hasCount &&
                    difference !==
                      0
                      ? "border-red-500/40"
                      : hasCount
                      ? "border-green-500/30"
                      : "border-gray-800"
                  }`}
                >

                  <div className="flex items-start gap-3">

                    <div className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">

                      <Package
                        size={22}
                      />

                    </div>

                    <div className="flex-1 min-w-0">

                      <h3 className="text-white font-bold truncate">
                        {
                          product.name
                        }
                      </h3>

                      <p className="text-gray-600 text-[10px] font-mono mt-1 truncate">
                        {product.qrNo ||
                          product.barcode ||
                          product.barcodeNo ||
                          "Barkod yok"}
                      </p>

                    </div>

                    <div className="text-right shrink-0">

                      <p className="text-[9px] text-gray-600 uppercase font-bold">
                        Sistem
                      </p>

                      <p className="text-xl font-black text-blue-400">
                        {
                          systemStock
                        }
                      </p>

                    </div>

                  </div>

                  {/* SAYIM KONTROLÜ */}

                  <div className="flex items-center gap-2 mt-4">

                    <button
                      type="button"
                      onClick={() =>
                        decreaseCount(
                          product.id
                        )
                      }
                      className="w-12 h-12 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-center text-gray-400 active:scale-95"
                    >
                      <Minus
                        size={20}
                      />
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={
                        hasCount
                          ? countedStock
                          : ""
                      }
                      onChange={(
                        event
                      ) =>
                        updateCount(
                          product.id,
                          event.target
                            .value
                        )
                      }
                      placeholder="Say"
                      className="flex-1 min-w-0 h-12 bg-gray-950 border border-gray-800 focus:border-blue-500 rounded-xl text-center text-white text-xl font-black outline-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        increaseCount(
                          product.id
                        )
                      }
                      className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white active:scale-95"
                    >
                      <Plus
                        size={20}
                      />
                    </button>

                  </div>

                  {/* FARK */}

                  {hasCount && (
                    <div
                      className={`mt-3 px-3 py-2 rounded-lg flex items-center justify-between ${
                        difference ===
                        0
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >

                      <div className="flex items-center gap-2 text-xs font-bold">

                        {difference ===
                        0 ? (
                          <CheckCircle2
                            size={16}
                          />
                        ) : (
                          <ClipboardCheck
                            size={16}
                          />
                        )}

                        {difference ===
                        0
                          ? "Stok eşleşiyor"
                          : "Sayım farkı"}

                      </div>

                      <span className="font-black">

                        {difference >
                        0
                          ? "+"
                          : ""}

                        {
                          difference
                        }

                      </span>

                    </div>
                  )}

                </div>
              );
            }
          )}

        </div>

        {filteredProducts.length ===
          0 && (
          <div className="py-20 text-center">

            <Package
              size={40}
              className="text-gray-700 mx-auto"
            />

            <p className="text-gray-500 mt-4">
              Ürün bulunamadı.
            </p>

          </div>
        )}

      </main>

      {/* SAYIMI TAMAMLA */}

      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">

        <button
          type="button"
          disabled={
            isSaving ||
            countedProducts ===
              0
          }
          onClick={
            handleCompleteInventory
          }
          className="w-full bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >

          <ClipboardCheck
            size={21}
          />

          {isSaving
            ? "Sayım Kaydediliyor..."
            : "Sayımı Tamamla"}

        </button>

      </div>

    </div>
  );
}
