import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA-qPCcU4SRory8-2elykexJsBYfOXaL-s",
  authDomain: "spadellate.firebaseapp.com",
  projectId: "spadellate",
  storageBucket: "spadellate.firebasestorage.app",
  messagingSenderId: "427173015074",
  appId: "1:427173015074:web:683a00d1e000b06c96a47b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
