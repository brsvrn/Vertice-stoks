"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Package,
  Trash2,
  Filter,
} from "lucide-react";

export default function NotificationsView({
  notifications = [],
  readNotificationIds = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onOpenProduct,
  onBack,
}) {
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "CRITICAL", "WARNING", "INFO"

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "CRITICAL") return notifications.filter(n => n.type === "CRITICAL" || n.type === "ERROR");
    if (activeFilter === "WARNING") return notifications.filter(n => n.type === "WARNING");
    return notifications.filter(n => n.type !== "CRITICAL" && n.type !== "ERROR" && n.type !== "WARNING");
  }, [notifications, activeFilter]);

  const unreadNotifications = useMemo(() => {
    return filteredNotifications.filter((n) => !readNotificationIds.includes(n.id));
  }, [filteredNotifications, readNotificationIds]);

  const readNotifications = useMemo(() => {
    return filteredNotifications.filter((n) => readNotificationIds.includes(n.id));
  }, [filteredNotifications, readNotificationIds]);

  const getNotificationStyle = (notification) => {
    if (notification.type === "CRITICAL" || notification.type === "ERROR") {
      return {
        container: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30",
        iconContainer: "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400",
        title: "text-rose-600 dark:text-rose-400",
        badge: "bg-rose-500 text-white"
      };
    }
    if (notification.type === "WARNING") {
      return {
        container: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
        iconContainer: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
        title: "text-amber-600 dark:text-amber-400",
        badge: "bg-amber-500 text-white"
      };
    }
    return {
      container: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",
      iconContainer: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
      title: "text-blue-600 dark:text-blue-400",
      badge: "bg-blue-500 text-white"
    };
  };

  const getNotificationIcon = (notification) => {
    if (notification.type === "WARNING") return <Clock size={20} />;
    if (notification.type === "CRITICAL" || notification.type === "ERROR") return <AlertTriangle size={20} />;
    return <Bell size={20} />;
  };

  const NotificationCard = ({ notification, isRead }) => {
    const style = getNotificationStyle(notification);

    return (
      <div className={`rounded-2xl p-4 transition-all border ${isRead ? "bg-[var(--surface)] border-[var(--border)] opacity-70" : style.container + " shadow-sm"}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${isRead ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : style.iconContainer}`}>
            {isRead ? <Check size={22} /> : getNotificationIcon(notification)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={`font-black text-sm ${isRead ? "text-[var(--foreground)]" : style.title}`}>
                  {notification.title}
                </h3>
                {!isRead && (
                  <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                    Yeni
                  </span>
                )}
              </div>
              {isRead && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Okundu</span>}
            </div>

            <p className={`text-sm mt-2 leading-relaxed ${isRead ? 'text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
              {notification.message}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              {notification.productId && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAsRead?.(notification.id);
                    onOpenProduct?.(notification.productId);
                  }}
                  className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-[var(--border)] text-blue-600 dark:text-blue-400 text-xs font-bold px-3 py-2 rounded-xl shadow-sm"
                >
                  <Package size={14} /> Ürünü Gör
                </button>
              )}
              {!isRead && (
                <button
                  type="button"
                  onClick={() => onMarkAsRead?.(notification.id)}
                  className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 text-xs font-bold px-3 py-2 rounded-xl shadow-sm"
                >
                  <Check size={14} /> Okundu Yap
                </button>
              )}
              {onDeleteNotification && (
                <button
                  type="button"
                  onClick={() => onDeleteNotification(notification.id)}
                  className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold px-3 py-2 rounded-xl shadow-sm"
                >
                  <Trash2 size={14} /> Gizle
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filters = [
    { id: "all", label: "Tümü" },
    { id: "CRITICAL", label: "Kritik" },
    { id: "WARNING", label: "Uyarı" },
    { id: "INFO", label: "Sistem" }
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--background)] text-[var(--foreground)]">
      {/* HEADER */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)] pt-5 pb-3 shadow-sm">
        <div className="px-5 flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="w-11 h-11 shrink-0 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors rounded-xl flex items-center justify-center active:scale-95"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 className="text-xl font-black text-[var(--foreground)]">Akıllı Uyarılar</h1>
              <p className="text-slate-500 text-xs mt-1 font-medium">{unreadNotifications.length} okunmamış bildirim</p>
            </div>
          </div>

          {unreadNotifications.length > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="h-11 px-4 shrink-0 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 rounded-xl flex items-center gap-2 font-bold text-sm transition-colors shadow-sm"
              title="Tümünü okundu yap"
            >
              <CheckCheck size={18} />
              <span className="hidden sm:inline">Tümünü Oku</span>
            </button>
          )}
        </div>
        
        <div className="px-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                activeFilter === f.id
                  ? "bg-[var(--foreground)] text-[var(--background)] border-transparent shadow-md"
                  : "bg-[var(--surface)] text-slate-500 border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* İÇERİK */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {/* BİLDİRİM YOK */}
        {filteredNotifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
              <Bell size={32} className="text-slate-400" />
            </div>
            <h2 className="text-[var(--foreground)] font-black text-lg">Bildirim Yok</h2>
            <p className="text-slate-500 text-sm mt-2 max-w-[260px] leading-relaxed">
              {activeFilter === "all" 
                ? "Şu anda kritik stok veya yaklaşan son kullanma tarihi bildirimi bulunmuyor."
                : "Bu filtreye uygun bildirim bulunamadı."}
            </p>
          </div>
        )}

        {/* OKUNMAMIŞ */}
        {unreadNotifications.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xs font-black uppercase tracking-widest text-rose-500">Yeni Bildirimler</h2>
              <span className="text-[10px] font-black text-white bg-rose-500 px-2.5 py-1 rounded-full shadow-sm">{unreadNotifications.length}</span>
            </div>
            <div className="space-y-3">
              {unreadNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} isRead={false} />
              ))}
            </div>
          </section>
        )}

        {/* OKUNMUŞ */}
        {readNotifications.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4 px-1">
              <CheckCheck size={16} className="text-slate-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Okunan Bildirimler</h2>
            </div>
            <div className="space-y-3">
              {readNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} isRead={true} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
