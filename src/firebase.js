import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configurazione copiata da Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBJOYV4Udbpb2kGfPs3AUSHDWuVJfKfKj4",
  authDomain: "spadellate.firebaseapp.com",
  projectId: "spadellate",
  storageBucket: "spadellate.firebasestorage.app",
  messagingSenderId: "427173015074",
  appId: "1:427173015074:web:f83cf72d76af893c96a47b",
};

// Inizializza l'app Firebase
const app = initializeApp(firebaseConfig);

// Export usati in App.jsx
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);