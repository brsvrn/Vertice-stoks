import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "../../../lib/firebaseAdmin";

export async function POST(request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!idToken) return NextResponse.json({ error: "Oturum doğrulaması gerekli." }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const body = await request.json();
    const name = String(body?.name || decoded.name || "").trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
    const ref = getAdminDb().collection("users").doc(decoded.uid);
    const existing = await ref.get();
    const now = new Date().toISOString();
    const user = { uid: decoded.uid, name, displayName: name, email: decoded.email || "", photoURL: decoded.picture || null, createdAt: existing.data()?.createdAt || now, updatedAt: now, lastLoginAt: now, lastCompanyId: existing.data()?.lastCompanyId || null };
    await ref.set(user, { merge: true });
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile setup failed:", error);
    return NextResponse.json({ error: "Profil oluşturulamadı." }, { status: 500 });
  }
}
