import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
  getAdminMessaging,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ID = "G-ZXHYS9KH9T";
const EVENT_TYPES = new Set(["PRODUCT_CREATED", "STOCK_IN", "STOCK_OUT"]);

function getDataCollection(db, collectionName) {
  return db
    .collection("artifacts")
    .doc(APP_ID)
    .collection("public")
    .doc("data")
    .collection(collectionName);
}

function toSafeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function makeNotification(type, product, quantity) {
  const productName = product.name || "Ürün";

  if (type === "PRODUCT_CREATED") {
    return {
      type,
      title: "Yeni ürün eklendi",
      body: `${productName} ürün listesine eklendi.`,
      priority: "normal",
    };
  }

  if (type === "STOCK_IN") {
    return {
      type,
      title: "Stok girişi yapıldı",
      body: `${productName} için ${quantity} adet stok girişi kaydedildi.`,
      priority: "normal",
    };
  }

  return {
    type,
    title: "Stok çıkışı yapıldı",
    body: `${productName} için ${quantity} adet stok çıkışı kaydedildi.`,
    priority: "normal",
  };
}

async function sendToDevices({ messaging, deviceDocuments, notification }) {
  const activeDevices = deviceDocuments.filter(
    (device) => device.data().notificationsEnabled === true && device.data().token
  );
  const tokens = [...new Set(activeDevices.map((device) => device.data().token))];

  if (tokens.length === 0) {
    return { sent: 0, failures: 0 };
  }

  let sent = 0;
  let failures = 0;
  const invalidTokens = new Set();

  for (let start = 0; start < tokens.length; start += 500) {
    const chunk = tokens.slice(start, start + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        type: notification.type,
        productId: notification.productId || "",
        batchId: notification.batchId || "",
        url: notification.url || "/",
        priority: notification.priority || "normal",
      },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: notification.tag,
          renotify: notification.priority === "critical",
        },
        fcmOptions: { link: notification.url || "/" },
      },
    });

    sent += response.successCount;
    failures += response.failureCount;
    response.responses.forEach((item, index) => {
      const code = item.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalidTokens.add(chunk[index]);
      }
    });
  }

  await Promise.all(
    activeDevices
      .filter((device) => invalidTokens.has(device.data().token))
      .map((device) => device.ref.delete())
  );

  return { sent, failures };
}

export async function POST(request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const idToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!idToken) {
      return NextResponse.json({ error: "Oturum doğrulaması gerekli." }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const payload = await request.json();
    const type = String(payload?.type || "");
    const productId = String(payload?.productId || "");
    const batchId = String(payload?.batchId || "");
    const quantity = toSafeNumber(payload?.quantity);

    if (!EVENT_TYPES.has(type) || !productId) {
      return NextResponse.json({ error: "Geçersiz bildirim olayı." }, { status: 400 });
    }

    if (type !== "PRODUCT_CREATED" && quantity === 0) {
      return NextResponse.json({ error: "Geçerli adet gerekli." }, { status: 400 });
    }

    const db = getAdminDb();
    const users = getDataCollection(db, "users");
    const user = await users.doc(decodedToken.uid).get();
    if (!user.exists) {
      return NextResponse.json({ error: "Yetkili kullanıcı bulunamadı." }, { status: 403 });
    }

    const products = getDataCollection(db, "products");
    const productSnapshot = await products.doc(productId).get();
    if (!productSnapshot.exists) {
      return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }

    const product = { id: productSnapshot.id, ...productSnapshot.data() };
    const devices = await getDataCollection(db, "devices").get();
    const messaging = getAdminMessaging();
    const eventNotification = {
      ...makeNotification(type, product, quantity),
      productId,
      batchId,
      url: `/?product=${encodeURIComponent(productId)}`,
      tag: `inventory-${type.toLowerCase()}-${productId}-${Date.now()}`,
    };

    const eventResult = await sendToDevices({
      messaging,
      deviceDocuments: devices.docs,
      notification: eventNotification,
    });

    let criticalResult = { sent: 0, failures: 0 };
    if (type === "STOCK_IN" || type === "STOCK_OUT") {
      const batches = await getDataCollection(db, "batches").where("productId", "==", productId).get();
      const totalStock = batches.docs.reduce(
        (total, batch) => total + Number(batch.data().quantity || 0),
        0
      );
      const minimumStock = Number(product.minStock || 0);
      const logs = getDataCollection(db, "notificationLogs");
      const stateRef = logs.doc(`critical-state-${productId}`);

      if (minimumStock > 0 && totalStock <= minimumStock) {
        const previousState = await stateRef.get();
        if (previousState.data()?.isCritical !== true) {
          criticalResult = await sendToDevices({
            messaging,
            deviceDocuments: devices.docs,
            notification: {
              type: "CRITICAL_STOCK",
              title: "Kritik stok uyarısı",
              body: `${product.name || "Ürün"} kritik seviyeye düştü. Mevcut: ${totalStock}, minimum: ${minimumStock}.`,
              productId,
              batchId,
              url: `/?product=${encodeURIComponent(productId)}`,
              priority: "critical",
              tag: `critical-stock-${productId}`,
            },
          });
          await stateRef.set({
            isCritical: true,
            productId,
            totalStock,
            minimumStock,
            triggeredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        await stateRef.set(
          {
            isCritical: false,
            productId,
            totalStock,
            minimumStock,
            recoveredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

    return NextResponse.json({
      success: true,
      event: eventResult,
      critical: criticalResult,
    });
  } catch (error) {
    console.error("Inventory push event failed:", error);
    return NextResponse.json(
      { error: error?.message || "Bildirim gönderilemedi." },
      { status: 500 }
    );
  }
}
