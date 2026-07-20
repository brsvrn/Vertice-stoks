import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb, getAdminMessaging } from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES = new Set(["PRODUCT_CREATED", "STOCK_IN", "STOCK_OUT"]);

function tenantCollection(db, companyId, collectionName) {
  return db.collection("companies").doc(companyId).collection(collectionName);
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function makeNotification(type, product, quantity) {
  const productName = product.name || "Ürün";
  if (type === "PRODUCT_CREATED") {
    return { type, title: "Yeni ürün eklendi", body: `${productName} ürün listesine eklendi.`, priority: "normal" };
  }
  if (type === "STOCK_IN") {
    return { type, title: "Stok girişi yapıldı", body: `${productName} için ${quantity} adet stok girişi kaydedildi.`, priority: "normal" };
  }
  return { type, title: "Stok çıkışı yapıldı", body: `${productName} için ${quantity} adet stok çıkışı kaydedildi.`, priority: "normal" };
}

async function sendToDevices({ messaging, deviceDocuments, notification, companyId }) {
  const activeDevices = deviceDocuments.filter((document) => {
    const device = document.data();
    return device.notificationsEnabled === true && Boolean(device.token);
  });
  const tokens = [...new Set(activeDevices.map((document) => document.data().token))];
  if (tokens.length === 0) return { sent: 0, failures: 0 };

  let sent = 0;
  let failures = 0;
  const invalidTokens = new Set();
  for (let start = 0; start < tokens.length; start += 500) {
    const chunk = tokens.slice(start, start + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      data: {
        notificationId: notification.tag,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        companyId,
        productId: notification.productId || "",
        batchId: notification.batchId || "",
        url: notification.url || "/",
        priority: notification.priority || "normal",
      },
      webpush: { fcmOptions: { link: notification.url || "/" } },
    });
    sent += response.successCount;
    failures += response.failureCount;
    response.responses.forEach((item, index) => {
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(item.error?.code)) {
        invalidTokens.add(chunk[index]);
      }
    });
  }

  await Promise.all(activeDevices.filter((document) => invalidTokens.has(document.data().token)).map((document) => document.ref.delete()));
  return { sent, failures };
}

export async function POST(request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!idToken) return NextResponse.json({ error: "Oturum doğrulaması gerekli." }, { status: 401 });

    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const payload = await request.json();
    const companyId = String(payload?.companyId || "").trim();
    const type = String(payload?.type || "");
    const productId = String(payload?.productId || "").trim();
    const batchId = String(payload?.batchId || "").trim();
    const quantity = positiveNumber(payload?.quantity);
    if (!companyId || !EVENT_TYPES.has(type) || !productId) {
      return NextResponse.json({ error: "Geçersiz firma veya bildirim olayı." }, { status: 400 });
    }
    if (type !== "PRODUCT_CREATED" && quantity === 0) {
      return NextResponse.json({ error: "Geçerli adet gerekli." }, { status: 400 });
    }

    const db = getAdminDb();
    const member = await db.collection("companies").doc(companyId).collection("members").doc(decodedToken.uid).get();
    if (!member.exists || member.data()?.status !== "ACTIVE") {
      return NextResponse.json({ error: "Bu işletme için erişim yetkiniz yok." }, { status: 403 });
    }

    const products = tenantCollection(db, companyId, "products");
    const productSnapshot = await products.doc(productId).get();
    if (!productSnapshot.exists) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

    const product = { id: productSnapshot.id, ...productSnapshot.data() };
    const devices = await tenantCollection(db, companyId, "devices").get();
    const messaging = getAdminMessaging();
    const url = `/?product=${encodeURIComponent(productId)}`;
    const eventResult = await sendToDevices({
      messaging,
      deviceDocuments: devices.docs,
      companyId,
      notification: { ...makeNotification(type, product, quantity), productId, batchId, url, tag: `inventory-${type.toLowerCase()}-${productId}-${Date.now()}` },
    });

    let criticalResult = { sent: 0, failures: 0 };
    if (type === "STOCK_IN" || type === "STOCK_OUT") {
      const batches = await tenantCollection(db, companyId, "batches").where("productId", "==", productId).get();
      const totalStock = batches.docs.reduce((total, batch) => total + Number(batch.data().quantity || 0), 0);
      const minimumStock = Number(product.minStock || 0);
      const stateRef = tenantCollection(db, companyId, "notificationLogs").doc(`critical-state-${productId}`);
      if (minimumStock > 0 && totalStock <= minimumStock) {
        const previousState = await stateRef.get();
        if (previousState.data()?.isCritical !== true) {
          criticalResult = await sendToDevices({
            messaging,
            deviceDocuments: devices.docs,
            companyId,
            notification: {
              type: "CRITICAL_STOCK",
              title: "Kritik stok uyarısı",
              body: `${product.name || "Ürün"} kritik seviyeye düştü. Mevcut: ${totalStock}, minimum: ${minimumStock}.`,
              productId,
              batchId,
              url,
              priority: "critical",
              tag: `critical-stock-${productId}`,
            },
          });
          await stateRef.set({ isCritical: true, productId, totalStock, minimumStock, triggeredAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
      } else {
        await stateRef.set({ isCritical: false, productId, totalStock, minimumStock, recoveredAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      }
    }

    return NextResponse.json({ success: true, event: eventResult, critical: criticalResult });
  } catch (error) {
    console.error("Inventory push event failed:", error);
    return NextResponse.json({ error: error?.message || "Bildirim gönderilemedi." }, { status: 500 });
  }
}
