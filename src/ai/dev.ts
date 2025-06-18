
// IMPORTANT: Load environment variables from .env.local for the Genkit server process
import dotenv from 'dotenv';
import path from 'path'; // Using import for path module

// Construct the absolute path to .env.local relative to this file's directory
// __dirname is the directory of the current module (src/ai/)
// ../../ moves up two levels to the project root
const envPath = path.resolve(__dirname, '../../.env.local');

console.log('>>> [Genkit Server] Attempting to load .env.local from path:', envPath);
const loadEnvResult = dotenv.config({ path: envPath });

if (loadEnvResult.error) {
  console.error('!!! [Genkit Server] ERROR LOADING .env.local !!!');
  console.error('!!! Error details:', loadEnvResult.error);
  console.error('!!! Please ensure .env.local exists at the project root and is readable.');
} else {
  console.log('>>> [Genkit Server] Successfully processed .env.local.');
  if (loadEnvResult.parsed) {
    // console.log('>>> Variables parsed from .env.local:', Object.keys(loadEnvResult.parsed));
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.log('>>> [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is SET in Genkit process.');
    // console.log('>>> First 5 chars of API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5));
  } else {
    console.error('!!! [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is NOT SET in Genkit process after dotenv.config() !!!');
  }
}

// Flows will be imported for their side effects in this file.
// These imports MUST happen AFTER dotenv.config() has run and populated process.env.
// If clientApp.ts (imported by flows via data.ts) runs before this, it won't see the env vars.
console.log('>>> [Genkit Server] Proceeding to import flows...');
import './flows/sync-billetweb-participants-flow';
// If you have other flows, import them here as well.
console.log('>>> [Genkit Server] Flow imports complete.');
