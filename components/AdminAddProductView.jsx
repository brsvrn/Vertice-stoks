"use client";

import { useState } from "react";
import { addDoc } from "firebase/firestore";
import {
  ArrowLeft,
  PackagePlus,
  QrCode,
  Save,
} from "lucide-react";

import {
  getPublicCollection,
} from "./StockApp";

export default function AdminAddProductView({
  onBack,
  showToast,
  scannedBarcode = "",
}) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    minStock: "",
    shelfLocation: "",
    qrNo: scannedBarcode,
  });

  const [isSaving, setIsSaving] =
    useState(false);

  const updateField = (
    field,
    value
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    const cleanName =
      formData.name.trim();

    const cleanBarcode =
      formData.qrNo.trim();

    const minimumStock =
      Number(formData.minStock);

    if (!cleanName) {
      showToast(
        "Ürün adı zorunludur.",
        "error"
      );
      return;
    }

    if (!cleanBarcode) {
      showToast(
        "Barkod veya QR kodu zorunludur.",
        "error"
      );
      return;
    }

    if (
      formData.minStock === "" ||
      Number.isNaN(minimumStock) ||
      minimumStock < 0
    ) {
      showToast(
        "Geçerli bir kritik stok miktarı girin.",
        "error"
      );
      return;
    }

    try {
      setIsSaving(true);

      await addDoc(
        getPublicCollection(
          "products"
        ),
        {
          name: cleanName,

          category:
            formData.category.trim() ||
            "Diğer",

          minStock:
            minimumStock,

          shelfLocation:
            formData.shelfLocation.trim(),

          qrNo:
            cleanBarcode,

          createdAt:
            new Date().toISOString(),
        }
      );

      showToast(
        `${cleanName} başarıyla eklendi.`
      );

      onBack();
    } catch (error) {
      console.error(
        "Ürün ekleme hatası:",
        error
      );

      showToast(
        "Ürün kaydedilirken bir hata oluştu.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">

      {/* Header */}

      <header className="flex items-center gap-4 p-5 bg-gray-900 border-b border-gray-800">

        <button
          type="button"
          onClick={onBack}
          className="p-2.5 bg-gray-800 rounded-full text-white active:scale-95"
        >
          <ArrowLeft
            size={20}
          />
        </button>

        <div>

          <h1 className="text-xl font-bold text-white">
            Yeni Ürün Ekle
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Ürün kartı oluştur
          </p>

        </div>

      </header>

      {/* Form */}

      <main className="flex-1 overflow-y-auto p-5 pb-32">

        <div className="max-w-md mx-auto space-y-5">

          {/* Barcode */}

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-blue-500/10 rounded-xl">

                <QrCode
                  size={24}
                  className="text-blue-400"
                />

              </div>

              <div className="flex-1 min-w-0">

                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                  Barkod / QR Kodu
                </p>

                <p className="text-blue-400 font-mono font-bold mt-1 break-all">
                  {formData.qrNo ||
                    "Kod girilmedi"}
                </p>

              </div>

            </div>

          </div>

          {/* Product Name */}

          <div>

            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
              Ürün Adı *
            </label>

            <input
              type="text"
              value={
                formData.name
              }
              onChange={(
                event
              ) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
              placeholder="Örn: Coca Cola 330 ml"
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-colors"
            />

          </div>

          {/* Barcode Manual */}

          <div>

            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
              Barkod / QR No *
            </label>

            <input
              type="text"
              value={
                formData.qrNo
              }
              onChange={(
                event
              ) =>
                updateField(
                  "qrNo",
                  event.target.value
                )
              }
              placeholder="8691234567890"
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 text-white font-mono outline-none focus:border-blue-500 transition-colors"
            />

          </div>

          {/* Category */}

          <div>

            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
              Kategori
            </label>

            <input
              type="text"
              value={
                formData.category
              }
              onChange={(
                event
              ) =>
                updateField(
                  "category",
                  event.target.value
                )
              }
              placeholder="Örn: Meşrubat"
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-colors"
            />

          </div>

          {/* Stock / Shelf */}

          <div className="grid grid-cols-2 gap-4">

            <div>

              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
                Kritik Stok *
              </label>

              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={
                  formData.minStock
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "minStock",
                    event.target.value
                  )
                }
                placeholder="10"
                className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500"
              />

            </div>

            <div>

              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
                Raf Konumu
              </label>

              <input
               
