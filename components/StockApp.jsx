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

/*
|--------------------------------------------------------------------------
| FIRESTORE COLLECTION
|--------------------------------------------------------------------------
*/

export const getPublicCollection = (collectionName) =>
  collection(
    db,
    "artifacts",
    appId,
    "public",
    "data",
    collectionName
  );

/*
|--------------------------------------------------------------------------
| ANA UYGULAMA
|--------------------------------------------------------------------------
*/

export default function StockApp() {
  /*
  |--------------------------------------------------------------------------
  | USER STATE
  |--------------------------------------------------------------------------
  */

  const [user, setUser] = useState(null);

  const [dbUser, setDbUser] =
    useState(null);

  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  /*
  |--------------------------------------------------------------------------
  | FIRESTORE DATA
  |--------------------------------------------------------------------------
  */

  const [products, setProducts] =
    useState([]);

  const [batches, setBatches] =
    useState([]);

  const [
    transactions,
    setTransactions,
  ] = useState([]);

  /*
  |--------------------------------------------------------------------------
  | UI STATE
  |--------------------------------------------------------------------------
  */

  const [
    currentView,
    setCurrentView,
  ] = useState("dashboard");

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState(null);

  const [
    scannedBarcode,
    setScannedBarcode,
  ] = useState("");

  const [toast, setToast] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | TOAST
  |--------------------------------------------------------------------------
  */

  const showToast = (
    message,
    type = "success"
  ) => {
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

    const initializeAuthentication =
      async () => {
        try {
          unsubscribeAuth =
            onAuthStateChanged(
