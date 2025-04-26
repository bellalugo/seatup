
import type React from 'react'; // Ensure React is imported for ElementType

export type TicketType = 'Strategist' | 'Marshal' | 'General' | 'None';

export interface User {
  id: string;
  name: string; // Added for display
  ticketType: TicketType;
}

export interface GameTable {
  id: string;
  gameName: string;
  day: 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  timeSlot: string; // e.g., "09:00 - 13:00"
  totalSeats: number;
  gameTypeIcon?: React.ElementType; // Optional icon component
}

/**
 * Type definition for the data collected from the add/edit table form.
 * Does not include 'id' as it's generated or comes from the edited item.
 * Uses icon name string for easier selection in the form.
 */
export interface GameTableInput {
    gameName: string;
    day: 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    timeSlot: string;
    totalSeats: number;
    gameTypeIconName?: string; // Use string name for form selection
}


export interface Registration {
  userId: string;
  tableId: string;
}

// Define registration phases based on ticket priority
export const registrationPhases: TicketType[] = ['Strategist', 'Marshal', 'General'];
