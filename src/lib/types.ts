
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

export interface Registration {
  userId: string;
  tableId: string;
}

// Define registration phases based on ticket priority
export const registrationPhases: TicketType[] = ['Strategist', 'Marshal', 'General'];
