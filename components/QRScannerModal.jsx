"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function QRScannerModal({
title = "Ürün Ara / Okut",
onClose,
onScan,
}) {
const videoRef = useRef(null);
const codeReaderRef = useRef(null);
const mountedRef = useRef(true);
const hasScannedRef = useRef(false);
const startingRef = useRef(false);

const [status, setStatus] = useState("starting");
const [error, setError] = useState("");
const [manualMode, setManualMode] = useState(false);
const [manualCode, setManualCode] = useState("");

/*

KAMERAYI GÜVENLİ ŞEKİLDE DURDUR
*/
const stopScanner = () => {
try {
if (codeReaderRef.current) {
// ZXing'de kamerayı ve taramayı durduran metod reset() 'tir.
codeReaderRef.current.reset();
}
} catch (err) {
console.log("Kamera durdurma hatası:", err);
}
};


/*

KAMERA İZNİNİ İSTE

(ZXing cihazları listelemeden önce izin alınmış olması,

kameraların isimlerinin boş dönmemesi için önemlidir)
*/
const requestCameraPermission = async () => {
if (
typeof navigator === "undefined" ||
!navigator.mediaDevices ||
!navigator.mediaDevices.getUserMedia
) {
throw new Error("CAMERA_NOT_SUPPORTED");
}


const stream = await navigator.mediaDevices.getUserMedia({  
  video: true,  
  audio: false,  
});  

stream.getTracks().forEach((track) => {  
  track.stop();  
});  

return true;

};

/*

ZXING İLE ARKA KAMERAYI BAŞLAT
*/
const startScanner = async () => {
if (startingRef.current) return;


startingRef.current = true;  
hasScannedRef.current = false;  

try {  
  if (!mountedRef.current) return;  

  setStatus("permission");  
  setError("");  

  // 1. ADIM: İzin al  
  await requestCameraPermission();  

  if (!mountedRef.current) return;  
  setStatus("starting");  

  // Önceki çalışan okuyucuyu temizle  
  stopScanner();  
  await new Promise((resolve) => setTimeout(resolve, 300));  

  if (!mountedRef.current) return;  

  // 2. ADIM: ZXing Okuyucuyu Başlat  
  const codeReader = new BrowserMultiFormatReader();  
  codeReaderRef.current = codeReader;  

  // 3. ADIM: Kameraları Listele ve Arka Kamerayı Bul  
  const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();  
  let cameraIdToUse = undefined;  

  if (videoInputDevices && videoInputDevices.length > 0) {  
    const backCamera = videoInputDevices.find(  
      (c) =>  
        c.label.toLowerCase().includes("back") ||  
        c.label.toLowerCase().includes("arka") ||  
        c.label.toLowerCase().includes("environment")  
    );  

    if (backCamera) {  
      cameraIdToUse = backCamera.deviceId;  
    } else {  
      // İsimden bulunamazsa genellikle son kamera arka kameradır  
      cameraIdToUse = videoInputDevices[videoInputDevices.length - 1].deviceId;  
    }  
  }  

  if (!videoRef.current) return;  

  // 4. ADIM: Video elementine akışı ver ve taramaya başla  
  codeReader.decodeFromVideoDevice(  
    cameraIdToUse,  
    videoRef.current,  
    (result, err) => {  
      // Eğer çoktan okunduysa işlemi iptal et  
      if (hasScannedRef.current) return;  

      if (result) {  
        hasScannedRef.current = true;  
        const scannedText = result.getText();  
          
        stopScanner(); // Kamerayı anında kapat  

        if (mountedRef.current) {  
          onScan(scannedText);  
        }  
      }  
        
      // 'err' genellikle NotFoundException döner (o anki kade'de barkod yok demektir).  
      // Kritik bir hata olmadığı sürece console'a basmıyoruz, performansı etkilemesin.  
    }  
  );  

  if (mountedRef.current) {  
    setStatus("scanning");  
  }  
} catch (err) {  
  console.error("Kamera başlatma hatası:", err);  

  if (!mountedRef.current) return;  

  setStatus("error");  

  if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {  
    setError("Kamera izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.");  
    return;  
  }  

  if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {  
    setError("Bu cihazda kullanılabilir bir kamera bulunamadı.");  
    return;  
  }  

  if (err?.message === "CAMERA_NOT_SUPPORTED") {  
    setError("Bu tarayıcı kamera erişimini desteklemiyor.");  
    return;  
  }  

  setError("Kamera başlatılamadı veya başka bir uygulama tarafından kullanılıyor.");  
} finally {  
  startingRef.current = false;  
}

};

/*

MODAL AÇILDIĞINDA OTOMATİK BAŞLAT
*/
useEffect(() => {
mountedRef.current = true;


const timer = setTimeout(() => {  
  startScanner();  
}, 500);  

return () => {  
  mountedRef.current = false;  
  clearTimeout(timer);  
  stopScanner();  
};  
// eslint-disable-next-line react-hooks/exhaustive-deps

}, []);

/*

İŞLEMLER
*/
const handleClose = () => {
stopScanner();
onClose();
};


const openManualMode = () => {
stopScanner();
setError("");
setManualMode(true);
};

const returnToCamera = () => {
setManualMode(false);
setError("");
setTimeout(() => {
startScanner();
}, 300);
};

const handleManualSubmit = () => {
const cleanCode = manualCode.trim();
if (!cleanCode) {
setError("Lütfen barkod veya QR kod numarasını girin.");
return;
}
onScan(cleanCode);
};

return (
<div className="fixed inset-0 z-[200] bg-black flex flex-col">
{/* HEADER */}
<header className="bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center justify-between z-10">
<div>
<h1 className="text-white text-xl font-black">{title}</h1>
<p className="text-gray-500 text-sm mt-1">Vertice Stok</p>
</div>
<button  
type="button"  
onClick={handleClose}  
className="w-11 h-11 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center"  
>
×
</button>
</header>

<main className="flex-1 overflow-y-auto flex flex-col">  
    {!manualMode ? (  
      <>  
        {/* KAMERA ALANI */}  
        <div className="relative bg-black flex-1 min-h-[400px] overflow-hidden">  
            
          {/* ZXing Video Elementi (iOS için playsInline hayati önem taşır) */}  
          <video  
            ref={videoRef}  
            className="absolute inset-0 w-full h-full object-cover"  
            autoPlay  
            muted  
            playsInline  
          />  

          {/* Kullanıcı için Görsel Hedefleme (Viewfinder) */}  
          {status === "scanning" && (  
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">  
              {/* Arka plan karartması */}  
              <div className="absolute inset-0 bg-black/40" />  
                
              {/* Odak Kutu */}  
              <div className="relative w-[80%] h-[35%] max-w-sm max-h-64 border-2 border-blue-500 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] bg-transparent">  
                {/* Tarama çizgisi animasyonu */}  
                <div className="absolute w-full h-0.5 bg-blue-500 top-1/2 left-0 -translate-y-1/2 animate-pulse shadow-[0_0_10px_2px_rgba(59,130,246,0.6)]" />  
              </div>  
            </div>  
          )}  

          {(status === "starting" || status === "permission") && (  
            <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center px-6 text-center z-10">  
              <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />  
              <p className="text-white font-black mt-5">  
                {status === "permission"  
                  ? "Kamera izni bekleniyor..."  
                  : "ZXing Okuyucu başlatılıyor..."}  
              </p>  
              <p className="text-gray-500 text-sm mt-2">  
                Kamera erişimine izin verin  
              </p>  
            </div>  
          )}  
        </div>  

        {/* TARAYICI BİLGİSİ */}  
        {status === "scanning" && (  
          <div className="px-6 py-5 text-center bg-gray-900 border-t border-gray-800">  
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-bold">  
              ● Kamera Aktif  
            </div>  
            <h2 className="text-white text-lg font-black mt-3">  
              Barkodu mavi kutuya ortalayın  
            </h2>  
            <p className="text-gray-500 text-sm mt-2">  
              Market barkodları ve QR kodlar otomatik tanınacaktır.  
            </p>  
          </div>  
        )}  

        {/* HATA */}  
        {status === "error" && (  
          <div className="p-6 flex-1 bg-gray-950 flex flex-col justify-center">  
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-center">  
              <h3 className="text-red-400 font-black">Kamera Açılamadı</h3>  
              <p className="text-red-300 text-sm mt-2 leading-6">{error}</p>  
              <button  
                type="button"  
                onClick={startScanner}  
                className="w-full mt-5 bg-blue-600 text-white font-black py-4 rounded-xl"  
              >  
                Kamera İzni İste  
              </button>  
            </div>  
          </div>  
        )}  

        {/* MANUEL GİRİŞ BUTONU */}  
        <div className="px-6 pb-6 pt-3 bg-gray-900">  
          <button  
            type="button"  
            onClick={openManualMode}  
            className="w-full bg-gray-800 border border-gray-700 text-gray-300 font-bold py-4 rounded-xl transition-colors hover:bg-gray-700"  
          >  
            Kodu Manuel Gir  
          </button>  
        </div>  
      </>  
    ) : (  
      /* MANUEL MOD */  
      <div className="p-6 flex-1 bg-gray-950">  
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">  
          <h2 className="text-white text-xl font-black">Kodu Manuel Gir</h2>  
          <p className="text-gray-500 text-sm mt-2">  
            Barkod veya QR kod numarasını yazın.  
          </p>  
          <input  
            type="text"  
            inputMode="numeric"  
            value={manualCode}  
            onChange={(event) => setManualCode(event.target.value)}  
            placeholder="Barkod / QR kodu"  
            className="w-full mt-6 bg-gray-950 border border-gray-700 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500"  
            autoFocus  
          />  
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}  
            
          <button  
            type="button"  
            onClick={handleManualSubmit}  
            className="w-full mt-5 bg-blue-600 text-white font-black py-4 rounded-xl"  
          >  
            Ürünü Ara  
          </button>  
          <button  
            type="button"  
            onClick={returnToCamera}  
            className="w-full mt-3 bg-gray-800 text-gray-300 font-bold py-4 rounded-xl"  
          >  
            Kameraya Dön  
          </button>  
        </div>  
      </div>  
    )}  
  </main>  
</div>

);
}
Bu kodu aldım nasıl kurcam
