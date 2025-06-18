// IMPORTANT: Load environment variables from .env.local for the Genkit server process
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' }); // Adjust path if your .env.local is elsewhere relative to this file

// Flows will be imported for their side effects in this file.
// Ensure these imports happen AFTER dotenv.config()
import './flows/sync-billetweb-participants-flow';
