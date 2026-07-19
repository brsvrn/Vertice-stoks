"use client";

import { useEffect, useState } from "react";
import { generateQRCode } from "../lib/qr";

export default function LabelPreview({ product }) {
  const [qrImage, setQrImage] = useState("");

  useEffect(() => {
    let active = true;
    generateQRCode(product.id)
      .then((image) => active && setQrImage(image))
      .catch((error) => {
        console.error("Etiket QR kodu üretilemedi:", error);
        active && setQrImage("");
      });

    return () => {
      active = false;
    };
  }, [product.id]);


  return (
    <div
      data-label
      className="label-card bg-white text-black rounded-xl border border-gray-300 shadow p-4 flex flex-col justify-between"
    >
      <div>

        <h2
          className="
          text-center
          font-bold
          text-lg
          tracking-widest
          "
        >
          VERTICE
        </h2>

      </div>

      <div className="flex items-center gap-4">

        <div
          className="
          w-[95px]
          h-[95px]
          bg-white
          flex
          items-center
          justify-center
          "
        >
          {qrImage && (
            <img
              src={qrImage}
              alt="QR"
              className="w-full h-full"
            />
          )}
        </div>

        <div className="flex-1">

          <h3
            className="
            font-bold
            text-base
            leading-5
            "
          >
            {product.name}
          </h3>

          <p className="text-sm mt-2">
            QR :
            <span className="font-bold ml-2">
              {product.qrNo}
            </span>
          </p>

          {product.shelfLocation && (
            <p className="text-sm mt-1">
              Raf :
              <span className="font-bold ml-2">
                {product.shelfLocation}
              </span>
            </p>
          )}

        </div>

      </div>

      <div
        className="
        text-center
        text-[10px]
        text-gray-500
        "
      >
        Vertice Restaurant Stock System
      </div>

    </div>
  );
          }
