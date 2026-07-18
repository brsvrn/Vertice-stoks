"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";

const SUPPORTED_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
];

const SCAN_STATE = {
  IDLE: "idle",
  REQUESTING_PERMISSION: "requesting_permission",
  STARTING: "starting",
  SCANNING: "scanning",
  ERROR: "error",
};

const DUPLICATE_SCAN_COOLDOWN_MS = 2000;

export default function QRScannerModal({ isOpen, onClose, onScan }) {
  const [scanState, setScanState] = useState(SCAN_STATE.IDLE);
  const [errorMessage, setErrorMessage] = useState("");
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualBarcodeValue, setManualBarcodeValue] = useState("");
  const [manualEntryError, setManualEntryError] = useState("");

  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const lastScannedTextRef = useRef(null);
  const lastScannedAtRef = useRef(0);
  const hasScannedSuccessfullyRef = useRef(false);
  const isCleaningUpRef = useRef(false);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* no-op */
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        /* no-op */
      }
      videoRef.current.srcObject = null;
    }
  }, []);

  const cleanupScanner = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        /* no-op */
      }
      readerRef.current = null;
    }

    stopCameraStream();

    lastScannedTextRef.current = null;
    lastScannedAtRef.current = 0;
    hasScannedSuccessfullyRef.current = false;
    isCleaningUpRef.current = false;
  }, [stopCameraStream]);

  const resolvePreferredDeviceId = useCallback(async () => {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();

    if (!devices || devices.length === 0) {
      throw new Error("NO_CAMERA_FOUND");
    }

    const environmentDevice = devices.find((device) => {
      const label = device.label?.toLowerCase() ?? "";
      return (
        label.includes("back") ||
        label.includes("environment") ||
        label.includes("arka") ||
        label.includes("rear")
      );
    });

    return environmentDevice ? environmentDevice.deviceId : devices[0].deviceId;
  }, []);

  const startScanner = useCallback(async () => {
    setScanState(SCAN_STATE.REQUESTING_PERMISSION);
    setErrorMessage("");

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      setScanState(SCAN_STATE.STARTING);

      let deviceId;
      try {
        deviceId = await resolvePreferredDeviceId();
      } catch (deviceError) {
        if (deviceError.message === "NO_CAMERA_FOUND") {
          setErrorMessage("Kamera bulunamadı.");
          setScanState(SCAN_STATE.ERROR);
          return;
        }
        throw deviceError;
      }

      await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, error) => {
          if (videoRef.current && videoRef.current.srcObject) {
            streamRef.current = videoRef.current.srcObject;
          }

          if (result) {
            const scannedText = result.getText();
            const now = Date.now();

            const isDuplicate =
              lastScannedTextRef.current === scannedText &&
              now - lastScannedAtRef.current < DUPLICATE_SCAN_COOLDOWN_MS;

            if (isDuplicate || hasScannedSuccessfullyRef.current) {
              return;
            }

            lastScannedTextRef.current = scannedText;
            lastScannedAtRef.current = now;
            hasScannedSuccessfullyRef.current = true;

            cleanupScanner();
            onScan?.(scannedText);
            return;
          }

          if (error && !(error instanceof NotFoundException)) {
            // Kare bazlı decode hataları (NotFoundException) beklenen davranıştır,
            // bu yüzden sadece gerçek hatalar için sessizce devam edilir.
          }
        }
      );

      if (videoRef.current && videoRef.current.srcObject) {
        streamRef.current = videoRef.current.srcObject;
      }

      setScanState(SCAN_STATE.SCANNING);
    } catch (error) {
      let message = "Kamera başlatılamadı.";

      const errorName = error?.name || "";

      if (
        errorName === "NotAllowedError" ||
        errorName === "PermissionDeniedError"
      ) {
        message = "Tarayıcı kamera erişimine izin vermedi.";
      } else if (
        errorName === "NotFoundError" ||
        errorName === "DevicesNotFoundError"
      ) {
        message = "Kamera bulunamadı.";
      } else if (errorName === "NotReadableError") {
        message = "Kameraya başka bir uygulama tarafından erişiliyor.";
      }

      setErrorMessage(message);
      setScanState(SCAN_STATE.ERROR);
    }
  }, [cleanupScanner, onScan, resolvePreferredDeviceId]);

  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setScanState(SCAN_STATE.IDLE);
      setIsManualEntryOpen(false);
      setManualBarcodeValue("");
      setManualEntryError("");
      return;
    }

    startScanner();

    return () => {
      cleanupScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const handleManualEntryToggle = () => {
    setIsManualEntryOpen((prev) => !prev);
    setManualBarcodeValue("");
    setManualEntryError("");
  };

  const handleManualEntrySubmit = (event) => {
    event.preventDefault();
    const trimmedValue = manualBarcodeValue.trim();

    if (!trimmedValue) {
      setManualEntryError("Lütfen bir barkod değeri girin.");
      return;
    }

    cleanupScanner();
    onScan?.(trimmedValue);
  };

  const handleRetry = () => {
    setErrorMessage("");
    startScanner();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="QR ve Barkod Tarayıcı"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            QR / Barkod Tara
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5 pt-4">
          <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Ürünün QR veya barkodunu kameraya gösterin.
          </p>

          {!isManualEntryOpen && (
            <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-inner dark:border-slate-700">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                autoPlay
                playsInline
              />

              {scanState === SCAN_STATE.SCANNING && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-3/4 w-3/4">
                    <div className="absolute inset-0 rounded-xl border-2 border-emerald-400/80" />
                    <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-emerald-400" />
                    <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-emerald-400" />
                    <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-emerald-400" />
                    <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-emerald-400" />
                    <div className="qr-scan-line absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" />
                  </div>
                </div>
              )}

              {(scanState === SCAN_STATE.REQUESTING_PERMISSION ||
                scanState === SCAN_STATE.STARTING) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 text-slate-200">
                  <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-emerald-400" />
                  <span className="text-sm font-medium">
                    Kamera hazırlanıyor...
                  </span>
                </div>
              )}

              {scanState === SCAN_STATE.ERROR && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-red-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      Kamera başlatılamadı
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {errorMessage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
                  >
                    Tekrar Dene
                  </button>
                </div>
              )}
            </div>
          )}

          {isManualEntryOpen && (
            <form onSubmit={handleManualEntrySubmit} className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <label
                  htmlFor="manual-barcode-input"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Barkod Numarası
                </label>
                <input
                  id="manual-barcode-input"
                  type="text"
                  inputMode="text"
                  autoFocus
                  value={manualBarcodeValue}
                  onChange={(event) => {
                    setManualBarcodeValue(event.target.value);
                    if (manualEntryError) setManualEntryError("");
                  }}
                  placeholder="Barkodu elle gir"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none ring-emerald-400 transition focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                {manualEntryError && (
                  <p className="mt-1.5 text-xs font-medium text-red-500">
                    {manualEntryError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleManualEntryToggle}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
                >
                  Onayla
                </button>
              </div>
            </form>
          )}

          {!isManualEntryOpen && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleManualEntryToggle}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Manuel Giriş
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes qr-scan-line-move {
          0% {
            top: 0%;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0%;
          }
        }
        .qr-scan-line {
          animation: qr-scan-line-move 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/*
Gerekli npm paketleri:
npm install @zxing/browser @zxing/library
*/
