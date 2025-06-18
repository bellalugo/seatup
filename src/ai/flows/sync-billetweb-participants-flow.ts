
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
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('!!! SERVER LOG: EXPORTED syncBilletwebParticipants CALLED !!!');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  return syncBilletwebParticipantsFlow(); // Call without arguments as inputSchema is z.void()
}

const syncBilletwebParticipantsFlow = ai.defineFlow(
  {
    name: 'syncBilletwebParticipantsFlow',
    inputSchema: z.void(), // Changed from z.undefined() to z.void() for flows with no input.
    outputSchema: SyncBilletwebParticipantsOutputSchema, // Use the unexported schema here
  },
  async () => { // This function takes no arguments, matching z.void()
    console.log('*****************************************************************');
    console.log('*** SERVER LOG: Genkit Flow "syncBilletwebParticipantsFlow" STARTED ***');
    console.log('*****************************************************************');
    try {
      console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: Démarrage de la récupération Billetweb...');
      let participants: Participant[] = [];
      try {
        participants = await getParticipantsFromBilletweb();
        console.log(`[SYNC_FLOW_DEBUG_SERVER] Flow: ${participants.length} participant(s) récupéré(s) de Billetweb.`);
        if (participants.length > 0) {
          console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: Premier participant récupéré (aperçu):', JSON.stringify(participants[0]));
        } else {
          console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: Aucun participant récupéré de Billetweb ou liste vide.');
        }
      } catch (billetwebError) {
        console.error('[SYNC_FLOW_DEBUG_SERVER] Flow Erreur: ÉCHEC de la récupération depuis BILLETWEB:', billetwebError);
        let errorMessage = 'Échec de la récupération des participants depuis Billetweb.';
        if (billetwebError instanceof Error) {
          errorMessage += ` Détails: ${billetwebError.message}`;
        }
        return { 
          message: errorMessage, 
          participantsSynced: 0,
          error: errorMessage 
        };
      }
      
      if (!participants || participants.length === 0) {
        console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: Aucun participant trouvé sur Billetweb (après try-catch Billetweb). Traitement arrêté avant sauvegarde.');
        return { message: 'Aucun participant trouvé sur Billetweb ou erreur lors de la récupération. Aucune sauvegarde tentée.', participantsSynced: 0 };
      }

      console.log(`[SYNC_FLOW_DEBUG_SERVER] Flow: Tentative de sauvegarde de ${participants.length} participant(s) dans Firestore...`);
      await saveParticipants(participants);
      console.log('[SYNC_FLOW_DEBUG_SERVER] Flow: Sauvegarde terminée avec succès (selon saveParticipants).');
      
      return { 
        message: `${participants.length} participant(s) synchronisé(s) avec succès depuis Billetweb.`, 
        participantsSynced: participants.length 
      };
    } catch (error) {
      console.error('[SYNC_FLOW_DEBUG_SERVER] Flow Erreur (globale Catch): Échec de la synchronisation des participants Billetweb:', error);
      let errorMessage = 'Échec de la synchronisation des participants Billetweb (erreur globale dans le flux).';
      if (error instanceof Error) {
        errorMessage += ` Détails: ${error.message}`;
      }
      return { 
        message: errorMessage, 
        participantsSynced: 0,
        error: errorMessage 
      };
    }
  }
);
