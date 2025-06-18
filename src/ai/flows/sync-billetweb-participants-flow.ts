
'use server';
/**
 * @fileOverview Flow to synchronize Billetweb participants with Firestore.
 *
 * - syncBilletwebParticipants - Fetches participants from Billetweb and saves them to Firestore.
 * - SyncBilletwebParticipantsOutput - The return type for the syncBilletwebParticipants function.
 */

import { ai } from '@/ai/ai-instance'; // Corrected import for ai instance
import { z } from 'genkit';
import { getParticipantsFromBilletweb } from '@/services/billetweb';
import { saveParticipants } from '@/lib/data';
import type { Participant } from '@/lib/types';

// Define the Zod schema but do not export it directly
const SyncBilletwebParticipantsOutputSchema = z.object({
  message: z.string().describe('A message indicating the result of the synchronization.'),
  participantsSynced: z.number().describe('Number of participants successfully synced.'),
  error: z.string().optional().describe('Error message if synchronization failed.'),
});

// Export the TypeScript type inferred from the Zod schema
export type SyncBilletwebParticipantsOutput = z.infer<typeof SyncBilletwebParticipantsOutputSchema>;

// Export the async wrapper function
export async function syncBilletwebParticipants(): Promise<SyncBilletwebParticipantsOutput> {
  console.log('SERVER LOG: Exported async wrapper function "syncBilletwebParticipants" CALLED.');
  return syncBilletwebParticipantsFlow(); // Call without arguments as inputSchema is z.void()
}

const syncBilletwebParticipantsFlow = ai.defineFlow(
  {
    name: 'syncBilletwebParticipantsFlow',
    inputSchema: z.void(), // Changed from z.undefined() to z.void() for flows with no input.
    outputSchema: SyncBilletwebParticipantsOutputSchema, // Use the unexported schema here
  },
  async () => { // This function takes no arguments, matching z.void()
    console.log('SERVER LOG: Genkit Flow "syncBilletwebParticipantsFlow" STARTED (called from exported wrapper).');
    try {
      console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: Attempting Billetweb fetch...');
      let participants: Participant[] = [];
      try {
        participants = await getParticipantsFromBilletweb();
        console.log(`[SYNC_FLOW_DEBUG_SERVER] Flow: ${participants.length} participant(s) fetched from Billetweb.`);
        if (participants.length > 0) {
          console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: First participant fetched (preview):', JSON.stringify(participants[0]));
        } else {
          console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: No participants fetched from Billetweb or empty list.');
        }
      } catch (billetwebError) {
        console.error('[SYNC_FLOW_DEBUG_SERVER] Flow Error: FAILED to fetch from BILLETWEB:', billetwebError);
        let errorMessage = 'Failed to fetch participants from Billetweb.';
        if (billetwebError instanceof Error) {
          errorMessage += ` Details: ${billetwebError.message}`;
        }
        return { 
          message: errorMessage, 
          participantsSynced: 0,
          error: errorMessage 
        };
      }
      
      if (!participants || participants.length === 0) {
        console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: No participants found on Billetweb (after Billetweb try-catch). Stopping before save attempt.');
        return { message: 'No participants found on Billetweb or error during fetch. No save attempted.', participantsSynced: 0 };
      }

      console.log(`[SYNC_FLOW_DEBUG_SERVER] Flow: Attempting to save ${participants.length} participant(s) to Firestore...`);
      await saveParticipants(participants);
      console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: Save completed successfully (according to saveParticipants).');
      
      return { 
        message: `${participants.length} participant(s) synced successfully from Billetweb.`, 
        participantsSynced: participants.length 
      };
    } catch (error) {
      console.error('[SYNC_FLOW_DEBUG_SERVER] Flow Error (Global Catch): Failed to sync Billetweb participants:', error);
      let errorMessage = 'Failed to sync Billetweb participants (global error in flow).';
      if (error instanceof Error) {
        errorMessage += ` Details: ${error.message}`;
      }
      return { 
        message: errorMessage, 
        participantsSynced: 0,
        error: errorMessage 
      };
    }
  }
);

