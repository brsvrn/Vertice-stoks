"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { isNativeApp } from "../lib/nativeRuntime";

const NATIVE_FORMATS = [
  BarcodeFormat.QrCode,
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.Code128,
  BarcodeFormat.Code39,
];

function getCameraLabel(device, index) {
  return device.label || `Kamera ${index + 1}`;
}

function chooseRearCamera(devices) {
  return (
    devices.find((device) => /(back|rear|environment|arka)/i.test(device.label)) ||
    devices[devices.length - 1] ||
    null
  );
}

function getScannerConstraints(cameraId) {
  return {
    audio: false,
    video: {
      ...(cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: { ideal: "environment" } }),
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 16 / 9 },
    },
  };
}

export default function QRScannerModal({
  title = "Ürün Ara / Okut",
  onClose,
  onScan,
}) {
  const nativeMode = isNativeApp();
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const trackRef = useRef(null);
  const nativeScannerRef = useRef(false);
  const lastScanRef = useRef({ value: "", timestamp: 0 });
  const mountedRef = useRef(true);

  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [status, setStatus] = useState("starting");
  const [error, setError] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    trackRef.current = null;
    setTorchAvailable(false);
    setTorchEnabled(false);

    const stream = videoRef.current?.srcObject;
    if (typeof MediaStream !== "undefined" && stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    readerRef.current = null;
    if (nativeScannerRef.current) {
      nativeScannerRef.current = false;
      void BarcodeScanner.stopScan().catch(() => undefined);
    }
  }, []);

  const reportScan = useCallback(
    (rawValue) => {
      const value = String(rawValue || "").trim();
      if (!value) return;

      const now = Date.now();
      if (
        lastScanRef.current.value === value &&
        now - lastScanRef.current.timestamp < 1500
      ) {
        return;
      }

      lastScanRef.current = { value, timestamp: now };
      stopScanner();
      if (nativeMode) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
      onScan(value);
    },
    [nativeMode, onScan, stopScanner]
  );

  const startNativeScanner = useCallback(async () => {
    try {
      setStatus("starting");
      setError("");
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) throw new Error("CAMERA_UNSUPPORTED");

      nativeScannerRef.current = true;
      setStatus("ready");
      const result = await BarcodeScanner.scan({ formats: NATIVE_FORMATS, autoZoom: true });
      nativeScannerRef.current = false;
      if (!mountedRef.current) return;

      const barcode = result.barcodes?.[0];
      const value = barcode?.rawValue || barcode?.displayValue || "";
      if (value) reportScan(value);
      else onClose();
    } catch (scanError) {
      nativeScannerRef.current = false;
      if (!mountedRef.current) return;
      console.error("Android barkod tarama hatası:", scanError);
      setStatus("error");
      setError(
        scanError?.message === "CAMERA_UNSUPPORTED"
          ? "Bu cihazda kullanılabilir bir kamera bulunamadı."
          : "Kamera başlatılamadı. Kamera iznini kontrol edin veya manuel giriş kullanın."
      );
    }
  }, [onClose, reportScan]);

  const startWebScanner = useCallback(
    async (requestedCameraId) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError("Bu tarayıcı kamera erişimini desteklemiyor.");
        return;
      }

      try {
        setStatus("starting");
        setError("");
        stopScanner();

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 100,
          delayBetweenScanSuccess: 800,
        });
        readerRef.current = reader;

        controlsRef.current = await reader.decodeFromConstraints(
          getScannerConstraints(requestedCameraId),
          videoRef.current,
          (result, scanError) => {
            if (result) reportScan(result.getText());
            else if (scanError && scanError?.name !== "NotFoundException") {
              console.debug("Barkod tarama denemesi başarısız:", scanError);
            }
          }
        );

        const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
        trackRef.current = track || null;
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === "videoinput"
        );
        const activeCameraId =
          track?.getSettings?.().deviceId || chooseRearCamera(devices)?.deviceId || "";

        if (mountedRef.current) {
          setCameras(devices);
          setSelectedCameraId(activeCameraId);
        }

        const capabilities = track?.getCapabilities?.() || {};
        setTorchAvailable(Boolean(capabilities.torch));
        if (capabilities.focusMode?.includes("continuous")) {
          await track
            .applyConstraints({ advanced: [{ focusMode: "continuous" }] })
            .catch(() => undefined);
        }

        await videoRef.current?.play?.().catch(() => undefined);
        if (mountedRef.current) setStatus("ready");
      } catch (cameraError) {
        console.error("Kamera başlatma hatası:", cameraError);
        if (!mountedRef.current) return;
        setStatus("error");
        if (["NotAllowedError", "PermissionDeniedError"].includes(cameraError?.name)) {
          setError("Kamera izni verilmedi. Uygulama ayarlarından kamera iznini açın.");
        } else if (cameraError?.name === "NotReadableError") {
          setError("Kamera başka bir uygulama tarafından kullanılıyor olabilir.");
        } else {
          setError("Kamera başlatılamadı. Tekrar deneyin veya manuel giriş kullanın.");
        }
      }
    },
    [reportScan, stopScanner]
  );

  const startScanner = useCallback(
    (cameraId) => (nativeMode ? startNativeScanner() : startWebScanner(cameraId)),
    [nativeMode, startNativeScanner, startWebScanner]
  );

  useEffect(() => {
    mountedRef.current = true;
    void startScanner();
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  const handleManualSubmit = () => {
    const value = manualCode.trim();
    if (!value) {
      setError("Lütfen barkod veya QR kod numarasını girin.");
      return;
    }
    reportScan(value);
  };

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track?.applyConstraints) return;
    try {
      const nextValue = !torchEnabled;
      await track.applyConstraints({ advanced: [{ torch: nextValue }] });
      setTorchEnabled(nextValue);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-5 py-4">
        <div>
          <h1 className="text-xl font-black">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">Envantra</p>
        </div>
        <button type="button" onClick={handleClose} aria-label="Tarayıcıyı kapat" className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-800 text-2xl">×</button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {!manualMode ? (
          <>
            <div className="scanner-viewport relative min-h-[320px] bg-black">
              {!nativeMode && <video ref={videoRef} className="h-full min-h-[320px] w-full object-cover" autoPlay muted playsInline />}
              {!nativeMode && status !== "error" && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                  <div className="scanner-focus-window" aria-hidden="true">
                    <i className="scanner-corner scanner-corner--top-left" />
                    <i className="scanner-corner scanner-corner--top-right" />
                    <i className="scanner-corner scanner-corner--bottom-left" />
                    <i className="scanner-corner scanner-corner--bottom-right" />
                    <span className="scanner-focus-line" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 px-6 py-6 text-center">
              {torchAvailable && status === "ready" && (
                <button type="button" onClick={toggleTorch} className="w-full rounded-2xl border border-gray-800 bg-gray-900 py-3 font-bold text-gray-300">
                  {torchEnabled ? "Feneri kapat" : "Feneri aç"}
                </button>
              )}
              {!nativeMode && cameras.length > 1 && (
                <label className="block text-left text-sm text-gray-400">
                  Kamera
                  <select value={selectedCameraId} onChange={(event) => void startScanner(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white">
                    {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{getCameraLabel(camera, index)}</option>)}
                  </select>
                </label>
              )}
              {status === "error" && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-left">
                  <p className="font-bold text-red-300">Kamera açılamadı</p>
                  <p className="mt-2 text-sm text-red-200">{error}</p>
                  <button type="button" onClick={() => void startScanner(selectedCameraId)} className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold">Tekrar dene</button>
                </div>
              )}
              <button type="button" onClick={() => { stopScanner(); setManualMode(true); setError(""); }} className="w-full rounded-2xl border border-gray-800 bg-gray-900 py-4 font-bold text-gray-300">Kodu manuel gir</button>
            </div>
          </>
        ) : (
          <div className="p-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="text-xl font-black">Kodu manuel gir</h2>
              <input type="text" inputMode="text" value={manualCode} onChange={(event) => setManualCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleManualSubmit()} placeholder="Barkod veya QR bağlantısı" className="mt-5 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-4 text-white" autoFocus />
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              <button type="button" onClick={handleManualSubmit} className="mt-5 w-full rounded-xl bg-blue-600 py-4 font-black">Ürünü ara</button>
              <button type="button" onClick={() => { setManualMode(false); setError(""); void startScanner(selectedCameraId); }} className="mt-3 w-full rounded-xl bg-gray-800 py-4 font-bold text-gray-300">Kameraya dön</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
