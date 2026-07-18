"use client";

import { useMemo } from "react";

import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Package,
  Trash2,
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
  /*
   * =====================================
   * OKUNMAMIŞ BİLDİRİMLER
   * =====================================
   */

  const unreadNotifications = useMemo(() => {
    return notifications.filter(
      (notification) =>
        !readNotificationIds.includes(
          notification.id
        )
    );
  }, [
    notifications,
    readNotificationIds,
  ]);

  /*
   * =====================================
   * OKUNMUŞ BİLDİRİMLER
   * =====================================
   */

  const readNotifications = useMemo(() => {
    return notifications.filter(
      (notification) =>
        readNotificationIds.includes(
          notification.id
        )
    );
  }, [
    notifications,
    readNotificationIds,
  ]);

  /*
   * =====================================
   * BİLDİRİM TİPİ
   * =====================================
   */

  const getNotificationStyle = (
    notification
  ) => {
    if (
      notification.type ===
        "CRITICAL" ||
      notification.type ===
        "ERROR"
    ) {
      return {
        container:
          "bg-red-500/10 border-red-500/30",
        iconContainer:
          "bg-red-500/10 border-red-500/30 text-red-400",
        title:
          "text-red-400",
      };
    }

    if (
      notification.type ===
      "WARNING"
    ) {
      return {
        container:
          "bg-orange-500/10 border-orange-500/30",
        iconContainer:
          "bg-orange-500/10 border-orange-500/30 text-orange-400",
        title:
          "text-orange-400",
      };
    }

    return {
      container:
        "bg-blue-500/10 border-blue-500/30",
      iconContainer:
        "bg-blue-500/10 border-blue-500/30 text-blue-400",
      title:
        "text-blue-400",
    };
  };

  /*
   * =====================================
   * BİLDİRİM İKONU
   * =====================================
   */

  const getNotificationIcon = (
    notification
  ) => {
    if (
      notification.type ===
      "WARNING"
    ) {
      return (
        <Clock size={22} />
      );
    }

    if (
      notification.type ===
        "CRITICAL" ||
      notification.type ===
        "ERROR"
    ) {
      return (
        <AlertTriangle
          size={22}
        />
      );
    }

    return (
      <Bell size={22} />
    );
  };

  /*
   * =====================================
   * BİLDİRİM KARTI
   * =====================================
   */

  const NotificationCard = ({
    notification,
    isRead,
  }) => {
    const style =
      getNotificationStyle(
        notification
      );

    return (
      <div
        className={`border rounded-2xl p-4 ${
          isRead
            ? "bg-gray-900 border-gray-800 opacity-60"
            : style.container
        }`}
      >
        <div className="flex items-start gap-3">

          {/* İKON */}

          <div
            className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center ${
              isRead
                ? "bg-gray-950 border-gray-800 text-gray-500"
                : style.iconContainer
            }`}
          >
            {isRead ? (
              <Check
                size={21}
              />
            ) : (
              getNotificationIcon(
                notification
              )
            )}
          </div>

          {/* İÇERİK */}

          <div className="flex-1 min-w-0">

            <div className="flex items-start justify-between gap-2">

              <div className="min-w-0">

                <h3
                  className={`font-black text-sm ${
                    isRead
                      ? "text-gray-400"
                      : style.title
                  }`}
                >
                  {
                    notification.title
                  }
                </h3>

                {!isRead && (
                  <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider text-white bg-red-500 px-2 py-0.5 rounded-full">
                    Yeni
                  </span>
                )}

              </div>

              {isRead && (
                <span className="text-[9px] text-gray-600 font-bold uppercase">
                  Okundu
                </span>
              )}

            </div>

            <p className="text-gray-400 text-sm mt-3 leading-6">
              {
                notification.message
              }
            </p>

            {/* BUTONLAR */}

            <div className="flex flex-wrap gap-2 mt-4">

              {notification.productId && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAsRead?.(
                      notification.id
                    );

                    onOpenProduct?.(
                      notification.productId
                    );
                  }}
                  className="flex items-center gap-2 bg-gray-950 border border-gray-800 text-blue-400 text-xs font-bold px-3 py-2 rounded-lg"
                >
                  <Package
                    size={15}
                  />

                  Ürünü Gör
                </button>
              )}

              {!isRead && (
                <button
                  type="button"
                  onClick={() =>
                    onMarkAsRead?.(
                      notification.id
                    )
                  }
                  className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold px-3 py-2 rounded-lg"
                >
                  <Check
                    size={15}
                  />

                  Okundu Yap
                </button>
              )}

              {onDeleteNotification && (
                <button
                  type="button"
                  onClick={() =>
                    onDeleteNotification(
                      notification.id
                    )
                  }
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold px-3 py-2 rounded-lg"
                >
                  <Trash2
                    size={15}
                  />

                  Gizle
                </button>
              )}

            </div>

          </div>

        </div>
      </div>
    );
  };

  /*
   * =====================================
   * EKRAN
   * =====================================
   */

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">

      {/* HEADER */}

      <header className="bg-gray-900 border-b border-gray-800 p-5">

        <div className="flex items-center justify-between gap-3">

          <div className="flex items-center gap-4">

            <button
              type="button"
              onClick={onBack}
              className="w-11 h-11 shrink-0 bg-gray-800 rounded-xl flex items-center justify-center active:scale-95"
            >
              <ArrowLeft
                size={22}
              />
            </button>

            <div>

              <h1 className="text-xl font-black text-white">
                Bildirimler
              </h1>

              <p className="text-gray-500 text-xs mt-1">
                {
                  unreadNotifications.length
                }{" "}
                okunmamış bildirim
              </p>

            </div>

          </div>

          {unreadNotifications.length >
            0 && (
            <button
              type="button"
              onClick={
                onMarkAllAsRead
              }
              className="w-11 h-11 shrink-0 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl flex items-center justify-center"
              title="Tümünü okundu yap"
            >
              <CheckCheck
                size={21}
              />
            </button>
          )}

        </div>

      </header>

      {/* İÇERİK */}

      <main className="flex-1 overflow-y-auto p-4 pb-10">

        {/* BİLDİRİM YOK */}

        {notifications.length ===
          0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">

            <div className="w-20 h-20 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center">

              <Bell
                size={35}
                className="text-gray-700"
              />

            </div>

            <h2 className="text-white font-black text-lg mt-5">
              Bildirim Yok
            </h2>

            <p className="text-gray-500 text-sm mt-2 max-w-[260px] leading-6">
              Şu anda kritik stok veya yaklaşan son kullanma tarihi bildirimi bulunmuyor.
            </p>

          </div>
        )}

        {/* OKUNMAMIŞ */}

        {unreadNotifications.length >
          0 && (
          <section>

            <div className="flex items-center justify-between mb-3 px-1">

              <h2 className="text-xs font-black uppercase tracking-widest text-red-400">
                Yeni Bildirimler
              </h2>

              <span className="text-[10px] font-black text-white bg-red-500 px-2 py-1 rounded-full">
                {
                  unreadNotifications.length
                }
              </span>

            </div>

            <div className="space-y-3">

              {unreadNotifications.map(
                (notification) => (
                  <NotificationCard
                    key={
                      notification.id
                    }
                    notification={
                      notification
                    }
                    isRead={
                      false
                    }
                  />
                )
              )}

            </div>

          </section>
        )}

        {/* OKUNMUŞ */}

        {readNotifications.length >
          0 && (
          <section
            className={
              unreadNotifications.length >
              0
                ? "mt-8"
                : ""
            }
          >

            <div className="flex items-center gap-2 mb-3 px-1">

              <CheckCheck
                size={16}
                className="text-gray-600"
              />

              <h2 className="text-xs font-black uppercase tracking-widest text-gray-600">
                Okunan Bildirimler
              </h2>

            </div>

            <div className="space-y-3">

              {readNotifications.map(
                (notification) => (
                  <NotificationCard
                    key={
                      notification.id
                    }
                    notification={
                      notification
                    }
                    isRead={
                      true
                    }
                  />
                )
              )}

            </div>

          </section>
        )}

      </main>

    </div>
  );
}
