// firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyAvUePNjiKhiFePN5PY4yOqwgIHy8F_few",
  authDomain: "sistema-cristo-felix-2.firebaseapp.com",
  projectId: "sistema-cristo-felix-2",
  storageBucket: "sistema-cristo-felix-2.firebasestorage.app",
  messagingSenderId: "897774362587",
  appId: "1:897774362587:web:2221e7a21148d3cf3711fe",
  measurementId: "G-L8PPVC98S6"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
