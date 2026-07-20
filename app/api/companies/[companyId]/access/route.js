import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";

function hashSecret(value) { return createHash("sha256").update(String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex"); }
function token() { return randomBytes(32).toString("base64url"); }
function joinCode() { const raw = randomBytes(8).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10); return `ENV-${raw.slice(0, 4)}-${raw.slice(4)}`; }

async function context(request, companyId) {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!idToken) throw new Error("AUTH_REQUIRED");
  const user = await getAdminAuth().verifyIdToken(idToken);
  const db = getAdminDb();
  const member = await db.collection("companies").doc(companyId).collection("members").doc(user.uid).get();
  if (!member.exists || member.data()?.status !== "ACTIVE") throw new Error("FORBIDDEN");
  return { db, user, member: member.data(), companyRef: db.collection("companies").doc(companyId) };
}

function manager(member) { return member.role === "OWNER" || member.role === "ADMIN"; }

export async function GET(request, { params }) {
  try {
    const { companyId } = await params;
    const { companyRef, member } = await context(request, companyId);
    if (!manager(member)) throw new Error("FORBIDDEN");
    const [members, invites] = await Promise.all([companyRef.collection("members").get(), companyRef.collection("invites").orderBy("createdAt", "desc").limit(25).get()]);
    return NextResponse.json({ members: members.docs.map((item) => ({ id: item.id, ...item.data() })), invites: invites.docs.map((item) => ({ id: item.id, ...item.data() })) });
  } catch (error) { return accessError(error); }
}

export async function POST(request, { params }) {
  try {
    const { companyId } = await params;
    const { db, user, member, companyRef } = await context(request, companyId);
    if (!manager(member)) throw new Error("FORBIDDEN");
    const body = await request.json();
    const action = String(body?.action || "");
    const now = new Date().toISOString();

    if (action === "invite") {
      if (member.role !== "OWNER" && body?.role === "ADMIN") throw new Error("FORBIDDEN");
      const rawToken = token();
      const tokenHash = hashSecret(rawToken);
      const role = body?.role === "ADMIN" ? "ADMIN" : "PERSONNEL";
      const maxUses = Math.min(Math.max(Number(body?.maxUses || 1), 1), 100);
      const expiresAt = new Date(Date.now() + Math.min(Math.max(Number(body?.expiresInDays || 7), 1), 30) * 86400000).toISOString();
      const invite = { companyId, role, createdBy: user.uid, createdAt: now, expiresAt, maxUses, usedCount: 0, status: "ACTIVE", lastUsedAt: null };
      const batch = db.batch();
      batch.set(db.collection("companyInviteTokens").doc(tokenHash), invite);
      batch.set(companyRef.collection("invites").doc(tokenHash), invite);
      await batch.commit();
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://envantra.vercel.app";
      return NextResponse.json({ invite: { id: tokenHash, ...invite }, url: `${baseUrl}/join?token=${encodeURIComponent(rawToken)}` });
    }

    if (action === "regenerateJoinCode") {
      if (member.role !== "OWNER") throw new Error("FORBIDDEN");
      const settingsRef = companyRef.collection("settings").doc("access");
      const settings = await settingsRef.get();
      const oldHash = settings.data()?.joinCodeHash;
      const code = joinCode();
      const hash = hashSecret(code);
      const batch = db.batch();
      if (oldHash) batch.set(db.collection("companyJoinCodes").doc(oldHash), { status: "REVOKED", revokedAt: now }, { merge: true });
      batch.set(db.collection("companyJoinCodes").doc(hash), { companyId, status: "ACTIVE", createdAt: now });
      batch.set(settingsRef, { joinCodeHash: hash, joinCodeUpdatedAt: now }, { merge: true });
      await batch.commit();
      return NextResponse.json({ joinCode: code });
    }
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) { return accessError(error); }
}

export async function PATCH(request, { params }) {
  try {
    const { companyId } = await params;
    const { member, companyRef } = await context(request, companyId);
    if (member.role !== "OWNER") throw new Error("FORBIDDEN");
    const body = await request.json();
    const uid = String(body?.uid || "");
    const target = await companyRef.collection("members").doc(uid).get();
    if (!target.exists) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    if (target.data()?.role === "OWNER") return NextResponse.json({ error: "OWNER rolü bu ekrandan değiştirilemez." }, { status: 409 });
    const updates = { updatedAt: new Date().toISOString() };
    if (["ADMIN", "PERSONNEL"].includes(body?.role)) updates.role = body.role;
    if (["ACTIVE", "SUSPENDED"].includes(body?.status)) updates.status = body.status;
    await target.ref.set(updates, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) { return accessError(error); }
}

export async function DELETE(request, { params }) {
  try {
    const { companyId } = await params;
    const { db, member, companyRef } = await context(request, companyId);
    if (!manager(member)) throw new Error("FORBIDDEN");
    const body = await request.json();
    if (body?.inviteId) {
      const id = String(body.inviteId);
      const batch = db.batch();
      batch.set(db.collection("companyInviteTokens").doc(id), { status: "REVOKED", revokedAt: new Date().toISOString() }, { merge: true });
      batch.set(companyRef.collection("invites").doc(id), { status: "REVOKED", revokedAt: new Date().toISOString() }, { merge: true });
      await batch.commit();
      return NextResponse.json({ success: true });
    }
    if (body?.uid) {
      if (member.role !== "OWNER") throw new Error("FORBIDDEN");
      const target = await companyRef.collection("members").doc(String(body.uid)).get();
      if (target.data()?.role === "OWNER") return NextResponse.json({ error: "OWNER işletmeden çıkarılamaz." }, { status: 409 });
      const batch = db.batch();
      batch.delete(target.ref);
      batch.set(db.collection("users").doc(String(body.uid)), { companyIds: FieldValue.arrayRemove(companyId), updatedAt: new Date().toISOString() }, { merge: true });
      await batch.commit();
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Silinecek kayıt belirtilmedi." }, { status: 400 });
  } catch (error) { return accessError(error); }
}

function accessError(error) {
  if (error?.message === "AUTH_REQUIRED") return NextResponse.json({ error: "Oturum doğrulaması gerekli." }, { status: 401 });
  if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Bu işlem için yetkiniz bulunmuyor." }, { status: 403 });
  console.error("Company access operation failed:", error);
  return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}
