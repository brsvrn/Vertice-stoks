import { NextResponse } from "next/server";

import { getAdminDb, getAdminMessaging } from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tenantCollection(db, companyId, collectionName) {
  return db.collection("companies").doc(companyId).collection(collectionName);
}

function safeDocumentId(value) {
  return String(value || "").replace(/\//g, "_").replace(/\s+/g, "_");
}

function utcDay(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

async function sendNotification({ messaging, devices, notification, companyId }) {
  const eligible = devices.filter((document) => document.data().notificationsEnabled === true && document.data().token);
  const tokens = [...new Set(eligible.map((document) => document.data().token))];
  if (tokens.length === 0) return { successCount: 0, failureCount: 0, deviceCount: 0 };

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = new Set();
  const url = notification.productId ? `/?product=${encodeURIComponent(notification.productId)}` : "/";
  for (let start = 0; start < tokens.length; start += 500) {
    const chunk = tokens.slice(start, start + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      data: {
        notificationId: String(notification.id),
        title: String(notification.title),
        body: String(notification.body),
        type: String(notification.type),
        companyId,
        productId: String(notification.productId || ""),
        batchId: String(notification.batchId || ""),
        url,
        priority: notification.type === "CRITICAL_STOCK" ? "critical" : "normal",
      },
      webpush: { fcmOptions: { link: url } },
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
    response.responses.forEach((result, index) => {
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(result.error?.code)) invalidTokens.add(chunk[index]);
    });
  }
  await Promise.all(eligible.filter((document) => invalidTokens.has(document.data().token)).map((document) => document.ref.delete()));
  return { successCount, failureCount, deviceCount: tokens.length };
}

function expiryNotification(batch, product, daysLeft) {
  const name = product?.name || "Bilinmeyen ürün";
  const batchNo = batch.batchNo || "-";
  if (daysLeft < 0) return { id: `expired-${batch.id}`, title: "SKT geçti", body: `${name} - Parti #${batchNo} ürününün son kullanma tarihi geçti.`, type: "EXPIRED" };
  if (daysLeft === 0) return { id: `expiry-today-${batch.id}`, title: "SKT bugün", body: `${name} - Parti #${batchNo} ürününün son kullanma tarihi bugün.`, type: "EXPIRY_TODAY" };
  if (daysLeft === 1) return { id: `expiry-1day-${batch.id}`, title: "SKT'ye 1 gün kaldı", body: `${name} - Parti #${batchNo} için son kullanma tarihine 1 gün kaldı.`, type: "EXPIRY_1_DAY" };
  if (daysLeft === 3) return { id: `expiry-3days-${batch.id}`, title: "SKT yaklaşıyor", body: `${name} - Parti #${batchNo} için son kullanma tarihine 3 gün kaldı.`, type: "EXPIRY_3_DAYS" };
  return null;
}

async function processCompany({ db, messaging, company }) {
  const companyId = company.id;
  const productsCollection = tenantCollection(db, companyId, "products");
  const batchesCollection = tenantCollection(db, companyId, "batches");
  const devicesCollection = tenantCollection(db, companyId, "devices");
  const logsCollection = tenantCollection(db, companyId, "notificationLogs");
  const [productsSnapshot, batchesSnapshot, devicesSnapshot] = await Promise.all([
    productsCollection.get(),
    batchesCollection.get(),
    devicesCollection.get(),
  ]);
  const products = productsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const batches = batchesSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const candidates = [];
  const today = utcDay();

  for (const batch of batches) {
    if (Number(batch.quantity || 0) <= 0 || !batch.expiryDate) continue;
    const expiry = utcDay(batch.expiryDate);
    if (expiry === null) continue;
    const notification = expiryNotification(batch, productsById.get(batch.productId), Math.ceil((expiry - today) / 86400000));
    if (!notification) continue;
    const log = await logsCollection.doc(safeDocumentId(notification.id)).get();
    if (!log.exists) candidates.push({ ...notification, productId: batch.productId || "", batchId: batch.id });
  }

  for (const product of products) {
    const minimumStock = Number(product.minStock || 0);
    if (minimumStock <= 0) continue;
    const totalStock = batches.filter((batch) => batch.productId === product.id).reduce((total, batch) => total + Number(batch.quantity || 0), 0);
    const stateRef = logsCollection.doc(safeDocumentId(`critical-state-${product.id}`));
    const state = await stateRef.get();
    if (totalStock <= minimumStock && state.data()?.isCritical !== true) {
      candidates.push({
        id: `critical-stock-${product.id}`,
        title: "Kritik stok uyarısı",
        body: `${product.name || "Bilinmeyen ürün"} kritik seviyeye düştü. Mevcut stok: ${totalStock}. Minimum stok: ${minimumStock}.`,
        type: "CRITICAL_STOCK",
        productId: product.id,
        batchId: "",
        stateRef,
        totalStock,
        minimumStock,
      });
    } else if (totalStock > minimumStock && state.data()?.isCritical === true) {
      await stateRef.set({ isCritical: false, productId: product.id, totalStock, minimumStock, recoveredAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    }
  }

  let sentNotifications = 0;
  let successCount = 0;
  let failureCount = 0;
  for (const notification of candidates) {
    const result = await sendNotification({ messaging, devices: devicesSnapshot.docs, notification, companyId });
    successCount += result.successCount;
    failureCount += result.failureCount;
    if (result.successCount === 0) continue;
    sentNotifications += 1;
    const now = new Date().toISOString();
    if (notification.type === "CRITICAL_STOCK") {
      await notification.stateRef.set({ isCritical: true, productId: notification.productId, totalStock: notification.totalStock, minimumStock: notification.minimumStock, triggeredAt: now, updatedAt: now }, { merge: true });
    } else {
      await logsCollection.doc(safeDocumentId(notification.id)).set({ notificationId: notification.id, type: notification.type, productId: notification.productId, batchId: notification.batchId, title: notification.title, body: notification.body, sentAt: now });
    }
  }

  return { companyId, companyName: company.data().name || companyId, detectedNotifications: candidates.length, sentNotifications, devices: new Set(devicesSnapshot.docs.map((document) => document.data().token).filter(Boolean)).size, successCount, failureCount };
}

export async function GET(request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Yetkisiz istek." }, { status: 401 });
    }

    const db = getAdminDb();
    const messaging = getAdminMessaging();
    const companiesSnapshot = await db.collection("companies").where("status", "==", "ACTIVE").get();
    const results = [];
    for (const company of companiesSnapshot.docs) results.push(await processCompany({ db, messaging, company }));

    return NextResponse.json({
      success: true,
      message: "Firma bazlı otomatik stok ve SKT kontrolü tamamlandı.",
      companies: results.length,
      detectedNotifications: results.reduce((total, item) => total + item.detectedNotifications, 0),
      sentNotifications: results.reduce((total, item) => total + item.sentNotifications, 0),
      successCount: results.reduce((total, item) => total + item.successCount, 0),
      failureCount: results.reduce((total, item) => total + item.failureCount, 0),
      results,
    });
  } catch (error) {
    console.error("Envantra cron hatası:", error);
    return NextResponse.json({ success: false, error: error?.message || "Bilinmeyen sunucu hatası." }, { status: 500 });
  }
}
