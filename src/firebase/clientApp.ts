
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth'; // Import onAuthStateChanged
// Add other Firebase services like Firestore if needed:
import { getFirestore, type Firestore } from 'firebase/firestore';


// --- IMPORTANT ---
// Assurez-vous que la configuration de votre projet Firebase est correctement définie dans un fichier `.env.local`
// à la racine de votre projet (créez ce fichier s'il n'existe pas).
// Le nom du fichier DOIT être EXACTEMENT `.env.local`.
// Vous devez définir les variables suivantes :
//
// NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
// NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
// NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID (Optional)
//
// You can find these values in your Firebase project settings:
// Project settings > General > Your apps > Web app > SDK setup and configuration > Config
//
// **ERROR 'auth/api-key-not-valid' or 'auth/invalid-api-key':**
// This error almost always means the `NEXT_PUBLIC_FIREBASE_API_KEY` is missing,
// incorrect, or the environment variable is not being loaded correctly.
// Double-check your `.env.local` file (ensure the filename is exactly `.env.local`)
// and restart your Next.js development server after creating or modifying it (`npm run dev` or equivalent).
// --- --- --- ---

// Ensure environment variables are loaded correctly
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Log a preview of the config being used by initializeApp
// Côté serveur (Genkit), cela s'affichera dans le terminal du serveur Genkit.
// Côté client (Navigateur), cela s'affichera dans la console du navigateur.
if (typeof window === 'undefined') { // S'exécute côté serveur
  console.log('>>> [Firebase clientApp.ts - SERVER Context] Attempting to initialize Firebase with Project ID:', firebaseConfig.projectId);
  if (firebaseConfig.projectId === 'asynconv-sit' && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'asynconv-sit') {
    console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.warn("!!! CRITICAL CONFIG WARNING: Firebase clientApp.ts is initializing with Project ID 'asynconv-sit'. !!!");
    console.warn("!!! You previously indicated 'asynconv-sit-cbgwf' is the correct project.                        !!!");
    console.warn("!!! PLEASE URGENTLY VERIFY your .env.local file:                                                 !!!");
    console.warn("!!!   - Ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID is set to 'asynconv-sit-cbgwf'.                   !!!");
    console.warn("!!!   - Ensure ALL other NEXT_PUBLIC_FIREBASE_... variables match 'asynconv-sit-cbgwf'.          !!!");
    console.warn("!!! After correcting .env.local, RESTART your Next.js development server.                        !!!");
    console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  }
  console.log('>>> [Firebase clientApp.ts - SERVER Context] Full effective config for initializeApp:',
    JSON.stringify({
      apiKeyExists: !!firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
      measurementId: firebaseConfig.measurementId,
      apiKeyFirst5: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0,5) : 'MANQUANT'
    }, null, 2)
  );
} else { // S'exécute côté client
   console.log('>>> [Firebase clientApp.ts - CLIENT Context] Config for initializeApp (from ' + window.location.hostname + '):',
    JSON.stringify({
      apiKeyExists: !!firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      apiKeyFirst5: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0,5) : 'MANQUANT'
    }, null, 2)
  );
}


// Basic validation to help catch missing env vars during development
if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId
   ) {
     console.error(
       "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n" +
       "!!! CRITICAL FIREBASE CONFIG ERROR (clientApp.ts): Firebase environment variables are MISSING or INCOMPLETE.     !!!\n" +
       "!!! Ensure NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID  !!!\n" +
       "!!! are correctly set in your `.env.local` file.                                                                 !!!\n" +
       "!!! The filename MUST be exactly `.env.local` (NOT `.env`, etc.).                                                !!!\n" +
       "!!! RESTART your Next.js development server (e.g., `npm run dev`) AFTER creating or modifying `.env.local`.      !!!\n" +
       "!!! Without these, Firebase services (Auth, Firestore) WILL FAIL.                                                !!!\n" +
       "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
     );
}


// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log(">>> [Firebase clientApp.ts] Firebase App INITIALIZED successfully.");
  } catch (e) {
    console.error("!!! [Firebase clientApp.ts] CRITICAL ERROR during initializeApp:", e);
    console.error("!!! This often means your `firebaseConfig` (from .env.local) is malformed or missing critical values like apiKey or projectId.");
    // Fallback or rethrow, depending on how you want to handle total failure
    throw e; 
  }
} else {
  app = getApp(); // if already initialized, use that one
  console.log(">>> [Firebase clientApp.ts] Firebase App already initialized, Re-using existing instance.");
}

let auth: Auth;
try {
  auth = getAuth(app);
  console.log(">>> [Firebase clientApp.ts] Firebase Auth instance CREATED successfully.");
} catch (e) {
  console.error("!!! [Firebase clientApp.ts] CRITICAL ERROR during getAuth(app):", e);
  console.error("!!! This can happen if Firebase App initialization failed or if Auth service is misconfigured.");
  throw e;
}


let db: Firestore | null = null;
try {
    db = getFirestore(app);
    console.log(">>> [Firebase clientApp.ts] Firestore DB instance CREATED successfully.");
} catch (error) {
    console.error("!!! [Firebase clientApp.ts] CRITICAL ERROR during getFirestore(app):", error);
    console.error("!!! This usually means Firebase App initialization failed or Firestore is not enabled/configured for the project.");
    // db will remain null, functions using it should check for nullity or this will throw later.
}

// Log auth state on client side after app is initialized
if (typeof window !== 'undefined') {
  if (auth) { // Only set up listener if auth instance was successfully created
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('>>> [Firebase clientApp.ts - CLIENT onAuthStateChanged] User IS authenticated on client:', user.uid, user.email);
      } else {
        console.log('>>> [Firebase clientApp.ts - CLIENT onAuthStateChanged] User is NOT authenticated on client.');
      }
    });
  } else {
    console.error("!!! [Firebase clientApp.ts - CLIENT] Cannot set up onAuthStateChanged listener because Firebase Auth instance is NOT available!");
  }
}


export { app, auth, db };

