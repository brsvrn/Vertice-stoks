"use client";

import { useState } from "react";
import { addDoc } from "firebase/firestore";
import {
  ArrowLeft,
  Package,
  Save,
  QrCode,
  AlertTriangle,
} from "lucide-react";

import { getPublicCollection } from "./StockApp";
import { sendPushNotificationEvent } from "../lib/pushNotifications";

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
    qrNo: scannedBarcode || "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    const name = formData.name.trim();
    const qrNo = formData.qrNo.trim();
    const minStock = Number(formData.minStock);

    if (!name) {
      showToast?.(
        "Lütfen ürün adını girin.",
        "error"
      );
      return;
    }

    if (!qrNo) {
      showToast?.(
        "Lütfen barkod veya QR numarası girin.",
        "error"
      );
      return;
    }

    if (
      formData.minStock === "" ||
      Number.isNaN(minStock) ||
      minStock < 0
    ) {
      showToast?.(
        "Geçerli bir kritik stok miktarı girin.",
        "error"
      );
      return;
    }

    setIsSaving(true);

    try {
      const productReference = await addDoc(
        getPublicCollection("products"),
        {
          name,
          category:
            formData.category.trim() || "Diğer",
          minStock,
          shelfLocation:
            formData.shelfLocation.trim(),
          qrNo,
          createdAt: new Date().toISOString(),
        }
      );

      void sendPushNotificationEvent({
        type: "PRODUCT_CREATED",
        productId: productReference.id,
      });

      showToast?.(
        "Ürün başarıyla eklendi.",
        "success"
      );

      onBack?.();
    } catch (error) {
      console.error(
        "Ürün ekleme hatası:",
        error
      );

      showToast?.(
        "Ürün eklenirken bir hata oluştu.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="flex items-center gap-4 p-6 bg-gray-900 border-b border-gray-800">
        <button
          type="button"
          onClick={onBack}
          className="p-2 bg-gray-800 rounded-full text-white active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h1 className="text-xl font-bold">
            Yeni Ürün Ekle
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Ürün bilgilerini sisteme kaydedin.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 pb-32">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-blue-600/10 border border-blue-600/20 rounded-3xl flex items-center justify-center">
            <Package
              size={38}
              className="text-blue-400"
            />
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Barkod / QR No *
            </label>

            <div className="relative">
              <QrCode
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
              />

              <input
                type="text"
                value={formData.qrNo}
                onChange={(event) =>
                  handleChange(
                    "qrNo",
                    event.target.value
                  )
                }
                placeholder="Örn: 8691234567890"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-12 pr-4 py-4 text-white font-mono outline-none focus:border-blue-500"
              />
            </div>

            {scannedBarcode && (
              <p className="text-xs text-green-500 mt-2">
                Okutulan kod otomatik olarak
                eklendi.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Ürün Adı *
            </label>

            <input
              type="text"
              value={formData.name}
              onChange={(event) =>
                handleChange(
                  "name",
                  event.target.value
                )
              }
              placeholder="Örn: Coca Cola 330 ml"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Kategori
            </label>

            <input
              type="text"
              value={formData.category}
              onChange={(event) =>
                handleChange(
                  "category",
                  event.target.value
                )
              }
              placeholder="Örn: Meşrubat"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Kritik Stok *
              </label>

              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={formData.minStock}
                onChange={(event) =>
                  handleChange(
                    "minStock",
                    event.target.value
                  )
                }
                placeholder="Örn: 10"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Raf Konumu
              </label>

              <input
                type="text"
                value={formData.shelfLocation}
                onChange={(event) =>
                  handleChange(
                    "shelfLocation",
                    event.target.value
                  )
                }
                placeholder="Örn: A-01"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 flex gap-3">
            <AlertTriangle
              size={20}
              className="text-yellow-500 shrink-0 mt-0.5"
            />

            <div>
              <p className="text-yellow-500 text-sm font-bold">
                Stok bilgisi
              </p>

              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                Ürün kaydedildikten sonra ürün
                detayından stok girişi yapabilirsiniz.
                Parti numarası ve son kullanma tarihi
                stok girişinde kaydedilecektir.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <Save size={20} />

          {isSaving
            ? "Kaydediliyor..."
            : "Ürünü Kaydet"}
        </button>
      </div>
    </div>
  );
                    }
