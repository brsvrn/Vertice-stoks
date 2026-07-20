"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

import {
  getFCMToken,
  listenForegroundMessages,
} from "../lib/firebaseMessaging";

import Dashboard from "./Dashboard";
import ProfileSetupView from "./ProfileSetupView";
import AdminAddProductView from "./AdminAddProductView";
import ProductDetailView from "./ProductDetailView";
import QRScannerModal from "./QRScannerModal";
import InventoryView from "./InventoryView";
import NotificationsView from "./NotificationsView";
import InventoryHistoryView from "./InventoryHistoryView";
import ReportsView from "./ReportsView";
import GoogleSignInView from "./GoogleSignInView";
import PermissionsSetupView from "./PermissionsSetupView";
import PrintCenterView from "./PrintCenterView";
import CompanyOnboardingView from "./CompanyOnboardingView";
import CompanyAccessView from "./CompanyAccessView";
import AppLoadingScreen from "./AppLoadingScreen";
import { parseProductReference } from "../lib/qr";
import { getActiveCompanyId, setActiveCompanyId } from "../lib/tenantRuntime";

function getDeviceRegistrationId() {
  const storageKey = "vertice_push_device_id";
  const existingId = window.localStorage.getItem(storageKey);
  if (existingId) return existingId;

  const generatedId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, generatedId);
  return generatedId;
}

async function showForegroundPush(payload) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const title = payload?.notification?.title || "Envantra";
  const body = payload?.notification?.body || "Yeni bir bildiriminiz var.";
  const options = {
    body,
    icon: "/icons/envantra-logo-192-v1.png",
    badge: "/icons/envantra-logo-192-v1.png",
    tag: payload?.data?.notificationId || payload?.data?.type || "vertice-stok",
    data: { url: payload?.data?.url || "/" },
  };

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch (error) {
    console.debug("Foreground push could not be displayed:", error);
  }
}

/*

=========================================

PUBLIC FIRESTORE COLLECTION

=========================================
*/

export const getPublicCollection = (collectionName) => {
  const companyId = getActiveCompanyId();
  if (!companyId) throw new Error("ACTIVE_COMPANY_REQUIRED");
  return collection(db, "companies", companyId, collectionName);
};

