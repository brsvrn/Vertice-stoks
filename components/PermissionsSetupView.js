"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

export default function PermissionsSetupView({
  onComplete,
}) {
  const [notificationStatus, setNotificationStatus] =
    useState("unknown");

  const [cameraStatus, setCameraStatus] =
    useState("unknown");

  const [isLoading, setIsLoading] =
    useState(false);

  /*
   * =========================================
   * MEVCUT İZİNLERİ KONTROL ET
   * =========================================
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    /*
     * BİLDİRİM İZNİ
     */
    if ("Notification" in window) {
      setNotificationStatus(
        Notification.permission
      );
    } else {
      setNotificationStatus(
        "unsupported"
      );
    }

    /*
     * KAMERA DESTEĞİ
     */
    if (
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    ) {
      setCameraStatus("prompt");
    } else {
      setCameraStatus(
        "unsupported"
      );
    }
  }, []);

  /*
   * =========================================
   * BİLDİRİM İZNİ
   * =========================================
   */
  const requestNotificationPermission =
    async () => {
      if (
        typeof window === "undefined" ||
        !("Notification" in window)
      ) {
        setNotificationStatus(
          "unsupported"
        );

        return;
      }

      try {
        const permission =
          await Notification.requestPermission();

        setNotificationStatus(
          permission
        );
      } catch (error) {
        console.error(
          "Bildirim izin hatası:",
          error
        );

        setNotificationStatus(
          "denied"
        );
      }
    };

  /*
   * =========================================
   * KAMERA İZNİ
   * =========================================
   */
  const requestCameraPermission =
    async () => {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraStatus(
          "unsupported"
        );

        return;
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: {
                ideal: "environment",
              },
            },
          });

        /*
         * Sadece izin almak için kamerayı
         * kısa süreli açıyoruz.
         * Ardından kamera akışını kapatıyoruz.
         */
        stream
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        setCameraStatus(
          "granted"
        );
      } catch (error) {
        console.error(
          "Kamera izin hatası:",
          error
        );

        if (
          error?.name ===
            "NotAllowedError" ||
          error?.name ===
            "PermissionDeniedError"
        ) {
          setCameraStatus(
            "denied"
          );
        } else {
          setCameraStatus(
            "error"
          );
        }
      }
    };

  /*
   * =========================================
   * TÜM İZİNLERİ İSTE
   * =========================================
   */
  const handleRequestPermissions =
    async () => {
      if (isLoading) {
        return;
      }

      try {
        setIsLoading(true);

        /*
         * Önce kamera.
         */
        await requestCameraPermission();

        /*
         * Sonra bildirim.
         */
        await requestNotificationPermission();
      } finally {
        setIsLoading(false);
      }
    };

  /*
   * =========================================
   * DEVAM ET
   * =========================================
   */
  const handleContinue = () => {
    /*
     * Bu cihazda izin kurulum ekranının
     * tamamlandığını kaydediyoruz.
     */
    try {
      localStorage.setItem(
        "vertice_permissions_setup_completed",
        "true"
      );
    } catch (error) {
      console.error(
        "İzin durumu kaydedilemedi:",
        error
      );
    }

    if (
      typeof onComplete === "function"
    ) {
      onComplete();
    }
  };

  /*
   * =========================================
   * DURUM YARDIMCILARI
   * =========================================
   */

  const notificationGranted =
    notificationStatus === "granted";

  const cameraGranted =
    cameraStatus === "granted";

  const notificationDenied =
    notificationStatus === "denied";

  const cameraDenied =
    cameraStatus === "denied";

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-5">

      <div className="w-full max-w-md">

        {/* LOGO */}

        <div className="text-center">

          <div className="w-24 h-24 mx-auto rounded-3xl overflow-hidden border border-yellow-500/20 shadow-2xl">

            <img
              src="/icons/icon-192.png"
              alt="Envantra"
              className="w-full h-full object-cover"
            />

          </div>

          <h1 className="text-3xl font-black mt-6">
            Envantra
          </h1>

          <p className="text-gray-500 text-sm mt-2">
            Stok ve envanter yönetim sistemi
          </p>

        </div>

        {/* BİLGİ */}

        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-3xl p-5">

          <div className="flex items-start gap-4">

            <div className="w-12 h-12 shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">

              <ShieldCheck
                size={25}
              />

            </div>

            <div>

              <h2 className="font-black text-lg">
                Uygulama İzinleri
              </h2>

              <p className="text-gray-500 text-sm leading-6 mt-1">
                Envantra'nın tüm özelliklerini kullanabilmek için aşağıdaki izinlere ihtiyacımız var.
              </p>

            </div>

          </div>

          {/* KAMERA */}

          <div className="mt-6 bg-gray-950 border border-gray-800 rounded-2xl p-4">

            <div className="flex items-center gap-4">

              <div className="w-11 h-11 shrink-0 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">

                <Camera
                  size={22}
                />

              </div>

              <div className="flex-1">

                <h3 className="font-bold">
                  Kamera
                </h3>

                <p className="text-gray-600 text-xs mt-1">
                  QR ve barkod okutmak için kullanılır.
                </p>

              </div>

              {cameraGranted ? (
                <CheckCircle2
                  size={24}
                  className="text-green-400"
                />
              ) : (
                <span
                  className={`text-[10px] font-black uppercase ${
                    cameraDenied
                      ? "text-red-400"
                      : "text-orange-400"
                  }`}
                >
                  {cameraDenied
                    ? "Engellendi"
                    : "İzin Gerekli"}
                </span>
              )}

            </div>

          </div>

          {/* BİLDİRİM */}

          <div className="mt-3 bg-gray-950 border border-gray-800 rounded-2xl p-4">

            <div className="flex items-center gap-4">

              <div className="w-11 h-11 shrink-0 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400">

                <Bell
                  size={22}
                />

              </div>

              <div className="flex-1">

                <h3 className="font-bold">
                  Bildirimler
                </h3>

                <p className="text-gray-600 text-xs mt-1">
                  Kritik stok ve SKT uyarıları için kullanılır.
                </p>

              </div>

              {notificationGranted ? (
                <CheckCircle2
                  size={24}
                  className="text-green-400"
                />
              ) : (
                <span
                  className={`text-[10px] font-black uppercase ${
                    notificationDenied
                      ? "text-red-400"
                      : "text-orange-400"
                  }`}
                >
                  {notificationDenied
                    ? "Engellendi"
                    : "İzin Gerekli"}
                </span>
              )}

            </div>

          </div>

          {/* İZİN BUTONU */}

          {(!cameraGranted ||
            !notificationGranted) && (
            <button
              type="button"
              onClick={
                handleRequestPermissions
              }
              disabled={
                isLoading
              }
              className="w-full mt-5 bg-blue-600 disabled:bg-gray-800 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2"
            >

              <Smartphone
                size={20}
              />

              {isLoading
                ? "İzinler Kontrol Ediliyor..."
                : "Gerekli İzinleri Ver"}

            </button>
          )}

          {/* DEVAM */}

          <button
            type="button"
            onClick={
              handleContinue
            }
            className={`w-full py-4 rounded-xl font-black mt-3 ${
              cameraGranted &&
              notificationGranted
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            {cameraGranted &&
            notificationGranted
              ? "Kurulumu Tamamla"
              : "Şimdilik Atla ve Devam Et"}
          </button>

          {(cameraDenied ||
            notificationDenied) && (
            <p className="text-orange-400/80 text-xs text-center leading-5 mt-4">
              Engellenen izinleri daha sonra telefonunuzun uygulama veya site ayarlarından etkinleştirebilirsiniz.
            </p>
          )}

        </div>

        <p className="text-gray-700 text-[10px] text-center mt-5">
          Kamera yalnızca QR ve barkod tarama işlemleri sırasında kullanılır.
        </p>

      </div>

    </main>
  );
    }
