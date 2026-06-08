import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { UserInput, EnergyResult, TargetTime } from "./types";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// CRITICAL: Must use firestoreDatabaseId
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
export const wechatProvider = new OAuthProvider(import.meta.env.VITE_WECHAT_PROVIDER_ID || "oidc.wechat");

async function ensureUserDocument(user: any) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const providerIds = user.providerData?.map((p: any) => p.providerId).filter(Boolean) || [];
  const now = Date.now();
  const baseData = {
    userId: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    providers: providerIds,
    updatedAt: now,
    lastLoginAt: now
  };

  if (!snap.exists()) {
    await setDoc(userRef, {
      ...baseData,
      createdAt: now
    });
    return;
  }

  await setDoc(userRef, baseData, { merge: true });
}

export async function loginWithGoogle() {
  try {
    const res = await signInWithPopup(auth, googleProvider);
    await ensureUserDocument(res.user);
    return res.user;
  } catch (error) {
    console.error("Login Error", error);
    throw error;
  }
}

export async function loginWithApple() {
  try {
    appleProvider.addScope("email");
    appleProvider.addScope("name");
    const res = await signInWithPopup(auth, appleProvider);
    await ensureUserDocument(res.user);
    return res.user;
  } catch (error) {
    console.error("Apple Login Error", error);
    throw error;
  }
}

export async function loginWithWechat() {
  try {
    const res = await signInWithPopup(auth, wechatProvider);
    await ensureUserDocument(res.user);
    return res.user;
  } catch (error) {
    console.error("WeChat Login Error", error);
    throw error;
  }
}

export async function loginOrRegisterWithEmail(email: string, password: string, mode: "login" | "register") {
  const res = mode === "register"
    ? await createUserWithEmailAndPassword(auth, email, password)
    : await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(res.user);
  return res.user;
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

export async function saveCalculation(userInput: UserInput, result: EnergyResult, targetTimes: TargetTime) {
  if (!auth.currentUser) return;
  const colRef = collection(db, "users", auth.currentUser.uid, "calculations");
  await addDoc(colRef, {
    userId: auth.currentUser.uid,
    userInput,
    targetYear: targetTimes.targetYear || null,
    targetMonth: targetTimes.targetMonth || null,
    targetDay: targetTimes.targetDay || null,
    targetHour: targetTimes.targetHour || null,
    bazi: result.bazi || "",
    dayMaster: result.dayMaster || "",
    score: result.periods?.yearly?.score || 0,
    periods: result.periods || {},
    createdAt: Date.now(),
    createdAtServer: serverTimestamp()
  });
}

export async function fetchCalculations() {
  if (!auth.currentUser) return [];
  const q = query(
    collection(db, "users", auth.currentUser.uid, "calculations"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function listenCalculations(uid: string, callback: (data: any[]) => void) {
  const q = query(
    collection(db, "users", uid, "calculations"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function createSharedCalculation(userInput: UserInput, result: EnergyResult, targetTimes: TargetTime) {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userInput,
      result,
      targetTimes
    })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error || "分享创建失败");
  }
  const data = await response.json();
  return data.shareId;
}

export async function fetchSharedCalculation(shareId: string) {
  const safeId = shareId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safeId) return null;
  const response = await fetch(`/api/share/${safeId}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error || "分享读取失败");
  }
  return response.json();
}