export default function StockApp() {
  /*

  =========================================

  STATE

  =========================================
  */

  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyError, setCompanyError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inventoryCounts, setInventoryCounts] = useState([]);

  const [currentView, setCurrentView] = useState("dashboard");
  const [printProduct, setPrintProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddScannerOpen, setIsAddScannerOpen] = useState(false);

  const [scannedBarcodeForAdd, setScannedBarcodeForAdd] = useState("");

  const [pendingProductId, setPendingProductId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("product") || "";
  });
  const [pendingInviteToken, setPendingInviteToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const parameters = new URLSearchParams(window.location.search);
    return parameters.get("invite") || parameters.get("token") || "";
  });

  const [toast, setToast] = useState(null);

  const [notificationStatus, setNotificationStatus] = useState("unknown");

  const [notificationLoading, setNotificationLoading] = useState(false);

  const [readNotificationIds, setReadNotificationIds] = useState([]);

  const [inventoryActionLoading, setInventoryActionLoading] = useState(false);
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);
  const [googleSignInError, setGoogleSignInError] = useState("");
  const [googleProfileReviewRequired, setGoogleProfileReviewRequired] = useState(false);

  const [
    permissionsSetupCompleted,
    setPermissionsSetupCompleted,
  ] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  /*

  =========================================

  İLK KURULUM İZİN DURUMU

  =========================================
  */

  useEffect(() => {
    try {
      const completed = localStorage.getItem("vertice_permissions_setup_completed");
      setPermissionsSetupCompleted(completed === "true");
    } catch (error) {
      console.error("İzin kurulum durumu okunamadı:", error);
      setPermissionsSetupCompleted(false);
    }
  }, []);

  const activateCompany = useCallback((selectedCompany) => {
    setActiveCompanyId(selectedCompany?.id || "");
    setProducts([]);
    setBatches([]);
    setTransactions([]);
    setInventoryCounts([]);
    setSelectedProduct(null);
    setCurrentView("dashboard");
    setCompany(selectedCompany || null);
    if (selectedCompany) {
      window.localStorage.setItem("envantra_active_company_id", selectedCompany.id);
      const tenantRole = selectedCompany.membership?.role || "PERSONNEL";
      setDbUser((current) => current ? { ...current, tenantRole, role: tenantRole === "PERSONNEL" ? "staff" : "admin" } : current);
    } else {
      window.localStorage.removeItem("envantra_active_company_id");
    }
  }, []);

  useEffect(() => {
    if (!user || !dbUser?.uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        setCompanyLoading(true);
        setCompanyError("");
        const token = await user.getIdToken();
        if (pendingInviteToken) {
          const joinResponse = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "joinInvite", token: pendingInviteToken }) });
          const joinPayload = await joinResponse.json();
          if (!joinResponse.ok) throw new Error(joinPayload?.error || "Davet kullanılamadı.");
          setPendingInviteToken("");
          window.history.replaceState({}, "", window.location.pathname);
        }
        const response = await fetch("/api/companies", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "İşletmeler yüklenemedi.");
        if (cancelled) return;
        const list = payload.companies || [];
        setCompanies(list);
        const localId = window.localStorage.getItem("envantra_active_company_id");
        const preferred = list.find((item) => item.id === localId) || list.find((item) => item.id === payload.lastCompanyId) || (list.length === 1 ? list[0] : null);
        activateCompany(preferred);
        if (payload.initialJoinCode) showToast(`Vertice katılım kodu: ${payload.initialJoinCode}`, "success");
      } catch (error) {
        if (!cancelled) setCompanyError(error?.message || "İşletmeler yüklenemedi.");
      } finally {
        if (!cancelled) setCompanyLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activateCompany, dbUser?.uid, pendingInviteToken, showToast, user]);

  const handleSelectCompany = async (selectedCompany) => {
    if (!user) return;
    try {
      setCompanyLoading(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "switch", companyId: selectedCompany.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "İşletme açılamadı.");
      activateCompany(selectedCompany);
    } catch (error) { setCompanyError(error?.message || "İşletme açılamadı."); }
    finally { setCompanyLoading(false); }
  };

  /*

  =========================================

  TARAYICI BİLDİRİM DURUMU

  =========================================
  */

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationStatus(Notification.permission);
    } else {
      setNotificationStatus("unsupported");
    }
  }, []);

  /*

  =========================================

  FIREBASE AUTH

  =========================================
  */

  useEffect(() => {
    let unsubscribeAuth;

    const startAuthentication = async () => {
      try {
        unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
          setUser(firebaseUser);
          if (!firebaseUser) {
            setDbUser(null);
            setIsAuthLoading(false);
            return;
          }
          try {
            const userReference = doc(db, "users", firebaseUser.uid);
            const userSnapshot = await getDoc(userReference);
            if (userSnapshot.exists()) {
              const profile = {
                uid: firebaseUser.uid,
                ...userSnapshot.data(),
              };
              setDbUser(profile);
              setGoogleProfileReviewRequired(false);
            } else {
              setDbUser(null);
            }
          } catch (error) {
            console.error("Profil yükleme hatası:", error);
            setDbUser(null);
          }
          setIsAuthLoading(false);
        });
      } catch (error) {
        console.error("Firebase giriş hatası:", error);
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

  =========================================

  FIRESTORE CANLI VERİLER

  =========================================
  */

  useEffect(() => {
    if (!user || !dbUser || !company) {
      return;
    }

    const unsubscribeProducts = onSnapshot(
      getPublicCollection("products"),
      (snapshot) => {
        const data = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }));
        setProducts(data);
      },
      (error) => {
        console.error("Ürünler yüklenemedi:", error);
      }
    );
    
    const unsubscribeBatches = onSnapshot(
      getPublicCollection("batches"),
      (snapshot) => {
        const data = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }));
        setBatches(data);
      },
      (error) => {
        console.error("Partiler yüklenemedi:", error);
      }
    );
    
    const unsubscribeTransactions = onSnapshot(
      getPublicCollection("transactions"),
      (snapshot) => {
        const data = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }));
        data.sort(
          (a, b) =>
            new Date(b.date || b.createdAt || 0) -
            new Date(a.date || a.createdAt || 0)
        );
        setTransactions(data);
      },
      (error) => {
        console.error("Hareketler yüklenemedi:", error);
      }
    );
    
    const unsubscribeInventoryCounts = onSnapshot(
      getPublicCollection("inventoryCounts"),
      (snapshot) => {
        const data = snapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        }));
        data.sort(
          (a, b) =>
            new Date(b.createdAt || b.completedAt || 0) -
            new Date(a.createdAt || a.completedAt || 0)
        );
        setInventoryCounts(data);
      },
      (error) => {
        console.error("Sayım geçmişi yüklenemedi:", error);
      }
    );
    
    return () => {
      unsubscribeProducts();
      unsubscribeBatches();
      unsubscribeTransactions();
      unsubscribeInventoryCounts();
    };
  }, [user, dbUser, company]);

  useEffect(() => {
    if (!user || !company) return;
    return onSnapshot(
      doc(db, "companies", company.id, "members", user.uid),
      (snapshot) => {
        const membership = snapshot.data();
        if (!snapshot.exists() || membership?.status !== "ACTIVE") {
          activateCompany(null);
          setCompanyError("Bu işletmedeki üyeliğiniz artık aktif değil.");
          return;
        }
        const tenantRole = membership.role || "PERSONNEL";
        setCompany((current) => current ? { ...current, membership } : current);
        setDbUser((current) => current ? { ...current, tenantRole, role: tenantRole === "PERSONNEL" ? "staff" : "admin" } : current);
      },
      () => {
        activateCompany(null);
        setCompanyError("İşletme üyeliğiniz doğrulanamadı. Lütfen yeniden seçin.");
      }
    );
  }, [activateCompany, company?.id, user]);

  useEffect(() => {
    if (!pendingProductId || products.length === 0) {
      return;
    }

    const product = products.find((item) => item.id === pendingProductId);
    if (product) {
      setSelectedProduct(product);
      setCurrentView("product_detail");
      setPendingProductId("");
    }
  }, [pendingProductId, products]);

  /*

  =========================================

  FOREGROUND FCM

  =========================================
  */

  useEffect(() => {
    if (!user || !dbUser || !company) {
      return;
    }

    let unsubscribe = null;
    let active = true;
    
    const startListener = async () => {
      try {
        const unsubscribeFunction = await listenForegroundMessages((payload) => {
          const title =
            payload?.notification?.title ||
            payload?.data?.title ||
            "Envantra";
          const body =
            payload?.notification?.body ||
            payload?.data?.body ||
            "Yeni bir bildiriminiz var.";
          showToast(
            `${title}: ${body}`,
            payload?.data?.priority === "critical" ? "error" : "success"
          );
          void showForegroundPush(payload);
        });
        if (active) {
          unsubscribe = unsubscribeFunction;
        }
      } catch (error) {
        console.error("FCM dinleme hatası:", error);
      }
    };
    startListener();
    return () => {
      active = false;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [user, dbUser, company]);

  /*

  =========================================

  BİLDİRİMLERİ ETKİNLEŞTİR

  =========================================
  */

  const registerCurrentDeviceForPush = useCallback(
    async ({ interactive = false } = {}) => {
      if (!user || !dbUser || !company) return false;

      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        (!interactive && Notification.permission !== "granted")
      ) {
        return false;
      }

      try {
        const token = await getFCMToken();
        if (!token) throw new Error("FCM_TOKEN_EMPTY");

        const deviceId = getDeviceRegistrationId();
        await setDoc(
          doc(getPublicCollection("devices"), `${user.uid}_${deviceId}`),
          {
            uid: user.uid,
            userName: dbUser.name || "",
            role: dbUser.role || "personel",
            token,
            deviceId,
            notificationsEnabled: true,
            platform: navigator.userAgentData?.platform || navigator.platform || "web",
            userAgent: navigator.userAgent || "",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        setNotificationStatus("granted");
        return true;
      } catch (error) {
        console.error("Push device registration failed:", error);
        if (error?.message === "NOTIFICATION_PERMISSION_DENIED") {
          setNotificationStatus("denied");
        }
        return false;
      }
    },
    [company, dbUser, user]
  );

  const handleEnableNotifications = async () => {
    setNotificationLoading(true);
    const registered = await registerCurrentDeviceForPush({ interactive: true });
    setNotificationLoading(false);

    if (registered) {
      showToast("Telefon bildirimleri etkinleştirildi.", "success");
      return;
    }

    showToast(
      "Bildirim cihazı kaydedilemedi. Tarayıcı izinlerini ve Vercel ayarlarını kontrol edin.",
      "error"
    );
  };

  useEffect(() => {
    if (
      !user ||
      !dbUser ||
      !company ||
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    registerCurrentDeviceForPush();
  }, [company, dbUser, registerCurrentDeviceForPush, user]);

  /*

  =========================================

  PROFİL OLUŞTUR

  =========================================
  */

  const handleCreateProfile = async (name, role, adminPin = "") => {
    if (!user) {
      showToast("Kullanıcı oturumu bulunamadı.", "error");
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ name: name.trim(), role, adminPin }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Profil oluşturulamadı.");
      const userData = payload.user;
      setDbUser(userData);
      window.localStorage.setItem(`vertice_google_profile_reviewed_${user.uid}`, "true");
      setGoogleProfileReviewRequired(false);
      setCurrentView("dashboard");
      showToast(`Hoş geldin, ${name}!`, "success");
    } catch (error) {
      console.error("Profil oluşturma hatası:", error);
      showToast("Profil oluşturulamadı.", "error");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleSignInLoading(true);
      setGoogleSignInError("");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google giriş hatası:", error);
      if (error?.code === "auth/credential-already-in-use") {
        try {
          const credential = GoogleAuthProvider.credentialFromError(error);
          if (!credential) throw error;
          await signInWithCredential(auth, credential);
          setGoogleSignInError("");
          return;
        } catch (migrationError) {
          console.error("Mevcut Google hesabına geçiş hatası:", migrationError);
        }
      }
      const errorMessages = {
        "auth/operation-not-allowed": "Google ile giriş Firebase Authentication ayarlarında etkin değil.",
        "auth/unauthorized-domain": "Bu Vercel alan adı Firebase Authentication için yetkilendirilmemiş.",
        "auth/credential-already-in-use": "Google hesabı daha önce bağlanmış; profil kurulumunu tamamlayarak devam edin.",
        "auth/account-exists-with-different-credential": "Bu e-posta başka bir giriş yöntemiyle kayıtlı.",
        "auth/network-request-failed": "Google girişi için internet bağlantısı gerekli.",
        "auth/web-storage-unsupported": "Tarayıcı depolama izni kapalı. Gizli sekmeyi kapatıp tekrar deneyin.",
      };
      const message = errorMessages[error?.code] || `Google ile giriş başlatılamadı (${error?.code || "bilinmeyen hata"}).`;
      setGoogleSignInError(message);
      setGoogleSignInLoading(false);
    }
  };

  const handleEmailAuth = async ({ email, password, createAccount = false }) => {
    try {
      setGoogleSignInLoading(true);
      setGoogleSignInError("");
      if (createAccount) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const messages = { "auth/invalid-credential": "E-posta veya şifre hatalı.", "auth/email-already-in-use": "Bu e-posta zaten kayıtlı.", "auth/weak-password": "Şifre en az 6 karakter olmalı.", "auth/invalid-email": "Geçerli bir e-posta girin.", "auth/network-request-failed": "İnternet bağlantınızı kontrol edin." };
      setGoogleSignInError(messages[error?.code] || "E-posta ile giriş tamamlanamadı.");
      setGoogleSignInLoading(false);
    }
  };

  const handlePasswordReset = async (email) => {
    try {
      if (!email) throw new Error("EMAIL_REQUIRED");
      await sendPasswordResetEmail(auth, email);
      showToast("Şifre yenileme bağlantısı e-posta adresinize gönderildi.", "success");
    } catch { setGoogleSignInError("Şifre yenilemek için geçerli e-posta adresinizi girin."); }
  };

  const runCompanyOperation = async (action, value) => {
    if (!user) return;
    try {
      setCompanyLoading(true);
      setCompanyError("");
      const token = await user.getIdToken();
      const response = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(action === "create" ? { action, name: value } : { action, joinCode: value }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "İşletme işlemi tamamlanamadı.");
      const selectedCompany = { ...payload.company, membership: payload.membership };
      setCompanies((current) => [...current.filter((item) => item.id !== selectedCompany.id), selectedCompany]);
      activateCompany(selectedCompany);
      if (payload.joinCode) showToast(`Katılım kodunuz: ${payload.joinCode}`, "success");
    } catch (error) { setCompanyError(error.message || "İşletme işlemi tamamlanamadı."); }
    finally { setCompanyLoading(false); }
  };

  /*

  =========================================

  UYGULAMA İÇİ BİLDİRİMLER

  =========================================
  */

  const activeNotifications = useMemo(() => {
    const notifications = [];

    /* * KRİTİK STOK */
    products.forEach((product) => {
      const totalStock = batches
        .filter((batch) => batch.productId === product.id)
        .reduce((total, batch) => total + Number(batch.quantity || 0), 0);
      const minimumStock = Number(product.minStock || 0);
      if (minimumStock > 0 && totalStock <= minimumStock) {
        notifications.push({
          id: `critical-${product.id}`,
          type: "CRITICAL",
          title: "Kritik Stok Uyarısı",
          message: `${product.name} kritik stok seviyesinde. Mevcut: ${totalStock} / Minimum: ${minimumStock}`,
          productId: product.id,
        });
      }
    });
    
    /* * SKT */
    batches.forEach((batch) => {
      const quantity = Number(batch.quantity || 0);
      if (quantity <= 0 || !batch.expiryDate) {
        return;
      }
      const expiry = new Date(batch.expiryDate);
      const today = new Date();
      expiry.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const milliseconds = expiry.getTime() - today.getTime();
      const daysLeft = Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
      const product = products.find((item) => item.id === batch.productId);
      const productName = product?.name || "Bilinmeyen Ürün";
      
      if (daysLeft < 0) {
        notifications.push({
          id: `expired-${batch.id}`,
          type: "ERROR",
          title: "SKT Geçti",
          message: `${productName} - Parti #${batch.batchNo || "-"} ürününün son kullanma tarihi geçti.`,
          productId: batch.productId,
          batchId: batch.id,
        });
        return;
      }
      if (daysLeft === 0) {
        notifications.push({
          id: `expiry-today-${batch.id}`,
          type: "CRITICAL",
          title: "SKT Bugün Doluyor",
          message: `${productName} - Parti #${batch.batchNo || "-"} ürününün son kullanma tarihi bugün.`,
          productId: batch.productId,
          batchId: batch.id,
        });
        return;
      }
      if (daysLeft <= 3) {
        notifications.push({
          id: `expiry-${batch.id}`,
          type: "WARNING",
          title: "SKT Yaklaşıyor",
          message: `${productName} - Parti #${batch.batchNo || "-"} için ${daysLeft} gün kaldı.`,
          productId: batch.productId,
          batchId: batch.id,
        });
      }
    });
    
    /* * ONAY BEKLEYEN SAYIMLAR */
    const pendingInventories = inventoryCounts.filter(
      (inventory) =>
        inventory.applied === false &&
        Number(inventory.differenceProducts || 0) > 0 &&
        inventory.status !== "REJECTED"
    );
    if (pendingInventories.length > 0) {
      notifications.push({
        id: "pending-inventory",
        type: "WARNING",
        title: "Onay Bekleyen Sayım",
        message: `${pendingInventories.length} stok sayımı yönetici onayı bekliyor.`,
      });
    }
    return notifications;
  }, [products, batches, inventoryCounts]);

  /*

  =========================================

  OKUNMAMIŞ BİLDİRİMLER

  =========================================
  */

  const unreadNotifications = useMemo(() => {
    return activeNotifications.filter(
      (notification) => !readNotificationIds.includes(notification.id)
    );
  }, [activeNotifications, readNotificationIds]);

  /*

  =========================================

  TEK BİLDİRİMİ OKUNDU YAP

  =========================================
  */

  const handleMarkNotificationAsRead = (notificationId) => {
    setReadNotificationIds((previous) => {
      if (previous.includes(notificationId)) {
        return previous;
      }
      return [...previous, notificationId];
    });
  };

  /*

  =========================================

  TÜM BİLDİRİMLERİ OKUNDU YAP

  =========================================
  */

  const handleMarkAllNotificationsAsRead = () => {
    setReadNotificationIds(
      activeNotifications.map((notification) => notification.id)
    );
    showToast("Tüm bildirimler okundu olarak işaretlendi.", "success");
  };

  /*

  =========================================

  BİLDİRİMDEN ÜRÜN AÇ

  =========================================
  */

  const handleOpenProductFromNotification = (productId) => {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      showToast("Bildirimle ilişkili ürün bulunamadı.", "error");
      return;
    }
    setSelectedProduct(product);
    setCurrentView("product_detail");
  };

  /*

  =========================================

  SAYIM DURUMU

  =========================================
  */

  const isInventoryPending = (inventory) => {
    if (!inventory) {
      return false;
    }
    if (inventory.status === "APPLIED" || inventory.applied === true) {
      return false;
    }
    if (inventory.status === "REJECTED") {
      return false;
    }
    return Number(inventory.differenceProducts || 0) > 0;
  };

  /*

  =========================================

  LOKASYON STOK HESABI

  =========================================
  */

  const getCurrentLocationStock = (productId, location) => {
    return batches
      .filter(
        (batch) =>
          batch.productId === productId &&
          (batch.location || "DEPO") === location
      )
      .reduce((total, batch) => total + Number(batch.quantity || 0), 0);
  };

  /*

  =========================================

  GEÇMİŞ SAYIMI STOĞA UYGULA

  =========================================
  */

  const handleApplyInventory = async (inventory) => {
    if (inventoryActionLoading) {
      return;
    }
    if (dbUser?.role !== "admin") {
      showToast("Bu işlemi yalnızca yönetici yapabilir.", "error");
      return;
    }
    if (!inventory?.id) {
      showToast("Geçerli sayım kaydı bulunamadı.", "error");
      return;
    }
    if (!isInventoryPending(inventory)) {
      showToast(
        "Bu sayım daha önce sonuçlandırılmış veya uygulanmış.",
        "error"
      );
      return;
    }
    const items = Array.isArray(inventory.items) ? inventory.items : [];
    const differenceItems = items.filter(
      (item) => Number(item.difference || 0) !== 0
    );
    if (differenceItems.length === 0) {
      showToast("Bu sayımda uygulanacak stok farkı bulunamadı.", "error");
      return;
    }
    
    /* * SAYIMDAN SONRA STOK DEĞİŞMİŞ Mİ? */
    const changedItems = differenceItems.filter((item) => {
      const currentStock = getCurrentLocationStock(
        item.productId,
        inventory.location
      );
      return currentStock !== Number(item.systemStock || 0);
    });
    
    if (changedItems.length > 0) {
      const firstChanged = changedItems[0];
      const currentStock = getCurrentLocationStock(
        firstChanged.productId,
        inventory.location
      );
      showToast(
        `${firstChanged.productName} stoğu sayımdan sonra değişmiş. Sayım anında: ${firstChanged.systemStock}, şimdi: ${currentStock}. Yeni sayım yapmalısınız.`,
        "error"
      );
      return;
    }
    
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `${differenceItems.length} üründeki sayım farkı gerçek stoğa uygulanacak. Devam etmek istiyor musunuz?`
      )
    ) {
      return;
    }
    
    try {
      setInventoryActionLoading(true);
      const firestoreBatch = writeBatch(db);
      const now = new Date().toISOString();
      const inventoryReference = doc(
        getPublicCollection("inventoryCounts"),
        inventory.id
      );
      
      for (const item of differenceItems) {
        const difference = Number(item.difference || 0);
        
        /* * EKSİK STOK - FEFO */
        if (difference < 0) {
          let quantityToRemove = Math.abs(difference);
          const productBatches = batches
            .filter(
              (batch) =>
                batch.productId === item.productId &&
                (batch.location || "DEPO") === inventory.location &&
                Number(batch.quantity || 0) > 0
            )
            .sort((first, second) => {
              const firstDate = first.expiryDate
                ? new Date(first.expiryDate).getTime()
                : Number.MAX_SAFE_INTEGER;
              const secondDate = second.expiryDate
                ? new Date(second.expiryDate).getTime()
                : Number.MAX_SAFE_INTEGER;
              return firstDate - secondDate;
            });
            
          for (const batchItem of productBatches) {
            if (quantityToRemove <= 0) {
              break;
            }
            const currentQuantity = Number(batchItem.quantity || 0);
            const removeQuantity = Math.min(currentQuantity, quantityToRemove);
            const newQuantity = currentQuantity - removeQuantity;
            
            firestoreBatch.update(
              doc(getPublicCollection("batches"), batchItem.id),
              {
                quantity: newQuantity,
                updatedAt: now,
              }
            );
            quantityToRemove -= removeQuantity;
          }
          if (quantityToRemove > 0) {
            throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
          }
        }
        
        /* * FAZLA STOK */
        if (difference > 0) {
          const productBatches = batches
            .filter(
              (batch) =>
                batch.productId === item.productId &&
                (batch.location || "DEPO") === inventory.location
            )
            .sort((first, second) => {
              const firstDate = new Date(
                first.createdAt || first.date || 0
              ).getTime();
              const secondDate = new Date(
                second.createdAt || second.date || 0
              ).getTime();
              return secondDate - firstDate;
            });
            
          const targetBatch = productBatches[0];
          if (targetBatch) {
            firestoreBatch.update(
              doc(getPublicCollection("batches"), targetBatch.id),
              {
                quantity: Number(targetBatch.quantity || 0) + difference,
                updatedAt: now,
              }
            );
          } else {
            const newBatchReference = doc(getPublicCollection("batches"));
            firestoreBatch.set(newBatchReference, {
              productId: item.productId,
              quantity: difference,
              location: inventory.location,
              batchNo: `SAYIM-${Date.now()}-${item.productId}`,
              expiryDate: null,
              source: "INVENTORY_ADJUSTMENT",
              createdAt: now,
              updatedAt: now,
              createdByUid: dbUser?.uid || "",
              createdByName: dbUser?.name || "Yönetici",
            });
          }
        }
        
        /* * TRANSACTION */
        const transactionReference = doc(getPublicCollection("transactions"));
        firestoreBatch.set(transactionReference, {
          type: "INVENTORY_ADJUSTMENT",
          productId: item.productId,
          productName: item.productName || "",
          location: inventory.location,
          quantity: Math.abs(difference),
          difference,
          previousStock: Number(item.systemStock || 0),
          countedStock: Number(item.countedStock || 0),
          newStock: Number(item.countedStock || 0),
          direction: difference > 0 ? "IN" : "OUT",
          reason: "Onaylanan stok sayım farkı",
          inventoryId: inventory.id,
          userId: dbUser?.uid || "",
          userName: dbUser?.name || "Yönetici",
          userRole: dbUser?.role || "admin",
          originalCountedByUid: inventory.countedByUid || "",
          originalCountedByName: inventory.countedByName || "",
          date: now,
          createdAt: now,
        });
      }
      
      firestoreBatch.update(inventoryReference, {
        status: "APPLIED",
        applied: true,
        appliedByUid: dbUser?.uid || "",
        appliedByName: dbUser?.name || "Yönetici",
        appliedAt: now,
        updatedAt: now,
      });
      await firestoreBatch.commit();
      showToast("Sayım onaylandı ve stok farkları uygulandı.", "success");
    } catch (error) {
      console.error("Geçmiş sayım uygulama hatası:", error);
      if (error?.message?.startsWith("INSUFFICIENT_STOCK:")) {
        const productName = error.message.split(":")[1];
        showToast(
          `${productName} için yeterli stok bulunamadı. İşlem uygulanmadı.`,
          "error"
        );
        return;
      }
      showToast("Sayım farkları stoğa uygulanamadı.", "error");
    } finally {
      setInventoryActionLoading(false);
    }
  };

  /*

  =========================================

  SAYIMI REDDET

  =========================================
  */

  const handleRejectInventory = async (inventory) => {
    if (inventoryActionLoading) {
      return;
    }
    if (dbUser?.role !== "admin") {
      showToast("Bu işlemi yalnızca yönetici yapabilir.", "error");
      return;
    }
    if (!inventory?.id) {
      showToast("Geçerli sayım kaydı bulunamadı.", "error");
      return;
    }
    if (!isInventoryPending(inventory)) {
      showToast("Bu sayım zaten sonuçlandırılmış.", "error");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Bu sayımı reddetmek istediğinizden emin misiniz? Stok değişmeyecek."
      )
    ) {
      return;
    }
    try {
      setInventoryActionLoading(true);
      await updateDoc(doc(getPublicCollection("inventoryCounts"), inventory.id), {
        status: "REJECTED",
        applied: false,
        rejectedByUid: dbUser?.uid || "",
        rejectedByName: dbUser?.name || "Yönetici",
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      showToast("Sayım reddedildi. Stokta değişiklik yapılmadı.", "success");
    } catch (error) {
      console.error("Sayım reddetme hatası:", error);
      showToast("Sayım reddedilemedi.", "error");
    } finally {
      setInventoryActionLoading(false);
    }
  };

  /*

  =========================================

  ÜRÜN ARA / OKUT

  =========================================
  */

  const handleScanSuccess = (decodedText) => {
    setIsScannerOpen(false);
    const cleanCode = String(decodedText || "").trim();
    if (!cleanCode) {
      showToast("Geçerli bir barkod okunamadı.", "error");
      return;
    }
    const reference = parseProductReference(cleanCode);
    const foundProduct = products.find((product) => {
      const productCode = String(
        product.qrNo || product.barcode || product.barcodeNo || ""
      ).trim();
      return product.id === reference.productId || productCode === reference.barcode;
    });
    if (foundProduct) {
      setSelectedProduct(foundProduct);
      setCurrentView("product_detail");
      showToast("Ürün bulundu.", "success");
      return;
    }
    if (reference.productId) {
      showToast("Bu QR bağlantısına ait ürün bulunamadı.", "error");
      return;
    }
    setSelectedProduct(null);
    setScannedBarcodeForAdd(reference.barcode);
    setCurrentView("admin_add");
    showToast(
      "Bu barkod sistemde kayıtlı değil. Yeni ürün olarak ekleyebilirsiniz.",
      "success"
    );
  };

  /*

  =========================================

  YENİ ÜRÜN BARKOD OKUT

  =========================================
  */

  const handleAddScan = (decodedText) => {
    setIsAddScannerOpen(false);
    const cleanCode = String(decodedText || "").trim();
    if (!cleanCode) {
      showToast("Geçerli bir barkod okunamadı.", "error");
      return;
    }
    const reference = parseProductReference(cleanCode);
    const foundProduct = products.find((product) => {
      const productCode = String(
        product.qrNo || product.barcode || product.barcodeNo || ""
      ).trim();
      return product.id === reference.productId || productCode === reference.barcode;
    });
    if (foundProduct) {
      setSelectedProduct(foundProduct);
      setCurrentView("product_detail");
      showToast("Bu barkod zaten kayıtlı. Ürün detayları açıldı.", "success");
      return;
    }
    if (reference.productId) {
      showToast("Bu QR bağlantısına ait ürün bulunamadı.", "error");
      return;
    }
    setScannedBarcodeForAdd(reference.barcode);
    setCurrentView("admin_add");
    showToast("Barkod okundu. Ürün bilgilerini tamamlayın.", "success");
  };

  /*

  =========================================

  ÜRÜN DETAY

  =========================================
  */

  const handleOpenProduct = (product) => {
    setSelectedProduct(product);
    setCurrentView("product_detail");
  };

  /*

  =========================================

  ETİKET MERKEZİ

  =========================================
  */

  const handleOpenPrintCenter = (product = null) => {
    setPrintProduct(product);
    setCurrentView("print_center");
  };

  /*

  =========================================

  ANA SAYFAYA DÖN

  =========================================
  */

  const handleBackToDashboard = () => {
    setSelectedProduct(null);
    setScannedBarcodeForAdd("");
    setCurrentView("dashboard");
  };

  /*

  =========================================

  ÇIKIŞ

  =========================================
  */

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveCompanyId("");
      window.localStorage.removeItem("envantra_active_company_id");
      setCompany(null);
      setCompanies([]);
      setCurrentView("dashboard");
      setSelectedProduct(null);
      setIsScannerOpen(false);
      setIsAddScannerOpen(false);
      setDbUser(null);
      setUser(null);
      showToast("Çıkış yapıldı.", "success");
    } catch (error) {
      console.error("Çıkış hatası:", error);
      showToast("Çıkış yapılamadı.", "error");
    }
  };

  /*

  =========================================

  İLK AÇILIŞ İZİN EKRANI

  =========================================
  */

  if (permissionsSetupCompleted === null) {
    return <AppLoadingScreen message="Uygulama hazırlanıyor..." />;
  }

  if (!permissionsSetupCompleted) {
    return (
      <PermissionsSetupView
        onComplete={() => {
          setPermissionsSetupCompleted(true);
        }}
      />
    );
  }

  /*

  =========================================

  YÜKLENİYOR

  =========================================
  */

  if (isAuthLoading) {
    return <AppLoadingScreen message="Güvenli oturumunuz yükleniyor..." />;
  }

  /*

  =========================================

  AUTH HATASI

  =========================================
  */

  if (!user) {
    return <GoogleSignInView loading={googleSignInLoading} error={googleSignInError} onSignIn={handleGoogleSignIn} onEmailAuth={handleEmailAuth} onPasswordReset={handlePasswordReset} />;
  }

  /*

  =========================================

  PROFİL YOK

  =========================================
  */

  if (!dbUser || googleProfileReviewRequired) {
    return (
      <>
        {toast && <Toast toast={toast} />}
        <ProfileSetupView
          onSetup={handleCreateProfile}
          showToast={showToast}
          initialName={dbUser?.name || user.displayName || ""}
          initialRole={dbUser?.role || "staff"}
        />
      </>
    );
  }

  if (companyLoading && companies.length === 0 && !companyError) {
    return <AppLoadingScreen message="İşletmeniz ve stoklarınız yükleniyor..." />;
  }

  if (!company) {
    return <CompanyOnboardingView companies={companies} loading={companyLoading} error={companyError} invitePending={Boolean(pendingInviteToken && companyLoading)} onSelect={handleSelectCompany} onCreate={(name) => runCompanyOperation("create", name)} onJoin={(code) => runCompanyOperation("join", code)} />;
  }

  /*

  =========================================

  UYGULAMA

  =========================================
  */

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {toast && <Toast toast={toast} />}
      
      {/* QR ÜRÜN ARA */}
      {isScannerOpen && (
        <QRScannerModal
          title="Ürün Ara / Okut"
          onClose={() => setIsScannerOpen(false)}
          onScan={handleScanSuccess}
        />
      )}
      
      {/* QR YENİ ÜRÜN */}
      {isAddScannerOpen && (
        <QRScannerModal
          title="Barkod Okutarak Ekle"
          onClose={() => setIsAddScannerOpen(false)}
          onScan={handleAddScan}
        />
      )}
      
      {/* DASHBOARD */}
      {currentView === "dashboard" && (
        <Dashboard
          dbUser={dbUser}
          products={products}
          batches={batches}
          notifications={unreadNotifications}
          transactions={transactions}
          inventoryCounts={inventoryCounts}
          onOpenProduct={handleOpenProduct}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenAddScanner={() => setIsAddScannerOpen(true)}
          onOpenInventory={() => setCurrentView("inventory")}
          onOpenHistory={() => setCurrentView("inventory_history")}
          onOpenReports={() => setCurrentView("reports")}
          onOpenNotifications={() => setCurrentView("notifications")}
          onOpenProfile={() => setCurrentView("profile")}
          onOpenPrintCenter={handleOpenPrintCenter}
        />
      )}
      
      {/* BİLDİRİMLER */}
      {currentView === "notifications" && (
        <NotificationsView
          notifications={activeNotifications}
          readNotificationIds={readNotificationIds}
          onMarkAsRead={handleMarkNotificationAsRead}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onOpenProduct={handleOpenProductFromNotification}
          onBack={handleBackToDashboard}
        />
      )}
      
      {/* STOK SAYIMI */}
      {currentView === "inventory" && (
        <InventoryView
          products={products}
          batches={batches}
          dbUser={dbUser}
          onBack={handleBackToDashboard}
          showToast={showToast}
        />
      )}
      
      {/* SAYIM GEÇMİŞİ */}
      {currentView === "inventory_history" && (
        <InventoryHistoryView
          inventoryCounts={inventoryCounts}
          dbUser={dbUser}
          onBack={handleBackToDashboard}
          onApplyInventory={handleApplyInventory}
          onRejectInventory={handleRejectInventory}
        />
      )}

      {currentView === "reports" && (
        <ReportsView
          products={products}
          batches={batches}
          transactions={transactions}
          inventoryCounts={inventoryCounts}
          onBack={handleBackToDashboard}
        />
      )}
      
      {/* YENİ ÜRÜN */}
      {currentView === "admin_add" && (
        <AdminAddProductView
          scannedBarcode={scannedBarcodeForAdd}
          onBack={handleBackToDashboard}
          showToast={showToast}
        />
      )}
      
      {/* ÜRÜN DETAY */}
      {currentView === "product_detail" && selectedProduct && (
        <ProductDetailView
          product={selectedProduct}
          batches={batches.filter((batch) => batch.productId === selectedProduct.id)}
          transactions={transactions.filter(
            (transaction) => transaction.productId === selectedProduct.id
          )}
          dbUser={dbUser}
          onBack={handleBackToDashboard}
          showToast={showToast}
          onPrintLabel={() => handleOpenPrintCenter(selectedProduct)}
        />
      )}

      {/* ETİKET MERKEZİ */}
      {currentView === "print_center" && (
        <PrintCenterView
          product={printProduct}
          products={products}
          batches={batches}
          onBack={() => {
            setPrintProduct(null);
            setCurrentView("dashboard");
          }}
          showToast={showToast}
        />
      )}
      
      {/* PROFİL */}
      {currentView === "profile" && (
        <ProfileScreen
          dbUser={dbUser}
          company={company}
          companies={companies}
          notificationStatus={notificationStatus}
          notificationLoading={notificationLoading}
          onEnableNotifications={handleEnableNotifications}
          onBack={handleBackToDashboard}
          onSwitchCompany={() => activateCompany(null)}
          onManageCompany={() => setCurrentView("company_access")}
          onLogout={handleLogout}
        />
      )}
      {currentView === "company_access" && (
        <CompanyAccessView company={company} user={user} onBack={() => setCurrentView("profile")} showToast={showToast} />
      )}
    </div>
  );
}

