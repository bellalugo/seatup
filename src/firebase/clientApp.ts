
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
// Add other Firebase services like Firestore if needed:
import { getFirestore } from 'firebase/firestore';


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
  // THE USER CONFIRMED 'asynconv-sit-cbgwf' IS THE CORRECT PROJECT ID.
  // The log showed 'asynconv-sit' was being used.
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
     console.warn(
       "AVERTISSEMENT CONFIGURATION FIREBASE INCOMPLÈTE : Les variables d'environnement Firebase sont manquantes ou incomplètes. " +
       "Veuillez vous assurer que NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, " +
       "et NEXT_PUBLIC_FIREBASE_PROJECT_ID sont définis dans votre fichier `.env.local`. " +
       "IMPORTANT : Assurez-vous que le nom du fichier est exactement `.env.local` (et non `.env` ou autre). " +
       "Redémarrez votre serveur de développement Next.js (npm run dev) après avoir créé ou modifié le fichier .env.local. " +
       "Sans cela, les fonctionnalités Firebase (y compris Firestore) ne fonctionneront pas correctement et des erreurs de connexion se produiront."
     );
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // console.log("Firebase App initialisée.");
} else {
  app = getApp(); // if already initialized, use that one
  // console.log("Firebase App déjà initialisée, récupération de l'instance existante.");
}

const auth = getAuth(app);
let db: ReturnType<typeof getFirestore> | null = null;

try {
    db = getFirestore(app); // Initialize Firestore
    // console.log("Firestore DB instance initialisée.");
} catch (error) {
    console.error("ERREUR CRITIQUE lors de l'initialisation de Firestore:", error);
    console.error("Cela signifie probablement que la configuration Firebase (apiKey, projectId) est incorrecte ou manquante dans .env.local (vérifiez le nom du fichier et son contenu). Veuillez vérifier et redémarrer le serveur.");
    // db restera null, les fonctions qui l'utilisent devraient vérifier sa nullité.
}

// Log auth state on client side after app is initialized
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('>>> [Firebase clientApp.ts - CLIENT onAuthStateChanged] User IS authenticated on client:', user.uid, user.email);
    } else {
      console.log('>>> [Firebase clientApp.ts - CLIENT onAuthStateChanged] User is NOT authenticated on client.');
    }
  });
}


export { app, auth, db };

