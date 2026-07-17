"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  QrCode,
  Package,
  Warehouse,
  Martini,
  Plus,
  Minus,
  ArrowRightLeft,
  History,
  AlertTriangle,
} from "lucide-react";

export default function ProductDetailView({
  product,
  batches = [],
  transactions = [],
  onBack,
  showToast,
}) {
  const [modalType, setModalType] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | AKTİF PARTİLER
  |--------------------------------------------------------------------------
  */

  const activeBatches = useMemo(() => {
    return batches.filter(
      (batch) =>
        Number(batch.quantity || 0) > 0
    );
  }, [batches]);

  /*
  |--------------------------------------------------------------------------
  | TOPLAM STOK
  |--------------------------------------------------------------------------
  */

  const totalStock = useMemo(() => {
    return activeBatches.reduce(
      (total, batch) =>
        total +
        Number(batch.quantity || 0),
      0
    );
  }, [activeBatches]);

  /*
  |--------------------------------------------------------------------------
  | DEPO STOK
  |--------------------------------------------------------------------------
  */

  const depoStock = useMemo(() => {
    return activeBatches
      .filter(
        (batch) =>
          (batch.location || "DEPO") ===
          "DEPO"
      )
      .reduce(
        (total, batch) =>
          total +
          Number(batch.quantity || 0),
        0
      );
  }, [activeBatches]);

  /*
  |--------------------------------------------------------------------------
  | BAR STOK
  |--------------------------------------------------------------------------
  */

  const barStock = useMemo(() => {
    return activeBatches
      .filter(
        (batch) =>
          batch.location === "BAR"
      )
      .reduce(
        (total, batch) =>
          total +
          Number(batch.quantity || 0),
        0
      );
  }, [activeBatches]);

  /*
  |--------------------------------------------------------------------------
  | SKT'YE GÖRE PARTİ SIRALAMA
  |--------------------------------------------------------------------------
  */

  const sortedBatches = useMemo(() => {
    return [...activeBatches].sort(
      (a, b) => {
        if (
          !a.expiryDate &&
          !b.expiryDate
        ) {
          return 0;
        }

        if (!a.expiryDate) {
          return 1;
        }

        if (!b.expiryDate) {
          return -1;
        }

        return (
          new Date(a.expiryDate) -
          new Date(b.expiryDate)
        );
      }
    );
  }, [activeBatches]);

  /*
  |--------------------------------------------------------------------------
  | SON HAREKETLER
  |--------------------------------------------------------------------------
  */

  const recentTransactions =
    useMemo(() => {
      return [...transactions]
        .sort(
          (a, b) =>
            new Date(b.date || 0) -
            new Date(a.date || 0)
        )
        .slice(0, 5);
    }, [transactions]);

  /*
  |--------------------------------------------------------------------------
  | KRİTİK STOK
  |--------------------------------------------------------------------------
  */

  const isLowStock =
    totalStock <=
    Number(product?.minStock || 0);

  /*
  |--------------------------------------------------------------------------
  | SKT DURUMU
  |--------------------------------------------------------------------------
  */

  const getExpiryStatus = (
    expiryDate
  ) => {
    if (!expiryDate) {
      return {
        text: "SKT Yok",
        className:
          "text-gray-500",
      };
    }

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const expiry =
      new Date(expiryDate);

    const daysLeft =
      Math.ceil(
        (expiry.getTime() -
          today.getTime()) /
          (1000 *
            60 *
            60 *
            24)
      );

    if (daysLeft < 0) {
      return {
        text: "SKT GEÇMİŞ",
        className:
          "text-red-500 font-bold",
      };
    }

    if (daysLeft === 0) {
      return {
        text: "Bugün Son Gün",
        className:
          "text-red-400 font-bold",
      };
    }

    if (daysLeft <= 30) {
      return {
        text: `${daysLeft} gün kaldı`,
        className:
          "text-yellow-400 font-bold",
      };
    }

    return {
      text: `${daysLeft} gün kaldı`,
      className:
        "text-gray-500",
    };
  };

  /*
  |--------------------------------------------------------------------------
  | MODAL AÇMA
  |--------------------------------------------------------------------------
  */

  const handleOpenAction = (
    type
  ) => {
    if (
      (type === "OUT" ||
        type === "TRANSFER") &&
      totalStock <= 0
    ) {
      showToast(
        "Bu üründe işlem yapılabilecek stok bulunmuyor.",
        "error"
      );

      return;
    }

    setModalType(type);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">

      {/* HEADER */}

      <header className="p-5 bg-gray-900 border-b border-gray-800">

        <button
          type="button"
          onClick={onBack}
          className="p-2.5 bg-gray-800 rounded-full text-white active:scale-95 transition-transform mb-4"
        >
          <ArrowLeft
            size={20}
          />
        </button>

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">

            <h1 className="text-2xl font-black text-white leading-tight">
              {product?.name ||
                "Ürün"}
            </h1>

            <div className="flex items-center gap-2 mt-2 text-gray-500">

              <QrCode
                size={15}
              />

              <span className="font-mono text-xs break-all">
                {product?.qrNo ||
                  "QR kodu yok"}
              </span>

            </div>

            {product?.shelfLocation && (
              <div className="mt-3">

                <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
                  Raf:{" "}
                  {
                    product.shelfLocation
                  }
                </span>

              </div>
            )}

          </div>

          <div className="p-3 bg-blue-500/10 rounded-2xl shrink-0">

            <Package
              size={28}
              className="text-blue-400"
            />

          </div>

        </div>

      </header>

      {/* CONTENT */}

      <main className="flex-1 overflow-y-auto p-4 pb-32">

        {/* TOTAL STOCK */}

        <section className="bg-gray-900 border border-gray-800 rounded-3xl p-5 mb-4">

          <div className="flex items-end justify-between border-b border-gray-800 pb-5 mb-4">

            <div>

              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                Toplam Stok
              </p>

              <p
                className={`text-5xl font-black mt-2 ${
                  isLowStock
                    ? "text-red-500"
                    : "text-white"
                }`}
              >
                {totalStock}
              </p>

            </div>

            <div className="text-right">

              <p className="text-xs text-gray-600">
                Kritik Seviye
              </p>

              <p className="text-lg font-bold text-gray-400">
                {product?.minStock ||
                  0}
              </p>

            </div>

          </div>

          {isLowStock && (

            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">

              <AlertTriangle
                size={18}
                className="text-red-400 shrink-0"
              />

              <p className="text-red-300 text-xs font-medium">
                Bu ürün kritik stok seviyesinde.
              </p>

            </div>

          )}

          {/* LOCATION STOCK */}

          <div className="grid grid-cols-2 gap-3">

            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">

              <div className="flex items-center gap-2 text-gray-500 mb-2">

                <Warehouse
                  size={17}
                />

                <span className="text-[10px] font-bold uppercase">
                  Ana Depo
                </span>

              </div>

              <p className="text-3xl font-black text-white">
                {depoStock}
              </p>

              <p className="text-[10px] text-gray-600 mt-1">
                Adet
              </p>

            </div>

            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">

              <div className="flex items-center gap-2 text-gray-500 mb-2">

                <Martini
                  size={17}
                />

                <span className="text-[10px] font-bold uppercase">
                  Bar
                </span>

              </div>

              <p className="text-3xl font-black text-white">
                {barStock}
              </p>

              <p className="text-[10px] text-gray-600 mt-1">
                Adet
              </p>

            </div>

          </div>

        </section>

        {/* BATCHES */}

        <section className="mb-7">

          <div className="flex items-center justify-between mb-3 px-1">

            <h2 className="text-lg font-bold text-white">
              Aktif Partiler
            </h2>

            <span className="text-xs text-gray-600">
              {
                sortedBatches.length
              }{" "}
              parti
            </span>

          </div>

          <div className="space-y-3">

            {sortedBatches.map(
              (batch) => {
                const location =
                  batch.location ||
                  "DEPO";

               
