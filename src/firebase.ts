import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc,
  onSnapshot 
} from 'firebase/firestore';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';

// Configuration loaded directly from firebase-applet-config.json for bulletproof reliability, with optional support for custom Firebase overrides
const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyDMEPAYEBCpNoAwyf3Uy9xIRyIq8zzctUQ",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "amiable-card-6wrl4.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "amiable-card-6wrl4",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "amiable-card-6wrl4.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "565471010242",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:565471010242:web:dea73a69f8d8d8aa624a5b"
};

const databaseId = metaEnv.VITE_FIREBASE_DATABASE_ID || "ai-studio-d848d1b6-20bf-4f6a-8f59-7111180e1d3d";

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId if provided, or default database if using "(default)"
export const db = databaseId === "(default)" ? getFirestore(app) : getFirestore(app, databaseId);

export const auth = getAuth(app);

// Enable persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});
