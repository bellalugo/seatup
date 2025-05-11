import type { TicketType, Participant } from '@/lib/types';

/**
 * Represents a ticket retrieved from Billetweb (or mock).
 */
export interface TicketInfo {
  /**
   * The ticket id.
   */
  id: string;
  /**
   * The ticket type (e.g., Strategist, Marshal, General).
   */
  type: TicketType;
}

/**
 * Asynchronously retrieves ticket information for a user.
 * THIS IS CURRENTLY A MOCK.
 *
 * @param userId The ID of the user.
 * @returns A promise that resolves to a TicketInfo object or null if not found/valid.
 */
export async function getTicketInfo(userId: string): Promise<TicketInfo | null> {
  // TODO: Implement this by calling the Billetweb API using the userId
  //       or some other identifier linked to the Billetweb purchase.

  console.log(`Fetching ticket info for user: ${userId}`); // Placeholder log

  // --- MOCK IMPLEMENTATION ---
  // Simulate fetching based on userId from our mock users
  const { mockUsers } = await import('@/lib/data'); // Import dynamically if needed or move mock data access
  const user = mockUsers[userId];

  if (user && user.ticketType !== 'Aucun') { // Corrected from 'None' to 'Aucun'
     // Simulate finding a valid ticket
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    return {
      id: `bw-${userId}-${Math.random().toString(16).substring(2, 8)}`, // Generate a mock Billetweb ID
      type: user.ticketType,
    };
  } else {
    // Simulate user not found or has no valid ticket
    await new Promise(resolve => setTimeout(resolve, 50));
    return null;
  }
  // --- END MOCK IMPLEMENTATION ---
}


/**
 * Asynchronously retrieves a list of participants from Billetweb.
 * THIS IS CURRENTLY A MOCK.
 *
 * @returns A promise that resolves to an array of Participant objects.
 */
export async function getParticipantsFromBilletweb(): Promise<Participant[]> {
  console.log('Mock: Récupération des participants depuis Billetweb...');
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

  // TODO: Replace with actual API call to Billetweb
  // This mock data should match the Participant type
  const mockParticipants: Participant[] = [
    {
      id: 'bw-participant-1', // Unique ID from Billetweb
      nom: 'Dupont',
      prenom: 'Jean',
      email: 'jean.dupont@example.com',
      typeBillet: 'Stratège',
    },
    {
      id: 'bw-participant-2',
      nom: 'Martin',
      prenom: 'Sophie',
      email: 'sophie.martin@example.com',
      typeBillet: 'Maréchal',
    },
    {
      id: 'bw-participant-3',
      nom: 'Bernard',
      prenom: 'Luc',
      email: 'luc.bernard@example.com',
      typeBillet: 'Général',
    },
     {
      id: 'bw-participant-4',
      nom: 'Petit',
      prenom: 'Alice',
      email: 'alice.petit@example.com',
      typeBillet: 'Stratège',
    },
    {
      id: 'user-456', // Example matching an existing mockUser for testing
      nom: 'Bob (Maréchal)',
      prenom: '',
      email: 'bob.marechal@example.com',
      typeBillet: 'Maréchal',
    }
  ];
  console.log(`Mock: ${mockParticipants.length} participants récupérés.`);
  return mockParticipants;
}
