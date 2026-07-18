"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function LabelPreview({ product }) {
  const [qrImage, setQrImage] = useState("");

  useEffect(() => {
    generateQR();
  }, [product]);

  async function generateQR() {
    try {
      const value =
        product.qrNo ||
        product.id ||
        product.name;

      const image = await QRCode.toDataURL(value, {
        width: 220,
        margin: 1,
      });

      setQrImage(image);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div
      className="
      w-[300px]
      h-[180px]
      bg-white
      text-black
      rounded-xl
      border
      border-gray-300
      shadow
      p-4
      flex
      flex-col
      justify-between
      "
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
