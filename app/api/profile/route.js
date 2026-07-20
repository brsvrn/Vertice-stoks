import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../lib/firebaseAdmin";

const APP_ID = "G-ZXHYS9KH9T";

function getCollection(db, name) {
  return db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection(name);
}

export async function POST(request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!idToken) return NextResponse.json({ error: "Oturum doğrulaması gerekli." }, { status: 401 });

    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const body = await request.json();
    const name = String(body?.name || "").trim().slice(0, 80);
    const requestedRole = body?.role === "admin" ? "admin" : "staff";
    const adminPin = String(body?.adminPin || "");
    if (!name) return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });

    const users = getCollection(getAdminDb(), "users");
    const existing = await users.doc(decodedToken.uid).get();
    if (existing.exists) return NextResponse.json({ user: existing.data() });

    if (requestedRole === "admin") {
      const configuredPin = process.env.ADMIN_SETUP_PIN;
      if (!configuredPin || adminPin !== configuredPin) {
        return NextResponse.json({ error: "Yönetici PIN kodu geçersiz." }, { status: 403 });
      }
    }

    const user = { uid: decodedToken.uid, name, role: requestedRole, createdAt: new Date().toISOString() };
    await users.doc(decodedToken.uid).set(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile setup failed:", error);
    return NextResponse.json({ error: "Profil oluşturulamadı." }, { status: 500 });
  }
}
