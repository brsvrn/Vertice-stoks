"use client";

import { useEffect, useMemo, useState } from "react";

import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import { auth, db, appId } from "../lib/firebase";

import {
  getFCMToken,
  listenForegroundMessages,
} from "../lib/firebaseMessaging";

import Dashboard from "./Dashboard";
import ProfileSetupView from "./ProfileSetupView";
import AdminAddProductView from "./AdminAddProductView";
import ProductDetailView from "./ProductDetailView";
import QRScannerModal from "./QRScannerModal";


export const getPublicCollection = (collectionName) => {
  return collection(
    db,
    "artifacts",
    appId,
    "public",
    "data",
    collectionName
  );
};

export default function StockApp() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddScannerOpen, setIsAddScannerOpen] = useState(false);

  const [scannedBarcodeForAdd, setScannedBarcodeForAdd] =
    useState("");

  const [toast, setToast] = useState(null);

  const [notificationStatus, setNotificationStatus] =
    useState("unknown");

  const [notificationLoading, setNotificationLoading] =
    useState(false);

  const showToast = (message, type = "success") => {
    setToast({
      message,
      type,
    });

    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  /*
   * TARAYICI BİLDİRİM DURUMU
   */
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window
    ) {
      setNotificationStatus(
        Notification.permission
      );
    } else {
      setNotificationStatus(
        "unsupported"
      );
    }
  }, []);

  /*
   * FIREBASE AUTH
   */
  useEffect(() => {
    let unsubscribeAuth;

    const startAuthentication = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        unsubscribeAuth = onAuthStateChanged(
          auth,
          async (firebaseUser) => {
            setUser(firebaseUser);

            if (!firebaseUser) {
              setDbUser(null);
              setIsAuthLoading(false);
              return;
            }

            try {
              const userReference = doc(
                getPublicCollection("users"),
                firebaseUser.uid
              );

              const userSnapshot =
                await getDoc(userReference);

              if (userSnapshot.exists()) {
                setDbUser({
                  uid: firebaseUser.uid,
                  ...userSnapshot.data(),
                });
              } else {
                setDbUser(null);
              }
            } catch (error) {
              console.error(
                "Profil yükleme hatası:",
                error
              );

              setDbUser(null);
            }

            setIsAuthLoading(false);
          }
        );
      } catch (error) {
        console.error(
          "Firebase giriş hatası:",
          error
        );

        setIsAuthLoading(false);
      }
    };

    startAuthentication();

    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, []);

  /*
   * FIRESTORE VERİLERİ
   */
  useEffect(() => {
    if (!user || !dbUser) {
      return;
    }

    const unsubscribeProducts = onSnapshot(
      getPublicCollection("products"),
      (snapshot) => {
        const data = snapshot.docs.map(
          (documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          })
        );

        setProducts(data);
      },
      (error) => {
        console.error(
          "Ürünler yüklenemedi:",
          error
        );
      }
    );

    const unsubscribeBatches = onSnapshot(
      getPublicCollection("batches"),
      (snapshot) => {
        const data = snapshot.docs.map(
          (documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          })
        );

        setBatches(data);
      },
      (error) => {
        console.error(
          "Partiler yüklenemedi:",
          error
        );
      }
    );

    const unsubscribeTransactions = onSnapshot(
      getPublicCollection("transactions"),
      (snapshot) => {
        const data = snapshot.docs.map(
          (documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          })
        );

        data.sort(
          (a, b) =>
            new Date(b.date || 0) -
            new Date(a.date || 0)
        );

        setTransactions(data);
      },
      (error) => {
        console.error(
          "Hareketler yüklenemedi:",
          error
        );
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeBatches();
      unsubscribeTransactions();
    };
  }, [user, dbUser]);

  /*
   * UYGULAMA AÇIKKEN GELEN
   * FCM MESAJLARINI DİNLE
   */
  useEffect(() => {
    if (!user || !dbUser) {
      return;
    }

    let unsubscribe = null;
    let active = true;

    const startListener = async () => {
      try {
        const unsubscribeFunction =
          await listenForegroundMessages(
            (payload) => {
              const title =
                payload?.notification?.title ||
                payload?.data?.title ||
                "Vertice Stok";

              const body =
                payload?.notification?.body ||
                payload?.data?.body ||
                "Yeni bir bildiriminiz var.";

              showToast(
                `${title}: ${body}`,
                payload?.data?.priority === "critical"
                  ? "error"
                  : "success"
              );
            }
          );

        if (active) {
          unsubscribe =
            unsubscribeFunction;
        }
      } catch (error) {
        console.error(
          "FCM dinleme hatası:",
          error
        );
      }
    };

    startListener();

    return () => {
      active = false;

      if (
        typeof unsubscribe ===
        "function"
      ) {
        unsubscribe();
      }
    };
  }, [user, dbUser]);

  /*
   * BİLDİRİMLERİ ETKİNLEŞTİR
   *
   * 1. Kullanıcıdan izin ister.
   * 2. Service Worker kaydeder.
   * 3. FCM token alır.
   * 4. Token'ı Firestore devices
   *    koleksiyonuna kaydeder.
   */
  const handleEnableNotifications =
    async () => {
      if (!user) {
        showToast(
          "Kullanıcı oturumu bulunamadı.",
          "error"
        );

        return;
      }

      setNotificationLoading(true);

      try {
        const token =
          await getFCMToken();

        if (!token) {
          throw new Error(
            "FCM_TOKEN_EMPTY"
          );
        }

        /*
         * Token'ın tamamını document ID
         * olarak kullanmıyoruz.
         *
         * Kullanıcının UID'si cihaz kaydı
         * için yeterli.
         */
        const deviceReference = doc(
          getPublicCollection("devices"),
          user.uid
        );

        await setDoc(
          deviceReference,
          {
            uid: user.uid,

            userName:
              dbUser?.name || "",

            role:
              dbUser?.role ||
              "personel",

            token,

            notificationsEnabled:
              true,

            platform:
              typeof navigator !==
              "undefined"
                ? navigator.platform ||
                  "web"
                : "web",

            userAgent:
              typeof navigator !==
              "undefined"
                ? navigator.userAgent
                : "",

            updatedAt:
              new Date().toISOString(),
          },
          {
            merge: true,
          }
        );

        setNotificationStatus(
          "granted"
        );

        showToast(
          "Telefon bildirimleri etkinleştirildi.",
          "success"
        );
      } catch (error) {
        console.error(
          "Bildirim etkinleştirme hatası:",
          error
        );

        if (
          error?.message ===
          "NOTIFICATION_PERMISSION_DENIED"
        ) {
          setNotificationStatus(
            "denied"
          );

          showToast(
            "Bildirim izni engellenmiş. Tarayıcı site ayarlarından bildirim iznini açın.",
            "error"
          );

          return;
        }

        if (
          error?.message ===
          "NOTIFICATION_NOT_SUPPORTED" ||
          error?.message ===
          "MESSAGING_NOT_SUPPORTED"
        ) {
          setNotificationStatus(
            "unsupported"
          );

          showToast(
            "Bu tarayıcı push bildirimlerini desteklemiyor.",
            "error"
          );

          return;
        }

        if (
          error?.message ===
          "VAPID_KEY_MISSING"
        ) {
          showToast(
            "VAPID anahtarı bulunamadı. Vercel ayarlarını kontrol edin.",
            "error"
          );

          return;
        }

        showToast(
          "Bildirim sistemi etkinleştirilemedi.",
          "error"
        );
      } finally {
        setNotificationLoading(false);
      }
    };

  /*
   * PROFİL OLUŞTUR
   */
  const handleCreateProfile = async (
    name,
    role
  ) => {
    if (!user) {
      showToast(
        "Kullanıcı oturumu bulunamadı.",
        "error"
      );

      return;
    }

    try {
      const userData = {
        uid: user.uid,
        name: name.trim(),
        role,
        createdAt:
          new Date().toISOString(),
      };

      await setDoc(
        doc(
          getPublicCollection("users"),
          user.uid
        ),
        userData
      );

      setDbUser(userData);
      setCurrentView("dashboard");

      showToast(
        `Hoş geldin, ${name}!`,
        "success"
      );
    } catch (error) {
      console.error(
        "Profil oluşturma hatası:",
        error
      );

      showToast(
        "Profil oluşturulamadı.",
        "error"
      );
    }
  };

  /*
   * UYGULAMA İÇİ STOK VE SKT
   * BİLDİRİMLERİ
   */
  const activeNotifications =
    useMemo(() => {
      const notifications = [];

      products.forEach(
        (product) => {
          const totalStock =
            batches
              .filter(
                (batch) =>
                  batch.productId ===
                  product.id
              )
              .reduce(
                (total, batch) =>
                  total +
                  Number(
                    batch.quantity ||
                      0
                  ),
                0
              );

          const minimumStock =
            Number(
              product.minStock || 0
            );

          if (
            totalStock <=
            minimumStock
          ) {
            notifications.push({
              id: `critical-${product.id}`,
              type: "CRITICAL",
              title:
                "Kritik Stok Uyarısı",
              message:
                `${product.name} kritik stok seviyesinde. ` +
                `Mevcut: ${totalStock} / Minimum: ${minimumStock}`,
              productId:
                product.id,
            });
          }
        }
      );

      batches.forEach(
        (batch) => {
          const quantity =
            Number(
              batch.quantity || 0
            );

          if (
            quantity <= 0 ||
            !batch.expiryDate
          ) {
            return;
          }

          const expiry =
            new Date(
              batch.expiryDate
            );

          const today =
            new Date();

          expiry.setHours(
            0,
            0,
            0,
            0
          );

          today.setHours(
            0,
            0,
            0,
            0
          );

          const milliseconds =
            expiry.getTime() -
            today.getTime();

          const daysLeft =
            Math.ceil(
              milliseconds /
                (1000 *
                  60 *
                  60 *
                  24)
            );

          const product =
            products.find(
              (item) =>
                item.id ===
                batch.productId
            );

          const productName =
            product?.name ||
            "Bilinmeyen Ürün";

          if (daysLeft < 0) {
            notifications.push({
              id: `expired-${batch.id}`,
              type: "ERROR",
              title: "SKT Geçti",
              message:
                `${productName} - Parti #${batch.batchNo || "-"} ` +
                `ürününün son kullanma tarihi geçti.`,
              productId:
                batch.productId,
              batchId:
                batch.id,
            });

            return;
          }

          /*
           * SKT bugün
           */
          if (daysLeft === 0) {
            notifications.push({
              id: `expiry-today-${batch.id}`,
              type: "CRITICAL",
              title:
                "SKT Bugün Doluyor",
              message:
                `${productName} - Parti #${batch.batchNo || "-"} ` +
                `ürününün son kullanma tarihi bugün.`,
              productId:
                batch.productId,
              batchId:
                batch.id,
            });

            return;
          }

          /*
           * SKT'ye 3 gün veya daha az kaldı.
           */
          if (daysLeft <= 3) {
            notifications.push({
              id: `expiry-${batch.id}`,
              type: "WARNING",
              title:
                "SKT Yaklaşıyor",
              message:
                `${productName} - Parti #${batch.batchNo || "-"} ` +
                `için ${daysLeft} gün kaldı.`,
              productId:
                batch.productId,
              batchId:
                batch.id,
            });
          }
        }
      );

      return notifications;
    }, [products, batches]);

  /*
   * ÜRÜN ARA / OKUT
   */
  const handleScanSuccess = (
    decodedText
  ) => {
    setIsScannerOpen(false);

    const cleanCode =
      String(
        decodedText || ""
      ).trim();

    if (!cleanCode) {
      showToast(
        "Geçerli bir barkod okunamadı.",
        "error"
      );

      return;
    }

    const foundProduct =
      products.find(
        (product) => {
          const productCode =
            String(
              product.qrNo ||
                product.barcode ||
                product.barcodeNo ||
                ""
            ).trim();

          return (
            productCode ===
            cleanCode
          );
        }
      );

    if (foundProduct) {
      setSelectedProduct(
        foundProduct
      );

      setCurrentView(
        "product_detail"
      );

      showToast(
        "Ürün bulundu.",
        "success"
      );

      return;
    }

    setSelectedProduct(null);

    setScannedBarcodeForAdd(
      cleanCode
    );

    setCurrentView(
      "admin_add"
    );

    showToast(
      "Bu barkod sistemde kayıtlı değil. Yeni ürün olarak ekleyebilirsiniz.",
      "success"
    );
  };

  /*
   * YENİ ÜRÜN BARKOD OKUTMA
   */
  const handleAddScan = (
    decodedText
  ) => {
    setIsAddScannerOpen(false);

    const cleanCode =
      String(
        decodedText || ""
      ).trim();

    if (!cleanCode) {
      showToast(
        "Geçerli bir barkod okunamadı.",
        "error"
      );

      return;
    }

    const foundProduct =
      products.find(
        (product) => {
          const productCode =
            String(
              product.qrNo ||
                product.barcode ||
                product.barcodeNo ||
                ""
            ).trim();

          return (
            productCode ===
            cleanCode
          );
        }
      );

    if (foundProduct) {
      setSelectedProduct(
        foundProduct
      );

      setCurrentView(
        "product_detail"
      );

      showToast(
        "Bu barkod zaten kayıtlı. Ürün detayları açıldı.",
        "success"
      );

      return;
    }

    setScannedBarcodeForAdd(
      cleanCode
    );

    setCurrentView(
      "admin_add"
    );

    showToast(
      "Barkod okundu. Ürün bilgilerini tamamlayın.",
      "success"
    );
  };

  const handleOpenProduct = (
    product
  ) => {
    setSelectedProduct(product);

    setCurrentView(
      "product_detail"
    );
  };

  const handleBackToDashboard =
    () => {
      setSelectedProduct(null);

      setScannedBarcodeForAdd(
        ""
      );

      setCurrentView(
        "dashboard"
      );
    };

  const handleLogout =
    async () => {
      try {
        await signOut(auth);

        setDbUser(null);
        setUser(null);

        showToast(
          "Çıkış yapıldı.",
          "success"
        );
      } catch (error) {
        console.error(
          "Çıkış hatası:",
          error
        );

        showToast(
          "Çıkış yapılamadı.",
          "error"
        );
      }
    };

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">

          <div className="w-12 h-12 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />

          <h1 className="text-xl font-black">
            Vertice Stok
          </h1>

          <p className="text-gray-500 text-sm mt-2">
            Sistem yükleniyor...
          </p>

        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">

        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">

          <h1 className="text-2xl font-black">
            Vertice Stok
          </h1>

          <p className="text-gray-400 mt-3">
            Firebase kullanıcı oturumu oluşturulamadı.
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-6"
          >
            Tekrar Dene
          </button>

        </div>

      </main>
    );
  }

  if (!dbUser) {
    return (
      <>
        {toast && (
          <Toast toast={toast} />
        )}

        <ProfileSetupView
          onSetup={
            handleCreateProfile
          }
          showToast={
            showToast
          }
        />
      </>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-950 text-gray-100 overflow-hidden relative shadow-2xl">

      {toast && (
        <Toast toast={toast} />
      )}

      {isScannerOpen && (
        <QRScannerModal
          title="Ürün Ara / Okut"
          onClose={() =>
            setIsScannerOpen(false)
          }
          onScan={
            handleScanSuccess
          }
        />
      )}

      {isAddScannerOpen && (
        <QRScannerModal
          title="Barkod Okutarak Ekle"
          onClose={() =>
            setIsAddScannerOpen(
              false
            )
          }
          onScan={
            handleAddScan
          }
        />
      )}

      {currentView ===
        "dashboard" && (
        <Dashboard
          dbUser={dbUser}
          products={products}
          batches={batches}
          notifications={
            activeNotifications
          }
          onOpenProduct={
            handleOpenProduct
          }
          onOpenScanner={() =>
            setIsScannerOpen(true)
          }
          onOpenAddScanner={() =>
            setIsAddScannerOpen(
              true
            )
          }
          onOpenInventory={() => {
            showToast(
              "Sayım modülü sıradaki aşamada eklenecek.",
              "error"
            );
          }}
          onOpenHistory={() => {
            showToast(
              "Geçmiş ekranı sıradaki aşamada eklenecek.",
              "error"
            );
          }}
          onOpenNotifications={() => {
            showToast(
              `${activeNotifications.length} aktif bildiriminiz var.`,
              "success"
            );
          }}
          onOpenProfile={() => {
            setCurrentView(
              "profile"
            );
          }}
        />
      )}

      {currentView ===
        "admin_add" && (
        <AdminAddProductView
          scannedBarcode={
            scannedBarcodeForAdd
          }
          onBack={
            handleBackToDashboard
          }
          showToast={
            showToast
          }
        />
      )}

      {currentView ===
        "product_detail" &&
        selectedProduct && (
          <ProductDetailView
            product={
              selectedProduct
            }
            batches={batches.filter(
              (batch) =>
                batch.productId ===
                selectedProduct.id
            )}
            transactions={transactions.filter(
              (transaction) =>
                transaction.productId ===
                selectedProduct.id
            )}
            dbUser={dbUser}
            onBack={
              handleBackToDashboard
            }
            showToast={
              showToast
            }
          />
        )}

      {currentView ===
        "profile" && (
        <ProfileScreen
          dbUser={dbUser}
          notificationStatus={
            notificationStatus
          }
          notificationLoading={
            notificationLoading
          }
          onEnableNotifications={
            handleEnableNotifications
          }
          onBack={
            handleBackToDashboard
          }
          onLogout={
            handleLogout
          }
        />
      )}

    </div>
  );
}

