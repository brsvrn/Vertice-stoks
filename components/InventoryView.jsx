"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Minus,
  Package,
  Plus,
  Search,
  Table2,
  Printer,
  Warehouse,
  Wine,
  X,
  AlertTriangle,
} from "lucide-react";

import {
  addDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

import {
  db,
} from "../lib/firebase";

import {
  getPublicCollection,
} from "./StockApp";

import QRScannerModal from "./QRScannerModal";
import { parseProductReference } from "../lib/qr";
import { printInventoryTable } from "../lib/inventoryPrint";

export default function InventoryView({
  products = [],
  batches = [],
  dbUser,
  onBack,
  showToast,
}) {
  const [location, setLocation] =
    useState("DEPO");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [counts, setCounts] =
    useState({});

  const [activeSection, setActiveSection] =
    useState("count");

  const [tableMode, setTableMode] =
    useState("current");

  const [savedDraft, setSavedDraft] =
    useState(null);
  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isApplying,
    setIsApplying,
  ] = useState(false);

  const [
    isInventoryScannerOpen,
    setIsInventoryScannerOpen,
  ] = useState(false);

  const [
    showReview,
    setShowReview,
  ] = useState(false);

  /*
   * =====================================
   * SİSTEM STOĞU
   * =====================================
   */

  const stockByProduct = useMemo(() => {
    return batches.reduce((stockMap, batch) => {
      if (!batch.productId) {
        return stockMap;
      }

      const productStock = stockMap[batch.productId] || {
        DEPO: 0,
        BAR: 0,
      };

      const stockLocation =
        String(batch.location || "DEPO").toUpperCase() === "BAR"
          ? "BAR"
          : "DEPO";

      productStock[stockLocation] += Number(batch.quantity || 0);
      stockMap[batch.productId] = productStock;

      return stockMap;
    }, {});
  }, [batches]);

  const getSystemStock = useCallback((productId) => {
    return Number(stockByProduct[productId]?.[location] || 0);
  }, [location, stockByProduct]);

  const inventoryTableRows = useMemo(() => {
    return products
      .map((product) => {
        const depotStock = Number(stockByProduct[product.id]?.DEPO || 0);
        const barStock = Number(stockByProduct[product.id]?.BAR || 0);

        return {
          barcode:
            product.qrNo ||
            product.barcode ||
            product.barcodeNo ||
            "-",
          name: product.name || "İsimsiz ürün",
          depotStock,
          barStock,
          totalStock: depotStock + barStock,
        };
      })
      .sort((first, second) =>
        first.name.localeCompare(second.name, "tr-TR")
      );
  }, [products, stockByProduct]);

  const handlePrintTable = (mode) => {
    try {
      printInventoryTable(inventoryTableRows, mode);
    } catch (error) {
      console.error("Sayım tablosu yazdırma hatası:", error);
      showToast?.(
        "Yazdırma penceresi açılamadı. Tarayıcınızın açılır pencere iznini kontrol edin.",
        "error"
      );
    }
  };

  const draftStorageKey = `vertice_inventory_draft_${location.toLowerCase()}`;

  useEffect(() => {
    try {
      const savedValue = window.localStorage.getItem(draftStorageKey);
      const draft = savedValue ? JSON.parse(savedValue) : null;
      setSavedDraft(draft?.counts && typeof draft.counts === "object" ? draft : null);
    } catch (error) {
      console.error("Sayım taslağı okunamadı:", error);
      setSavedDraft(null);
    }
  }, [draftStorageKey]);

  const saveDraft = () => {
    if (Object.keys(counts).length === 0) {
      showToast?.("Kaydedilecek sayım girişi bulunmuyor.", "error");
      return;
    }

    const draft = { counts, location, savedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setSavedDraft(draft);
      showToast?.("Sayım taslağı bu cihazda kaydedildi.", "success");
    } catch (error) {
      console.error("Sayım taslağı kaydedilemedi:", error);
      showToast?.("Sayım taslağı kaydedilemedi.", "error");
    }
  };

  const loadDraft = () => {
    if (!savedDraft?.counts) return;
    setCounts(savedDraft.counts);
    showToast?.("Kaydedilen sayım taslağı yüklendi.", "success");
  };

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(draftStorageKey);
      setSavedDraft(null);
      showToast?.("Sayım taslağı silindi.", "success");
    } catch (error) {
      console.error("Sayım taslağı silinemedi:", error);
      showToast?.("Sayım taslağı silinemedi.", "error");
    }
  };

  /*
   * =====================================
   * ARAMA
   * =====================================
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
              product.name ||
                ""
            ).toLocaleLowerCase(
              "tr-TR"
            );

          const code =
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
            name.includes(
              query
            ) ||
            code.includes(
              query
            ) ||
            category.includes(
              query
            )
          );
        }
      );
    }, [
      products,
      searchQuery,
    ]);

  /*
   * =====================================
   * SAYIM DEĞİŞTİR
   * =====================================
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
   * =====================================
   * BARKOD SAYIM
   * =====================================
   */

  const handleInventoryScan = (
    decodedText
  ) => {
    const cleanCode =
      String(
        decodedText || ""
      ).trim();

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

    const reference = parseProductReference(cleanCode);
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
            product.id === reference.productId ||
            productCode === reference.barcode
          );
        }
      );

    if (!foundProduct) {
      showToast?.(
        `Bu barkod sistemde kayıtlı değil: ${cleanCode}`,
        "error"
      );

      return;
    }

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

    setSearchQuery(
      foundProduct.name ||
        ""
    );

    showToast?.(
      `${foundProduct.name} sayıldı: +1`,
      "success"
    );
  };

  /*
   * =====================================
   * SAYIM KALEMLERİ
   * =====================================
   */

  const inventoryItems =
    useMemo(() => {
      return products
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
    }, [
      products,
      batches,
      counts,
      location,
    ]);

  const countedProducts =
    inventoryItems.length;

  const differenceItems =
    useMemo(() => {
      return inventoryItems.filter(
        (item) =>
          item.difference !==
          0
      );
    }, [
      inventoryItems,
    ]);

  const differenceCount =
    differenceItems.length;

  /*
   * =====================================
   * SAYIMI TAMAMLA
   *
   * Önce fark kontrol ekranı açılır.
   * =====================================
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

      /*
       * Fark varsa önce
       * inceleme ekranını aç.
       */
      if (
        differenceCount > 0
      ) {
        setShowReview(true);

        return;
      }

      /*
       * Fark yoksa direkt
       * sayım kaydı oluştur.
       */
      try {
        setIsSaving(true);

        await addDoc(
          getPublicCollection(
            "inventoryCounts"
          ),
          {
            location,

            status:
              "COMPLETED",

            applied:
              false,

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
              inventoryItems.length,

            differenceProducts:
              0,

            items:
              inventoryItems,

            createdAt:
              new Date()
                .toISOString(),

            completedAt:
              new Date()
                .toISOString(),
          }
        );

        showToast?.(
          "Sayım tamamlandı. Stok farkı bulunmadı.",
          "success"
        );

        setCounts({});

        setSearchQuery("");

        setTimeout(() => {
          onBack?.();
        }, 800);
      } catch (error) {
        console.error(
          "Sayım kayıt hatası:",
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

  /*
   * =====================================
   * FARKLI SAYIMI SADECE RAPOR OLARAK
   * KAYDET
   *
   * Stok değişmez.
   * =====================================
   */

  const handleSaveWithoutApplying =
    async () => {
      try {
        setIsSaving(true);

        await addDoc(
          getPublicCollection(
            "inventoryCounts"
          ),
          {
            location,

            status:
              "COMPLETED",

            applied:
              false,

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
              inventoryItems.length,

            differenceProducts:
              differenceItems.length,

            items:
              inventoryItems,

            createdAt:
              new Date()
                .toISOString(),

            completedAt:
              new Date()
                .toISOString(),
          }
        );

        showToast?.(
          "Sayım kaydedildi. Stok farkları uygulanmadı.",
          "success"
        );

        setShowReview(false);

        setCounts({});

        setSearchQuery("");

        setTimeout(() => {
          onBack?.();
        }, 800);
      } catch (error) {
        console.error(
          "Sayım kayıt hatası:",
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

  /*
   * =====================================
   * SAYIM FARKLARINI STOĞA UYGULA
   * =====================================
   */

  const handleApplyDifferences =
    async () => {
      /*
       * SADECE YÖNETİCİ
       */
      if (
        dbUser?.role !==
        "admin"
      ) {
        showToast?.(
          "Stok farklarını yalnızca yönetici uygulayabilir.",
          "error"
        );

        return;
      }

      if (
        differenceItems.length ===
        0
      ) {
        showToast?.(
          "Uygulanacak stok farkı bulunamadı.",
          "error"
        );

        return;
      }

      try {
        setIsApplying(true);

        /*
         * FIRESTORE ATOMİK BATCH
         */
        const firestoreBatch =
          writeBatch(db);

        const now =
          new Date()
            .toISOString();

        /*
         * SAYIM KAYDI İÇİN
         * ÖNCEDEN ID OLUŞTUR
         */
        const inventoryRef =
          doc(
            getPublicCollection(
              "inventoryCounts"
            )
          );

        /*
         * HER FARKLI ÜRÜN
         */
        for (
          const item
          of differenceItems
        ) {
          const difference =
            Number(
              item.difference
            );

          /*
           * =================================
           * EKSİK STOK
           *
           * Sayılan stok sistemden düşük.
           *
           * FEFO:
           * SKT'si en yakın partiden
           * başlayarak düş.
           * =================================
           */

          if (
            difference < 0
          ) {
            let quantityToRemove =
              Math.abs(
                difference
              );

            /*
             * Seçili lokasyondaki
             * stoklu partiler.
             */
            const productBatches =
              batches
                .filter(
                  (batch) =>
                    batch.productId ===
                      item.productId &&
                    (batch.location ||
                      "DEPO") ===
                      location &&
                    Number(
                      batch.quantity ||
                        0
                    ) > 0
                )
                .sort(
                  (
                    first,
                    second
                  ) => {
                    /*
                     * SKT olmayan partiler
                     * en sona gider.
                     */

                    const firstDate =
                      first.expiryDate
                        ? new Date(
                            first.expiryDate
                          ).getTime()
                        : Number
                            .MAX_SAFE_INTEGER;

                    const secondDate =
                      second.expiryDate
                        ? new Date(
                            second.expiryDate
                          ).getTime()
                        : Number
                            .MAX_SAFE_INTEGER;

                    return (
                      firstDate -
                      secondDate
                    );
                  }
                );

            for (
              const batchItem
              of productBatches
            ) {
              if (
                quantityToRemove <=
                0
              ) {
                break;
              }

              const currentQuantity =
                Number(
                  batchItem.quantity ||
                    0
                );

              const removeQuantity =
                Math.min(
                  currentQuantity,
                  quantityToRemove
                );

              const newQuantity =
                currentQuantity -
                removeQuantity;

              const batchReference =
                doc(
                  getPublicCollection(
                    "batches"
                  ),
                  batchItem.id
                );

              firestoreBatch.update(
                batchReference,
                {
                  quantity:
                    newQuantity,

                  updatedAt:
                    now,
                }
              );

              quantityToRemove -=
                removeQuantity;
            }
          }

          /*
           * =================================
           * FAZLA STOK
           *
           * Fiziksel stok sistemden yüksek.
           * =================================
           */

          if (
            difference > 0
          ) {
            /*
             * Aynı ürün ve lokasyonda
             * mevcut parti bul.
             *
             * En son oluşturulan /
             * en güncel parti tercih edilir.
             */
            const productBatches =
              batches
                .filter(
                  (batch) =>
                    batch.productId ===
                      item.productId &&
                    (batch.location ||
                      "DEPO") ===
                      location
                )
                .sort(
                  (
                    first,
                    second
                  ) => {
                    const firstDate =
                      new Date(
                        first.createdAt ||
                          first.date ||
                          0
                      ).getTime();

                    const secondDate =
                      new Date(
                        second.createdAt ||
                          second.date ||
                          0
                      ).getTime();

                    return (
                      secondDate -
                      firstDate
                    );
                  }
                );

            const targetBatch =
              productBatches[0];

            /*
             * Mevcut parti varsa
             * stoğa ekle.
             */
            if (
              targetBatch
            ) {
              const batchReference =
                doc(
                  getPublicCollection(
                    "batches"
                  ),
                  targetBatch.id
                );

              firestoreBatch.update(
                batchReference,
                {
                  quantity:
                    Number(
                      targetBatch.quantity ||
                        0
                    ) +
                    difference,

                  updatedAt:
                    now,
                }
              );
            } else {
              /*
               * Hiç parti yoksa
               * sayım düzeltme partisi
               * oluştur.
               */
              const newBatchReference =
                doc(
                  getPublicCollection(
                    "batches"
                  )
                );

              firestoreBatch.set(
                newBatchReference,
                {
                  productId:
                    item.productId,

                  quantity:
                    difference,

                  location,

                  batchNo:
                    `SAYIM-${Date.now()}`,

                  expiryDate:
                    null,

                  source:
                    "INVENTORY_ADJUSTMENT",

                  createdAt:
                    now,

                  updatedAt:
                    now,

                  createdByUid:
                    dbUser?.uid ||
                    "",

                  createdByName:
                    dbUser?.name ||
                    "Yönetici",
                }
              );
            }
          }

          /*
           * =================================
           * TRANSACTION KAYDI
           * =================================
           */

          const transactionRef =
            doc(
              getPublicCollection(
                "transactions"
              )
            );

          firestoreBatch.set(
            transactionRef,
            {
              type:
                "INVENTORY_ADJUSTMENT",

              productId:
                item.productId,

              productName:
                item.productName,

              location,

              quantity:
                Math.abs(
                  item.difference
                ),

              difference:
                item.difference,

              previousStock:
                item.systemStock,

              countedStock:
                item.countedStock,

              newStock:
                item.countedStock,

              direction:
                item.difference >
                0
                  ? "IN"
                  : "OUT",

              reason:
                "Stok sayım farkı",

              inventoryId:
                inventoryRef.id,

              userId:
                dbUser?.uid ||
                "",

              userName:
                dbUser?.name ||
                "Yönetici",

              userRole:
                dbUser?.role ||
                "admin",

              date:
                now,

              createdAt:
                now,
            }
          );
        }

        /*
         * =====================================
         * SAYIM RAPORU
         * =====================================
         */

        firestoreBatch.set(
          inventoryRef,
          {
            location,

            status:
              "APPLIED",

            applied:
              true,

            appliedByUid:
              dbUser?.uid ||
              "",

            appliedByName:
              dbUser?.name ||
              "Yönetici",

            appliedAt:
              now,

            countedByUid:
              dbUser?.uid ||
              "",

            countedByName:
              dbUser?.name ||
              "Bilinmeyen Kullanıcı",

            countedByRole:
              dbUser?.role ||
              "admin",

            totalProducts:
              inventoryItems.length,

            differenceProducts:
              differenceItems.length,

            items:
              inventoryItems,

            createdAt:
              now,

            completedAt:
              now,
          }
        );

        /*
         * TÜM İŞLEMLERİ
         * TEK SEFERDE UYGULA
         */
        await firestoreBatch.commit();

        showToast?.(
          "Sayım farkları stoğa başarıyla uygulandı.",
          "success"
        );

        setShowReview(false);

        setCounts({});

        setSearchQuery("");

        setTimeout(() => {
          onBack?.();
        }, 1000);
      } catch (error) {
        console.error(
          "Stok farkı uygulama hatası:",
          error
        );

        showToast?.(
          "Stok farkları uygulanamadı.",
          "error"
        );
      } finally {
        setIsApplying(false);
      }
    };

  /*
   * =====================================
   * FARK İNCELEME EKRANI
   * =====================================
   */

  if (showReview) {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-gray-100">

        <header className="bg-gray-900 border-b border-gray-800 p-5">

          <div className="flex items-center gap-4">

            <button
              type="button"
              onClick={() =>
                setShowReview(
                  false
                )
              }
              disabled={
                isSaving ||
                isApplying
              }
              className="w-11 h-11 bg-gray-800 rounded-xl flex items-center justify-center"
            >
              <ArrowLeft
                size={22}
              />
            </button>

            <div>

              <h1 className="text-xl font-black">
                Sayım Farkları
              </h1>

              <p className="text-gray-500 text-xs mt-1">
                {location ===
                "DEPO"
                  ? "Depo"
                  : "Bar"}{" "}
                sayım sonucu
              </p>

            </div>

          </div>

        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-52">

          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mb-5">

            <div className="flex items-start gap-3">

              <AlertTriangle
                size={24}
                className="text-orange-400 shrink-0"
              />

              <div>

                <h2 className="text-orange-400 font-black">
                  Stok Farkı Bulundu
                </h2>

                <p className="text-gray-400 text-sm mt-2 leading-6">
                  {
                    differenceItems.length
                  }{" "}
                  üründe sistem stoğu ile fiziksel sayım arasında fark var.
                </p>

              </div>

            </div>

          </div>

          <div className="space-y-3">

            {differenceItems.map(
              (item) => (
                <div
                  key={
                    item.productId
                  }
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                >

                  <h3 className="text-white font-bold">
                    {
                      item.productName
                    }
                  </h3>

                  <div className="grid grid-cols-3 gap-2 mt-4">

                    <div className="bg-gray-950 rounded-xl p-3 text-center">

                      <p className="text-[9px] text-gray-500 uppercase font-bold">
                        Sistem
                      </p>

                      <p className="text-lg font-black text-blue-400 mt-1">
                        {
                          item.systemStock
                        }
                      </p>

                    </div>

                    <div className="bg-gray-950 rounded-xl p-3 text-center">

                      <p className="text-[9px] text-gray-500 uppercase font-bold">
                        Sayılan
                      </p>

                      <p className="text-lg font-black text-white mt-1">
                        {
                          item.countedStock
                        }
                      </p>

                    </div>

                    <div className="bg-gray-950 rounded-xl p-3 text-center">

                      <p className="text-[9px] text-gray-500 uppercase font-bold">
                        Fark
                      </p>

                      <p
                        className={`text-lg font-black mt-1 ${
                          item.difference >
                          0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {item.difference >
                        0
                          ? "+"
                          : ""}

                        {
                          item.difference
                        }
                      </p>

                    </div>

                  </div>

                </div>
              )
            )}

          </div>

        </main>

        <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 space-y-3">

          {dbUser?.role ===
          "admin" ? (
            <button
              type="button"
              onClick={
                handleApplyDifferences
              }
              disabled={
                isApplying ||
                isSaving
              }
              className="w-full bg-green-600 disabled:bg-gray-800 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2"
            >
              <CheckCircle2
                size={21}
              />

              {isApplying
                ? "Stok Güncelleniyor..."
                : "Farkları Stoğa Uygula"}
            </button>
          ) : (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">

              <p className="text-orange-400 text-xs font-bold">
                Stok farklarını yalnızca yönetici uygulayabilir.
              </p>

            </div>
          )}

          <button
            type="button"
            onClick={
              handleSaveWithoutApplying
            }
            disabled={
              isApplying ||
              isSaving
            }
            className="w-full bg-gray-800 disabled:bg-gray-900 text-gray-300 font-bold py-3.5 rounded-xl"
          >
            {isSaving
              ? "Kaydediliyor..."
              : "Sadece Sayımı Kaydet"}
          </button>

        </div>

      </div>
    );
  }

  /*
   * =====================================
   * ANA SAYIM EKRANI
   * =====================================
   */

  return (
    <div className="flex flex-col h-full bg-[var(--background)] text-[var(--foreground)]">
      {isInventoryScannerOpen && (
        <QRScannerModal
          title="Sayım İçin Barkod Tara"
          onClose={() => setIsInventoryScannerOpen(false)}
          onScan={handleInventoryScan}
        />
      )}

      <header className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="w-11 h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 className="text-xl font-black">Stok Yönetimi</h1>
              <p className="text-slate-500 text-xs mt-1">Stokları görüntüle ve sayım yap</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-6 bg-slate-100 dark:bg-slate-900 border border-[var(--border)] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setActiveSection("count")}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeSection === "count"
                  ? "bg-[var(--surface)] shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-slate-500 hover:text-[var(--foreground)]"
              }`}
            >
              Sayım Yap
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("table")}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeSection === "table"
                  ? "bg-[var(--surface)] shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-slate-500 hover:text-[var(--foreground)]"
              }`}
            >
              <Table2 size={16} />
              Stok Tablosu
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() => setLocation("DEPO")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold transition-colors ${
                location === "DEPO"
                  ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-50 dark:bg-slate-900 border-[var(--border)] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Warehouse size={18} />
              Depo
            </button>

            <button
              type="button"
              onClick={() => setLocation("BAR")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold transition-colors ${
                location === "BAR"
                  ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-50 dark:bg-slate-900 border-[var(--border)] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Wine size={18} />
              Bar
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="flex-1 bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold py-3 rounded-xl text-sm"
            >
              Taslağı Kaydet
            </button>
            {savedDraft && (
              <>
                <button type="button" onClick={loadDraft} className="flex-1 bg-violet-600 hover:bg-violet-700 transition-colors text-white font-bold py-3 rounded-xl text-sm shadow-md shadow-violet-500/20">Taslağa Devam Et</button>
                <button type="button" onClick={clearDraft} className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors text-slate-400 font-bold rounded-xl text-xs border border-[var(--border)]">Sil</button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsInventoryScannerOpen(true)}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-black py-4 rounded-xl flex items-center justify-center gap-3 shadow-[0_4px_14px_rgba(37,99,235,0.39)]"
          >
            <Camera size={22} />
            QR / Barkod Tara
          </button>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">Sayılan Ürün</p>
              <p className="text-xl font-black mt-1 text-[var(--foreground)]">{countedProducts}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">Fark Bulunan</p>
              <p className={`text-xl font-black mt-1 ${differenceCount > 0 ? "text-rose-500" : "text-teal-500"}`}>
                {differenceCount}
              </p>
            </div>
          </div>

          <div className="relative mt-4">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ürün veya barkod ara..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-[var(--border)] focus:border-blue-500 text-[var(--foreground)] pl-11 pr-11 py-3.5 rounded-xl outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32">

        {activeSection === "table" ? (
          <section className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black text-lg">Güncel Stok Tablosu</h2>
                  <p className="text-gray-500 text-xs mt-1">
                    Depo ve bar stokları anlık verilerle hesaplanır.
                  </p>
                </div>
                <span className="shrink-0 bg-blue-500/10 text-blue-400 rounded-lg px-2.5 py-1 text-xs font-bold">
                  {inventoryTableRows.length} ürün
                </span>
              </div>

              <div className="grid gap-2 mt-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handlePrintTable("current")}
                  className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <Printer size={18} />
                  Güncel Stoğu Yazdır
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintTable("count")}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <ClipboardCheck size={18} />
                  Boş Sayım Formu Yazdır
                </button>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-2 gap-2 border-b border-gray-800 p-3">
                <button
                  type="button"
                  onClick={() => setTableMode("current")}
                  className={`rounded-lg py-2.5 text-xs font-bold ${
                    tableMode === "current"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-950 text-gray-500"
                  }`}
                >
                  Güncel Stok Tablosu
                </button>
                <button
                  type="button"
                  onClick={() => setTableMode("count")}
                  className={`rounded-lg py-2.5 text-xs font-bold ${
                    tableMode === "count"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-950 text-gray-500"
                  }`}
                >
                  Sayım Tablosu
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 font-bold">Barkod</th>
                      <th className="px-4 py-3 font-bold">Ürün</th>
                      <th className="px-4 py-3 font-bold text-right">Depo</th>
                      <th className="px-4 py-3 font-bold text-right">Bar</th>
                      <th className="px-4 py-3 font-bold text-right">Toplam</th>
                      {tableMode === "count" && (
                        <th className="px-4 py-3 font-bold text-center">Sayım</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {inventoryTableRows.map((row) => (
                      <tr key={`${row.barcode}-${row.name}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.barcode}</td>
                        <td className="px-4 py-3 font-bold text-white">{row.name}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{row.depotStock}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{row.barStock}</td>
                        <td className="px-4 py-3 text-right font-black text-blue-400">{row.totalStock}</td>
                        {tableMode === "count" && (
                          <td className="px-4 py-3"><div className="h-8 min-w-20 rounded-lg border border-dashed border-gray-700" /></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {inventoryTableRows.length === 0 && (
                <p className="px-4 py-10 text-center text-gray-500">Tablolanacak ürün bulunamadı.</p>
              )}
            </div>
          </section>
        ) : (
          <>

        <div className="space-y-3">

          {filteredProducts.map((product) => {
            const systemStock = getSystemStock(product.id);
            const hasCount = counts[product.id] !== undefined;

            const countedStock = hasCount ? Number(counts[product.id]) : 0;
            const difference = hasCount ? countedStock - systemStock : 0;
            const isCritical = systemStock <= Number(product.minStock || 0);

            // Determine status color bar
            const statusColor = systemStock === 0 ? "bg-red-500" : isCritical ? "bg-orange-500" : "bg-blue-500";

            return (
              <div
                key={product.id}
                className={`relative overflow-hidden bg-[var(--surface)] border rounded-2xl shadow-sm transition-all ${
                  hasCount && difference !== 0
                    ? "border-red-500"
                    : hasCount
                    ? "border-teal-500"
                    : "border-[var(--border)]"
                }`}
              >
                {/* Bottom Status Bar */}
                <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${statusColor}`} />

                <div className="p-4 pb-5">
                  <div className="flex items-start gap-4">
                    {/* Placeholder for Product Image */}
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                      <Package size={24} className="text-slate-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[var(--foreground)] truncate">{product.name}</h3>
                      <p className="text-slate-500 text-xs mt-1 truncate">SKU: {product.qrNo || product.barcode || "N/A"}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Mevcut</p>
                      <p className="text-xl font-black text-[var(--foreground)]">{systemStock}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => decreaseCount(product.id)}
                      className="w-10 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Minus size={18} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={hasCount ? countedStock : ""}
                      onChange={(e) => updateCount(product.id, e.target.value)}
                      placeholder="Sayım"
                      className="flex-1 h-10 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] focus:border-blue-500 rounded-xl text-center text-[var(--foreground)] font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => increaseCount(product.id)}
                      className="w-10 h-10 bg-teal-500 hover:bg-teal-600 text-white rounded-xl flex items-center justify-center transition-colors shadow-md shadow-teal-500/20"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {hasCount && (
                    <div className={`mt-3 px-3 py-2 rounded-lg flex items-center justify-between text-xs font-bold ${
                      difference === 0 ? "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}>
                      <div className="flex items-center gap-2">
                        {difference === 0 ? <CheckCircle2 size={16} /> : <ClipboardCheck size={16} />}
                        {difference === 0 ? "Stok eşleşiyor" : "Sayım farkı"}
                      </div>
                      <span className="font-black">
                        {difference > 0 ? "+" : ""}{difference}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>

        {filteredProducts.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Package size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-black text-[var(--foreground)]">Ürün Bulunamadı</h3>
            <p className="text-slate-500 mt-2 max-w-[250px]">
              Arama kriterlerinize uyan bir ürün bulunamadı. Lütfen farklı bir arama yapın.
            </p>
          </div>
        )}
          </>
        )}
      </main>

      {activeSection === "count" && (
        <div className="absolute bottom-[76px] left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)] z-10">
          <button
            type="button"
            disabled={isSaving || countedProducts === 0}
            onClick={handleCompleteInventory}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:shadow-none transition-colors text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/30"
          >
            <ClipboardCheck size={21} />
            {isSaving ? "Sayım Kaydediliyor..." : "Sayımı Tamamla"}
          </button>
        </div>
      )}
    </div>
  );
}
