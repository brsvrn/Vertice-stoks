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

const getPublicCollection = (collectionName) =>
  collection(
    db,
    "artifacts",
    appId,
    "public",
    "data",
    collectionName
  );

export default function StockApp() {
  // Authentication
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Firestore Data
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Navigation
  const [currentView, setCurrentView] = useState("dashboard");

  // Selected Product
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Global UI
  const [toast, setToast] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | TOAST
  |--------------------------------------------------------------------------
  */

  const showToast = (message, type = "success") => {
    setToast({
      message,
      type,
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  /*
  |--------------------------------------------------------------------------
  | FIREBASE AUTHENTICATION
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let unsubscribeAuth;

    const initializeAuthentication = async () => {
      try {
        unsubscribeAuth = onAuthStateChanged(
          auth,
          async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
              try {
                const userReference = doc(
                  getPublicCollection("users"),
                  currentUser.uid
                );

                const userSnapshot = await getDoc(userReference);

                if (userSnapshot.exists()) {
                  setDbUser(userSnapshot.data());
                } else {
                  setDbUser(null);
                }
              } catch (error) {
                console.error(
                  "Kullanıcı bilgileri alınamadı:",
                  error
                );

                setDbUser(null);
              }
            } else {
              setDbUser(null);
            }

            setIsAuthLoading(false);
          }
        );

        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error(
          "Firebase Authentication hatası:",
          error
        );

        setIsAuthLoading(false);
      }
    };

    initializeAuthentication();

    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | FIRESTORE REALTIME LISTENERS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!user || !dbUser) {
      return;
    }

    const unsubscribeProducts = onSnapshot(
      getPublicCollection("products"),
      (snapshot) => {
        const productList = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...document.data(),
          })
        );

        setProducts(productList);
      },
      (error) => {
        console.error(
          "Ürünler alınamadı:",
          error
        );
      }
    );

    const unsubscribeBatches = onSnapshot(
      getPublicCollection("batches"),
      (snapshot) => {
        const batchList = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...document.data(),
          })
        );

        setBatches(batchList);
      },
      (error) => {
        console.error(
          "Partiler alınamadı:",
          error
        );
      }
    );

    const unsubscribeTransactions = onSnapshot(
      getPublicCollection("transactions"),
      (snapshot) => {
        const transactionList =
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }));

        transactionList.sort(
          (a, b) =>
            new Date(b.date || 0) -
            new Date(a.date || 0)
        );

        setTransactions(transactionList);
      },
      (error) => {
        console.error(
          "Stok hareketleri alınamadı:",
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
  |--------------------------------------------------------------------------
  | PROFILE CREATION
  |--------------------------------------------------------------------------
  */

  const handleCreateProfile = async (
    name,
    role
  ) => {
    if (!user) {
      return;
    }

    try {
      const userData = {
        uid: user.uid,
        name: name.trim(),
        role,
        createdAt: new Date().toISOString(),
      };

      await setDoc(
        doc(
          getPublicCollection("users"),
          user.uid
        ),
        userData
      );

      setDbUser(userData);

      showToast(
        `Hoş geldin, ${name}!`
      );
    } catch (error) {
      console.error(
        "Profil oluşturulamadı:",
        error
      );

      showToast(
        "Profil oluşturulurken hata oluştu.",
        "error"
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  const handleLogout = async () => {
    try {
      await signOut(auth);

      setDbUser(null);
      setProducts([]);
      setBatches([]);
      setTransactions([]);

      setCurrentView("dashboard");
    } catch (error) {
      console.error(
        "Çıkış yapılamadı:",
        error
      );

      showToast(
        "Çıkış yapılırken hata oluştu.",
        "error"
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | NOTIFICATIONS
  |--------------------------------------------------------------------------
  */

  const activeNotifications =
    useMemo(() => {
      const notifications = [];

      products.forEach((product) => {
        const totalStock = batches
          .filter(
            (batch) =>
              batch.productId === product.id
          )
          .reduce(
            (total, batch) =>
              total +
              Number(batch.quantity || 0),
            0
          );

        if (
          totalStock <=
          Number(product.minStock || 0)
        ) {
          notifications.push({
            id: `stock-${product.id}`,
            type: "CRITICAL",
            title: "Kritik Stok",
            message:
              `${product.name} kritik stok seviyesinde. ` +
              `Mevcut: ${totalStock} / Minimum: ${product.minStock}`,
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

        const expiryDate =
          new Date(batch.expiryDate);

        const today = new Date();

        today.setHours(
          0,
          0,
          0,
          0
        );

        const difference =
          expiryDate.getTime() -
          today.getTime();

        const daysLeft = Math.ceil(
          difference /
            (1000 * 60 * 60 * 24)
        );

        const product =
          products.find(
            (item) =>
              item.id === batch.productId
          );

        const productName =
          product?.name ||
          "Bilinmeyen Ürün";

        if (daysLeft < 0) {
          notifications.push({
            id: `expired-${batch.id}`,
            type: "ERROR",
            title: "SKT Geçmiş",
            message:
              `${productName} ürününün ` +
              `${batch.batchNo || "-"} numaralı partisinin SKT'si geçmiş.`,
          });
        } else if (daysLeft <= 30) {
          notifications.push({
            id: `expiry-${batch.id}`,
            type: "WARNING",
            title: "SKT Yaklaşıyor",
            message:
              `${productName} ürününün SKT'sine ${daysLeft} gün kaldı.`,
          });
        }
      });

      return notifications;
    }, [
      products,
      batches,
    ]);

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Package
            size={48}
            className="mx-auto mb-4 text
