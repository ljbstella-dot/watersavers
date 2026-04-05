/* ============================================================
   firebase.js — 물방울 급식 알리미 / 영신여자고등학교
   Firebase 익명 인증 + Firestore 기반
   - 익명 인증으로 기기당 고유 UID 발급
   - Firestore에 UID별 당일 제출 여부 저장 → 1인 1회 제한
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
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
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── 현재 로그인된 UID를 반환하는 Promise ─────────────────
// 익명 로그인은 앱 최초 실행 시 자동으로 처리됩니다.
// 이후 같은 기기에서는 동일한 UID가 유지됩니다.
//
// [수정] onAuthStateChanged 리스너를 콜백 실행 즉시 해제합니다.
// 해제하지 않으면 호출마다 리스너가 누적되어 메모리 누수 발생.
export function getCurrentUID() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // 콜백 실행 즉시 리스너 해제 → 메모리 누수 방지
      if (user) {
        // 이미 로그인된 상태 (익명 포함) → UID 반환
        resolve(user.uid);
      } else {
        // 미로그인 → 익명으로 자동 로그인
        try {
          const result = await signInAnonymously(auth);
          resolve(result.user.uid);
        } catch (e) {
          console.warn("익명 로그인 오류:", e);
          reject(e);
        }
      }
    });
  });
}

/**
 * 당일 제출 여부 확인 (Firebase 기반)
 * Firestore 경로: submissions/{dateKey}/users/{uid}
 *
 * @param {string} dateKey - 날짜 문자열 (예: "20260402")
 * @returns {Promise<boolean>} 제출 완료 여부
 */
export async function hasSubmittedTodayOnline(dateKey) {
  try {
    const uid = await getCurrentUID();
    const ref = doc(db, "submissions", dateKey, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (e) {
    console.warn("제출 여부 확인 오류:", e);
    // 오류 시 미제출로 간주 (서비스 중단 방지)
    return false;
  }
}

/**
 * 당일 제출 완료 기록 (Firebase 기반)
 * Firestore 경로: submissions/{dateKey}/users/{uid}
 *
 * @param {string} dateKey - 날짜 문자열 (예: "20260402")
 */
export async function markSubmittedTodayOnline(dateKey) {
  try {
    const uid = await getCurrentUID();
    const ref = doc(db, "submissions", dateKey, "users", uid);
    await setDoc(ref, {
      submittedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("제출 기록 오류:", e);
  }
}

/**
 * 인기도 저장 (온라인)
 * Firestore 경로: popularity/{dateKey}/menus/{menuName}
 *
 * @param {string} dateKey  - 날짜 문자열 (예: "20260402")
 * @param {string} menuName - 메뉴 이름   (예: "돈까스")
 */
export async function savePopularityOnline(dateKey, menuName) {
  try {
    const ref = doc(db, "popularity", dateKey, "menus", menuName);
    await setDoc(ref, { count: increment(1) }, { merge: true });
  } catch (e) {
    console.warn("Firebase 저장 오류:", e);
  }
}

/**
 * 인기도 불러오기 (온라인)
 * Firestore 경로: popularity/{dateKey}/menus/{menuName}
 *
 * @param {string} dateKey - 날짜 문자열 (예: "20260402")
 * @returns {Promise<{ [dateKey]: { [menuName]: number } }>}
 */
export async function loadPopularityOnline(dateKey) {
  try {
    const menusRef = collection(db, "popularity", dateKey, "menus");
    const snapshot = await getDocs(menusRef);
    const result = { [dateKey]: {} };
    snapshot.forEach(docSnap => {
      result[dateKey][docSnap.id] = docSnap.data().count || 0;
    });
    return result;
  } catch (e) {
    console.warn("Firebase 불러오기 오류:", e);
    return { [dateKey]: {} };
  }
}
const auth = getAuth(app);
const db   = getFirestore(app);

// ── 현재 로그인된 UID를 반환하는 Promise ─────────────────
// 익명 로그인은 앱 최초 실행 시 자동으로 처리됩니다.
// 이후 같은 기기에서는 동일한 UID가 유지됩니다.
export function getCurrentUID() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 이미 로그인된 상태 (익명 포함) → UID 반환
        resolve(user.uid);
      } else {
        // 미로그인 → 익명으로 자동 로그인
        try {
          const result = await signInAnonymously(auth);
          resolve(result.user.uid);
        } catch (e) {
          console.warn("익명 로그인 오류:", e);
          reject(e);
        }
      }
    });
  });
}

/**
 * 당일 제출 여부 확인 (Firebase 기반)
 * Firestore 경로: submissions/{dateKey}/users/{uid}
 *
 * @param {string} dateKey - 날짜 문자열 (예: "20260402")
 * @returns {Promise<boolean>} 제출 완료 여부
 */
export async function hasSubmittedTodayOnline(dateKey) {
  try {
    const uid = await getCurrentUID();
    const ref = doc(db, "submissions", dateKey, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (e) {
    console.warn("제출 여부 확인 오류:", e);
    // 오류 시 미제출로 간주 (서비스 중단 방지)
    return false;
  }
}

/**
 * 당일 제출 완료 기록 (Firebase 기반)
 * Firestore 경로: submissions/{dateKey}/users/{uid}
 *
 * @param {string} dateKey - 날짜 문자열 (예: "20260402")
 */
export async function markSubmittedTodayOnline(dateKey) {
  try {
    const uid = await getCurrentUID();
    const ref = doc(db, "submissions", dateKey, "users", uid);
    await setDoc(ref, {
      submittedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("제출 기록 오류:", e);
  }
}

/**
 * 인기도 저장 (온라인)
 * Firestore 경로: popularity/{dateKey}/menus/{menuName}
 *
 * @param {string} dateKey  - 날짜 문자열 (예: "20260402")
 * @param {string} menuName - 메뉴 이름   (예: "돈까스")
 */
export async function savePopularityOnline(dateKey, menuName) {
  try {
    const ref = doc(db, "popularity", dateKey, "menus", menuName);
    await setDoc(ref, { count: increment(1) }, { merge: true });
  } catch (e) {
    console.warn("Firebase 저장 오류:", e);
  }
}

/**
 * 인기도 불러오기 (온라인)
 * Firestore 경로: popularity/{dateKey}/menus/{menuName}
 *
 * @param {string} dateKey - 날짜 문자열 (예: "20260402")
 * @returns {Promise<{ [dateKey]: { [menuName]: number } }>}
 */
export async function loadPopularityOnline(dateKey) {
  try {
    const menusRef = collection(db, "popularity", dateKey, "menus");
    const snapshot = await getDocs(menusRef);
    const result = { [dateKey]: {} };
    snapshot.forEach(docSnap => {
      result[dateKey][docSnap.id] = docSnap.data().count || 0;
    });
    return result;
  } catch (e) {
    console.warn("Firebase 불러오기 오류:", e);
    return { [dateKey]: {} };
  }
}
