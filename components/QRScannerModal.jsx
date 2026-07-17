"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  ScanLine,
  Keyboard,
  AlertTriangle,
} from "lucide-react";

export default function QRScannerModal({
  onClose,
  onScan,
  title = "QR / Barkod Okut",
}) {
  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);

  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] =
    useState(false);
  const [scannerError, setScannerError] =
    useState("");

  useEffect(() => {
    let isMounted = true;
    let scriptElement = null;

    const startScanner = () => {
      if (
        !isMounted ||
        !window.Html5QrcodeScanner ||
        scannerRef.current
      ) {
        return;
      }

      try {
        const scanner =
          new window.Html5QrcodeScanner(
            "vertice-qr-reader",
            {
              fps: 10,

              qrbox: {
                width: 250,
                height: 250,
              },

              aspectRatio: 1,

              rememberLastUsedCamera:
                true,

              showTorchButtonIfSupported:
                true,

              showZoomSliderIfSupported:
                true,
            },
            false
          );

        scannerRef.current =
          scanner;

        scanner.render(
          async (
            decodedText
          ) => {
            if (
              isScanningRef.current
            ) {
              return;
            }

            isScanningRef.current =
              true;

            try {
              if (
                scannerRef.current
              ) {
                await scannerRef.current.clear();
              }
            } catch (error) {
              console.warn(
                "Tarayıcı kapatılırken hata:",
                error
              );
            }

            scannerRef.current =
              null;

            if (
              isMounted
            ) {
              onScan(
                decodedText
              );
            }
          },

          () => {
            // Her başarısız kareyi
            // konsola yazdırmıyoruz.
          }
        );
      } catch (error) {
        console.error(
          "QR tarayıcı başlatılamadı:",
          error
        );

        if (isMounted) {
          setScannerError(
            "Kamera başlatılamadı. Kamera iznini kontrol edin veya manuel giriş kullanın."
          );
        }
      }
    };

    const loadScannerLibrary =
      () => {
        if (
          window.Html5QrcodeScanner
        ) {
          startScanner();
          return;
        }

        const existingScript =
          document.querySelector(
            'script[data-vertice-qr="true"]'
          );

        if (existingScript) {
          existingScript.addEventListener(
            "load",
            startScanner
          );

          return;
        }

        scriptElement =
          document.createElement(
            "script"
          );

        scriptElement.src =
          "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";

        scriptElement.async =
          true;

        scriptElement.dataset.verticeQr =
          "true";

        scriptElement.onload =
          startScanner;

        scriptElement.onerror =
          () => {
            if (
              isMounted
            ) {
              setScannerError(
                "QR tarayıcı yüklenemedi. İnternet bağlantınızı kontrol edin veya manuel giriş kullanın."
              );
            }
          };

        document.body.appendChild(
          scriptElement
        );
      };

    loadScannerLibrary();

    return () => {
      isMounted = false;

      if (
        scannerRef.current
      ) {
        try {
          scannerRef.current
            .clear()
            .catch(() => {});
        } catch {
          // Tarayıcı zaten kapanmış olabilir.
        }

        scannerRef.current =
          null;
      }

      if (
        scriptElement
      ) {
        scriptElement.onload =
          null;
        scriptElement.onerror =
          null;
      }
    };
  }, [onScan]);

  const handleManualSubmit =
    () => {
      const cleanCode =
        manualCode.trim();

      if (!cleanCode) {
        return;
      }

      onScan(
        cleanCode
      );
    };

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">

      {/* Header */}

      <header className="p-5 flex items-center justify-between bg-gray-900 border-b border-gray-800">

        <div className="flex items-center gap-3">

          <div className="p-2 bg-blue-600/20 rounded-xl">

            <ScanLine
              size={24}
              className="text-blue-400"
            />

          </div>

          <div>

            <h2 className="text-lg font-bold text-white">
              {title}
            </h2>

            <p className="text-[10px] text-gray-500">
              Vertice Stok
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-3 bg-gray-800 rounded-full text-white active:scale-95"
          aria-label="Tarayıcıyı kapat"
        >
          <X size={20} />
        </button>

      </header>

      {/* Scanner */}

      <main className="flex-1 overflow-y-auto p-5">

        <div className="max-w-sm mx-auto">

          <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden p-3">

            <div
              id="vertice-qr-reader"
              className="w-full overflow-hidden rounded-2xl"
            />

          </div>

          <div className="mt-6 text-center">

            <p className="text-white font-bold">
              Barkodu kameraya gösterin
            </p>

            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              Ürün üzerindeki QR kodu veya barkodu kamera alanının ortasında tutun.
            </p>

          </div>

          {/* Scanner Error */}

          {scannerError && (

            <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">

              <div className="flex gap-3">

                <AlertTriangle
                  size={20}
                  className="text-red-400 shrink-0"
                />

                <p className="text-red-300 text-sm">
                  {
                    scannerError
                  }
                </p>

              </div>

            </div>

          )}

          {/* Manual Input */}

          <div className="mt-6">

            {!showManualInput ? (

              <button
                type="button"
                onClick={() =>
                  setShowManualInput(
                    true
                  )
                }
                className="w-full bg-gray-900 border border-gray-800 text-gray-300 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              >

                <Keyboard
                  size={20}
                />

                Kodu Manuel Gir

              </button>

            ) : (

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">

                <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Barkod / QR Kodu
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={
                    manualCode
                  }
                  onChange={(
                    event
                  ) =>
                    setManualCode(
                      event
                        .target
                        .value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleManualSubmit();
                    }
                  }}
                  placeholder="Örn: 8691234567890"
                  className="w-full mt-3 bg-gray-950 border border-gray-800 rounded-xl p-4 text-white font-mono outline-none focus:border-blue-500"
                />

                <div className="grid grid-cols-2 gap-3 mt-3">

                  <button
                    type="button"
                    onClick={() => {
                      setShowManualInput(
                        false
                      );

                      setManualCode(
                        ""
                      );
                    }}
                    className="bg-gray-800 text-gray-300 py-3 rounded-xl font-bold"
                  >
                    İptal
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleManualSubmit
                    }
                    disabled={
                      !manualCode.trim()
                    }
                    className="bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white py-3 rounded-xl font-bold"
                  >
                    Onayla
                  </button>

                </div>

              </div>

            )}

          </div>

        </div>

      </main>

    </div>
  );
}
