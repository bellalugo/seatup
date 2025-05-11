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

export const SyncBilletwebParticipantsOutputSchema = z.object({
  message: z.string().describe('A message indicating the result of the synchronization.'),
  participantsSynced: z.number().describe('Number of participants successfully synced.'),
  error: z.string().optional().describe('Error message if synchronization failed.'),
});
export type SyncBilletwebParticipantsOutput = z.infer<typeof SyncBilletwebParticipantsOutputSchema>;

export async function syncBilletwebParticipants(): Promise<SyncBilletwebParticipantsOutput> {
  return syncBilletwebParticipantsFlow(undefined); // Pass undefined as input
}

const syncBilletwebParticipantsFlow = ai.defineFlow(
  {
    name: 'syncBilletwebParticipantsFlow',
    inputSchema: z.undefined(), // No specific input needed for this trigger
    outputSchema: SyncBilletwebParticipantsOutputSchema,
  },
  async () => {
    try {
      console.log('Flow: Démarrage de la synchronisation des participants Billetweb...');
      const participants: Participant[] = await getParticipantsFromBilletweb();
      
      if (!participants || participants.length === 0) {
        console.log('Flow: Aucun participant trouvé sur Billetweb ou erreur lors de la récupération.');
        return { message: 'Aucun participant trouvé sur Billetweb ou erreur lors de la récupération.', participantsSynced: 0 };
      }

      console.log(`Flow: ${participants.length} participant(s) récupéré(s) de Billetweb. Sauvegarde dans Firestore...`);
      await saveParticipants(participants);
      console.log('Flow: Sauvegarde terminée.');
      
      return { 
        message: `${participants.length} participant(s) synchronisé(s) avec succès depuis Billetweb.`, 
        participantsSynced: participants.length 
      };
    } catch (error) {
      console.error('Flow Erreur: Échec de la synchronisation des participants Billetweb:', error);
      let errorMessage = 'Échec de la synchronisation des participants Billetweb.';
      if (error instanceof Error) {
        errorMessage += ` Détails: ${error.message}`;
      }
      // It's often better to re-throw the error or ensure the outputSchema can represent errors.
      // For now, returning a message within the existing schema.
      return { 
        message: errorMessage, 
        participantsSynced: 0,
        error: errorMessage 
      };
    }
  }
);
