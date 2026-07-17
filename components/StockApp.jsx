"use client";

import { useEffect, useMemo, useState } from "react";
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  Home,
  History,
  User,
  Bell,
  Plus,
  ClipboardCheck,
  Package,
  AlertTriangle,
} from "lucide-react";

import { auth, db, appId } from "../lib/firebase";
import Dashboard from "./Dashboard";
import ProfileSetupView from "./ProfileSetupView";
import AdminAddProductView from "./AdminAddProductView";
import ProductDetailView from "./ProductDetailView";

export const getPublicCollection = (name) =>
  collection(db, "artifacts", appId, "public", "data", name);

export default function StockApp() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Firebase Authentication
  useEffect(() => {
    let unsubscribe;

    const startAuth = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Giriş hatası:", error);
        setIsAuthLoading(false);
      }
    };

    unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setDbUser(null);
        setIsAuthLoading(false);
        return;
      }

      try {
        const userRef = doc(
          getPublicCollection("users"),
          currentUser.uid
        );

        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          setDbUser(userSnapshot.data());
        } else {
          setDbUser(null);
        }
      } catch (error) {
        console.error("Kullanıcı bilgisi alınamadı:", error);
        setDbUser(null);
      }

      setIsAuthLoading(false);
    });

    startAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Firestore gerçek zamanlı veriler
  useEffect(() => {
    if (!user || !dbUser) return;

    const unsubscribeProducts = onSnapshot(
      getPublicCollection("products"),
      (snapshot) => {
        setProducts(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (error) => {
        console.error("Ürün okuma hatası:", error);
      }
    );

    const unsubscribeBatches = onSnapshot(
      getPublicCollection("batches"),
      (snapshot) => {
        setBatches(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (error) => {
        console.error("Parti okuma hatası:", error);
      }
    );

    const unsubscribeTransactions = onSnapshot(
      getPublicCollection("transactions"),
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        list.sort(
          (a, b) =>
            new Date(b.date || 0) - new Date(a.date || 0)
        );

        setTransactions(list);
      },
      (error) => {
        console.error("Hareket okuma hatası:", error);
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeBatches();
      unsubscribeTransactions();
    };
  }, [user, dbUser]);

  // Profil oluşturma
  const handleCreateProfile = async (name, role) => {
    if (!user) return;

    try {
      const userData = {
        uid: user.uid,
        name: name.trim(),
        role,
        createdAt: new Date().toISOString(),
      };

      await setDoc(
        doc(getPublicCollection("users"), user.uid),
        userData
      );

      setDbUser(userData);
      showToast(`Hoş geldin, ${name}!`);
    } catch (error) {
      console.error("Profil oluşturma hatası:", error);
      showToast("Profil oluşturulamadı.", "error");
    }
  };

  // Çıkış
  const handleLogout = async () => {
    try {
      await signOut(auth);

      setDbUser(null);
      setProducts([]);
      setBatches([]);
      setTransactions([]);
      setSelectedProduct(null);
      setCurrentView("dashboard");
    } catch (error) {
      console.error("Çıkış hatası:", error);
      showToast("Çıkış yapılamadı.", "error");
    }
  };

  // Bildirimler
  const activeNotifications = useMemo(() => {
    const notifications = [];

    products.forEach((product) => {
      const totalStock = batches
        .filter((batch) => batch.productId === product.id)
        .reduce(
          (total, batch) =>
            total + Number(batch.quantity || 0),
          0
        );

      if (totalStock <= Number(product.minStock || 0)) {
        notifications.push({
          id: `stock-${product.id}`,
          type: "CRITICAL",
          title: "Kritik Stok",
          message: `${product.name}: ${totalStock} adet kaldı.`,
        });
      }
    });

    batches.forEach((batch) => {
      if (
        Number(batch.quantity || 0) <= 0 ||
        !batch.expiryDate
      ) {
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiry = new Date(batch.expiryDate);

      const daysLeft = Math.ceil(
        (expiry.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysLeft <= 30) {
        const product = products.find(
          (item) => item.id === batch.productId
        );

        notifications.push({
          id: `expiry-${batch.id}`,
          type: daysLeft < 0 ? "ERROR" : "WARNING",
          title: daysLeft < 0 ? "SKT Geçmiş" : "SKT Yaklaşıyor",
          message:
            daysLeft < 0
              ? `${product?.name || "Ürün"} ürününün SKT'si geçti.`
              : `${product?.name || "Ürün"} ürününün SKT'sine ${daysLeft} gün kaldı.`,
        });
      }
    });

    return notifications;
  }, [products, batches]);

  // Yükleniyor
  if (isAuthLoading) {
    return (
      <div className="min-h-[100dvh] bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Package
            size={48}
            className="mx-auto mb-4 text-blue-500 animate-pulse"
          />
          <p className="font-bold">Vertice Stok yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Firebase bağlantı hatası
  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <AlertTriangle
            size={48}
            className="mx-auto mb-4 text-red-500"
          />
          <p className="font-bold">Firebase bağlantısı kurulamadı.</p>
        </div>
      </div>
    );
  }

  // İlk profil oluşturma
  if (!dbUser) {
    return (
      <ProfileSetupView
        onSetup={handleCreateProfile}
        showToast={showToast}
      />
    );
  }

  return (
    <main className="max-w-md mx-auto h-[100dvh] bg-gray-950 text-gray-100 overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-5 left-4 right-4 z-[500] flex justify-center">
          <div
            className={`px-5 py-3 rounded-2xl text-white font-bold ${
              toast.type === "error"
                ? "bg-red-600"
                : toast.type === "warning"
                ? "bg-yellow-600"
                : "bg-green-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Ana Sayfa */}
      {currentView === "dashboard" && (
        <Dashboard
          dbUser={dbUser}
          products={products}
          batches={batches}
          notifications={activeNotifications}
          showToast={showToast}
          onOpenNotifications={() =>
            setCurrentView("notifications")
          }
          onSelectProduct={(product) => {
            setSelectedProduct(product);
            setCurrentView("product_detail");
          }}
          onUnknownBarcode={(barcode) => {
            if (dbUser.role !== "admin") {
              showToast(
                "Bu ürün kayıtlı değil. Ürün ekleme yetkiniz yok.",
                "error"
              );
              return;
            }

            setScannedBarcode(barcode);
            setCurrentView("admin_add");
          }}
        />
      )}

      {/* Ürün Detayı */}
      {currentView === "product_detail" &&
        selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            batches={batches.filter(
              (batch) =>
                batch.productId === selectedProduct.id
            )}
            transactions={transactions.filter(
              (transaction) =>
                transaction.productId === selectedProduct.id
            )}
            dbUser={dbUser}
            showToast={showToast}
            onBack={() => {
              setSelectedProduct(null);
              setCurrentView("dashboard");
            }}
          />
        )}

      {/* Yeni Ürün */}
      {currentView === "admin_add" &&
        dbUser.role === "admin" && (
          <AdminAddProductView
            scannedBarcode={scannedBarcode}
            showToast={showToast}
            onBack={() => {
              setScannedBarcode("");
              setCurrentView("dashboard");
            }}
          />
        )}

      {/* Geçici Sayfalar */}
      {![
        "dashboard",
        "product_detail",
        "admin_add",
      ].includes(currentView) && (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <Package
            size={48}
            className="text-blue-500 mb-4"
          />

          <h2 className="text-2xl font-bold mb-3">
            {currentView === "inventory"
              ? "Stok Sayımı"
              : currentView === "history"
              ? "Hareket Geçmişi"
              : currentView === "notifications"
              ? `Bildirimler (${activeNotifications.length})`
              : currentView === "profile"
              ? "Profil"
              : "Vertice Stok"}
          </h2>

          <p className="text-gray-500 text-sm mb-6">
            Bu modül henüz hazırlanıyor.
          </p>

          {currentView === "profile" && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full max-w-xs bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-xl font-bold mb-3"
            >
              Çıkış Yap
            </button>
          )}

          <button
            type="button"
            onClick={() => setCurrentView("dashboard")}
            className="w-full max-w-xs bg-blue-600 text-white py-3 rounded-xl font-bold"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      )}

      {/* Alt Menü */}
      {currentView === "dashboard" && (
        <nav className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex justify-between items-center z-30">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-blue-500"
          >
            <Home size={22} />
            <span className="text-[10px]">Ana Sayfa</span>
          </button>

          {dbUser.role === "admin" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setScannedBarcode("");
                  setCurrentView("admin_add");
                }}
                className="flex flex-col items-center gap-1 text-gray-500"
              >
                <Plus size={22} />
                <span className="text-[10px]">Ekle</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("inventory")}
                className="flex flex-col items-center gap-1 text-gray-500"
              >
                <ClipboardCheck size={22} />
                <span className="text-[10px]">Sayım</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setCurrentView("history")}
            className="flex flex-col items-center gap-1 text-gray-500"
          >
            <History size={22} />
            <span className="text-[10px]">Geçmiş</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("profile")}
            className="flex flex-col items-center gap-1 text-gray-500"
          >
            <User size={22} />
            <span className="text-[10px]">Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("notifications")}
            className="relative flex flex-col items-center gap-1 text-gray-500"
          >
            <Bell size={22} />

            {activeNotifications.length > 0 && (
              <span className="absolute -top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}

            <span className="text-[10px]">Bildirim</span>
          </button>
        </nav>
      )}
    </main>
  );
}
