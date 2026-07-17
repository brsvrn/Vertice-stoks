"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

import Dashboard from "./Dashboard";
import ProfileSetupView from "./ProfileSetupView";
import AdminAddProductView from "./AdminAddProductView";
import ProductDetailView from "./ProductDetailView";

export default function StockApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    let unsubscribeAuth;

    const initializeAuth = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        unsubscribeAuth = onAuthStateChanged(
          auth,
          (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
          },
          (error) => {
            console.error("Auth state error:", error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Auth initialization error:", error);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const productsQuery = query(
      collection(db, "products")
    );

    const unsubscribeProducts = onSnapshot(
      productsQuery,
      (snapshot) => {
        const productList = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setProducts(productList);
      },
      (error) => {
        console.error("Products error:", error);
      }
    );

    return () => {
      unsubscribeProducts();
    };
  }, [user]);

  const handleProfileCreated = (newProfile) => {
    setProfile(newProfile);
    setActiveView("dashboard");
  };

  const handleNavigate = (view) => {
    setActiveView(view);
    setSelectedProduct(null);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setActiveView("product-detail");
  };

  const handleBackToDashboard = () => {
    setSelectedProduct(null);
    setActiveView("dashboard");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />

          <h1 className="text-xl font-bold">
            Vertice Stok
          </h1>

          <p className="text-slate-400 mt-2">
            Sistem yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-2xl font-bold">
            Vertice Stok
          </h1>

          <p className="text-slate-400 mt-3">
            Firebase bağlantısı kurulamadı.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl"
          >
            Tekrar Dene
          </button>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <ProfileSetupView
        user={user}
        onProfileCreated={handleProfileCreated}
      />
    );
  }

  if (activeView === "add-product") {
    return (
      <AdminAddProductView
        user={user}
        profile={profile}
        onBack={handleBackToDashboard}
        onProductAdded={handleBackToDashboard}
      />
    );
  }

  if (
    activeView === "product-detail" &&
    selectedProduct
  ) {
    return (
      <ProductDetailView
        user={user}
        profile={profile}
        product={selectedProduct}
        onBack={handleBackToDashboard}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      profile={profile}
      products={products}
      onNavigate={handleNavigate}
      onSelectProduct={handleSelectProduct}
    />
  );
}
