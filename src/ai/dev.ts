
// IMPORTANT: Attempt to load .env.local variables as the VERY FIRST step.
import dotenv from 'dotenv';
import path from 'path';

console.log('>>> [Genkit Server] Attempting to configure dotenv...');
const envPath = path.resolve(process.cwd(), '.env.local');
const dotenvResult = dotenv.config({ path: envPath, override: true }); // override: true can be useful

if (dotenvResult.error) {
  console.error(`!!! [Genkit Server] ERROR loading .env.local from ${envPath}:`, dotenvResult.error);
} else {
  if (dotenvResult.parsed) {
    console.log(`>>> [Genkit Server] Successfully parsed .env.local. ${Object.keys(dotenvResult.parsed).length} variable(s) loaded by dotenv.`);
    // Optionally log loaded keys (not values) for privacy if needed for debugging:
    // console.log('>>> [Genkit Server] Keys loaded by dotenv:', Object.keys(dotenvResult.parsed).join(', '));
  } else {
    console.warn(`>>> [Genkit Server] dotenv.config() ran for ${envPath} but returned no parsed variables. This might indicate an empty or incorrectly formatted .env.local file or encoding issues (ensure UTF-8 without BOM).`);
  }
}

// Check if critical Firebase environment variables are set AFTER explicit dotenv call
if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.log('>>> [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is SET in Genkit process. First 5 chars:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5));
} else {
  console.error('!!! [Genkit Server] CRITICAL: NEXT_PUBLIC_FIREBASE_API_KEY is NOT SET in Genkit process AFTER explicit dotenv call. Firebase initialization will likely fail.');
  console.error('!!! Ensure .env.local exists at project root, is correctly formatted (UTF-8, no BOM), and contains the Firebase variables.');
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
