"use client";

import { useMemo, useState } from "react";
import {
  Search,
  X,
  Package,
  Bell,
  Camera,
} from "lucide-react";

import QRScannerModal from "./QRScannerModal";

export default function Dashboard({
  dbUser,
  products,
  batches,
  notifications,
  onOpenNotifications,
  onSelectProduct,
  onUnknownBarcode,
  showToast,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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

  const handleScanSuccess = (decodedText) => {
    setIsScannerOpen(false);

    const cleanCode =
      String(decodedText).trim();

    const foundProduct =
      products.find(
        (product) =>
          String(
            product.qrNo || ""
          ).trim() === cleanCode
      );

    if (foundProduct) {
      showToast(
        `${foundProduct.name} bulundu.`
      );

      onSelectProduct(
        foundProduct
      );

      return;
    }

    if (
      dbUser?.role === "admin" &&
      onUnknownBarcode
    ) {
      showToast(
        "Bu barkod kayıtlı değil. Yeni ürün olarak ekleyebilirsiniz.",
        "warning"
      );

      onUnknownBarcode(
        cleanCode
      );

      return;
    }

    setSearchQuery(
      cleanCode
    );

    showToast(
      "Bu barkoda ait kayıtlı ürün bulunamadı.",
      "error"
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">

      {isScannerOpen && (
        <QRScannerModal
          title="Ürün Ara / Barkod Okut"
          onClose={() =>
            setIsScannerOpen(
              false
            )
          }
          onScan={
            handleScanSuccess
          }
        />
      )}

      <header className="p-5 bg-gray-900 rounded-b-3xl border-b border-gray-800 shadow-lg relative z-10">

        <div className="flex justify-between items-center mb-5">

          <div>

            <h1 className="text-2xl font-black text-white">
              Vertice Stok
            </h1>

            <div className="flex items-center gap-2 mt-1">

              <p className="text-gray-500 text-sm">
                Mer
