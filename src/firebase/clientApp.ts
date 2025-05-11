
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Add other Firebase services like Firestore if needed:
import { getFirestore } from 'firebase/firestore';


// --- IMPORTANT ---
// Ensure your Firebase project configuration is correctly set in a `.env.local` file
// at the root of your project (create this file if it doesn't exist).
// You need to define the following variables:
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
// Double-check your `.env.local` file and restart your Next.js development server
// after creating or modifying it (`npm run dev` or equivalent).
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
     console.warn( // Changed to console.warn to avoid breaking server-side rendering if an env var is temporarily missing during build.
       "Firebase configuration environment variables are missing or incomplete. " +
       "Please ensure NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, " +
       "and NEXT_PUBLIC_FIREBASE_PROJECT_ID are set in your .env.local file and " +
       "that the development server was restarted after the file was created or modified. " +
       "This might lead to Firebase features not working correctly."
     );
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // if already initialized, use that one
}

const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

export { app, auth, db };