/*

=========================================

TOAST

=========================================
*/

function Toast({ toast }) {
  const isError = toast.type === "error";

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">
      <div
        className={`px-5 py-4 rounded-2xl shadow-2xl border text-sm font-bold text-white ${
          isError ? "bg-red-600 border-red-500" : "bg-green-600 border-green-500"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}

/*

=========================================

PROFİL

=========================================
*/

function ProfileScreen({
  dbUser,
  company,
  companies,
  notificationStatus,
  notificationLoading,
  onEnableNotifications,
  onBack,
  onSwitchCompany,
  onManageCompany,
  onLogout,
}) {
  const notificationsEnabled = notificationStatus === "granted";

  return (
    <div className="flex flex-col h-full">
      <header className="p-6 bg-gray-900 border-b border-gray-800">
        <button
          type="button"
          onClick={onBack}
          className="text-blue-400 text-sm font-bold mb-5"
        >
          ← Ana Sayfa
        </button>
        <h1 className="text-2xl font-black text-white">Profil</h1>
      </header>
      
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
          <div className="w-20 h-20 mx-auto bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center text-blue-400 text-3xl font-black">
            {dbUser?.name?.charAt(0)?.toLocaleUpperCase("tr-TR") || "K"}
          </div>
          <h2 className="text-2xl font-black text-white mt-5">{dbUser?.name}</h2>
          <span className="inline-block mt-3 px-4 py-1.5 bg-gray-950 border border-gray-800 rounded-full text-xs text-blue-400 font-bold uppercase">
            {dbUser?.tenantRole === "OWNER" ? "İşletme sahibi" : dbUser?.tenantRole === "ADMIN" ? "Yönetici" : "Personel"}
          </span>
        </div>

        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-black text-lg">Aktif İşletme</h3>
          <p className="mt-2 text-sm text-gray-500">{company?.name} · {dbUser?.tenantRole || "PERSONNEL"}</p>
          {(dbUser?.tenantRole === "OWNER" || dbUser?.tenantRole === "ADMIN") && <button type="button" onClick={onManageCompany} className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white">Personel ve Davet Yönetimi</button>}
          <button type="button" onClick={onSwitchCompany} className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950 py-3 font-bold text-gray-300">{companies?.length > 1 ? "İşletme Değiştir veya Ekle" : "İşletme Ekle veya Katıl"}</button>
        </div>
        
        {/* BİLDİRİMLER */}
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-black text-lg">Telefon Bildirimleri</h3>
          <p className="text-gray-500 text-sm mt-2 leading-6">
            SKT ve kritik stok uyarılarını telefonunuza alın.
          </p>
          {notificationsEnabled ? (
            <div className="mt-5 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-400 font-bold">✓ Bildirimler Etkin</p>
              <p className="text-gray-500 text-xs mt-2">
                Bu cihaz push bildirimleri almak için kayıtlı.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={onEnableNotifications}
              disabled={notificationLoading}
              className="w-full mt-5 bg-blue-600 disabled:bg-gray-700 text-white font-black py-4 rounded-xl"
            >
              {notificationLoading
                ? "Bildirimler Etkinleştiriliyor..."
                : "Bildirimleri Etkinleştir"}
            </button>
          )}
          {notificationStatus === "denied" && (
            <p className="text-red-400 text-xs mt-3">
              Bildirim izni engellenmiş. Tarayıcı site ayarlarından bildirim iznini açmanız gerekiyor.
            </p>
          )}
          {notificationStatus === "unsupported" && (
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
