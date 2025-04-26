import type { TicketType } from '@/lib/types';

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

  if (user && user.ticketType !== 'None') {
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
