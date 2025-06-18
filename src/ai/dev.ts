
// IMPORTANT: Load environment variables from .env.local for the Genkit server process
import dotenv from 'dotenv';

console.log('>>> [Genkit Server] Starting src/ai/dev.ts...');
console.log('>>> [Genkit Server] Attempting to initialize dotenv to load .env.local...');

try {
  // Assuming the script 'npm run genkit:dev' (which runs this file via tsx)
  // is executed from the project root.
  // So, '.env.local' should be relative to the Current Working Directory (CWD).
  const envConfigPath = '.env.local';
  console.log(`>>> [Genkit Server] Telling dotenv to load configuration from: "${envConfigPath}" (relative to CWD)`);
  const loadEnvResult = dotenv.config({ path: envConfigPath });

  if (loadEnvResult.error) {
    console.error('!!! [Genkit Server] dotenv.config() reported an error:');
    console.error('!!! Error details:', loadEnvResult.error);
    // It's possible the script might continue if only dotenv.config() fails to find the file,
    // but Firebase init will likely fail later due to missing env vars.
  } else {
    console.log('>>> [Genkit Server] dotenv.config() executed.');
    if (loadEnvResult.parsed && Object.keys(loadEnvResult.parsed).length > 0) {
      console.log(`>>> [Genkit Server] Variables parsed by dotenv from "${envConfigPath}": ${Object.keys(loadEnvResult.parsed).length} variable(s) loaded.`);
      // Optionally log keys: console.log(Object.keys(loadEnvResult.parsed).join(', '));
    } else if (loadEnvResult.parsed) {
      console.log(`>>> [Genkit Server] dotenv.config() parsed the file "${envConfigPath}" but found 0 variables. Is the file empty or only comments?`);
    } else {
      // This case might not be hit if .error is set, but good for completeness
      console.warn(`>>> [Genkit Server] dotenv.config() did not parse any variables from "${envConfigPath}", but also did not report an error. This is unusual.`);
    }

    // Explicitly check for the critical Firebase API key
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      console.log('>>> [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is SET in process.env.');
      console.log('>>> [Genkit Server] First 5 chars of API Key from process.env:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5));
    } else {
      console.error('!!! [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is NOT SET in process.env after dotenv.config() attempt. !!!');
      console.error('!!! This is a critical issue if Firebase initialization fails due to a missing API key.');
    }
  }
} catch (e) {
  console.error('!!! [Genkit Server] CRITICAL ERROR during dotenv.config() or related setup in src/ai/dev.ts:');
  // Log the error object directly to see more details if possible
  if (e instanceof Error) {
    console.error('!!! Error Message:', e.message);
    console.error('!!! Error Stack:', e.stack);
  } else {
    console.error('!!! Caught non-Error object:', e);
  }
  console.error('!!! This indicates a fundamental problem with loading environment variables or an early script error.');
  // Depending on the severity, you might want to re-throw or process.exit(1)
  // For now, we'll let it try to continue to see if other logs appear.
}

// Flows will be imported for their side effects in this file.
// These imports MUST happen AFTER dotenv.config() has run and populated process.env.
// If clientApp.ts (imported by flows via data.ts) runs before this, it won't see the env vars.
console.log('>>> [Genkit Server] Proceeding to import flows (AFTER dotenv attempt)...');
import './flows/sync-billetweb-participants-flow';
// If you have other flows, import them here as well.
console.log('>>> [Genkit Server] Flow imports complete.');
