"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { isNativeApp } from "../lib/nativeRuntime";
import { X, Flashlight, FlashlightOff, Keyboard, Search, QrCode } from "lucide-react";

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
      
      const errMsg = String(scanError?.message || "").toLowerCase();
      if (errMsg.includes("canceled") || errMsg.includes("cancelled")) {
        onClose();
        return;
      }

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

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  useEffect(() => {
    const handleNativeBack = (e) => {
      e.preventDefault();
      handleClose();
    };
    window.addEventListener("envantra:native-back", handleNativeBack);
    return () => {
      window.removeEventListener("envantra:native-back", handleNativeBack);
    };
  }, [handleClose]);

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
      {/* Floating Header */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-start justify-between px-6 py-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div>
          <h1 className="text-2xl font-black text-white drop-shadow-md">{title}</h1>
          <p className="mt-1 text-sm font-medium text-white/80 drop-shadow-sm">Kamera ile tarayın veya manuel girin</p>
        </div>
        <button 
          type="button" 
          onClick={handleClose} 
          aria-label="Tarayıcıyı kapat" 
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-transform active:scale-90"
        >
          <X size={20} />
        </button>
      </header>

      <main className="flex-1 relative flex flex-col justify-end">
        {!manualMode ? (
          <>
            <div className="absolute inset-0 z-0">
              {!nativeMode && <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />}
              {!nativeMode && status !== "error" && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
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

            {/* Bottom Actions Floating Panel */}
            <div className="relative z-20 w-full px-6 py-8 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-4 pb-12">
              {status === "error" && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/20 backdrop-blur-sm p-4 text-left mb-2">
                  <p className="font-bold text-rose-300">Kamera açılamadı</p>
                  <p className="mt-1 text-sm text-rose-200/80">{error}</p>
                  <button type="button" onClick={() => void startScanner(selectedCameraId)} className="mt-4 w-full rounded-xl bg-rose-600 hover:bg-rose-700 py-3 font-bold transition-colors">Tekrar dene</button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => { stopScanner(); setManualMode(true); setError(""); }} 
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md py-4 font-bold text-white transition-colors border border-white/10"
                >
                  <Keyboard size={20} />
                  Manuel Giriş
                </button>
                
                {torchAvailable && status === "ready" && (
                  <button 
                    type="button" 
                    onClick={toggleTorch} 
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl backdrop-blur-md transition-colors border border-white/10 ${torchEnabled ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  >
                    {torchEnabled ? <FlashlightOff size={22} /> : <Flashlight size={22} />}
                  </button>
                )}
              </div>

              {!nativeMode && cameras.length > 1 && (
                <div className="relative">
                  <select 
                    value={selectedCameraId} 
                    onChange={(event) => void startScanner(event.target.value)} 
                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/50 backdrop-blur-md px-4 py-3 pr-10 text-sm text-white outline-none focus:border-white/30"
                  >
                    {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{getCameraLabel(camera, index)}</option>)}
                  </select>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="relative z-20 flex-1 flex flex-col bg-black pt-32 px-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-5 border border-blue-500/20">
                <QrCode size={24} />
              </div>
              <h2 className="text-2xl font-black text-white">Kodu manuel gir</h2>
              <p className="mt-2 text-sm text-white/60 mb-6">Kamera çalışmıyorsa barkod üzerindeki numarayı buraya yazın.</p>
              
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="text" 
                  value={manualCode} 
                  onChange={(event) => setManualCode(event.target.value)} 
                  onKeyDown={(event) => event.key === "Enter" && handleManualSubmit()} 
                  placeholder="Barkod numarası" 
                  className="w-full rounded-2xl border border-white/10 bg-black/50 px-5 py-4 text-white text-lg font-mono outline-none focus:border-blue-500 transition-colors placeholder:font-sans" 
                  autoFocus 
                />
              </div>
              
              {error && <p className="mt-3 text-sm text-rose-400 flex items-center gap-1.5 font-medium"><X size={14} />{error}</p>}
              
              <button 
                type="button" 
                onClick={handleManualSubmit} 
                className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 transition-colors py-4 font-black flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(37,99,235,0.39)]"
              >
                <Search size={20} />
                Ürünü Bul
              </button>
              
              <button 
                type="button" 
                onClick={() => { setManualMode(false); setError(""); void startScanner(selectedCameraId); }} 
                className="mt-3 w-full rounded-2xl bg-transparent hover:bg-white/5 py-4 font-bold text-white/70 transition-colors"
              >
                Kameraya dön
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
