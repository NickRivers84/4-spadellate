import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

const firebaseConfig = {

apiKey: "AIzaSyBJOyV4Udbpb2kGfPs3AUSHDWuVJfKfkj4",
authDomain: "spadellate.firebaseapp.com",
projectId: "spadellate",
storageBucket: "spadellate.firebasestorage.app",
messagingSenderId: "427173015074",
appId: "1:427173015074:web:f83cf72d76af893c96a47b"

}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)

export const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()