function Toast({ toast }) {
  const isError =
    toast.type === "error";

  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[300] w-[90%] max-w-sm">

      <div
        className={`px-5 py-4 rounded-2xl shadow-2xl border text-sm font-bold text-white ${
          isError
            ? "bg-red-600 border-red-500"
            : "bg-green-600 border-green-500"
        }`}
      >
        {toast.message}
      </div>

    </div>
  );
}

function ProfileScreen({
  dbUser,
  notificationStatus,
  notificationLoading,
  onEnableNotifications,
  onBack,
  onLogout,
}) {
  const notificationsEnabled =
    notificationStatus ===
    "granted";

  return (
    <div className="flex flex-col h-full bg-gray-950">

      <header className="p-6 bg-gray-900 border-b border-gray-800">

        <button
          type="button"
          onClick={onBack}
          className="text-blue-400 text-sm font-bold mb-5"
        >
          ← Ana Sayfa
        </button>

        <h1 className="text-2xl font-black text-white">
          Profil
        </h1>

      </header>

      <main className="flex-1 p-6 overflow-y-auto">

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">

          <div className="w-20 h-20 mx-auto bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center text-blue-400 text-3xl font-black">
            {dbUser?.name
              ?.charAt(0)
              ?.toLocaleUpperCase(
                "tr-TR"
              ) || "K"}
          </div>

          <h2 className="text-2xl font-black text-white mt-5">
            {dbUser?.name}
          </h2>

          <span className="inline-block mt-3 px-4 py-1.5 bg-gray-950 border border-gray-800 rounded-full text-xs text-blue-400 font-bold uppercase">
            {dbUser?.role ===
            "admin"
              ? "Yönetici"
              : "Personel"}
          </span>

        </div>

        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-5">

          <h3 className="text-white font-black text-lg">
            Telefon Bildirimleri
          </h3>

          <p className="text-gray-500 text-sm mt-2 leading-6">
            SKT ve kritik stok uyarılarını telefonunuza alın.
          </p>

          {notificationsEnabled ? (
            <div className="mt-5 bg-green-500/10 border border-green-500/30 rounded-xl p-4">

              <p className="text-green-400 font-bold">
                ✓ Bildirimler Etkin
              </p>

              <p className="text-gray-500 text-xs mt-2">
                Bu cihaz push bildirimleri almak için kayıtlı.
              </p>

            </div>
          ) : (
            <button
              type="button"
              onClick={
                onEnableNotifications
              }
              disabled={
                notificationLoading
              }
              className="w-full mt-5 bg-blue-600 disabled:bg-gray-700 text-white font-black py-4 rounded-xl"
            >
              {notificationLoading
                ? "Bildirimler Etkinleştiriliyor..."
                : "Bildirimleri Etkinleştir"}
            </button>
          )}

          {notificationStatus ===
            "denied" && (
            <p className="text-red-400 text-xs mt-3">
              Bildirim izni engellenmiş. Tarayıcı site ayarlarından bildirim iznini açmanız gerekiyor.
            </p>
          )}

          {notificationStatus ===
            "unsupported" && (
            <p className="text-red-400 text-xs mt-3">
              Bu tarayıcı push bildirimlerini desteklemiyor.
            </p>
          )}

        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full mt-6 bg-red-500/10 border border-red-500/30 text-red-400 font-bold py-4 rounded-xl"
        >
          Çıkış Yap
        </button>

      </main>

    </div>
  );
}
