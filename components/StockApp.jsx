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

export const getPublicCollection = (collectionName) =>
  collection(
    db,
    "artifacts",
    appId,
    "public",
    "data",
    collectionName
  );

export default function StockApp() {
  // Kullanıcı
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Firestore verileri
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Sayfa yönetimi
  const [currentView, setCurrentView] = useState("dashboard");

  // Seçili ürün
  const [selectedProduct, setSelectedProduct] = useState(null);

  // QR ile okutulan yeni barkod
  const [scannedBarcode, setScannedBarcode] = useState("");

  // Bildirim mesajı
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
  | FIREBASE AUTH
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

    return ()
