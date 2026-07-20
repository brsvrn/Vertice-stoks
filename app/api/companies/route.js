import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INITIAL_OWNER_EMAIL = (process.env.INITIAL_OWNER_EMAIL || "brsvrn@gmail.com").toLowerCase();

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashSecret(value) {
  return createHash("sha256").update(normalizeCode(value)).digest("hex");
}

function makeJoinCode() {
  const raw = randomBytes(8).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return `ENV-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

async function verifyRequest(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("AUTH_REQUIRED");
  return getAdminAuth().verifyIdToken(token);
}

async function createCompany(db, user, { name, companyId }) {
  const companyRef = companyId ? db.collection("companies").doc(companyId) : db.collection("companies").doc();
  const now = new Date().toISOString();
  let joinCode = makeJoinCode();
  let codeRef = db.collection("companyJoinCodes").doc(hashSecret(joinCode));
  while ((await codeRef.get()).exists) {
    joinCode = makeJoinCode();
    codeRef = db.collection("companyJoinCodes").doc(hashSecret(joinCode));
  }
  const company = { name, normalizedName: name.toLocaleLowerCase("tr-TR"), ownerUid: user.uid, status: "ACTIVE", createdAt: now, updatedAt: now };
  const membership = { uid: user.uid, role: "OWNER", status: "ACTIVE", joinedAt: now, updatedAt: now, invitedBy: null, email: user.email || "", displayName: user.name || "" };
  const batch = db.batch();
  batch.set(companyRef, company, { merge: true });
  batch.set(companyRef.collection("members").doc(user.uid), membership, { merge: true });
  batch.set(codeRef, { companyId: companyRef.id, status: "ACTIVE", createdAt: now });
  batch.set(companyRef.collection("settings").doc("access"), { joinCodeHash: codeRef.id, joinCodeUpdatedAt: now }, { merge: true });
  batch.set(db.collection("users").doc(user.uid), { email: user.email || "", displayName: user.name || "", companyIds: FieldValue.arrayUnion(companyRef.id), lastCompanyId: companyRef.id, updatedAt: now }, { merge: true });
  await batch.commit();
  return { company: { id: companyRef.id, ...company }, membership, joinCode };
}

async function listCompanies(db, user) {
  const profile = await db.collection("users").doc(user.uid).get();
  const companyIds = [...new Set([...(profile.data()?.companyIds || []), profile.data()?.lastCompanyId].filter(Boolean))];
  const companies = await Promise.all(companyIds.map(async (companyId) => {
    const companyRef = db.collection("companies").doc(companyId);
    const [snapshot, membership] = await Promise.all([companyRef.get(), companyRef.collection("members").doc(user.uid).get()]);
    if (!snapshot.exists || snapshot.data()?.status !== "ACTIVE" || !membership.exists || membership.data()?.status !== "ACTIVE") return null;
    return { id: snapshot.id, ...snapshot.data(), membership: membership.data() };
  }));
  return companies.filter(Boolean);
}

export async function GET(request) {
  try {
    const user = await verifyRequest(request);
    const db = getAdminDb();
    let companies = await listCompanies(db, user);
    let initialJoinCode = "";
    if (companies.length === 0 && String(user.email || "").toLowerCase() === INITIAL_OWNER_EMAIL) {
      const existingVertice = await db.collection("companies").doc("vertice").get();
      if (!existingVertice.exists || existingVertice.data()?.ownerUid === user.uid) {
        const created = await createCompany(db, user, { name: "Vertice", companyId: "vertice" });
        companies = [{ ...created.company, membership: created.membership }];
        initialJoinCode = created.joinCode;
      }
    }
    const profile = await db.collection("users").doc(user.uid).get();
    return NextResponse.json({ companies, lastCompanyId: profile.data()?.lastCompanyId || "", initialJoinCode });
  } catch (error) {
    if (error?.message === "AUTH_REQUIRED") return NextResponse.json({ error: "Oturum doğrulaması gerekli." }, { status: 401 });
    console.error("Company list failed:", error);
    return NextResponse.json({ error: "İşletmeler yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await verifyRequest(request);
    const body = await request.json();
    const action = String(body?.action || "");
    const db = getAdminDb();

    if (action === "create") {
      const name = String(body?.name || "").trim().slice(0, 100);
      if (!name) return NextResponse.json({ error: "İşletme adı gerekli." }, { status: 400 });
      return NextResponse.json(await createCompany(db, user, { name }));
    }

    if (action === "join" || action === "joinInvite") {
      const lookupCollection = action === "join" ? "companyJoinCodes" : "companyInviteTokens";
      const secret = action === "join" ? body?.joinCode : body?.token;
      if (!String(secret || "").trim()) return NextResponse.json({ error: "Davet veya katılım kodu gerekli." }, { status: 400 });
      const lookupRef = db.collection(lookupCollection).doc(hashSecret(secret));
      const result = await db.runTransaction(async (transaction) => {
        const lookup = await transaction.get(lookupRef);
        const data = lookup.data();
        if (!lookup.exists || data?.status !== "ACTIVE") throw new Error("INVITE_INVALID");
        if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) throw new Error("INVITE_EXPIRED");

        const companyRef = db.collection("companies").doc(data.companyId);
        const companySnapshot = await transaction.get(companyRef);
        if (!companySnapshot.exists || companySnapshot.data()?.status !== "ACTIVE") throw new Error("COMPANY_INACTIVE");

        const memberRef = companyRef.collection("members").doc(user.uid);
        const existing = await transaction.get(memberRef);
        if (existing.exists && existing.data()?.status !== "ACTIVE") throw new Error("MEMBERSHIP_SUSPENDED");

        const now = new Date().toISOString();
        const role = action === "joinInvite" && data.role === "ADMIN" ? "ADMIN" : "PERSONNEL";
        const membership = existing.exists
          ? existing.data()
          : { uid: user.uid, role, status: "ACTIVE", joinedAt: now, updatedAt: now, invitedBy: data.createdBy || "join-code", email: user.email || "", displayName: user.name || "" };

        if (!existing.exists) {
          if (action === "joinInvite" && data.maxUses && Number(data.usedCount || 0) >= Number(data.maxUses)) throw new Error("INVITE_LIMIT");
          transaction.set(memberRef, membership);
          if (action === "joinInvite") {
            const usedCount = Number(data.usedCount || 0) + 1;
            const status = usedCount >= Number(data.maxUses || 1) ? "USED" : "ACTIVE";
            transaction.update(lookupRef, { usedCount, lastUsedAt: now, status });
            transaction.set(companyRef.collection("invites").doc(lookup.id), { usedCount, lastUsedAt: now, status }, { merge: true });
          }
        }

        transaction.set(db.collection("users").doc(user.uid), { email: user.email || "", displayName: user.name || "", companyIds: FieldValue.arrayUnion(companyRef.id), lastCompanyId: companyRef.id, updatedAt: now }, { merge: true });
        return { company: { id: companySnapshot.id, ...companySnapshot.data() }, membership };
      });
      return NextResponse.json(result);
    }

    if (action === "switch") {
      const companyId = String(body?.companyId || "");
      const membership = await db.collection("companies").doc(companyId).collection("members").doc(user.uid).get();
      if (!membership.exists || membership.data()?.status !== "ACTIVE") return NextResponse.json({ error: "Bu işletmeye erişiminiz bulunmuyor." }, { status: 403 });
      await db.collection("users").doc(user.uid).set({ companyIds: FieldValue.arrayUnion(companyId), lastCompanyId: companyId, updatedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz işletme işlemi." }, { status: 400 });
  } catch (error) {
    if (error?.message === "AUTH_REQUIRED") return NextResponse.json({ error: "Oturum doğrulaması gerekli." }, { status: 401 });
    if (error?.message === "INVITE_INVALID") return NextResponse.json({ error: "Davet geçersiz veya artık aktif değil." }, { status: 404 });
    if (error?.message === "INVITE_EXPIRED") return NextResponse.json({ error: "Davet süresi dolmuş." }, { status: 410 });
    if (error?.message === "INVITE_LIMIT") return NextResponse.json({ error: "Davet kullanım limiti dolmuş." }, { status: 410 });
    if (error?.message === "COMPANY_INACTIVE") return NextResponse.json({ error: "İşletme kullanıma açık değil." }, { status: 403 });
    if (error?.message === "MEMBERSHIP_SUSPENDED") return NextResponse.json({ error: "Bu işletmedeki üyeliğiniz askıya alınmış." }, { status: 403 });
    console.error("Company operation failed:", error);
    return NextResponse.json({ error: "İşletme işlemi tamamlanamadı." }, { status: 500 });
  }
}
