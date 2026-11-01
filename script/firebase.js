import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA4HuehDiaHafRt-7ua2KatQCJ5pyd5dRU",
  authDomain: "catsocial-3c3c9.firebaseapp.com",
  projectId: "catsocial-3c3c9",
  storageBucket: "catsocial-3c3c9.firebasestorage.app",
  messagingSenderId: "779081939069",
  appId: "1:779081939069:web:e4c1c74e2ba6a76f851914",
  measurementId: "G-ND65W8NPF0"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
};
