import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: Replace the following with your app's Firebase project configuration
// You can get this from your Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyCQEEHzmgIKf16RDy8RkjvBDzneGhVoL0M",
  authDomain: "csi-hackdays.firebaseapp.com",
  projectId: "csi-hackdays",
  storageBucket: "csi-hackdays.firebasestorage.app",
  messagingSenderId: "941589432501",
  appId: "1:941589432501:web:6c4dff306f0170faa9d6fc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
