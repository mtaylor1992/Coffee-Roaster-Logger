// firebase/firebase-config.js

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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
