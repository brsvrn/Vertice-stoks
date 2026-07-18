"use client";

import { useMemo, useState } from "react";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Package,
  Search,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Warehouse,
  Wine,
} from "lucide-react";

export default function InventoryHistoryView({
  inventoryCounts = [],
  dbUser,
  onBack,
  onApplyInventory,
  onRejectInventory,
}) {
  const [selectedInventory, setSelectedInventory] =
    useState(null);

  const [filter, setFilter] =
    useState("ALL");

  const [searchQuery, setSearchQuery] =
    useState("");

  /*
   * =========================================
   * TARİH FORMATLA
   * =========================================
   */

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "-";
    }

    const date =
      dateValue?.toDate
        ? dateValue.toDate()
        : new Date(dateValue);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleString(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  /*
   * =========================================
   * DURUM NORMALLEŞTİR
   *
   * Eski COMPLETED + applied:false
   * kayıtlarını da PENDING kabul ediyoruz.
   * =========================================
   */

  const getStatus = (
    inventory
  ) => {
    if (
      inventory.status ===
      "APPLIED"
    ) {
      return "APPLIED";
    }

    if (
      inventory.status ===
      "REJECTED"
    ) {
      return "REJECTED";
    }

    if (
      inventory.status ===
        "COMPLETED" &&
      inventory.applied ===
        false &&
      Number(
        inventory.differenceProducts ||
          0
      ) === 0
    ) {
      return "COMPLETED";
    }

    /*
     * Farklı ama stoğa uygulanmamış
     * eski COMPLETED kayıtları
     * onay bekleyen olarak göster.
     */
    if (
      inventory.status ===
        "COMPLETED" &&
      inventory.applied ===
        false &&
      Number(
        inventory.differenceProducts ||
          0
      ) > 0
    ) {
      return "PENDING";
    }

    return (
      inventory.status ||
      "PENDING"
    );
  };

  /*
   * =========================================
   * DURUM BİLGİSİ
   * =========================================
   */

  const getStatusInfo = (
    inventory
  ) => {
    const status =
      getStatus(
        inventory
      );

    switch (status) {
      case "APPLIED":
        return {
          label:
            "Stoğa Uygulandı",

          className:
            "bg-green-500/10 border-green-500/30 text-green-400",

          icon:
            <ShieldCheck
              size={15}
            />,
        };

      case "REJECTED":
        return {
          label:
            "Reddedildi",

          className:
            "bg-red-500/10 border-red-500/30 text-red-400",

          icon:
            <XCircle
              size={15}
            />,
        };

      case "COMPLETED":
        return {
          label:
            "Farksız Tamamlandı",

          className:
            "bg-blue-500/10 border-blue-500/30 text-blue-400",

          icon:
            <CheckCircle2
              size={15}
            />,
        };

      default:
        return {
          label:
            "Onay Bekliyor",

          className:
            "bg-orange-500/10 border-orange-500/30 text-orange-400",

          icon:
            <Clock3
              size={15}
            />,
        };
    }
  };

  /*
   * =========================================
   * FİLTRELE
   * =========================================
   */

  const filteredInventoryCounts =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      return inventoryCounts
        .filter(
          (inventory) => {
            const status =
              getStatus(
                inventory
              );

            if (
              filter !==
                "ALL" &&
              status !==
                filter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            const userName =
              String(
                inventory.countedByName ||
                  ""
              ).toLocaleLowerCase(
                "tr-TR"
              );

            const location =
              String(
                inventory.location ||
                  ""
              ).toLocaleLowerCase(
                "tr-TR"
              );

            const itemMatch =
              Array.isArray(
                inventory.items
              ) &&
              inventory.items.some(
                (item) =>
                  String(
                    item.productName ||
                      ""
                  )
                    .toLocaleLowerCase(
                      "tr-TR"
                    )
                    .includes(
                      query
                    )
              );

            return (
              userName.includes(
                query
              ) ||
              location.includes(
                query
              ) ||
              itemMatch
            );
          }
        )
        .sort(
          (a, b) => {
            const firstDate =
              new Date(
                a.createdAt ||
                  a.completedAt ||
                  0
              ).getTime();

            const secondDate =
              new Date(
                b.createdAt ||
                  b.completedAt ||
                  0
              ).getTime();

            return (
              secondDate -
              firstDate
            );
          }
        );
    }, [
      inventoryCounts,
      filter,
      searchQuery,
    ]);

  /*
   * =========================================
   * ÖZET SAYILARI
   * =========================================
   */

  const pendingCount =
    inventoryCounts.filter(
      (inventory) =>
        getStatus(
          inventory
        ) === "PENDING"
    ).length;

  const appliedCount =
    inventoryCounts.filter(
      (inventory) =>
        getStatus(
          inventory
        ) === "APPLIED"
    ).length;

  /*
   * =========================================
   * SAYIM DETAY EKRANI
   * =========================================
   */

  if (selectedInventory) {
    const status =
      getStatus(
        selectedInventory
      );

    const statusInfo =
      getStatusInfo(
        selectedInventory
      );

    const items =
      Array.isArray(
        selectedInventory.items
      )
        ? selectedInventory.items
        : [];

    const differenceItems =
      items.filter(
        (item) =>
          Number(
            item.difference ||
              0
          ) !== 0
      );

    const canManage =
      dbUser?.role ===
        "admin" &&
      status ===
        "PENDING";

    return (
      <div className="flex flex-col h-full bg-gray-950 text-gray-100">

        {/* HEADER */}

        <header className="bg-gray-900 border-b border-gray-800 p-5">

          <div className="flex items-center gap-4">

            <button
              type="button"
              onClick={() =>
                setSelectedInventory(
                  null
                )
              }
              className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center"
            >
              <ArrowLeft
                size={22}
              />
            </button>

            <div className="flex-1 min-w-0">

              <h1 className="text-xl font-black text-white">
                Sayım Detayı
              </h1>

              <p className="text-gray-500 text-xs mt-1">
                {formatDate(
                  selectedInventory.createdAt ||
                    selectedInventory.completedAt
                )}
              </p>

            </div>

          </div>

        </header>

        {/* DETAY */}

        <main className="flex-1 overflow-y-auto p-4 pb-48">

          {/* DURUM */}

          <div
            className={`border rounded-2xl p-4 ${statusInfo.className}`}
          >

            <div className="flex items-center gap-2 font-black">

              {
                statusInfo.icon
              }

              {
                statusInfo.label
              }

            </div>

          </div>

          {/* SAYIM BİLGİLERİ */}

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-4">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-[10px] text-gray-500 uppercase font-bold">
                  Sayımı Yapan
                </p>

                <p className="text-white font-bold mt-1">
                  {selectedInventory.countedByName ||
                    "Bilinmeyen Kullanıcı"}
                </p>

              </div>

              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  selectedInventory.location ===
                  "BAR"
                    ? "bg-purple-500/10 text-purple-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}
              >

                {selectedInventory.location ===
                "BAR" ? (
                  <Wine
                    size={23}
                  />
                ) : (
                  <Warehouse
                    size={23}
                  />
                )}

              </div>

            </div>

            <div className="grid grid-cols-3 gap-2 mt-5">

              <div className="bg-gray-950 rounded-xl p-3 text-center">

                <p className="text-[9px] text-gray-500 uppercase font-bold">
                  Lokasyon
                </p>

                <p className="text-white font-black mt-1 text-sm">
                  {selectedInventory.location ===
                  "BAR"
                    ? "Bar"
                    : "Depo"}
                </p>

              </div>

              <div className="bg-gray-950 rounded-xl p-3 text-center">

                <p className="text-[9px] text-gray-500 uppercase font-bold">
                  Sayılan
                </p>

                <p className="text-white font-black mt-1">
                  {
                    items.length
                  }
                </p>

              </div>

              <div className="bg-gray-950 rounded-xl p-3 text-center">

                <p className="text-[9px] text-gray-500 uppercase font-bold">
                  Fark
                </p>

                <p
                  className={`font-black mt-1 ${
                    differenceItems.length >
                    0
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  {
                    differenceItems.length
                  }
                </p>

              </div>

            </div>

          </div>

          {/* UYARI */}

          {status ===
            "PENDING" && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mt-4">

              <div className="flex items-start gap-3">

                <AlertTriangle
                  size={21}
                  className="text-orange-400 shrink-0"
                />

                <div>

                  <p className="text-orange-400 font-bold">
                    Yönetici Onayı Bekliyor
                  </p>

                  <p className="text-gray-400 text-xs leading-5 mt-2">
                    Bu sayımdaki stok farkları henüz gerçek stoğa uygulanmadı.
                  </p>

                </div>

              </div>

            </div>
          )}

          {/* ÜRÜNLER */}

          <div className="mt-6">

            <h2 className="text-xs text-gray-500 font-black uppercase tracking-widest mb-3">
              Sayım Kalemleri
            </h2>

            <div className="space-y-3">

              {items.map(
                (
                  item,
                  index
                ) => {
                  const difference =
                    Number(
                      item.difference ||
                        0
                    );

                  return (
                    <div
                      key={
                        item.productId ||
                        index
                      }
                      className={`bg-gray-900 border rounded-2xl p-4 ${
                        difference !==
                        0
                          ? "border-red-500/30"
                          : "border-gray-800"
                      }`}
                    >

                      <div className="flex items-center gap-3">

                        <div className="w-10 h-10 bg-gray-950 rounded-xl flex items-center justify-center text-gray-500">

                          <Package
                            size={20}
                          />

                        </div>

                        <div className="flex-1 min-w-0">

                          <h3 className="text-white font-bold truncate">
                            {item.productName ||
                              "Bilinmeyen Ürün"}
                          </h3>

                          {item.qrNo && (
                            <p className="text-gray-600 text-[10px] font-mono mt-1 truncate">
                              {
                                item.qrNo
                              }
                            </p>
                          )}

                        </div>

                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4">

                        <div className="bg-gray-950 rounded-lg p-2 text-center">

                          <p className="text-[8px] text-gray-600 uppercase font-bold">
                            Sistem
                          </p>

                          <p className="text-blue-400 font-black mt-1">
                            {Number(
                              item.systemStock ||
                                0
                            )}
                          </p>

                        </div>

                        <div className="bg-gray-950 rounded-lg p-2 text-center">

                          <p className="text-[8px] text-gray-600 uppercase font-bold">
                            Sayılan
                          </p>

                          <p className="text-white font-black mt-1">
                            {Number(
                              item.countedStock ||
                                0
                            )}
                          </p>

                        </div>

                        <div className="bg-gray-950 rounded-lg p-2 text-center">

                          <p className="text-[8px] text-gray-600 uppercase font-bold">
                            Fark
                          </p>

                          <p
                            className={`font-black mt-1 ${
                              difference >
                              0
                                ? "text-green-400"
                                : difference <
                                  0
                                ? "text-red-400"
                                : "text-gray-500"
                            }`}
                          >
                            {difference >
                            0
                              ? "+"
                              : ""}

                            {
                              difference
                            }
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </main>

        {/* YÖNETİCİ İŞLEMLERİ */}

        {canManage && (
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 space-y-3">

            <button
              type="button"
              onClick={() =>
                onApplyInventory?.(
                  selectedInventory
                )
              }
              className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2"
            >

              <ShieldCheck
                size={21}
              />

              Onayla ve Stoğa Uygula

            </button>

            <button
              type="button"
              onClick={() =>
                onRejectInventory?.(
                  selectedInventory
                )
              }
              className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
            >

              <XCircle
                size={19}
              />

              Sayımı Reddet

            </button>

          </div>
        )}

      </div>
    );
  }

  /*
   * =========================================
   * SAYIM GEÇMİŞİ LİSTESİ
   * =========================================
   */

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">

      <header className="bg-gray-900 border-b border-gray-800 p-5">

        <div className="flex items-center gap-4">

          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center"
          >
            <ArrowLeft
              size={22}
            />
          </button>

          <div>

            <h1 className="text-xl font-black text-white">
              Sayım Geçmişi
            </h1>

            <p className="text-gray-500 text-xs mt-1">
              Geçmiş stok sayımları ve onaylar
            </p>

          </div>

        </div>

        {/* ÖZET */}

        <div className="grid grid-cols-2 gap-3 mt-5">

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">

            <p className="text-[9px] text-orange-400 uppercase font-bold">
              Onay Bekleyen
            </p>

            <p className="text-2xl font-black text-orange-400 mt-1">
              {
                pendingCount
              }
            </p>

          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">

            <p className="text-[9px] text-green-400 uppercase font-bold">
              Uygulanan
            </p>

            <p className="text-2xl font-black text-green-400 mt-1">
              {
                appliedCount
              }
            </p>

          </div>

        </div>

        {/* ARAMA */}

        <div className="relative mt-4">

          <Search
            size={19}
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
            placeholder="Kullanıcı, ürün veya lokasyon ara..."
            className="w-full bg-gray-950 border border-gray-800 focus:border-blue-500 text-white pl-11 pr-4 py-3 rounded-xl outline-none text-sm"
          />

        </div>

        {/* FİLTRELER */}

        <div className="flex gap-2 overflow-x-auto mt-4 pb-1">

          <FilterButton
            active={
              filter ===
              "ALL"
            }
            onClick={() =>
              setFilter(
                "ALL"
              )
            }
          >
            Tümü
          </FilterButton>

          <FilterButton
            active={
              filter ===
              "PENDING"
            }
            onClick={() =>
              setFilter(
                "PENDING"
              )
            }
          >
            Bekleyen
          </FilterButton>

          <FilterButton
            active={
              filter ===
              "APPLIED"
            }
            onClick={() =>
              setFilter(
                "APPLIED"
              )
            }
          >
            Uygulanan
          </FilterButton>

          <FilterButton
            active={
              filter ===
              "REJECTED"
            }
            onClick={() =>
              setFilter(
                "REJECTED"
              )
            }
          >
            Reddedilen
          </FilterButton>

        </div>

      </header>

      <main className="flex-1 overflow-y-auto p-4">

        <div className="space-y-3">

          {filteredInventoryCounts.map(
            (inventory) => {
              const statusInfo =
                getStatusInfo(
                  inventory
                );

              return (
                <button
                  type="button"
                  key={
                    inventory.id
                  }
                  onClick={() =>
                    setSelectedInventory(
                      inventory
                    )
                  }
                  className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl p-4 active:scale-[0.99] transition-all"
                >

                  <div className="flex items-start gap-3">

                    <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 shrink-0">

                      <ClipboardCheck
                        size={23}
                      />

                    </div>

                    <div className="flex-1 min-w-0">

                      <div className="flex items-start justify-between gap-2">

                        <div>

                          <h3 className="text-white font-bold">
                            {inventory.location ===
                            "BAR"
                              ? "Bar Sayımı"
                              : "Depo Sayımı"}
                          </h3>

                          <p className="text-gray-500 text-xs mt-1">
                            {inventory.countedByName ||
                              "Bilinmeyen Kullanıcı"}
                          </p>

                        </div>

                        <ChevronRight
                          size={20}
                          className="text-gray-600 shrink-0"
                        />

                      </div>

                      <div className="mt-3">

                        <span
                          className={`inline-flex items-center gap-1.5 border rounded-lg px-2 py-1 text-[10px] font-bold ${statusInfo.className}`}
                        >
                          {
                            statusInfo.icon
                          }

                          {
                            statusInfo.label
                          }
                        </span>

                      </div>

                      <div className="flex items-center justify-between mt-3">

                        <p className="text-gray-600 text-[10px]">
                          {formatDate(
                            inventory.createdAt ||
                              inventory.completedAt
                          )}
                        </p>

                        <p className="text-gray-500 text-[10px] font-bold">
                          {Number(
                            inventory.differenceProducts ||
                              0
                          )}{" "}
                          fark
                        </p>

                      </div>

                    </div>

                  </div>

                </button>
              );
            }
          )}

        </div>

        {filteredInventoryCounts.length ===
          0 && (
          <div className="py-20 text-center">

            <ClipboardCheck
              size={42}
              className="text-gray-700 mx-auto"
            />

            <h3 className="text-white font-bold mt-4">
              Sayım bulunamadı
            </h3>

            <p className="text-gray-500 text-sm mt-2">
              Bu filtreye uygun kayıtlı sayım bulunmuyor.
            </p>

          </div>
        )}

      </main>

    </div>
  );
}

/*
 * =========================================
 * FİLTRE BUTONU
 * =========================================
 */

function FilterButton({
  active,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
        active
          ? "bg-blue-600 border-blue-500 text-white"
          : "bg-gray-950 border-gray-800 text-gray-500"
      }`}
    >
      {children}
    </button>
  );
        }
