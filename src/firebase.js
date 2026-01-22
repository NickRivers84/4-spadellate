import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA-qPCcU4SRory8-2elykexJsBYfOXaL-s",
  authDomain: "spadellate.web.app",
  projectId: "spadellate",
  storageBucket: "spadellate.firebasestorage.app",
  messagingSenderId: "427173015074",
  appId: "1:427173015074:web:683a00d1e000b06c96a47b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// persistenza login (resta loggato)
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const db = getFirestore(app);
