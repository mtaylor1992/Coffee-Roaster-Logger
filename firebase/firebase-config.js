// firebase/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKu1qGhJIjwvwbJGLMlEEIe50cQIA2XPo",
    authDomain: "coffee-roaster-logger.firebaseapp.com",
    projectId: "coffee-roaster-logger",
    storageBucket: "coffee-roaster-logger.firebasestorage.app",
    messagingSenderId: "922458358699",
    appId: "1:922458358699:web:64310ed204bd63bc28c8ee",
    measurementId: "G-R0BYYR1BE5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Initialize Firebase (for compatibility purposes)
 */
export function initializeFirebase() {
    // Additional Firebase initialization if needed
    console.log("Firebase initialized.");
}

export { app, db };
