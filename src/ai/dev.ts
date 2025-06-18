
// IMPORTANT: Load environment variables from .env.local for the Genkit server process
import dotenv from 'dotenv';

console.log('>>> [Genkit Server] Starting src/ai/dev.ts...');
console.log('>>> [Genkit Server] Current Working Directory (CWD):', process.cwd());

try {
  const envConfigPath = '.env.local'; // Assuming .env.local is in the CWD (project root)
  console.log(`>>> [Genkit Server] Attempting to load .env.local from path: ${process.cwd()}/${envConfigPath}`);
  
  // To verify file existence (optional, Node.js specific, might not work in all tsx environments)
  try {
    const fs = require('fs');
    if (fs.existsSync(envConfigPath)) {
      console.log(`>>> [Genkit Server] .env.local file EXISTS at ${process.cwd()}/${envConfigPath}.`);
    } else {
      console.warn(`>>> [Genkit Server] .env.local file DOES NOT EXIST at ${process.cwd()}/${envConfigPath}.`);
    }
  } catch (fe) {
    console.warn(`>>> [Genkit Server] Could not check .env.local file existence: ${(fe as Error).message}`);
  }

  const loadEnvResult = dotenv.config({ path: envConfigPath });

  if (loadEnvResult.error) {
    console.error('!!! [Genkit Server] dotenv.config() reported an error:');
    console.error('!!! Error details:', loadEnvResult.error);
  } else {
    console.log('>>> [Genkit Server] dotenv.config() executed.');
    if (loadEnvResult.parsed && Object.keys(loadEnvResult.parsed).length > 0) {
      console.log(`>>> [Genkit Server] Variables parsed by dotenv from "${envConfigPath}": ${Object.keys(loadEnvResult.parsed).length} variable(s) loaded.`);
      // console.log('>>> [Genkit Server] Loaded variable keys:', Object.keys(loadEnvResult.parsed).join(', '));
    } else if (loadEnvResult.parsed) {
      console.warn(`>>> [Genkit Server] dotenv.config() parsed the file "${envConfigPath}" but found 0 variables. Is the file empty, incorrectly formatted, or has encoding issues (e.g., UTF-8 with BOM)?`);
    } else {
      console.warn(`>>> [Genkit Server] dotenv.config() did not parse any variables from "${envConfigPath}", but also did not report an error. This is unusual.`);
    }

    // Explicit check for NEXT_PUBLIC_FIREBASE_API_KEY
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      console.log('>>> [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is SET in Genkit process. First 5 chars:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5));
    } else {
      console.error('!!! [Genkit Server] NEXT_PUBLIC_FIREBASE_API_KEY is NOT SET in Genkit process after dotenv.config() attempt. !!!');
    }
    // Explicit check for BILLETWEB_USER
     if (process.env.BILLETWEB_USER) {
      console.log('>>> [Genkit Server] BILLETWEB_USER is SET.');
    } else {
      console.warn('>>> [Genkit Server] BILLETWEB_USER is NOT SET.');
    }
  }
} catch (e) {
  console.error('!!! [Genkit Server] CRITICAL ERROR during dotenv.config() or related setup in src/ai/dev.ts:');
  if (e instanceof Error) {
    console.error('!!! Error Message:', e.message);
    console.error('!!! Error Stack:', e.stack);
  } else {
    console.error('!!! Caught non-Error object:', e);
  }
}

// Flows will be imported for their side effects in this file.
// These imports MUST happen AFTER dotenv.config() has run and populated process.env.
console.log('>>> [Genkit Server] Proceeding to import flows (AFTER dotenv attempt)...');
import './flows/sync-billetweb-participants-flow';
// If you have other flows, import them here as well.
console.log('>>> [Genkit Server] Flow imports complete.');
console.log('>>> [Genkit Server] src/ai/dev.ts finished execution (initial setup).');
