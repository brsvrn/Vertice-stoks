"use client";

import { useState } from "react";
import {
  Package,
  Lock,
  User,
  ShieldCheck,
} from "lucide-react";

export default function ProfileSetupView({
  onSetup,
  showToast,
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [adminPin, setAdminPin] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // Geçici yönetici PIN'i.
  // Daha sonra Firebase tabanlı yetkilendirmeye taşıyacağız.
  const ADMIN_SECRET_PIN = "1453";

  const handleRegister = async () => {
    const cleanName = name.trim();

    if (!cleanName) {
      showToast(
        "Lütfen adınızı ve soyadınızı girin.",
        "error"
      );
      return;
    }

    if (
      role === "admin" &&
      adminPin !== ADMIN_SECRET_PIN
    ) {
      showToast(
        "Yönetici PIN kodu hatalı.",
        "error"
      );
      return;
    }

    try {
      setIsSubmitting(true);

      await onSetup(
        cleanName,
        role
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-gray-950 text-white flex items-center justify-center p-6">

      <div className="w-full max-w-md">

        {/* Logo */}

        <div className="flex flex-col items-center mb-10">

          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-blue-900/30">

            <Package size={40} />

          </div>

          <h1 className="text-3xl font-black text-center">
            Vertice Stok
          </h1>

          <p className="text-gray-500 text-sm mt-2 text-center">
            Stok ve envanter yönetim sistemi
          </p>

        </div>

        {/* Form */}

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">

          <h2 className="text-xl font-bold mb-2">
            Profil Oluştur
          </h2>

          <p className="text-gray-500 text-sm mb-6">
            Sisteme devam etmek için kullanıcı bilgilerinizi girin.
          </p>

          {/* Name */}

          <div className="mb-5">

            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
              Ad Soyad
            </label>

            <div className="relative">

              <User
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600"
              />

              <input
                type="text"
                placeholder="Adınız Soyadınız"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-blue-500 transition-colors"
              />

            </div>

          </div>

          {/* Role */}

          <div className="mb-5">

            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
              Kullanıcı Rolü
            </label>

            <div className="grid grid-cols-2 gap-3">

              <button
                type="button"
                onClick={() => {
                  setRole("staff");
                  setAdminPin("");
                }}
                className={`py-4 rounded-2xl border-2 font-bold transition-all ${
                  role === "staff"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-gray-950 border-gray-800 text-gray-500"
                }`}
              >
                <User
                  size={22}
                  className="mx-auto mb-2"
                />

                Personel
              </button>

              <button
                type="button"
                onClick={() =>
                  setRole("admin")
                }
                className={`py-4 rounded-2xl border-2 font-bold transition-all ${
                  role === "admin"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-gray-950 border-gray-800 text-gray-500"
                }`}
              >
                <ShieldCheck
                  size={22}
                  className="mx-auto mb-2"
                />

                Yönetici
              </button>

            </div>

          </div>

          {/* Admin PIN */}

          {role === "admin" && (

            <div className="mb-5">

              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">
                Yönetici PIN
              </label>

              <div className="relative">

                <Lock
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600"
                />

                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="Yönetici PIN kodu"
                  value={adminPin}
                  onChange={(event) =>
                    setAdminPin(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter"
                    ) {
                      handleRegister();
                    }
                  }}
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-blue-500 transition-colors font-mono tracking-widest"
                />

              </div>

              <p className="text-[11px] text-gray-600 mt-2">
                Yönetici hesabı oluşturmak için yetkili PIN kodu gereklidir.
              </p>

            </div>

          )}

          {/* Submit */}

          <button
            type="button"
            onClick={
              handleRegister
            }
            disabled={
              isSubmitting ||
              !name.trim() ||
              (role === "admin" &&
                !adminPin)
            }
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98]"
          >

            {isSubmitting
              ? "Profil Oluşturuluyor..."
              : "Sisteme Giriş Yap"}

          </button>

        </div>

        <p className="text-center text-gray-700 text-[11px] mt-6">
          Vertice Stok Yönetim Sistemi
        </p>

      </div>

    </main>
 
