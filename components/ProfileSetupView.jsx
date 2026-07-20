"use client";

import { useState } from "react";
import { Package, Lock } from "lucide-react";

export default function ProfileSetupView({
  onSetup,
  showToast,
  initialName = "",
  initialRole = "staff",
}) {
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState(initialRole);
  const [adminPin, setAdminPin] = useState("");

  const handleRegister = async () => {
    const cleanName = name.trim();

    if (!cleanName) {
      showToast("Lütfen adınızı girin.", "error");
      return;
    }

    try {
      await onSetup(cleanName, role, adminPin);
    } catch (error) {
      console.error("Profil oluşturma hatası:", error);
      showToast("Profil oluşturulamadı.", "error");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-blue-900/30">
            <Package size={40} />
          </div>

          <h1 className="text-3xl font-bold mb-2">
            Stockera
          </h1>

          <p className="text-gray-400 text-sm leading-relaxed">
            Stok yönetim sistemine devam etmek için
            profilinizi oluşturun.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Adınız Soyadınız
            </label>

            <input
              type="text"
              placeholder="Adınızı ve soyadınızı girin"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-4 text-white placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-400 mb-2">
              Yetki Türü
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRole("staff");
                  setAdminPin("");
                }}
                className={`py-4 rounded-xl font-bold border-2 transition-all ${
                  role === "staff"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-gray-950 border-gray-800 text-gray-500"
                }`}
              >
                Personel
              </button>

              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`py-4 rounded-xl font-bold border-2 transition-all ${
                  role === "admin"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-gray-950 border-gray-800 text-gray-500"
                }`}
              >
                Yönetici
              </button>
            </div>
          </div>

          {role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Yönetici PIN Kodu
              </label>

              <div className="relative">
                <Lock
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN kodunu girin"
                  value={adminPin}
                  onChange={(event) =>
                    setAdminPin(event.target.value)
                  }
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-12 pr-4 py-4 text-white font-mono placeholder-gray-600 outline-none focus:border-blue-500"
                />
              </div>

              <p className="text-xs text-gray-600 mt-2">
                Yönetici hesabı oluşturmak için geçerli
                yönetici PIN kodu gereklidir.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleRegister}
            disabled={
              !name.trim() ||
              (role === "admin" && !adminPin)
            }
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98]"
          >
            Profili Oluştur
          </button>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Stockera Stok Yönetim Sistemi
        </p>
      </div>
    </main>
  );
}
