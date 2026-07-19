"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

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
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const trackRef = useRef(null);
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
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    readerRef.current = null;
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
      onScan(value);
    },
    [onScan, stopScanner]
  );

  const startScanner = useCallback(
    async (requestedCameraId) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError("Bu tarayıcı kamera erişimini desteklemiyor.");
        return;
      }

      try {
        setStatus("permission");
        setError("");
        stopScanner();

        const permissionStream = await navigator.mediaDevices.getUserMedia(
          getScannerConstraints()
        );
        const grantedCameraId = permissionStream
          .getVideoTracks()[0]
          ?.getSettings?.().deviceId;
        permissionStream.getTracks().forEach((track) => track.stop());

        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === "videoinput"
        );
        const fallbackCamera = chooseRearCamera(devices);
        const cameraId =
          requestedCameraId || grantedCameraId || fallbackCamera?.deviceId;

        if (!cameraId) {
          throw new Error("CAMERA_NOT_FOUND");
        }

        if (!mountedRef.current) return;

        setCameras(devices);
        setSelectedCameraId(cameraId);
        setStatus("starting");

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 100,
          delayBetweenScanSuccess: 800,
        });
        readerRef.current = reader;

        controlsRef.current = await reader.decodeFromConstraints(
          getScannerConstraints(cameraId),
          videoRef.current,
          (result, scanError) => {
            if (result) {
              reportScan(result.getText());
              return;
            }

            if (scanError && scanError?.name !== "NotFoundException") {
              console.debug("Barkod tarama denemesi başarısız:", scanError);
            }
          }
        );

        const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
        trackRef.current = track || null;

        const capabilities = track?.getCapabilities?.() || {};
        setTorchAvailable(Boolean(capabilities.torch));

        if (capabilities.focusMode?.includes("continuous")) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" }],
            });
          } catch (focusError) {
            console.debug("Continuous focus is unavailable:", focusError);
          }
        }

        await videoRef.current?.play?.().catch(() => undefined);

        if (mountedRef.current) setStatus("scanning");
      } catch (cameraError) {
        console.error("Kamera başlatma hatası:", cameraError);
        if (!mountedRef.current) return;

        setStatus("error");
        if (["NotAllowedError", "PermissionDeniedError"].includes(cameraError?.name)) {
          setError("Kamera izni verilmedi. Tarayıcı ayarlarından kamera iznini açın.");
        } else if (cameraError?.name === "NotReadableError") {
          setError("Kamera başka bir uygulama tarafından kullanılıyor olabilir.");
        } else {
          setError("Kamera başlatılamadı. Lütfen tekrar deneyin veya manuel giriş kullanın.");
        }
      }
    },
    [reportScan, stopScanner]
  );

  useEffect(() => {
    mountedRef.current = true;
    startScanner();

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
    } catch (torchError) {
      console.debug("Torch could not be changed:", torchError);
      setTorchAvailable(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-5 py-4">
        <div>
          <h1 className="text-xl font-black">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">Vertice Stok</p>
        </div>
        <button type="button" onClick={handleClose} aria-label="Tarayıcıyı kapat" className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-800 text-2xl">×</button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {!manualMode ? (
          <>
            <div className="scanner-viewport relative min-h-[320px] bg-black">
              <video ref={videoRef} className="h-full min-h-[320px] w-full object-cover" autoPlay muted playsInline />
              {(status === "starting" || status === "scanning") && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6">
                  <p className="mb-6 rounded-full bg-black/45 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm">
                    Barkodu çerçevenin içine getirin
                  </p>
                  <div className="scanner-focus-window" aria-hidden="true">
                    <i className="scanner-corner scanner-corner--top-left" />
                    <i className="scanner-corner scanner-corner--top-right" />
                    <i className="scanner-corner scanner-corner--bottom-left" />
                    <i className="scanner-corner scanner-corner--bottom-right" />
                    <span className="scanner-focus-line" />
                  </div>
                </div>
              )}
              {(status === "permission" || status === "starting") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 px-6 text-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
                  <p className="mt-5 font-black">{status === "permission" ? "Kamera izni bekleniyor..." : "Kamera hazırlanıyor..."}</p>
                </div>
              )}
            </div>

            <div className="space-y-4 px-6 py-6 text-center">
              {status === "scanning" && <p className="font-bold text-green-400">● Kamera aktif — QR veya barkodu çerçeveye getirin</p>}
              {torchAvailable && status === "scanning" && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-900 py-3 font-bold text-gray-300"
                >
                  {torchEnabled ? "Feneri kapat" : "Feneri aÃ§"}
                </button>
              )}
              {cameras.length > 1 && (
                <label className="block text-left text-sm text-gray-400">
                  Kamera
                  <select value={selectedCameraId} onChange={(event) => startScanner(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white">
                    {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{getCameraLabel(camera, index)}</option>)}
                  </select>
                </label>
              )}
              {status === "error" && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-left">
                  <p className="font-bold text-red-300">Kamera açılamadı</p>
                  <p className="mt-2 text-sm text-red-200">{error}</p>
                  <button type="button" onClick={() => startScanner(selectedCameraId)} className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold">Tekrar dene</button>
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
              <button type="button" onClick={() => { setManualMode(false); setError(""); startScanner(selectedCameraId); }} className="mt-3 w-full rounded-xl bg-gray-800 py-4 font-bold text-gray-300">Kameraya dön</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
