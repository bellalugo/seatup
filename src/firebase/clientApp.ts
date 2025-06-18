
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Add other Firebase services like Firestore if needed:
import { getFirestore } from 'firebase/firestore';


// --- IMPORTANT ---
// Assurez-vous que la configuration de votre projet Firebase est correctement définie dans un fichier `.env.local`
// à la racine de votre projet (créez ce fichier s'il n'existe pas).
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
} else {
    console.log("Configuration Firebase chargée depuis les variables d'environnement:", {
        apiKeyPreview: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 5)}...` : 'MANQUANT!',
        authDomain: firebaseConfig.authDomain ? 'Présent' : 'MANQUANT!',
        projectId: firebaseConfig.projectId ? 'Présent' : 'MANQUANT!',
    });
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase App initialisée.");
} else {
  app = getApp(); // if already initialized, use that one
  console.log("Firebase App déjà initialisée, récupération de l'instance existante.");
}

const auth = getAuth(app);
let db: ReturnType<typeof getFirestore> | null = null;

try {
    db = getFirestore(app); // Initialize Firestore
    console.log("Firestore DB instance initialisée.");
} catch (error) {
    console.error("ERREUR CRITIQUE lors de l'initialisation de Firestore:", error);
    console.error("Cela signifie probablement que la configuration Firebase (apiKey, projectId) est incorrecte ou manquante dans .env.local (vérifiez le nom du fichier et son contenu). Veuillez vérifier et redémarrer le serveur.");
    // db restera null, les fonctions qui l'utilisent devraient vérifier sa nullité.
}


export { app, auth, db };

