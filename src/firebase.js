// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ I TUOI VALORI REALI (li hai già)
const firebaseConfig = {
  apiKey: "AIzaSyA-qPCcU4SRory8-2elykexJsBYfOXaL-s",
  authDomain: "spadellate.firebaseapp.com",
  projectId: "spadellate",
  storageBucket: "spadellate.firebasestorage.app",
  messagingSenderId: "427173015074",
  appId: "1:427173015074:web:683a00d1e000b06c96a47b",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Provider Google (riutilizzalo in App.jsx)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// ✅ Persistenza robusta: local → se fallisce (Incognito) → session
(async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log("[auth] persistence = local");
  } catch (e) {
    try {
      await setPersistence(auth, browserSessionPersistence);
      console.log("[auth] persistence = session (fallback)");
    } catch (e2) {
      console.warn("[auth] persistence fallback failed", e2);
    }
  }
})();
