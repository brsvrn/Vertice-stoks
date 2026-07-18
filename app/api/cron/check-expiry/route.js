import { NextResponse } from "next/server";

import {
  getAdminDb,
  getAdminMessaging,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ID = "G-ZXHYS9KH9T";

/*
 * FIRESTORE COLLECTION
 */
function getDataCollection(
  db,
  collectionName
) {
  return db
    .collection("artifacts")
    .doc(APP_ID)
    .collection("public")
    .doc("data")
    .collection(collectionName);
}

/*
 * ANA CRON ENDPOINT
 */
export async function GET(request) {
  try {
    /*
     * CRON GÜVENLİK KONTROLÜ
     */
    const authHeader =
      request.headers.get(
        "authorization"
      );

    const cronSecret =
      process.env.CRON_SECRET;

    if (
      cronSecret &&
      authHeader !==
        `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Yetkisiz istek.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * FIREBASE ADMIN
     */
    const db = getAdminDb();

    const messaging =
      getAdminMessaging();

    /*
     * VERİLERİ AL
     */
    const [
      productsSnapshot,
      batchesSnapshot,
      devicesSnapshot,
    ] = await Promise.all([
      getDataCollection(
        db,
        "products"
      ).get(),

      getDataCollection(
        db,
        "batches"
      ).get(),

      getDataCollection(
        db,
        "devices"
      ).get(),
    ]);

    /*
     * ÜRÜNLER
     */
    const products =
      productsSnapshot.docs.map(
        (document) => ({
          id: document.id,
          ...document.data(),
        })
      );

    /*
     * PARTİLER
     */
    const batches =
      batchesSnapshot.docs.map(
        (document) => ({
          id: document.id,
          ...document.data(),
        })
      );

    /*
     * AKTİF CİHAZ TOKENLARI
     */
    const tokens =
      devicesSnapshot.docs
        .map(
          (document) =>
            document.data()
        )
        .filter(
          (device) =>
            device.notificationsEnabled ===
              true &&
            device.token
        )
        .map(
          (device) =>
            device.token
        );

    /*
     * AYNI TOKEN VARSA
     * TEK TOKEN OLARAK KULLAN
     */
    const uniqueTokens = [
      ...new Set(tokens),
    ];

    /*
     * AKTİF CİHAZ YOK
     */
    if (
      uniqueTokens.length === 0
    ) {
      return NextResponse.json({
        success: true,

        message:
          "Bildirim gönderilecek aktif cihaz bulunamadı.",

        notifications: 0,

        devices: 0,
      });
    }

    /*
     * GÖNDERİLECEK
     * BİLDİRİMLER
     */
    const notifications = [];

    /*
     * BUGÜN
     */
    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    /*
     * =====================================
     * SKT KONTROLÜ
     * =====================================
     */
    for (
      const batch of batches
    ) {
      const quantity =
        Number(
          batch.quantity || 0
        );

      /*
       * STOK YOKSA
       * SKT BİLDİRİMİ GÖNDERME
       */
      if (
        quantity <= 0 ||
        !batch.expiryDate
      ) {
        continue;
      }

      /*
       * SKT TARİHİ
       */
      const expiry =
        new Date(
          batch.expiryDate
        );

      /*
       * GEÇERSİZ TARİH
       */
      if (
        Number.isNaN(
          expiry.getTime()
        )
      ) {
        continue;
      }

      expiry.setHours(
        0,
        0,
        0,
        0
      );

      /*
       * KAÇ GÜN KALDI
       */
      const difference =
        expiry.getTime() -
        today.getTime();

      const daysLeft =
        Math.ceil(
          difference /
            (
              1000 *
              60 *
              60 *
              24
            )
        );

      /*
       * ÜRÜNÜ BUL
       */
      const product =
        products.find(
          (item) =>
            item.id ===
            batch.productId
        );

      const productName =
        product?.name ||
        "Bilinmeyen Ürün";

      /*
       * SKT GEÇTİ
       */
      if (
        daysLeft < 0
      ) {
        notifications.push({
          id:
            `expired-${batch.id}`,

          title:
            "⛔ SKT Geçti",

          body:
            `${productName} - ` +
            `Parti #${
              batch.batchNo ||
              "-"
            } ürününün ` +
            `son kullanma tarihi geçti.`,

          batchId:
            batch.id,

          productId:
            batch.productId,

          type:
            "EXPIRED",
        });

        continue;
      }

      /*
       * SKT BUGÜN
       */
      if (
        daysLeft === 0
      ) {
        notifications.push({
          id:
            `expiry-today-${batch.id}`,

          title:
            "🚨 SKT Bugün",

          body:
            `${productName} - ` +
            `Parti #${
              batch.batchNo ||
              "-"
            } ürününün ` +
            `son kullanma tarihi bugün.`,

          batchId:
            batch.id,

          productId:
            batch.productId,

          type:
            "EXPIRY_TODAY",
        });

        continue;
      }

      /*
       * SKT'YE
       * 3 GÜN VEYA DAHA AZ
       */
      if (
        daysLeft <= 3
      ) {
        notifications.push({
          id:
            `expiry-warning-${batch.id}`,

          title:
            "⚠️ SKT Yaklaşıyor",

          body:
            `${productName} - ` +
            `Parti #${
              batch.batchNo ||
              "-"
            } için ` +
            `son kullanma tarihine ` +
            `${daysLeft} gün kaldı.`,

          batchId:
            batch.id,

          productId:
            batch.productId,

          type:
            "EXPIRY_WARNING",
        });
      }
    }

    /*
     * =====================================
     * KRİTİK STOK KONTROLÜ
     * =====================================
     */
    for (
      const product
      of products
    ) {
      /*
       * ÜRÜNE AİT
       * TÜM PARTİLERİN STOKLARINI TOPLA
       */
      const totalStock =
        batches
          .filter(
            (batch) =>
              batch.productId ===
              product.id
          )
          .reduce(
            (
              total,
              batch
            ) =>
              total +
              Number(
                batch.quantity ||
                  0
              ),
            0
          );

      /*
       * MİNİMUM STOK
       */
      const minimumStock =
        Number(
          product.minStock ||
            0
        );

      /*
       * minStock TANIMLANMAMIŞSA
       * KRİTİK STOK KONTROLÜ YAPMA
       */
      if (
        minimumStock <= 0
      ) {
        continue;
      }

      /*
       * KRİTİK STOK
       */
      if (
        totalStock <=
        minimumStock
      ) {
        notifications.push({
          id:
            `critical-stock-${product.id}`,

          title:
            "🚨 Kritik Stok",

          body:
            `${
              product.name ||
              "Bilinmeyen Ürün"
            } kritik stok seviyesinde. ` +
            `Mevcut stok: ${totalStock}. ` +
            `Minimum stok: ${minimumStock}.`,

          productId:
            product.id,

          batchId:
            "",

          type:
            "CRITICAL_STOCK",
        });
      }
    }

    /*
     * BİLDİRİM YOK
     */
    if (
      notifications.length === 0
    ) {
      return NextResponse.json({
        success: true,

        message:
          "Gönderilecek bildirim bulunamadı.",

        notifications: 0,

        devices:
          uniqueTokens.length,
      });
    }

    /*
     * =====================================
     * PUSH BİLDİRİMLERİNİ GÖNDER
     * =====================================
     */
    let successCount = 0;

    let failureCount = 0;

    /*
     * HER BİLDİRİMİ
     * AKTİF CİHAZLARA GÖNDER
     */
    for (
      const notification
      of notifications
    ) {
      const response =
        await messaging
          .sendEachForMulticast({
            tokens:
              uniqueTokens,

            notification: {
              title:
                notification.title,

              body:
                notification.body,
            },

            data: {
              notificationId:
                notification.id,

              type:
                notification.type,

              productId:
                String(
                  notification.productId ||
                    ""
                ),

              batchId:
                String(
                  notification.batchId ||
                    ""
                ),

              url:
                "/",
            },

            webpush: {
              notification: {
                icon:
                  "/icon-192.png",

                badge:
                  "/icon-192.png",

                tag:
                  notification.id,
              },

              fcmOptions: {
                link:
                  "/",
              },
            },
          });

      successCount +=
        response.successCount;

      failureCount +=
        response.failureCount;
    }

    /*
     * SONUÇ
     */
    return NextResponse.json({
      success: true,

      message:
        "Otomatik stok ve SKT kontrolü tamamlandı.",

      detectedNotifications:
        notifications.length,

      devices:
        uniqueTokens.length,

      successCount,

      failureCount,
    });
  } catch (error) {
    /*
     * HATA
     */
    console.error(
      "Vertice Stok Cron hatası:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Bilinmeyen sunucu hatası.",
      },
      {
        status: 500,
      }
    );
  }
        }
