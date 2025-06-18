
// IMPORTANT: Attempt to load .env.local variables as the VERY FIRST step.
import dotenv from 'dotenv';
import path from 'path';

let dotenvLoadedSuccessfully = false;
let firebaseApiKeyIsSet = false;
let billetwebUserIsSet = false;

try {
  console.log('>>> [Genkit Server] src/ai/dev.ts: TOP OF FILE - Attempting to configure dotenv...');
  const envPath = path.resolve(process.cwd(), '.env.local');
  console.log(`>>> [Genkit Server] src/ai/dev.ts: Targeting .env.local path: ${envPath}`);
  
  if (require('fs').existsSync(envPath)) {
    console.log(`>>> [Genkit Server] src/ai/dev.ts: .env.local file EXISTS at ${envPath}.`);
  } else {
    console.warn(`!!! [Genkit Server] src/ai/dev.ts: .env.local file NOT FOUND at ${envPath}. This is a critical issue. !!!`);
  }

  const dotenvResult = dotenv.config({ path: envPath, override: true, debug: process.env.NODE_ENV !== 'production' });

  if (dotenvResult.error) {
    console.error(`!!! [Genkit Server] src/ai/dev.ts: ERROR loading .env.local from ${envPath}:`, dotenvResult.error);
    throw dotenvResult.error; // Re-throw to make failure explicit if needed by calling context
  } else {
    if (dotenvResult.parsed) {
      console.log(`>>> [Genkit Server] src/ai/dev.ts: Successfully parsed .env.local. ${Object.keys(dotenvResult.parsed).length} variable(s) loaded by dotenv.`);
      console.log('>>> [Genkit Server] src/ai/dev.ts: Loaded keys:', Object.keys(dotenvResult.parsed).join(', '));
      dotenvLoadedSuccessfully = true;
    } else {
      console.warn(`>>> [Genkit Server] src/ai/dev.ts: dotenv.config() ran for ${envPath} but returned no parsed variables. This might indicate an empty or incorrectly formatted .env.local file or encoding issues (ensure UTF-8 without BOM).`);
    }
  }
} catch (e) {
    console.error('!!! [Genkit Server] src/ai/dev.ts: CRITICAL ERROR during dotenv setup:', e);
}

// Check critical Firebase environment variables AFTER explicit dotenv call attempt
if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.log('>>> [Genkit Server] src/ai/dev.ts: NEXT_PUBLIC_FIREBASE_API_KEY is SET. First 5 chars:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5));
  firebaseApiKeyIsSet = true;
} else {
  console.error('!!! [Genkit Server] src/ai/dev.ts: CRITICAL: NEXT_PUBLIC_FIREBASE_API_KEY is NOT SET in Genkit process AFTER explicit dotenv call. Firebase initialization will likely fail.');
}

if (process.env.BILLETWEB_USER) {
  console.log('>>> [Genkit Server] src/ai/dev.ts: BILLETWEB_USER is SET.');
  billetwebUserIsSet = true;
} else {
  console.warn('>>> [Genkit Server] src/ai/dev.ts: BILLETWEB_USER is NOT SET. Billetweb API calls will fail or use fallback logic.');
}

console.log(`>>> [Genkit Server] src/ai/dev.ts: Dotenv load status: ${dotenvLoadedSuccessfully}, Firebase API Key status: ${firebaseApiKeyIsSet}, Billetweb User status: ${billetwebUserIsSet}`);

// Flows will be imported for their side effects in this file.
// These imports MUST happen AFTER environment variables are expected to be available.
console.log('>>> [Genkit Server] src/ai/dev.ts: Proceeding to import flows (which might initialize Firebase)...');
import './flows/sync-billetweb-participants-flow';
// If you have other flows, import them here as well.
console.log('>>> [Genkit Server] src/ai/dev.ts: Flow imports complete.');
console.log('>>> [Genkit Server] src/ai/dev.ts: finished initial setup execution.');
