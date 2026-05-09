/* ============================================================
   firebase.js — 물방울 급식 알리미 / 영신여자고등학교
   Google 계정 로그인 + Firestore 기반
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  increment,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Firebase 프로젝트 설정 ────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBqR-wDYiS8FI5ZLEwOmyc79dmT90feHDo",
  authDomain:        "watersavers-55c20.firebaseapp.com",
  projectId:         "watersavers-55c20",
  storageBucket:     "watersavers-55c20.firebasestorage.app",
  messagingSenderId: "918890865851",
  appId:             "1:918890865851:web:12473095e29e535e78759e",
  measurementId:     "G-W7QBWYPY5V"
};

// ── Firebase 초기화 ───────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

// ── 현재 유저 반환 ────────────────────────────────────────
export function getCurrentUser() {
  return auth.currentUser;
}

// ── 로그인 상태 감지 ──────────────────────────────────────
// callback(user) — user가 null이면 미로그인
export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Google 로그인 ─────────────────────────────────────────
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (e) {
    console.warn("Google 로그인 오류:", e);
    throw e;
  }
}

// ── 로그아웃 ─────────────────────────────────────────────
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("로그아웃 오류:", e);
  }
}

// ── 절약량 저장 (Firestore) ───────────────────────────────
// 경로: savings/{uid}/dates/{dateKey} → { liters: 350 }
export async function saveSavingOnline(dateKey, liters) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, "savings", uid, "dates", dateKey);
    await setDoc(ref, { liters }, { merge: true });
  } catch (e) {
    console.warn("절약량 저장 오류:", e);
  }
}

// ── 절약량 전체 불러오기 (Firestore) ─────────────────────
// 반환: { "20260416": 451, "20260417": 512, ... }
export async function loadSavingsOnline() {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return {};
    const datesRef = collection(db, "savings", uid, "dates");
    const snapshot = await getDocs(datesRef);
    const result   = {};
    snapshot.forEach(docSnap => {
      result[docSnap.id] = docSnap.data().liters || 0;
    });
    return result;
  } catch (e) {
    console.warn("절약량 불러오기 오류:", e);
    return {};
  }
}

// ── 당일 제출 여부 확인 (Firestore) ──────────────────────
export async function hasSubmittedTodayOnline(dateKey) {
  try {
    const uid  = auth.currentUser?.uid;
    if (!uid) return false;
    const ref  = doc(db, "submissions", dateKey, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (e) {
    console.warn("제출 여부 확인 오류:", e);
    return false;
  }
}

// ── 당일 제출 완료 기록 (Firestore) ──────────────────────
export async function markSubmittedTodayOnline(dateKey) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, "submissions", dateKey, "users", uid);
    await setDoc(ref, { submittedAt: new Date().toISOString() });
  } catch (e) {
    console.warn("제출 기록 오류:", e);
  }
}

// ── 인기도 저장 (Firestore) ───────────────────────────────
export async function savePopularityOnline(dateKey, menuName) {
  try {
    const ref = doc(db, "popularity", dateKey, "menus", menuName);
    await setDoc(ref, { count: increment(1) }, { merge: true });
  } catch (e) {
    console.warn("인기도 저장 오류:", e);
  }
}

// ── 인기도 불러오기 (Firestore) ───────────────────────────
export async function loadPopularityOnline(dateKey) {
  try {
    const menusRef = collection(db, "popularity", dateKey, "menus");
    const snapshot = await getDocs(menusRef);
    const result   = { [dateKey]: {} };
    snapshot.forEach(docSnap => {
      result[dateKey][docSnap.id] = docSnap.data().count || 0;
    });
    return result;
  } catch (e) {
    console.warn("인기도 불러오기 오류:", e);
    return { [dateKey]: {} };
  }
}
