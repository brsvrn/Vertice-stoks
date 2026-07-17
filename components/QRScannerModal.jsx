"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScannerModal({
  title = "Ürün Ara / Okut",
  onClose,
  onScan,
}) {
  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);

  const [error, setError] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        setError("");
        setIsStarting(true);

        const scanner = new Html5Qrcode("qr-reader");

        scannerRef.current = scanner;

        const cameraConfig = {
          facingMode: {
            ideal: "environment",
          },
        };

        const scannerConfig = {
          fps: 10,

          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(
              viewfinderWidth * 0.85,
              320
            );

            const height = Math.min(
              viewfinderHeight * 0.4,
              160
            );

            return {
              width,
              height,
            };
          },

          aspectRatio: 1.777778,
        };

        await scanner.start(
          cameraConfig,
          scannerConfig,

          async (decodedText) => {
            if (hasScannedRef.current) {
              return;
            }

            hasScannedRef.current = true;

            try {
              if (
                scannerRef.current &&
                scannerRef.current.isScanning
              ) {
                await scannerRef.current.stop();
              }
            } catch (stopError) {
              console.log(
                "Tarayıcı durdurma:",
                stopError
              );
            }

            onScan(decodedText);
          },

          () => {
            // Barkod bulunamadığında hata göstermiyoruz.
            // Kamera taramaya devam eder.
          }
        );

        if (mounted) {
          setIsStarting(false);
        }
      } catch (scannerError) {
        console.error(
          "Kamera başlatma hatası:",
          scannerError
        );

        if (mounted) {
          setIsStarting(false);

          setError(
            "Kamera açılamadı. Tarayıcı ayarlarından kamera izni verdiğinizden emin olun."
          );
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 300);

    return () => {
      mounted = false;

      clearTimeout(timer);

      const stopScanner = async () => {
        try {
          if (
            scannerRef.current &&
            scannerRef.current.isScanning
          ) {
            await scannerRef.current.stop();
          }

          if (scannerRef.current) {
            scannerRef.current.clear();
          }
        } catch (error) {
          console.log(
            "Kamera kapatma:",
            error
          );
        }
      };

      stopScanner();
    };
  }, [onScan]);

  const handleClose = async () => {
    try {
      if (
        scannerRef.current &&
        scannerRef.current.isScanning
      ) {
        await scannerRef.current.stop();
      }

      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    } catch (error) {
      console.log(
        "Kamera kapatma:",
        error
      );
    }

    onClose();
  };

  const handleManualSubmit = () => {
    const cleanCode = manualCode.trim();

    if (!cleanCode) {
      setError(
        "Lütfen barkod veya QR kodunu girin."
      );

      return;
    }

    onScan(cleanCode);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* HEADER */}

      <header className="bg-gray-900 border-b border-gray-800 px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-2xl">
            ▣
          </div>

          <div>
            <h1 className="text-white text-xl font-black">
              {title}
            </h1>

            <p className="text-gray-500 text-sm mt-1">
              Vertice Stok
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="w-12 h-12 rounded-full bg-gray-800 text-white text-3xl flex items-center justify-center"
        >
          ×
        </button>
      </header>

      {/* ANA İÇERİK */}

      <main className="flex-1 overflow-y-auto">
        {!manualMode ? (
          <>
            {/* KAMERA */}

            <div className="relative w-full bg-black">
              <div
                id="qr-reader"
                className="w-full overflow-hidden"
              />

              {isStarting && (
                <div className="absolute inset-0 min-h-[300px] flex flex-col items-center justify-center bg-gray-950">
                  <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />

                  <p className="text-white font-bold mt-5">
                    Kamera açılıyor...
                  </p>

                  <p className="text-gray-500 text-sm mt-2">
                    Arka kamera hazırlanıyor
                  </p>
                </div>
              )}
            </div>

            {/* AÇIKLAMA */}

            <div className="px-6 py-7 text-center">
              <h2 className="text-white text-xl font-black">
                Barkodu kameraya gösterin
              </h2>

              <p className="text-gray-500 mt-3 leading-7">
                Ürün üzerindeki QR kodu veya barkodu
                kameranın ortasında tutun.
              </p>

              <p className="text-blue-400 text-sm font-bold mt-3">
                Kod algılandığında otomatik olarak
                taranacaktır.
              </p>
            </div>
          </>
        ) : (
          /* MANUEL GİRİŞ */

          <div className="p-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white text-xl font-black">
                Kodu Manuel Gir
              </h2>

              <p className="text-gray-500 text-sm mt-2">
                Ürünün barkod veya QR kod numarasını
                aşağıya yazın.
              </p>

              <input
                type="text"
                inputMode="numeric"
                value={manualCode}
                onChange={(event) =>
                  setManualCode(event.target.value)
                }
                placeholder="Barkod / QR kodu"
                className="w-full mt-6 bg-gray-950 border border-gray-700 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500"
                autoFocus
              />

              <button
                type="button"
                onClick={handleManualSubmit}
                className="w-full mt-4 bg-blue-600 text-white font-black py-4 rounded-xl"
              >
                Ürünü Ara
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualMode(false);
                  setError("");
                }}
                className="w-full mt-3 bg-gray-800 text-gray-300 font-bold py-4 rounded-xl"
              >
                Kameraya Dön
              </button>
            </div>
          </div>
        )}

        {/* HATA */}

        {error && (
          <div className="mx-6 mb-5 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-400 text-sm">
              {error}
            </p>
          </div>
        )}

        {/* MANUEL GİRİŞ BUTONU */}

        {!manualMode && (
          <div className="px-6 pb-8">
            <button
              type="button"
              onClick={async () => {
                try {
                  if (
                    scannerRef.current &&
                    scannerRef.current.isScanning
                  ) {
                    await scannerRef.current.stop();
                  }
                } catch (error) {
                  console.log(error);
                }

                setManualMode(true);
              }}
              className="w-full bg-gray-900 border border-gray-800 text-gray-300 font-bold py-5 rounded-2xl"
            >
              ⌨ Kodu Manuel Gir
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
