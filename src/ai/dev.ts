
// IMPORTANT: With `tsx -r dotenv/config` in package.json,
// environment variables from .env.local should be preloaded.
// The explicit dotenv.config() call here is no longer the primary method
// but can serve as a secondary check or for environments where preloading isn't used.

console.log('>>> [Genkit Server] Starting src/ai/dev.ts...');

// Check if critical Firebase environment variables are set
if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.log('>>> [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is SET in Genkit process. First 5 chars:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5));
} else {
  console.error('!!! [Genkit Server] CRITICAL: NEXT_PUBLIC_FIREBASE_API_KEY is NOT SET in Genkit process. Firebase initialization will likely fail.');
  console.error('!!! Ensure .env.local exists, is correctly formatted (UTF-8, no BOM), and contains the Firebase variables.');
  console.error('!!! Also verify that `tsx -r dotenv/config` is working as expected.');
}

if (process.env.BILLETWEB_USER) {
  console.log('>>> [Genkit Server] BILLETWEB_USER is SET.');
} else {
  console.warn('>>> [Genkit Server] BILLETWEB_USER is NOT SET. Billetweb API calls will fail or use fallback logic.');
}

// Flows will be imported for their side effects in this file.
// These imports MUST happen AFTER environment variables are expected to be available.
console.log('>>> [Genkit Server] Proceeding to import flows...');
import './flows/sync-billetweb-participants-flow';
// If you have other flows, import them here as well.
console.log('>>> [Genkit Server] Flow imports complete.');
console.log('>>> [Genkit Server] src/ai/dev.ts finished initial setup execution.');
