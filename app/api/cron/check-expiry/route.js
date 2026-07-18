import { NextResponse } from "next/server";

import {
  getAdminDb,
  getAdminMessaging,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ID = "G-ZXHYS9KH9T";

function getDataCollection(db, collectionName) {
  return db
    .collection("artifacts")
    .doc(APP_ID)
    .collection("public")
    .doc("data")
    .collection(collectionName);
}

/*
 * Firestore belge ID'sinde sorun çıkarabilecek
 * karakterleri temizler.
 */
function safeDocumentId(value) {
  return String(value || "")
    .replace(/\//g, "_")
    .replace(/\s+/g, "_");
}

/*
 * Bildirim daha önce gönderilmiş mi?
 */
async function notificationAlreadySent(
  logsCollection,
  notificationId
) {
  const logRef = logsCollection.doc(
    safeDocumentId(notificationId)
  );

  const snapshot = await logRef.get();

  return snapshot.exists;
}

/*
 * Bildirimi gönderilmiş olarak kaydet.
 */
async function saveNotificationLog(
  logsCollection,
  notification
) {
  const logRef = logsCollection.doc(
    safeDocumentId(notification.id)
  );

  await logRef.set({
    notificationId: notification.id,
    type: notification.type,

    productId:
      notification.productId || "",

    batchId:
      notification.batchId || "",

    title:
      notification.title || "",

    body:
      notification.body || "",

    sentAt:
      new Date().toISOString(),
  });
}

/*
 * Kritik stok alarm durumunu kontrol etmek için
 * ayrı bir state kaydı kullanıyoruz.
 */
function getCriticalStateRef(
  logsCollection,
  productId
) {
  return logsCollection.doc(
    safeDocumentId(
      `critical-state-${productId}`
    )
  );
}

export async function GET(request) {
  try {
    /*
     * =====================================
     * CRON GÜVENLİĞİ
     * =====================================
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
     * =====================================
     * FIREBASE
     * =====================================
     */

    const db = getAdminDb();

    const messaging =
      getAdminMessaging();

    const productsCollection =
      getDataCollection(
        db,
        "products"
      );

    const batchesCollection =
      getDataCollection(
        db,
        "batches"
      );

    const devicesCollection =
      getDataCollection(
        db,
        "devices"
      );

    const logsCollection =
      getDataCollection(
        db,
        "notificationLogs"
      );

    /*
     * =====================================
     * VERİLERİ AL
     * =====================================
     */

    const [
      productsSnapshot,
      batchesSnapshot,
      devicesSnapshot,
    ] = await Promise.all([
      productsCollection.get(),
      batchesCollection.get(),
      devicesCollection.get(),
    ]);

    const products =
      productsSnapshot.docs.map(
        (document) => ({
          id: document.id,
          ...document.data(),
        })
      );

    const batches =
      batchesSnapshot.docs.map(
        (document) => ({
          id: document.id,
          ...document.data(),
        })
      );

    /*
     * =====================================
     * AKTİF CİHAZLAR
     * =====================================
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
     * Aynı token birden fazla kez
     * kayıtlıysa tekilleştir.
     */
    const uniqueTokens = [
      ...new Set(tokens),
    ];

    if (
      uniqueTokens.length === 0
    ) {
      return NextResponse.json({
        success: true,

        message:
          "Bildirim gönderilecek aktif cihaz bulunamadı.",

        detectedNotifications: 0,

        sentNotifications: 0,

        devices: 0,
      });
    }

    /*
     * =====================================
     * BİLDİRİM ADAYLARI
     * =====================================
     */

    const notificationCandidates =
      [];

    const today =
      new Date();

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
       * Stok yoksa SKT uyarısı verme.
       */
      if (
        quantity <= 0 ||
        !batch.expiryDate
      ) {
        continue;
      }

      const expiry =
        new Date(
          batch.expiryDate
        );

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
       *
       * Her parti için sadece bir kez.
       */
      if (
        daysLeft < 0
      ) {
        notificationCandidates.push({
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

          productId:
            batch.productId,

          batchId:
            batch.id,

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
        notificationCandidates.push({
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

          productId:
            batch.productId,

          batchId:
            batch.id,

          type:
            "EXPIRY_TODAY",
        });

        continue;
      }

      /*
       * 1 GÜN KALDI
       */
      if (
        daysLeft === 1
      ) {
        notificationCandidates.push({
          id:
            `expiry-1day-${batch.id}`,

          title:
            "🚨 SKT'ye 1 Gün Kaldı",

          body:
            `${productName} - ` +
            `Parti #${
              batch.batchNo ||
              "-"
            } için ` +
            `son kullanma tarihine ` +
            `1 gün kaldı.`,

          productId:
            batch.productId,

          batchId:
            batch.id,

          type:
            "EXPIRY_1_DAY",
        });

        continue;
      }

      /*
       * 3 GÜN KALDI
       *
       * Tam olarak 3 gün kala gönderilir.
       */
      if (
        daysLeft === 3
      ) {
        notificationCandidates.push({
          id:
            `expiry-3days-${batch.id}`,

          title:
            "⚠️ SKT Yaklaşıyor",

          body:
            `${productName} - ` +
            `Parti #${
              batch.batchNo ||
              "-"
            } için ` +
            `son kullanma tarihine ` +
            `3 gün kaldı.`,

          productId:
            batch.productId,

          batchId:
            batch.id,

          type:
            "EXPIRY_3_DAYS",
        });
      }
    }

    /*
     * =====================================
     * KRİTİK STOK KONTROLÜ
     * =====================================
     */

    for (
      const product of products
    ) {
      /*
       * Ürüne ait tüm partilerin
       * mevcut stoklarını topla.
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

      const minimumStock =
        Number(
          product.minStock ||
            0
        );

      /*
       * Minimum stok tanımlanmamışsa
       * kritik stok kontrolü yapma.
       */
      if (
        minimumStock <= 0
      ) {
        continue;
      }

      const criticalStateRef =
        getCriticalStateRef(
          logsCollection,
          product.id
        );

      const criticalStateSnapshot =
        await criticalStateRef.get();

      const previousState =
        criticalStateSnapshot.exists
          ? criticalStateSnapshot.data()
          : null;

      /*
       * ÜRÜN KRİTİK SEVİYEDE
       */
      if (
        totalStock <=
        minimumStock
      ) {
        /*
         * Daha önce kritik olarak
         * işaretlenmemişse bildirim oluştur.
         */
        if (
          !previousState ||
          previousState.isCritical !==
            true
        ) {
          notificationCandidates.push({
            id:
              `critical-stock-${product.id}-${Date.now()}`,

            title:
              "🚨 Kritik Stok",

            body:
              `${
                product.name ||
                "Bilinmeyen Ürün"
              } kritik stok seviyesine düştü. ` +
              `Mevcut stok: ${totalStock}. ` +
              `Minimum stok: ${minimumStock}.`,

            productId:
              product.id,

            batchId:
              "",

            type:
              "CRITICAL_STOCK",

            criticalStateRef,

            totalStock,

            minimumStock,
          });
        }
      } else {
        /*
         * Ürün daha önce kritik durumdaysa
         * ve stok normale çıktıysa
         * alarm durumunu sıfırla.
         */
        if (
          previousState?.isCritical ===
          true
        ) {
          await criticalStateRef.set(
            {
              isCritical: false,

              productId:
                product.id,

              totalStock,

              minimumStock,

              recoveredAt:
                new Date().toISOString(),

              updatedAt:
                new Date().toISOString(),
            },
            {
              merge: true,
            }
          );
        }
      }
    }

    /*
     * =====================================
     * DAHA ÖNCE GÖNDERİLENLERİ FİLTRELE
     * =====================================
     */

    const notificationsToSend =
      [];

    for (
      const notification
      of notificationCandidates
    ) {
      /*
       * Kritik stok bildirimi için
       * Date.now() kullandığımızdan
       * state sistemi tekrarları yönetir.
       */
      if (
        notification.type ===
        "CRITICAL_STOCK"
      ) {
        notificationsToSend.push(
          notification
        );

        continue;
      }

      const alreadySent =
        await notificationAlreadySent(
          logsCollection,
          notification.id
        );

      if (
        !alreadySent
      ) {
        notificationsToSend.push(
          notification
        );
      }
    }

    /*
     * GÖNDERİLECEK YENİ BİLDİRİM YOK
     */
    if (
      notificationsToSend.length ===
      0
    ) {
      return NextResponse.json({
        success: true,

        message:
          "Yeni bildirim bulunamadı.",

        detectedNotifications:
          notificationCandidates.length,

        sentNotifications: 0,

        devices:
          uniqueTokens.length,
      });
    }

    /*
     * =====================================
     * PUSH GÖNDERİMİ
     * =====================================
     */

    let successCount = 0;

    let failureCount = 0;

    let sentNotifications =
      0;

    for (
      const notification
      of notificationsToSend
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
                String(
                  notification.id
                ),

              type:
                String(
                  notification.type
                ),

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
                  String(
                    notification.id
                  ),

                renotify:
                  false,
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

      /*
       * En az bir cihaza başarılı
       * gönderim yapıldıysa logla.
       */
      if (
        response.successCount > 0
      ) {
        sentNotifications += 1;

        /*
         * Bildirim geçmişini kaydet.
         */
        await saveNotificationLog(
          logsCollection,
          notification
        );

        /*
         * Kritik stok durumunu
         * aktif olarak işaretle.
         */
        if (
          notification.type ===
            "CRITICAL_STOCK" &&
          notification.criticalStateRef
        ) {
          await notification
            .criticalStateRef
            .set(
              {
                isCritical: true,

                productId:
                  notification.productId,

                totalStock:
                  notification.totalStock,

                minimumStock:
                  notification.minimumStock,

                triggeredAt:
                  new Date()
                    .toISOString(),

                updatedAt:
                  new Date()
                    .toISOString(),
              },
              {
                merge: true,
              }
            );
        }
      }
    }

    /*
     * =====================================
     * SONUÇ
     * =====================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Otomatik stok ve SKT kontrolü tamamlandı.",

      detectedNotifications:
        notificationCandidates.length,

      sentNotifications,

      devices:
        uniqueTokens.length,

      successCount,

      failureCount,
    });
  } catch (error) {
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
