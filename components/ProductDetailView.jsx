"use client";

import { useMemo, useState } from "react";
import {
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import {
  ArrowLeft,
  Plus,
  Minus,
  ArrowRightLeft,
  Warehouse,
  Package,
  X,
  Save,
  Trash2,
} from "lucide-react";

import { db } from "../lib/firebase";
import { getPublicCollection } from "./StockApp";
import { sendPushNotificationEvent } from "../lib/pushNotifications";

export default function ProductDetailView({
  product,
  batches = [],
  transactions = [],
  onBack,
  showToast,
  dbUser,
}) {
  const [modalType, setModalType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeBatches = useMemo(() => {
    return batches.filter(
      (batch) => Number(batch.quantity || 0) > 0
    );
  }, [batches]);

  const totalStock = activeBatches.reduce(
    (sum, batch) =>
      sum + Number(batch.quantity || 0),
    0
  );

  const depoStock = activeBatches
    .filter(
      (batch) =>
        (batch.location || "DEPO") === "DEPO"
    )
    .reduce(
      (sum, batch) =>
        sum + Number(batch.quantity || 0),
      0
    );

  const barStock = activeBatches
    .filter(
      (batch) => batch.location === "BAR"
    )
    .reduce(
      (sum, batch) =>
        sum + Number(batch.quantity || 0),
      0
    );

  const sortedBatches = [...activeBatches].sort(
    (a, b) =>
      new Date(a.expiryDate || "2999-12-31") -
      new Date(b.expiryDate || "2999-12-31")
  );

  /*
   * =========================================
   * HAREKET KAYDI
   * =========================================
   */

  const addTransaction = async ({
    type,
    quantity,
    reason,
    locationInfo,
    batchId,
  }) => {
    await addDoc(
      getPublicCollection("transactions"),
      {
        productId: product.id,
        productName: product.name || "",
        batchId: batchId || "",
        userId: dbUser?.uid || "",
        userName:
          dbUser?.name || "Bilinmeyen Kullanıcı",
        type,
        reason,
        locationInfo,
        quantity: Number(quantity),
        date: new Date().toISOString(),
      }
    );
  };

  /*
   * =========================================
   * ÜRÜNÜ TAMAMEN SİL
   * =========================================
   */

  const handleDeleteProduct = async () => {
    if (dbUser?.role !== "admin") {
      showToast?.(
        "Bu işlemi yalnızca yönetici yapabilir.",
        "error"
      );
      return;
    }

    if (isDeleting) {
      return;
    }

    const firstConfirm = window.confirm(
      `"${product.name}" ürününü tamamen silmek istediğinizden emin misiniz?\n\nÜrün kaydı ve ürüne ait tüm stok/parti kayıtları silinecek. İşlem geçmişi korunacaktır.`
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      `SON ONAY\n\n"${product.name}" kalıcı olarak silinecek.\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`
    );

    if (!secondConfirm) {
      return;
    }

    setIsDeleting(true);

    try {
      /*
       * ÜRÜNE AİT PARTİLERİ TOPLU SİL
       */

      if (batches.length > 0) {
        const firestoreBatch = writeBatch(db);

        batches.forEach((batch) => {
          firestoreBatch.delete(
            doc(
              getPublicCollection("batches"),
              batch.id
            )
          );
        });

        await firestoreBatch.commit();
      }

      /*
       * ÜRÜNÜ SİL
       */

      await deleteDoc(
        doc(
          getPublicCollection("products"),
          product.id
        )
      );

      showToast?.(
        `${product.name} tamamen silindi.`,
        "success"
      );

      onBack?.();
    } catch (error) {
      console.error(
        "Ürün silme hatası:",
        error
      );

      showToast?.(
        "Ürün silinemedi. Lütfen tekrar deneyin.",
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /*
   * =========================================
   * STOK GİRİŞİ
   * =========================================
   */

  const handleStockIn = async (data) => {
    const quantity = Number(data.quantity);

    if (
      !quantity ||
      quantity <= 0 ||
      !data.batchNo ||
      !data.expiryDate
    ) {
      showToast?.(
        "Tüm zorunlu alanları doldurun.",
        "error"
      );
      return;
    }

    setIsSaving(true);

    try {
      const newBatch = await addDoc(
        getPublicCollection("batches"),
        {
          productId: product.id,
          batchNo: data.batchNo.trim(),
          expiryDate: data.expiryDate,
          quantity,
          location: data.location,
          createdAt: new Date().toISOString(),
        }
      );

      await addTransaction({
        type: "IN",
        quantity,
        reason: data.reason,
        locationInfo: data.location,
        batchId: newBatch.id,
      });

      void sendPushNotificationEvent({
        type: "STOCK_IN",
        productId: product.id,
        batchId: newBatch.id,
        quantity,
      });

      showToast?.(
        "Stok girişi başarıyla kaydedildi."
      );

      setModalType(null);
    } catch (error) {
      console.error(
        "Stok giriş hatası:",
        error
      );

      showToast?.(
        "Stok girişi kaydedilemedi.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * =========================================
   * STOK ÇIKIŞI
   * =========================================
   */

  const handleStockOut = async (data) => {
    const quantity = Number(data.quantity);

    const selectedBatch = activeBatches.find(
      (batch) => batch.id === data.batchId
    );

    if (!selectedBatch) {
      showToast?.(
        "Lütfen bir parti seçin.",
        "error"
      );
      return;
    }

    if (
      !quantity ||
      quantity <= 0 ||
      quantity >
        Number(selectedBatch.quantity || 0)
    ) {
      showToast?.(
        "Geçerli bir çıkış miktarı girin.",
        "error"
      );
      return;
    }

    setIsSaving(true);

    try {
      await setDoc(
        doc(
          getPublicCollection("batches"),
          selectedBatch.id
        ),
        {
          ...selectedBatch,
          quantity:
            Number(selectedBatch.quantity) -
            quantity,
        }
      );

      await addTransaction({
        type: "OUT",
        quantity,
        reason: data.reason,
        locationInfo:
          selectedBatch.location || "DEPO",
        batchId: selectedBatch.id,
      });

      void sendPushNotificationEvent({
        type: "STOCK_OUT",
        productId: product.id,
        batchId: selectedBatch.id,
        quantity,
      });

      showToast?.(
        "Stok çıkışı başarıyla kaydedildi."
      );

      setModalType(null);
    } catch (error) {
      console.error(
        "Stok çıkış hatası:",
        error
      );

      showToast?.(
        "Stok çıkışı kaydedilemedi.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * =========================================
   * SEVK
   * =========================================
   */

  const handleTransfer = async (data) => {
    const quantity = Number(data.quantity);

    const sourceBatch = activeBatches.find(
      (batch) =>
        batch.id === data.sourceBatchId
    );

    if (!sourceBatch) {
      showToast?.(
        "Sevk edilecek partiyi seçin.",
        "error"
      );
      return;
    }

    if (
      !quantity ||
      quantity <= 0 ||
      quantity >
        Number(sourceBatch.quantity || 0)
    ) {
      showToast?.(
        "Geçerli bir sevk miktarı girin.",
        "error"
      );
      return;
    }

    const sourceLocation =
      sourceBatch.location || "DEPO";

    const targetLocation =
      sourceLocation === "DEPO"
        ? "BAR"
        : "DEPO";

    setIsSaving(true);

    try {
      await setDoc(
        doc(
          getPublicCollection("batches"),
          sourceBatch.id
        ),
        {
          ...sourceBatch,
          quantity:
            Number(sourceBatch.quantity) -
            quantity,
        }
      );

      const targetBatch = batches.find(
        (batch) =>
          batch.productId === product.id &&
          batch.batchNo ===
            sourceBatch.batchNo &&
          batch.expiryDate ===
            sourceBatch.expiryDate &&
          (batch.location || "DEPO") ===
            targetLocation
      );

      if (targetBatch) {
        await setDoc(
          doc(
            getPublicCollection("batches"),
            targetBatch.id
          ),
          {
            ...targetBatch,
            quantity:
              Number(
                targetBatch.quantity || 0
              ) + quantity,
          }
        );
      } else {
        await addDoc(
          getPublicCollection("batches"),
          {
            productId: product.id,
            batchNo: sourceBatch.batchNo,
            expiryDate: sourceBatch.expiryDate,
            quantity,
            location: targetLocation,
            createdAt:
              new Date().toISOString(),
          }
        );
      }

      await addTransaction({
        type: "TRANSFER",
        quantity,
        reason: "Depolar Arası Sevk",
        locationInfo:
          `${sourceLocation} -> ${targetLocation}`,
        batchId: sourceBatch.id,
      });

      showToast?.(
        "Sevk işlemi başarıyla tamamlandı."
      );

      setModalType(null);
    } catch (error) {
      console.error(
        "Sevk hatası:",
        error
      );

      showToast?.(
        "Sevk işlemi tamamlanamadı.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-950 text-white">

      <header className="p-6 bg-gray-900 border-b border-gray-800 shrink-0">

        <button
          type="button"
          onClick={onBack}
          className="p-2 bg-gray-800 rounded-full mb-4"
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-3xl font-bold leading-tight">
          {product.name}
        </h1>

        <p className="text-gray-500 text-sm font-mono mt-2">
          {product.qrNo}
        </p>

        {product.shelfLocation && (
          <p className="text-blue-400 text-xs mt-2">
            Raf: {product.shelfLocation}
          </p>
        )}

      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32">

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">

          <div className="flex justify-between items-end border-b border-gray-800 pb-4 mb-4">

            <div>

              <p className="text-gray-500 text-sm">
                Toplam Stok
              </p>

              <p
                className={`text-4xl font-bold mt-1 ${
                  totalStock <=
                  Number(product.minStock || 0)
                    ? "text-red-500"
                    : "text-white"
                }`}
              >
                {totalStock}
              </p>

            </div>

            <p className="text-xs text-gray-500">
              Kritik: {product.minStock || 0}
            </p>

          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">

              <div className="flex items-center gap-2 text-gray-400">
                <Warehouse size={16} />
                <span className="text-xs font-bold">
                  ANA DEPO
                </span>
              </div>

              <p className="text-2xl font-bold mt-2">
                {depoStock}
              </p>

            </div>

            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">

              <div className="flex items-center gap-2 text-gray-400">
                <Package size={16} />
                <span className="text-xs font-bold">
                  BAR
                </span>
              </div>

              <p className="text-2xl font-bold mt-2">
                {barStock}
              </p>

            </div>

          </div>

        </div>

        <h2 className="font-bold text-lg mb-3">
          Aktif Partiler
        </h2>

        <div className="space-y-2 mb-8">

          {sortedBatches.map((batch) => {
            const location =
              batch.location || "DEPO";

            return (
              <div
                key={batch.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center"
              >

                <div>

                  <p className="font-bold">
                    Parti #{batch.batchNo}
                  </p>

                  <p className="text-gray-500 text-xs mt-1">
                    SKT:{" "}
                    {batch.expiryDate ||
                      "Belirtilmedi"}
                  </p>

                </div>

                <div className="text-right">

                  <p className="text-blue-400 text-xl font-bold">
                    {batch.quantity}
                  </p>

                  <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-full">
                    {location}
                  </span>

                </div>

              </div>
            );
          })}

          {sortedBatches.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">

              <Package
                size={36}
                className="mx-auto text-gray-700 mb-3"
              />

              <p className="text-gray-500 text-sm">
                Bu üründe aktif stok yok.
              </p>

            </div>
          )}

        </div>

        <h2 className="font-bold text-lg mb-3">
          Son Hareketler
        </h2>

        <div className="space-y-2">

          {transactions
            .slice(0, 10)
            .map((transaction) => (
              <div
                key={transaction.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center"
              >

                <div>

                  <p className="text-sm font-bold">
                    {transaction.reason ||
                      "Stok İşlemi"}
                  </p>

                  <p className="text-gray-500 text-xs mt-1">
                    {transaction.locationInfo}
                  </p>

                  <p className="text-gray-600 text-[10px] mt-1">
                    {transaction.date
                      ? new Date(
                          transaction.date
                        ).toLocaleString(
                          "tr-TR"
                        )
                      : ""}
                  </p>

                </div>

                <p
                  className={`font-bold text-lg ${
                    transaction.type === "IN"
                      ? "text-green-400"
                      : transaction.type ===
                        "OUT"
                      ? "text-red-400"
                      : "text-blue-400"
                  }`}
                >
                  {transaction.type === "IN"
                    ? "+"
                    : transaction.type ===
                      "OUT"
                    ? "-"
                    : ""}
                  {transaction.quantity}
                </p>

              </div>
            ))}

          {transactions.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-6">
              Henüz stok hareketi yok.
            </p>
          )}

        </div>

        {/* SADECE YÖNETİCİ - ÜRÜN SİL */}

        {dbUser?.role === "admin" && (
          <div className="mt-10 mb-6">

            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">

              <h3 className="text-red-400 font-bold">
                Tehlikeli İşlemler
              </h3>

              <p className="text-gray-500 text-xs leading-5 mt-2">
                Ürünü silerseniz ürün kaydı ve ürüne ait tüm stok/parti kayıtları kalıcı olarak silinir. Stok hareket geçmişi korunur.
              </p>

              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="w-full mt-4 bg-red-600 disabled:bg-gray-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Trash2 size={20} />

                {isDeleting
                  ? "Ürün Siliniyor..."
                  : "Ürünü Tamamen Sil"}
              </button>

            </div>

          </div>
        )}

      </div>

      <div className="bg-gray-900 border-t border-gray-800 p-4 grid grid-cols-3 gap-3 shrink-0 pb-safe">

        <button
          type="button"
          onClick={() =>
            setModalType("IN")
          }
          className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl py-4 flex flex-col items-center gap-1 font-bold"
        >
          <Plus size={20} />
          <span className="text-xs">
            Giriş
          </span>
        </button>

        <button
          type="button"
          disabled={totalStock <= 0}
          onClick={() =>
            setModalType("TRANSFER")
          }
          className="bg-blue-500/10 border border-blue-500/30 text-blue-400 disabled:opacity-30 rounded-xl py-4 flex flex-col items-center gap-1 font-bold"
        >
          <ArrowRightLeft size={20} />
          <span className="text-xs">
            Sevk
          </span>
        </button>

        <button
          type="button"
          disabled={totalStock <= 0}
          onClick={() =>
            setModalType("OUT")
          }
          className="bg-red-500/10 border border-red-500/30 text-red-400 disabled:opacity-30 rounded-xl py-4 flex flex-col items-center gap-1 font-bold"
        >
          <Minus size={20} />
          <span className="text-xs">
            Çıkış
          </span>
        </button>

      </div>

      {modalType === "IN" && (
        <StockInModal
          isSaving={isSaving}
          onClose={() =>
            setModalType(null)
          }
          onSubmit={handleStockIn}
        />
      )}

      {modalType === "OUT" && (
        <StockOutModal
          batches={sortedBatches}
          isSaving={isSaving}
          onClose={() =>
            setModalType(null)
          }
          onSubmit={handleStockOut}
        />
      )}

      {modalType === "TRANSFER" && (
        <TransferModal
          batches={sortedBatches}
          isSaving={isSaving}
          onClose={() =>
            setModalType(null)
          }
          onSubmit={handleTransfer}
        />
      )}

    </div>
  );
}

/*
 * =========================================
 * MODAL LAYOUT
 * =========================================
 */

function ModalLayout({
  title,
  onClose,
  children,
}) {
  return (
    <div className="absolute inset-0 z-[100] flex items-end">

      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      <div className="relative w-full bg-gray-900 border-t border-gray-800 rounded-t-3xl p-6">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-xl font-bold">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-gray-800 rounded-full text-gray-400"
          >
            <X size={20} />
          </button>

        </div>

        {children}

      </div>

    </div>
  );
}

/*
 * =========================================
 * STOK GİRİŞ MODAL
 * =========================================
 */

function StockInModal({
  onClose,
  onSubmit,
  isSaving,
}) {
  const [data, setData] = useState({
    quantity: "",
    batchNo: "",
    expiryDate: "",
    location: "DEPO",
    reason: "Satın Alma",
  });

  return (
    <ModalLayout
      title="Stok Girişi"
      onClose={onClose}
    >

      <div className="space-y-4">

        <div className="grid grid-cols-2 gap-2">

          {["DEPO", "BAR"].map(
            (location) => (
              <button
                type="button"
                key={location}
                onClick={() =>
                  setData({
                    ...data,
                    location,
                  })
                }
                className={`py-3 rounded-xl font-bold ${
                  data.location ===
                  location
                    ? "bg-blue-600 text-white"
                    : "bg-gray-950 text-gray-500"
                }`}
              >
                {location}
              </button>
            )
          )}

        </div>

        <input
          type="number"
          min="1"
          placeholder="Miktar"
          value={data.quantity}
          onChange={(event) =>
            setData({
              ...data,
              quantity:
                event.target.value,
            })
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white outline-none"
        />

        <input
          type="text"
          placeholder="Parti No"
          value={data.batchNo}
          onChange={(event) =>
            setData({
              ...data,
              batchNo:
                event.target.value,
            })
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white outline-none"
        />

        <input
          type="date"
          value={data.expiryDate}
          onChange={(event) =>
            setData({
              ...data,
              expiryDate:
                event.target.value,
            })
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white outline-none"
        />

        <select
          value={data.reason}
          onChange={(event) =>
            setData({
              ...data,
              reason:
                event.target.value,
            })
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white"
        >
          <option>Satın Alma</option>
          <option>İade Geldi</option>
          <option>Sayım Fazlası</option>
        </select>

        <button
          type="button"
          disabled={isSaving}
          onClick={() =>
            onSubmit(data)
          }
          className="w-full bg-green-600 disabled:bg-gray-800 py-4 rounded-xl font-bold flex justify-center items-center gap-2"
        >
          <Save size={20} />

          {isSaving
            ? "Kaydediliyor..."
            : "Girişi Kaydet"}
        </button>

      </div>

    </ModalLayout>
  );
}

/*
 * =========================================
 * STOK ÇIKIŞ MODAL
 * =========================================
 */

function StockOutModal({
  batches,
  onClose,
  onSubmit,
  isSaving,
}) {
  const [data, setData] = useState({
    batchId:
      batches[0]?.id || "",
    quantity: "",
    reason: "Servis",
  });

  return (
    <ModalLayout
      title="Stok Çıkışı"
      onClose={onClose}
    >

      <div className="space-y-4">

        <select
          value={data.batchId}
          onChange={(event) =>
            setData({
              ...data,
              batchId:
                event.target.value,
            })
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white"
        >
          {batches.map((batch) => (
            <option
              key={batch.id}
              value={batch.id}
            >
              [{batch.location || "DEPO"}] Parti #
              {batch.batchNo} - {batch.quantity} adet
            </option>
          ))}
        </select>

        <input
          type="number"
          min="1"
          placeholder="Çıkış miktarı"
          value={data.quantity}
          onChange={(event) =>
            setData({
              ...data,
              quantity:
                event.target.value,
            })
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white outline-none"
        />

        <select
          value={data.reason}
          onChange={(event) =>
            setData({
              ...data,
              reason:
                event.target.value,
            })
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white"
        >
          <option>Servis</option>
          <option>Fire</option>
          <option>İade</option>
          <option>Sayım Eksiği</option>
        </select>

        <button
          type="button"
          disabled={
            isSaving ||
            !data.batchId
          }
          onClick={() =>
            onSubmit(data)
          }
          className="w-full bg-red-600 disabled:bg-gray-800 py-4 rounded-xl font-bold"
        >
          {isSaving
            ? "Kaydediliyor..."
            : "Çıkışı Onayla"}
        </button>

      </div>

    </ModalLayout>
  );
}

/*
 * =========================================
 * SEVK MODAL
 * =========================================
 */

function TransferModal({
  batches,
  onClose,
  onSubmit,
  isSaving,
}) {
  const [sourceBatchId, setSourceBatchId] =
    useState(
      batches[0]?.id || ""
    );

  const [quantity, setQuantity] =
    useState("");

  const selectedBatch =
    batches.find(
      (batch) =>
        batch.id === sourceBatchId
    );

  const sourceLocation =
    selectedBatch?.location ||
    "DEPO";

  const targetLocation =
    sourceLocation === "DEPO"
      ? "BAR"
      : "DEPO";

  return (
    <ModalLayout
      title="Depolar Arası Sevk"
      onClose={onClose}
    >

      <div className="space-y-4">

        <select
          value={sourceBatchId}
          onChange={(event) =>
            setSourceBatchId(
              event.target.value
            )
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white"
        >
          {batches.map((batch) => (
            <option
              key={batch.id}
              value={batch.id}
            >
              [{batch.location || "DEPO"}] Parti #
              {batch.batchNo} - {batch.quantity} adet
            </option>
          ))}
        </select>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-center">

          <p className="text-gray-500 text-xs">
            Sevk Yönü
          </p>

          <p className="font-bold text-blue-400 mt-1">
            {sourceLocation}
            {" → "}
            {targetLocation}
          </p>

        </div>

        <input
          type="number"
          min="1"
          placeholder="Sevk miktarı"
          value={quantity}
          onChange={(event) =>
            setQuantity(
              event.target.value
            )
          }
          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white outline-none"
        />

        <button
          type="button"
          disabled={
            isSaving ||
            !sourceBatchId
          }
          onClick={() =>
            onSubmit({
              sourceBatchId,
              quantity,
            })
          }
          className="w-full bg-blue-600 disabled:bg-gray-800 py-4 rounded-xl font-bold"
        >
          {isSaving
            ? "Kaydediliyor..."
            : "Sevki Onayla"}
        </button>

      </div>

    </ModalLayout>
  );
                }
