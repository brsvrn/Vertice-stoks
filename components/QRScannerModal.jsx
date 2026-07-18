"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScannerModal({
title = "Ürün Ara / Okut",
onClose,
onScan,
}) {
const scannerRef = useRef(null);
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
const stopScanner = async () => {
try {
if (
scannerRef.current &&
scannerRef.current.isScanning
) {
await scannerRef.current.stop();
}
} catch (err) {
console.log("Kamera durdurma hatası:", err);
}


try {  
  if (scannerRef.current) {  
    scannerRef.current.clear();  
  }  
} catch (err) {  
  console.log("Tarayıcı temizleme hatası:", err);  
}  

scannerRef.current = null;

};

/*

KAMERA İZNİNİ İSTE
*/
const requestCameraPermission = async () => {
if (
typeof navigator === "undefined" ||
!navigator.mediaDevices ||
!navigator.mediaDevices.getUserMedia
) {
throw new Error("CAMERA_NOT_SUPPORTED");
}


/*  
 * getUserMedia çağrısı tarayıcının  
 * gerçek kamera izin penceresini tetikler.  
 */  
const stream =  
  await navigator.mediaDevices.getUserMedia({  
    video: {  
      facingMode: {  
        ideal: "environment",  
      },  
    },  
    audio: false,  
  });  

/*  
 * Burada sadece izin alıyoruz.  
 * html5-qrcode birazdan kamerayı tekrar açacak.  
 * Bu nedenle geçici stream'i kapatıyoruz.  
 */  
stream.getTracks().forEach((track) => {  
  track.stop();  
});  

return true;

};

/*

ARKA KAMERAYI BAŞLAT
*/
const startScanner = async () => {
if (startingRef.current) {
return;
}


startingRef.current = true;  
hasScannedRef.current = false;  

try {  
  if (!mountedRef.current) {  
    return;  
  }  

  setStatus("permission");  
  setError("");  

  /*  
   * 1. ADIM:  
   * Tarayıcıdan kamera iznini açıkça iste.  
   */  
  await requestCameraPermission();  

  if (!mountedRef.current) {  
    return;  
  }  

  setStatus("starting");  

  /*  
   * Önceden açık bir scanner varsa temizle.  
   */  
  await stopScanner();  

  /*  
   * DOM'un hazırlanmasını bekle.  
   */  
  await new Promise((resolve) =>  
    setTimeout(resolve, 300)  
  );  

  if (!mountedRef.current) {  
    return;  
  }  

  /*  
   * 2. ADIM:  
   * QR/Barkod tarayıcı oluştur.  
   */  
  const scanner =  
    new Html5Qrcode("qr-reader");  

  scannerRef.current = scanner;  

  /*  
   * 3. ADIM:  
   * Direkt arka kamerayı aç.  
   *  
   * environment = telefonun arka kamerası  
   */  
  await scanner.start(  
    {  
      facingMode: "environment",  
    },  
    {  
      fps: 10,  

      qrbox: (  
        viewfinderWidth,  
        viewfinderHeight  
      ) => {  
        const width = Math.floor(  
          Math.min(  
            viewfinderWidth * 0.85,  
            320  
          )  
        );  

        const height = Math.floor(  
          Math.min(  
            viewfinderHeight * 0.35,  
            160  
          )  
        );  

        return {  
          width,  
          height,  
        };  
      },  

      aspectRatio: 1.777778,  
    },  

    /*  
     * KOD BAŞARIYLA OKUNDU  
     */  
    async (decodedText) => {  
      if (hasScannedRef.current) {  
        return;  
      }  

      hasScannedRef.current = true;  

      try {  
        await stopScanner();  
      } catch (err) {  
        console.log(err);  
      }  

      if (mountedRef.current) {  
        onScan(decodedText);  
      }  
    },  

    /*  
     * Henüz kod algılanmadı.  
     * Hata göstermiyoruz.  
     */  
    () => {}  
  );  

  if (mountedRef.current) {  
    setStatus("scanning");  
  }  
} catch (err) {  
  console.error(  
    "Kamera başlatma hatası:",  
    err  
  );  

  if (!mountedRef.current) {  
    return;  
  }  

  setStatus("error");  

  /*  
   * HATA TÜRLERİNİ AYIR  
   */  
  if (  
    err?.name === "NotAllowedError" ||  
    err?.name === "PermissionDeniedError"  
  ) {  
    setError(  
      "Kamera izni verilmedi. Aşağıdaki 'Kamera İzni İste' butonuna dokunun ve açılan izin penceresinde 'İzin Ver' seçeneğini seçin."  
    );  

    return;  
  }  

  if (  
    err?.name === "NotFoundError" ||  
    err?.name === "DevicesNotFoundError"  
  ) {  
    setError(  
      "Bu cihazda kullanılabilir bir kamera bulunamadı."  
    );  

    return;  
  }  

  if (  
    err?.name === "NotReadableError" ||  
    err?.name === "TrackStartError"  
  ) {  
    setError(  
      "Kamera başka bir uygulama tarafından kullanılıyor olabilir. Diğer kamera uygulamalarını kapatıp tekrar deneyin."  
    );  

    return;  
  }  

  if (  
    err?.message ===  
    "CAMERA_NOT_SUPPORTED"  
  ) {  
    setError(  
      "Bu tarayıcı kamera erişimini desteklemiyor. Uygulamayı güncel Chrome tarayıcısında açmayı deneyin."  
    );  

    return;  
  }  

  setError(  
    "Kamera başlatılamadı. Kamera iznini kontrol edip tekrar deneyin."  
  );  
} finally {  
  startingRef.current = false;  
}

};

/*

MODAL AÇILDIĞINDA

KAMERAYI OTOMATİK BAŞLAT
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

MODALI KAPAT
*/
const handleClose = async () => {
await stopScanner();


onClose();

};

/*

MANUEL MODA GEÇ
*/
const openManualMode = async () => {
await stopScanner();


setError("");  
setManualMode(true);

};

/*

KAMERAYA GERİ DÖN
*/
const returnToCamera = () => {
setManualMode(false);
setError("");


setTimeout(() => {  
  startScanner();  
}, 300);

};

/*

MANUEL KOD GÖNDER
*/
const handleManualSubmit = () => {
const cleanCode =
manualCode.trim();


if (!cleanCode) {  
  setError(  
    "Lütfen barkod veya QR kod numarasını girin."  
  );  

  return;  
}  

onScan(cleanCode);

};

return (
<div className="fixed inset-0 z-[200] bg-black flex flex-col">

{/* HEADER */}  

  <header className="bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center justify-between">  
    <div>  
      <h1 className="text-white text-xl font-black">  
        {title}  
      </h1>  

      <p className="text-gray-500 text-sm mt-1">  
        Vertice Stok  
      </p>  
    </div>  

    <button  
      type="button"  
      onClick={handleClose}  
      className="w-11 h-11 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center"  
    >  
      ×  
    </button>  
  </header>  

  <main className="flex-1 overflow-y-auto">  

    {!manualMode ? (  
      <>  
        {/* KAMERA ALANI */}  

        <div className="relative bg-black min-h-[320px]">  

          <div  
            id="qr-reader"  
            className="w-full"  
          />  

          {(status === "starting" ||  
            status === "permission") && (  
            <div className="absolute inset-0 min-h-[320px] bg-gray-950 flex flex-col items-center justify-center px-6 text-center">  

              <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />  

              <p className="text-white font-black mt-5">  
                {status === "permission"  
                  ? "Kamera izni bekleniyor..."  
                  : "Arka kamera açılıyor..."}  
              </p>  

              <p className="text-gray-500 text-sm mt-2">  
                Kamera erişimine izin verin  
              </p>  

            </div>  
          )}  

        </div>  

        {/* TARAYICI BİLGİSİ */}  

        {status === "scanning" && (  
          <div className="px-6 py-6 text-center">  

            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-bold">  
              ● Kamera Aktif  
            </div>  

            <h2 className="text-white text-xl font-black mt-5">  
              Barkodu kameraya gösterin  
            </h2>  

            <p className="text-gray-500 mt-3">  
              QR kodu veya ürün barkodunu  
              kameranın ortasında tutun.  
            </p>  

            <p className="text-blue-400 text-sm font-bold mt-3">  
              Algılandığında otomatik okunacaktır.  
            </p>  

          </div>  
        )}  

        {/* HATA */}  

        {status === "error" && (  
          <div className="p-6">  

            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">  

              <h3 className="text-red-400 font-black">  
                Kamera Açılamadı  
              </h3>  

              <p className="text-red-300 text-sm mt-2 leading-6">  
                {error}  
              </p>  

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

        {/* MANUEL GİRİŞ */}  

        <div className="px-6 pb-8">  

          <button  
            type="button"  
            onClick={openManualMode}  
            className="w-full bg-gray-900 border border-gray-800 text-gray-300 font-bold py-5 rounded-2xl"  
          >  
            Kodu Manuel Gir  
          </button>  

        </div>  
      </>  
    ) : (  
      /* MANUEL MOD */  

      <div className="p-6">  

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">  

          <h2 className="text-white text-xl font-black">  
            Kodu Manuel Gir  
          </h2>  

          <p className="text-gray-500 text-sm mt-2">  
            Barkod veya QR kod numarasını yazın.  
          </p>  

          <input  
            type="text"  
            inputMode="numeric"  
            value={manualCode}  
            onChange={(event) =>  
              setManualCode(  
                event.target.value  
              )  
            }  
            placeholder="Barkod / QR kodu"  
            className="w-full mt-6 bg-gray-950 border border-gray-700 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500"  
            autoFocus  
          />  

          {error && (  
            <p className="text-red-400 text-sm mt-3">  
              {error}  
            </p>  
          )}  

          <button  
            type="button"  
            onClick={  
              handleManualSubmit  
            }  
            className="w-full mt-5 bg-blue-600 text-white font-black py-4 rounded-xl"  
          >  
            Ürünü Ara  
          </button>  

          <button  
            type="button"  
            onClick={  
              returnToCamera  
            }  
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
