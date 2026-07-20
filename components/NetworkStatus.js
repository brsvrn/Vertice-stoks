"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-xl flex items-center gap-2">
      <WifiOff size={15} />
      Çevrimdışısınız. Yeni işlemler bağlantı gelene kadar kaydedilemeyebilir.
    </div>
  );
}
