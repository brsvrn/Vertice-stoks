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

export async function GET(request) {
  try {
    /*
     * CRON GÜVENLİK KONTROLÜ
     */
    const authHeader =
      request.headers.get("authorization");

    const cronSecret =
      process.env.CRON_SECRET;

    if (
      cronSecret &&
      authHeader !== `Bearer ${cronSecret}`
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

    const db = getAdminDb();
    const messaging = getAdminMessaging();

    /*
     * FIRESTORE VERİLERİNİ AL
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

    const products =
      productsSnapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        })
      );

    const batches =
      batchesSnapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        })
      );

    /*
     * SADECE BİLDİRİMLERİ AÇIK
     * CİHAZLARIN TOKENLARINI AL
     */
    const tokens =
      devicesSnapshot.docs
        .map((doc) => doc.data())
        .filter(
          (device) =>
            device.notificationsEnabled ===
              true &&
            device.token
        )
        .map(
          (device) => device.token
        );

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
        notifications: 0,
      });
    }

    const notifications = [];

    /*
     * TARİH HESABI
     */
    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    /*
     * SKT KONTROLÜ
     */
    for (const batch of batches) {
      const quantity =
        Number(
          batch.quantity || 0
        );

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
       */
      if (daysLeft < 0) {
        notifications.push({
          id:
            `expired-${batch.id}`,

          title:
            "⛔ SKT Geçti",

          body:
            `${productName} - ` +
            `Parti #${batch.batchNo || "-"} ` +
            `ürününün son kullanma tarihi geçti.`,

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
      if (daysLeft === 0) {
        notifications.push({
          id:
            `expiry-today-${batch.id}`,

          title:
            "🚨 SKT Bugün",

          body:
            `${productName} - ` +
            `Parti #${batch.batchNo || "-"} ` +
            `ürününün son kullanma tarihi bugün.`,

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
       * 3 GÜN KALDI
       */
      if (daysLeft <= 3) {
        notifications.push({
          id:
            `expiry-warning-${batch.id}`,

          title:
            "⚠️ SKT Yaklaşıyor",

          body:
            `${productName} - ` +
            `Parti #${batch.batchNo || "-"} ` +
            `için son kullanma tarihine ` +
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

    if (
      notifications.length === 0
    ) {
      return NextResponse.json({
        success: true,
        message:
          "Gönderilecek SKT bildirimi bulunamadı.",
        notifications: 0,
      });
    }

    /*
     * PUSH BİLDİRİMLERİNİ GÖNDER
     */
    let successCount = 0;
    let failureCount = 0;

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
            },

            webpush: {
              notification: {
                icon:
                  "/icon-192.png",

                badge:
                  "/icon-192.png",
              },

              fcmOptions: {
                link: "/",
              },
            },
          });

      successCount +=
        response.successCount;

      failureCount +=
        response.failureCount;
    }

    return NextResponse.json({
      success: true,

      message:
        "SKT kontrolü tamamlandı.",

      detectedNotifications:
        notifications.length,

      devices:
        uniqueTokens.length,

      successCount,

      failureCount,
    });
  } catch (error) {
    console.error(
      "SKT Cron hatası:",
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
