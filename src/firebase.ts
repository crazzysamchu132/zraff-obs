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

// Configuration loaded directly from firebase-applet-config.json for bulletproof reliability
const firebaseConfig = {
  projectId: "amiable-card-6wrl4",
  appId: "1:565471010242:web:dea73a69f8d8d8aa624a5b",
  apiKey: "AIzaSyDMEPAYEBCpNoAwyf3Uy9xIRyIq8zzctUQ",
  authDomain: "amiable-card-6wrl4.firebaseapp.com",
  storageBucket: "amiable-card-6wrl4.firebasestorage.app",
  messagingSenderId: "565471010242"
};

const databaseId = "ai-studio-d848d1b6-20bf-4f6a-8f59-7111180e1d3d";

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId since we are using a provisioned database
export const db = getFirestore(app, databaseId);

export const auth = getAuth(app);

// Enable persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});
